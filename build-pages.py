"""Build split hosted assets and a self-contained offline download from shared sources."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys

root = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, default=root / '_site')
args = parser.parse_args()
output = args.output.resolve()
if output == root or root not in output.parents:
    raise SystemExit('Pages output must be a subdirectory of this repository.')
assets = output / 'assets'
assets.mkdir(parents=True, exist_ok=True)
vendor = root / 'node_modules/pdfjs-dist'
subprocess.run([
    sys.executable, str(root / 'build.py'), '--pdfjs-dir', str(vendor),
    '--output', str(output / 'standalone'),
], check=True)

def asset(name, data, extension):
    if isinstance(data, str):
        data = data.encode()
    filename = f'{name}.{hashlib.sha256(data).hexdigest()[:16]}.{extension}'
    (assets / filename).write_bytes(data)
    return filename

css = asset('styles', (root / 'styles.css').read_bytes(), 'css')
theme = asset('theme-init', (root / 'theme-init.js').read_bytes(), 'js')
engine = asset('pdf', (vendor / 'legacy/build/pdf.min.mjs').read_bytes(), 'mjs')
worker = asset('pdf-worker', (vendor / 'legacy/build/pdf.worker.min.mjs').read_bytes(), 'mjs')
sample = asset('yommy', (root / 'CARD HOLDER YOMMY.pdf').read_bytes(), 'pdf')
reviewed_sample = asset('yommy-reviewed', (root / 'examples/YOMMY_reviewed.pattern.json').read_bytes(), 'json')
urls = ','.join(f'{key}:new URL({json.dumps("./"+value)},import.meta.url).href' for key, value in [('engine', engine), ('worker', worker), ('sample', sample), ('reviewedSample', reviewed_sample)])
modules = ['geometry.mjs', 'downloads.mjs', 'raster.mjs', 'appearance.mjs', 'box-selection.mjs', 'runtime-assets.mjs', 'review.mjs', 'mark-groups.mjs', 'duplicate-paths.mjs', 'app.js']
app_source = 'const HOSTED_ASSETS={' + urls + '};\n' + '\n'.join(re.sub(r'^import [^\n]*;\n', '', re.sub(r'^export ', '', (root / name).read_text(), flags=re.M), flags=re.M) for name in modules)
app = asset('app', app_source, 'mjs')
html = (root / 'index.template.html').read_text()
html = html.replace('<script>/*__THEME__*/</script>', f'<script src="assets/{theme}"></script>')
html = html.replace('<style>/*__STYLES__*/</style>', f'<link rel="stylesheet" href="assets/{css}">')
html = re.sub(r'<script type="module">.*?</script>', f'<script type="module" src="assets/{app}"></script>', html, count=1, flags=re.S)
html = html.replace('<button id="themeToggle"', '<a class="button" href="downloads.html">Downloads &amp; guide</a><button id="themeToggle"', 1)
(output / 'index.html').write_text(html)
manifest = {key: 'assets/' + value for key, value in [('app', app), ('styles', css), ('theme', theme), ('engine', engine), ('worker', worker), ('sample', sample), ('reviewedSample', reviewed_sample)]}
(output / 'assets-manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
# Keep old hashed assets on repeated local builds so open tabs remain usable.
# CI builds in a clean checkout and publishes only the current artifact.
shutil.copy2(root / 'downloads.html', output / 'downloads.html')
for name in ('docs', 'examples', 'THIRD_PARTY_LICENSES'):
    shutil.copytree(root / name, output / name, dirs_exist_ok=True)
(output / '.nojekyll').touch()
print('GitHub Pages artifact:', output)
print('Hosted HTML:', len(html.encode()), 'bytes; app JavaScript:', len(app_source.encode()), 'bytes')
