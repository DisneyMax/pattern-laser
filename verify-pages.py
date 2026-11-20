"""Check split hosted assets, offline completeness, links and generated JavaScript."""
from html.parser import HTMLParser
from pathlib import Path
import hashlib
import json
import re
import subprocess
import tempfile
from urllib.parse import unquote, urlsplit

source = Path(__file__).resolve().parent
root = source / '_site'
class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.targets = []
        self.inline_scripts = []
        self.styles = 0
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'script' and 'src' not in attrs:
            self.inline_scripts.append(attrs)
        if tag == 'style':
            self.styles += 1
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

manifest = json.loads((root / 'assets-manifest.json').read_text())
assert set(manifest) == {'app', 'styles', 'theme', 'engine', 'worker', 'sample', 'reviewedSample'}
for key, name in manifest.items():
    path = root / name
    digest = hashlib.sha256(path.read_bytes()).hexdigest()[:16]
    assert f'.{digest}.' in path.name, f'Invalid asset hash: {name}'
    if path.suffix in ('.js', '.mjs'):
        subprocess.run(['node', '--check', str(path)], check=True)
assert (root / manifest['styles']).read_bytes() == (source / 'styles.css').read_bytes()
assert (root / manifest['theme']).read_bytes() == (source / 'theme-init.js').read_bytes()
assert (root / manifest['sample']).read_bytes() == (source / 'CARD HOLDER YOMMY.pdf').read_bytes()
assert (root / manifest['reviewedSample']).read_bytes() == (source / 'examples/YOMMY_reviewed.pattern.json').read_bytes()
for key, filename in [('engine', 'pdf.min.mjs'), ('worker', 'pdf.worker.min.mjs')]:
    assert (root / manifest[key]).read_bytes() == (source / 'node_modules/pdfjs-dist/legacy/build' / filename).read_bytes()
hosted = (root / 'index.html').read_text()
parser = Links()
parser.feed(hosted)
assert len(hosted) < 100000 and not parser.inline_scripts and parser.styles == 0
for key in ('app', 'styles', 'theme'):
    assert manifest[key] in parser.targets, key
assert hosted.index(manifest['theme']) < hosted.index(manifest['styles']), 'Theme must apply before CSS paints.'
app = (root / manifest['app']).read_text()
assert not any(name in app for name in ('const PDF_ENGINE=', 'const PDF_WORKER=', 'const SAMPLE_PDF=', 'const SAMPLE_PROJECT='))
for key in ('engine', 'worker', 'sample', 'reviewedSample'):
    assert f'./{Path(manifest[key]).name}' in app, key

html = (root / 'standalone/Pattern_Laser_Utility.html').read_text()
assert len(html) > 1000000
assert not re.search(r'/\*__[A-Z]+__\*/', html), 'Unexpanded offline placeholder'
parser = Links()
parser.feed(html)
assert parser.styles == 1 and len(parser.inline_scripts) == 2
assert not any(urlsplit(t).path.endswith(('.css', '.js', '.mjs')) for t in parser.targets), 'Offline bundle needs an external asset'
scripts = re.findall(r'<script type="module">(.*?)</script>', html, re.S)
assert len(scripts) == 1
with tempfile.TemporaryDirectory() as directory:
    module = Path(directory) / 'app.mjs'
    module.write_text(scripts[0])
    subprocess.run(['node', '--check', str(module)], check=True)
assert (source / 'styles.css').read_text() in html
assert (source / 'theme-init.js').read_text() in html
assert (root / 'examples/100mm_calibration.svg').is_file()
assert (root / 'docs/Pattern_Laser_User_Guide.pdf').read_bytes().startswith(b'%PDF-')
print('Hosted asset hashes, theme order, links, modules and offline completeness verified.')
