"""Build a self-contained HTML utility with PDF.js and a bundled test PDF.
Run npm install first, then npm run build. No server is needed to use the result.
"""
from pathlib import Path
import argparse,base64,re
root=Path(__file__).resolve().parent
parser=argparse.ArgumentParser()
parser.add_argument('--pdfjs-dir',type=Path)
parser.add_argument('--sample',type=Path,default=root/'CARD HOLDER YOMMY.pdf')
parser.add_argument('--output',type=Path,default=root/'dist')
args=parser.parse_args()
vendor=args.pdfjs_dir or root/'node_modules/pdfjs-dist'
if not vendor.exists():
 vendor=Path('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist')
if not vendor.exists():raise SystemExit('PDF.js is missing. Run npm install or pass --pdfjs-dir.')
args.output.mkdir(parents=True,exist_ok=True)
core=re.sub(r'^export ', '',(root/'geometry.mjs').read_text(),flags=re.M)
constants='\n'.join('const '+name+'="'+base64.b64encode(path.read_bytes()).decode()+'";' for name,path in [('PDF_ENGINE',vendor/'legacy/build/pdf.min.mjs'),('PDF_WORKER',vendor/'legacy/build/pdf.worker.min.mjs'),('SAMPLE_PDF',args.sample)])
app=constants+'\n'+(root/'app.js').read_text()
html=(root/'index.template.html').read_text().replace('/*__STYLES__*/',(root/'styles.css').read_text()).replace('/*__THEME__*/',(root/'theme-init.js').read_text()).replace('/*__RUNTIME__*/',re.sub(r'^export ', '',(root/'runtime-assets.mjs').read_text(),flags=re.M)).replace('/*__CORE__*/',core).replace('/*__DOWNLOADS__*/',re.sub(r'^export ', '',(root/'downloads.mjs').read_text(),flags=re.M)).replace('/*__RASTER__*/',re.sub(r'^export ', '',(root/'raster.mjs').read_text(),flags=re.M)).replace('/*__APPEARANCE__*/',re.sub(r'^export ', '',(root/'appearance.mjs').read_text(),flags=re.M)).replace('/*__SELECTION__*/',re.sub(r'^export ', '',(root/'box-selection.mjs').read_text(),flags=re.M)).replace('/*__APP__*/',app)
license_text=(vendor/'LICENSE').read_text()
html=html.replace('<script type="module">','<!-- Bundled PDF.js license:\n'+license_text+'\n-->\n<script type="module">')
assert len(re.findall(r'</script',html,re.I))==2
(args.output/'Pattern_Laser_Utility.html').write_text(html)
print('Standalone utility:',len(html.encode()),'bytes')
