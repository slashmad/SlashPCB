from base64 import b64decode
import io
import json
import mmap
from pathlib import Path
import plistlib
import struct
import subprocess
import tarfile
import zipfile

from publish import api


def validate(packages, version, run):
    repo = run["head_repository"]["name"].lower()
    project_license = b64decode(api(f"contents/LICENSE?ref={run['head_sha']}")["content"])
    checks = []

    def verify_license(content, label):
        assert content.replace(b"\r\n", b"\n") == project_license, (label, "wrong packaged LICENSE")
        checks.append(f"{label}: packaged LICENSE matches the build commit")

    def asar_package(data, label):
        _, header_size, _, json_size = struct.unpack('<4I', data[:16])
        header = json.loads(data[16:16+json_size])
        entry = header['files']['package.json']
        offset = 8 + header_size + int(entry['offset'])
        package = json.loads(data[offset:offset+entry['size']])
        assert package['name'] == repo and package['version'] == version, (label, package)
        assert not any(name in header['files'] for name in ['AGENTS.md', 'AI_CONTEXT.md', 'docs']), label
        checks.append(f'{label}: packaged identity {repo} {version}')

    for p in packages.iterdir():
        name = p.name
        if name.endswith('.zip'):
            with zipfile.ZipFile(p) as z:
                assert z.testzip() is None, name
                asars = [n for n in z.namelist() if n.endswith('/resources/app.asar') or n == 'resources/app.asar' or n.endswith('/Resources/app.asar')]
                assert len(asars) == 1, (name, asars)
                asar_package(z.read(asars[0]), name)
                resources = asars[0].removesuffix('app.asar')
                verify_license(z.read(resources + 'LICENSE'), name)
                if '-mac-' in name:
                    infos = [n for n in z.namelist() if n.endswith('.app/Contents/Info.plist') and '/Contents/Frameworks/' not in n]
                    assert len(infos) == 1, infos
                    info = plistlib.loads(z.read(infos[0]))
                    assert info['CFBundleShortVersionString'] == version, info
                    binary = z.read(infos[0].rsplit('/',1)[0] + '/MacOS/' + info['CFBundleExecutable'])[:32]
                    assert binary[:4] == b'\xcf\xfa\xed\xfe' and struct.unpack_from('<I',binary,4)[0] == 0x100000c, name
                    checks.append(f'{name}: macOS arm64 executable and bundle version')
                else:
                    binary = z.read(repo + '.exe')
                    pe = struct.unpack_from('<I', binary, 0x3c)[0]
                    assert binary[pe:pe+4] == b'PE\0\0' and struct.unpack_from('<H', binary, pe+4)[0] == 0x8664, name
                    checks.append(f'{name}: Windows x64 executable')
        elif name.endswith('.AppImage'):
            with p.open('rb') as f:
                with mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ) as data:
                    assert data[:4] == b'\x7fELF' and struct.unpack_from('<H', data, 18)[0] == 62, name
                    offset = data.find(b'hsqs')
                    while offset >= 0:
                        if struct.unpack_from('<HH', data, offset+28) == (4,0):
                            break
                        offset = data.find(b'hsqs', offset+4)
                    assert offset > 0, name
            data = subprocess.check_output(['unsquashfs','-o',str(offset),'-cat',str(p),'resources/app.asar'])
            asar_package(data, name)
            license_bytes = subprocess.check_output(['unsquashfs','-o',str(offset),'-cat',str(p),'resources/LICENSE'])
            verify_license(license_bytes, name)
            checks.append(f'{name}: Linux x64 AppImage filesystem readable')
        elif name.endswith('.deb'):
            entries = subprocess.check_output(['ar','t',str(p)],text=True).splitlines()
            control = next(n for n in entries if n.startswith('control.tar'))
            data = subprocess.check_output(['ar','p',str(p),control])
            with tarfile.open(fileobj=io.BytesIO(data)) as tar:
                entry = next(m for m in tar.getmembers() if m.name.lstrip('./') == 'control')
                text = tar.extractfile(entry).read().decode()
                fields = dict(line.split(': ',1) for line in text.splitlines() if ': ' in line and not line.startswith(' '))
                assert fields['Version'] == version and fields['Architecture'] == 'amd64', fields
            checks.append(f'{name}: Debian version and amd64 architecture')
        elif name.endswith('.rpm'):
            fields = subprocess.check_output(['rpm','-qp','--qf','%{VERSION} %{ARCH}',str(p)],text=True).strip()
            assert fields == f'{version} x86_64', fields
            checks.append(f'{name}: RPM version and x86_64 architecture')
        elif name.endswith('.exe'):
            with p.open('rb') as f:
                assert f.read(2) == b'MZ', name
                f.seek(0x3c); offset=struct.unpack('<I',f.read(4))[0]
                f.seek(offset); assert f.read(4) == b'PE\0\0', name
            checks.append(f'{name}: PE installer/portable container readable')
        elif name.endswith('.dmg'):
            with p.open('rb') as f:
                f.seek(-512,2); assert f.read(4) == b'koly', name
            checks.append(f'{name}: UDIF disk image trailer valid; not mounted on Linux')
        else:
            assert name == 'SHA256SUMS.txt', name

    print("\n".join(checks), flush=True)
