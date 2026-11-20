"""Build a self-contained GitHub Pages artifact without modifying tracked HTML."""
from pathlib import Path
import argparse
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
output.mkdir(parents=True, exist_ok=True)
subprocess.run([
    sys.executable, str(root / 'build.py'),
    '--pdfjs-dir', str(root / 'node_modules/pdfjs-dist'),
    '--output', str(output / 'standalone'),
], check=True)
html = (output / 'standalone/Pattern_Laser_Utility.html').read_text()
html = html.replace('<button id="themeToggle"', '<a class="button" href="downloads.html">Downloads &amp; guide</a><button id="themeToggle"', 1)
(output / 'index.html').write_text(html)
shutil.copy2(root / 'downloads.html', output / 'downloads.html')
for name in ('docs', 'examples', 'THIRD_PARTY_LICENSES'):
    shutil.copytree(root / name, output / name, dirs_exist_ok=True)
(output / '.nojekyll').touch()
print('GitHub Pages artifact:', output)
