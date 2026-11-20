"""Check the generated Pages links, embedded app and module syntax before publishing."""
from html.parser import HTMLParser
from pathlib import Path
import re
import subprocess
import tempfile
from urllib.parse import unquote, urlsplit

root = Path(__file__).resolve().parent / '_site'
class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.targets = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for key in ('href', 'src'):
            if key in attrs:
                self.targets.append(attrs[key])

for path in root.rglob('*.html'):
    html = path.read_text()
    parser = Links()
    parser.feed(html)
    for target in parser.targets:
        parsed = urlsplit(target)
        if parsed.scheme or parsed.netloc or not parsed.path:
            continue
        if parsed.path.startswith('/'):
            raise SystemExit(f'Root-relative link breaks project Pages: {path}: {target}')
        destination = (path.parent / unquote(parsed.path)).resolve()
        if not destination.is_relative_to(root.resolve()) or not destination.exists():
            raise SystemExit(f'Missing or escaping link: {path}: {target}')

for name in ('index.html', 'standalone/Pattern_Laser_Utility.html'):
    html = (root / name).read_text()
    if len(html) < 1000000 or re.search(r'/\*__(?:APP|CORE|RASTER|DOWNLOADS|APPEARANCE|SELECTION)__\*/', html):
        raise SystemExit(f'Incomplete application bundle: {name}')
    scripts = re.findall(r'<script type="module">(.*?)</script>', html, re.S)
    if len(scripts) != 1:
        raise SystemExit(f'Expected one application module: {name}')
    with tempfile.TemporaryDirectory() as directory:
        module = Path(directory) / 'app.mjs'
        module.write_text(scripts[0])
        subprocess.run(['node', '--check', str(module)], check=True)
assert (root / 'examples/100mm_calibration.svg').is_file()
assert (root / 'docs/Pattern_Laser_User_Guide.pdf').read_bytes().startswith(b'%PDF-')
print('Pages links, bundled modules, calibration SVG and PDF guide verified.')
