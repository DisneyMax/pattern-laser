"""Refresh the standalone utility and GitHub Pages entry point before committing."""
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parent
subprocess.run([sys.executable, str(root / 'build.py'), '--output', str(root / 'standalone')], check=True)
html = (root / 'standalone/Pattern_Laser_Utility.html').read_text()
html = html.replace('<button id="themeToggle"', '<a class="button" href="downloads.html">Downloads &amp; guide</a><button id="themeToggle"', 1)
(root / 'index.html').write_text(html)
(root / '.nojekyll').touch()
print('GitHub Pages entry point refreshed: index.html')
