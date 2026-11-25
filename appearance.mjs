export function resolveTheme(saved,systemDark=false){return saved==='light'||saved==='dark'?saved:systemDark?'dark':'light';}
export function getThemePreference(storage,systemDark=false){try{return resolveTheme(storage?.getItem('pattern-laser-theme'),systemDark);}catch{return resolveTheme(null,systemDark);}}
export function saveThemePreference(storage,theme){try{storage?.setItem('pattern-laser-theme',theme);return true;}catch{return false;}}
export function getHoverHintsPreference(storage){try{return storage?.getItem('pattern-laser-hover-hints')!=='false';}catch{return true;}}
export function saveHoverHintsPreference(storage,enabled){try{storage?.setItem('pattern-laser-hover-hints',String(enabled));return true;}catch{return false;}}
export function briefHint(text){const first=text.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim()||text;if(first.length<=112)return first;const cut=first.slice(0,109);const space=cut.lastIndexOf(' ');return (space>40?cut.slice(0,space):cut)+'…';}
export function setHelp(element,text){if(!element)return;element.removeAttribute?.('title');element.setAttribute('data-help',text);element.setAttribute('data-hint',briefHint(text));element.setAttribute('aria-description',text);}
export function createHelpButton(text,name='this control'){
 const button=document.createElement('button');button.type='button';button.className='help-trigger';button.textContent='?';button.setAttribute('aria-label','Help for '+name);button.setAttribute('data-help-trigger','true');setHelp(button,text);button.setAttribute('data-hint','Click for the full explanation.');return button;
}
export function makeHelpRow(label,text,name){const row=document.createElement('div');row.className='help-check-row';setHelp(label,text);row.append(label,createHelpButton(text,name));return row;}
export const CONTROL_HELP={
 scanBoundaries:'Inspect connected open paths containing unresolved boundaries using a fixed 0.2 mm source endpoint limit. Assigned open guides appear only if they meet an unresolved boundary. Show gaps, ambiguous junctions and free endpoints without editing geometry. Disconnected fragments can belong to the same physical piece; compare the PDF.',
 boundarySelect:'Choose a connected boundary component. Its paths are selected and fitted into the preview. Components with branches, unsupported paths, assigned open guides or large gaps require manual editing.',
 showBoundary:'Reveal and fit all paths in this boundary, with orange gap rings, red ambiguous junctions and blue free-end rings. This changes selection only and cancels pending previews.',
 previewBoundary:'Preview a bounded closure or unique join into one closed contour. Source bounds and unrelated operations are preserved; global cleanup tolerance stays unchanged. Inspect the dashed contour against the PDF.',
 applyBoundary:'Apply only the previewed repair in one Undo step. Raster geometry needs a fresh overlay and scale acknowledgement. The repaired boundary is explicitly assigned as an outer or internal cut.',
 cancelBoundary:'Discard the boundary repair preview without editing geometry. Escape also cancels.',

 duplicateManual:'Off by default: every manually assigned path stays. Enable to remove redundant manual copies only when operations and styles match; one original manual path and its operation are retained per group. Rescan and inspect the preview. Conflicting operations remain manual.',
 findDuplicates:'Scan current paths without rebuilding cleanup. Exact command copies and near-overlapping round paths are separate; conflicting operations or styles stay manual. Nothing is removed by scanning.',
 duplicateKind:'Exact matches require identical source commands. Near matches compare circular source paths within small center and diameter tolerances; they can represent intentional geometry and always need inspection.',
 duplicateGroup:'Review all compatible groups or one group. For near matches, the first individual group is selected initially. Retained IDs are shown. Matching redundant manual copies are removed only if explicitly enabled; a manual keeper and its operation remain.',
 previewDuplicates:'Show retained source paths in green and proposed removals in dashed red. Export and project saving wait until Apply or Cancel. No geometry changes during preview.',
 applyDuplicates:'Remove only the previewed automatic copies. Retained geometry, styles and manual operations stay unchanged. Matching redundant manual paths are removed only if Allow matching manual copies was enabled. Creates one Undo step and requires fresh raster review. Source cleanup rebuilds or retracing can reintroduce copies.',
 cancelDuplicates:'Discard the duplicate-removal preview without changing any paths. Escape also cancels.',

 markGroupScope:'Continuous rows suggest regular straight or gently curved sequences. Whole piece includes all eligible round marks inside each closed cut boundary, including separate rows, corners and hardware candidates of different sizes. Choose the intended operation after inspecting the preview; manual assignments remain protected.',
 findMarkGroups:'Scan using the selected scope: continuous rows or all eligible round marks inside each closed cut boundary. Overlapping copies share detection positions; source paths and manual assignments are preserved. Scan notes explain exclusions.',
 markGroupSelect:'Choose a proposed row or piece to inspect. Whole-piece groups can include hardware holes. Choose the intended operation and preview every highlighted mark before applying.',
 markGroupRole:'Choose Stitch holes or Fastener / round marks for this group. Nothing changes until Apply group. Global stitch-hole resizing applies after assigning Stitch holes.',
 previewMarkGroup:'Highlight the marks that would receive the chosen operation. Their source paths and sizes stay unchanged; current hole-resizing settings are shown in the preview.',
 applyMarkGroup:'Apply the previewed operation to editable group members only. Existing manual assignments stay unchanged. This creates one Undo step and resets raster review acknowledgement.',
 cancelMarkGroup:'Discard the group preview without changing geometry or operations. Escape also cancels a pending preview.',

 reviewPrev:'Select and zoom to the previous unresolved or possibly excluded path. Navigation wraps around the review list without changing geometry.',
 reviewNext:'Select and zoom to the next unresolved or possibly excluded path. Assign or exclude an item after inspecting its source.',
 previewRepair:'Show a proposed closing segment or unambiguous join without changing geometry. Suggestions bridge gaps up to 0.2 mm. Branches, clipped paths and uncertain features need manual review.',
 applyRepair:'Apply the displayed repair to the highlighted paths and assign the resulting closed contour. Global cleanup tolerance and unrelated assignments stay unchanged. Undo can restore the edit.',
 cancelRepair:'Discard the repair preview and keep the original geometry. Escape also cancels a pending preview.',

 hoverHints:'Show short hints after an 800 ms mouse hover. Turn this off for quieter navigation. Click ? or press F1 on a control for full help, even with hover hints off. Your choice is saved in this browser.',
 themeToggle:'Switch the interface between light and dark. Your choice is saved in this browser. PDF paper and SVG layer colours stay consistent.',
 undo:'Undo the latest geometry edit, tracing, calibration or engine change in this session. Up to 25 steps are retained. Shortcut: Ctrl+Z or ⌘Z.',
 saveProject:'Save this page’s source geometry, edits, layer choices, calibration and reference image as a project JSON file. It does not embed the original PDF.',
 export:'Generate an SVG containing the included operation layers. Unresolved features and unreviewed raster traces block export. Laser power and speed must be assigned in xTool Studio.',
 drop:'Open a PDF from this device. Vector pages use extraction; pages without vector paths open in raster mode. Processing happens in this browser.',
 sample:'Load the reviewed YOMMY project, ready to export. It includes the documented 0.10 mm cleanup and two excluded construction spurs; source geometry is retained.',
 emptySample:'Load the reviewed YOMMY example with five outer contours, one internal cutout and 438 stitch holes. Check its overlay and scale before export.',
 originalSample:'Open the original YOMMY PDF with conservative 0.03 mm joining. Its seven unresolved paths are left for manual cleanup practice; use the reviewed sample for a ready-to-export example.',
 page:'Choose the PDF page to work on. Switching pages resets this page’s edits and calibration, so save a project first if needed.',
 project:'Restore a saved .pattern.json project, including its geometry and edits. A restored raster project requires fresh overlay and scale review.',
 conversionMode:'Vector extraction preserves source paths. Raster trace converts the rendered appearance in selected areas to approximate centrelines. Switching engines rebuilds page geometry.',
 attachRasterSource:'Attach the matching original PDF to a saved raster project so you can trace more areas. The saved PDF fingerprint and page dimensions must match.',
 selectRasterArea:'Drag a rectangle around one pattern piece in the PDF view. Leave dimension labels, logos and unrelated artwork outside the selection.',
 rasterX:'Horizontal position of the selection’s left edge, in source-page millimetres, measured from the left of the PDF.',
 rasterY:'Vertical position of the selection’s top edge, in source-page millimetres, measured down from the top of the PDF.',
 rasterW:'Width of the tracing selection in source-page millimetres. Include the entire cut line with a small margin.',
 rasterH:'Height of the tracing selection in source-page millimetres. Avoid cutting through a contour or including neighbouring artwork.',
 rasterDpi:'Resolution used to render the PDF before tracing. 300 DPI samples more finely; 150 DPI uses less memory. Higher DPI cannot recover detail missing from the source image.',
 rasterSimplify:'Maximum polyline simplification tolerance in millimetres relative to skeleton pixels. Smaller values keep more points. This is not a guarantee of accuracy against the original design.',
 rasterThreshold:'Pixels darker than this value become trace material. Lower values suppress light watermarks and paper texture; higher values capture faint lines but may add noise.',
 rasterSpeckle:'Remove connected dark components smaller than this physical area, in square millimetres. Raising it removes more noise but can also remove tiny printed marks.',
 rasterPrune:'Remove dangling branches shorter than this length from the thinned line network. Helps with tiny spurs; higher values can remove intentional details. Zero disables pruning.',
 rasterSuppressText:'Mask selectable PDF text before tracing. Image-based lettering is unaffected. If a text box overlaps a needed line, turn this off and select a tighter area.',
 rasterPoints:'Include compact round printed marks with estimated centres and sizes. They are classification suggestions, not guaranteed punch dimensions. Off by default for outline tracing.',
 rasterOpen:'Include short open lines and dashes as review items. Off by default. Long broken contours remain review items even when this option is off.',
 previewRaster:'Show the black/white threshold mask for the selected area. This previews settings only; click Trace area to regenerate geometry.',
 traceRaster:'Trace the selected area to single centrelines in a background worker. Re-tracing the same area replaces it. Tracing rebuilds geometry and resets manual cleanup.',
 clearRaster:'Remove this page’s raster traces. Undo restores the previous geometry.',
 rasterReviewed:'Confirm that you compared included raster paths with the original and checked a known physical dimension. New tracing, edits or calibration invalidate this confirmation.',
 dedupe:'Remove repeated and reversed path segments and overlapping straight-line portions. It does not remove intentional nearby parallel paths.',
 join:'Join endpoints only where the connection is unambiguous and inside the chosen tolerance. Multiple possible branches stay separate for review.',
 tolerance:'Maximum endpoint gap to bridge, in source millimetres, up to 0.2 mm. Larger values can connect unintended paths. This is separate from raster simplification tolerance.',
 rebuild:'Rebuild cleanup and classifications from this page’s source geometry. Manual edits are reset. Undo can restore the previous state.',
 known:'Actual known length of a feature, in millimetres, from a reliable printed dimension or physical reference.',
 measured:'Length of that same feature in the source PDF, before output scaling. Use Measure or the inspector’s bounds. Mouse measurements are approximate.',
 calibrate:'Set a uniform output scale equal to known distance divided by measured source distance. Original coordinates remain available. Raster review must be confirmed again afterward.',
 resetScale:'Restore 100% of the PDF’s physical size. This also invalidates raster scale review.',
 viewPaths:'Show assigned geometry without the original PDF underlay. Preview visibility checkboxes do not change export inclusion.',
 viewOverlay:'Show geometry over a faded PDF render so you can check alignment, missing features and unwanted cuts.',
 viewOriginal:'Show the original PDF render for comparison. Geometry is still retained for export and editing.',
 viewMask:'Show the latest raster threshold mask. The mask is a preview, not the exported SVG.',
 selectTool:'Select whole paths with a left-mouse drag in Cut paths or Overlay. Only visible paths fully inside the box are selected. Shift-drag adds; Shift-click toggles individual paths. Escape cancels a drag or clears selection. This does not split paths.',
 measureTool:'Click two points on the page to measure their source distance. The calibration field is filled automatically. Click Measure again or press Escape to leave measurement mode.',
 zoom:'Change only the preview zoom. It does not change output dimensions or calibration.',
 fit:'Reset the preview zoom and scroll position. The exported physical scale stays unchanged.',
 assignment:'Assign the selected paths to an operation or to Reference. This is a manual choice and is preserved when automatic roles are refreshed. Reference paths are excluded from export.',
 excludeSelected:'Move the selected geometry to Reference, explicitly excluding it from SVG export. The original source is retained and Undo can restore the assignment.',
 closeSelected:'Close selected open contours only if the gap between their endpoints fits the join tolerance. This adds a closing segment; inspect the result in Overlay.',
 splitSelected:'Split selected paths into individual segments for editing. Each segment needs a new assignment or join. Undo restores the original paths.',
 focusSelected:'Zoom and scroll the preview toward the selected geometry. It does not change the geometry or exported scale.',
 joinSelected:'Try joining only the selected paths within the tolerance. Ambiguous junctions remain separate rather than choosing a potentially wrong connection.',
 filter:'Choose which objects appear in the list. Filtering does not hide preview layers or change the SVG export.',
 resizeHoles:'Replace recognised circular Stitch holes with true circles at the chosen final diameter. Fastener / round marks and other layers are unaffected. Off preserves original geometry.',
 holeDiameter:'Final diameter of resized stitch holes in output millimetres, after calibration. This value is not multiplied by the output scale.',
 exportSize:'Full page keeps the PDF canvas dimensions. Fit geometry crops the included paths with a 1 mm source-space margin on each side; it does not resize the pattern.',
 reviewExcluded:'Select suspected pattern features that would otherwise be silently omitted. Assign an operation or explicitly exclude them to resolve the export check.',
 calibrationFile:'Create a calibration SVG containing a rectangle whose geometry is 100 × 20 mm. Verify that size after import into xTool Studio; the canvas includes margins.',
 report:'Save counts, classifications, calibration, tracing settings, unresolved paths and the export inventory as JSON. It is a diagnostic report, not a cut file.',
 downloadSaveLink:'Ask the browser to download the prepared file. Embedded views may block this; Open file and Copy contents remain alternatives.',
 downloadNativeSave:'Use the browser’s native Save as picker when supported in a secure, standalone browser tab. A saved message appears only after writing finishes.',
 downloadOpenLink:'Open the generated file in a new tab. Use the browser’s Save page as command and retain the .svg or .json extension.',
 downloadCopy:'Copy the complete generated SVG or JSON text. Paste it into a text editor and save using the displayed filename and extension.',
 downloadContents:'Exact file contents prepared for saving. If clipboard permission is blocked, select and copy this text manually.',
 downloadBrowserLink:'Open this utility outside the embedded view. A standalone tab may allow downloads and Save as where the embedded view does not.',
 downloadClose:'Close this save dialog. The prepared file remains available until it is replaced by the next generated file.'
};
export const BRIEF_HELP={
 page:'Switch pages; current-page edits and calibration reset. Save a project first.',
 conversionMode:'Switch vector/raster engines. Page geometry is rebuilt; Undo can restore it.',
 traceRaster:'Trace this area. Tracing rebuilds page geometry and resets manual cleanup.',
 rebuild:'Rebuild source geometry and reset manual edits. Undo restores the previous state.',
 rasterReviewed:'Confirm the raster overlay and physical scale before SVG export.',
 calibrate:'Apply known ÷ measured distance as a uniform scale; raster review resets.',
 resizeHoles:'Resize recognised stitch holes only. Fastener marks keep their source geometry.',
 export:'Export included SVG layers after review. Set laser parameters in xTool Studio.'
};
export function initAppearance(){
 const button=document.getElementById('themeToggle'),root=document.documentElement;
 let storage;try{storage=window.localStorage;}catch{}
 let media;try{media=window.matchMedia('(prefers-color-scheme: dark)');}catch{}
 let explicit;try{explicit=storage?.getItem('pattern-laser-theme');}catch{}
 function apply(theme){root.dataset.theme=theme;root.style.colorScheme=theme;button.setAttribute('aria-pressed',String(theme==='dark'));button.textContent='☾ Dark theme';}
 apply(getThemePreference(storage,!!media?.matches));
 button.onclick=()=>{const next=root.dataset.theme==='dark'?'light':'dark';explicit=next;apply(next);saveThemePreference(storage,next);};
 media?.addEventListener?.('change',event=>{if(explicit!=='light'&&explicit!=='dark')apply(event.matches?'dark':'light');});
 for(const [id,text]of Object.entries(CONTROL_HELP)){
  const control=document.getElementById(id);if(!control)continue;setHelp(control,text);if(BRIEF_HELP[id])control.setAttribute('data-hint',BRIEF_HELP[id]);
  const label=document.querySelector('label[for="'+id+'"]')||control.closest('label');
  if(!label||label.dataset.helpEnhanced)continue;label.dataset.helpEnhanced='true';
  setHelp(label,text);if(BRIEF_HELP[id])label.setAttribute('data-hint',BRIEF_HELP[id]);const name=label.textContent.trim().replace(/\s+/g,' '),parent=label.parentNode;
  if(label.classList.contains('check')){const row=document.createElement('div');row.className='help-check-row';parent.insertBefore(row,label);row.append(label,createHelpButton(text,name));}
  else if(label.getAttribute('for')===id){const row=document.createElement('div');row.className='help-label-row';if(label.classList.contains('gap')){row.classList.add('gap');label.classList.remove('gap');}parent.insertBefore(row,label);row.append(label,createHelpButton(text,name));}
 }
 const tooltip=document.getElementById('appTooltip'),preference=document.getElementById('hoverHints');
 let active=null,pending=null,showTimer=null,hideTimer=null,pinned=false,dragging=false,hoverEnabled=getHoverHintsPreference(storage);
 if(preference){preference.checked=hoverEnabled;preference.onchange=()=>{hoverEnabled=preference.checked;saveHoverHintsPreference(storage,hoverEnabled);hide();};}
 const cancelShow=()=>{if(showTimer!==null)clearTimeout(showTimer);showTimer=null;pending=null;};
 const cancelHide=()=>{if(hideTimer!==null)clearTimeout(hideTimer);hideTimer=null;};
 function hide(){cancelShow();cancelHide();if(active){const ids=(active.getAttribute('aria-describedby')||'').split(/\s+/).filter(x=>x&&x!==tooltip.id);if(ids.length)active.setAttribute('aria-describedby',ids.join(' '));else active.removeAttribute('aria-describedby');}active=null;pinned=false;try{tooltip.hidePopover?.();}catch{}tooltip.hidden=true;}
 function show(target,full=false){if(!target?.getAttribute('data-help')||target.isConnected===false)return;cancelShow();cancelHide();if(active&&active!==target)hide();active=target;pinned=full;
  tooltip.textContent=full?target.getAttribute('data-help'):(target.getAttribute('data-hint')||briefHint(target.getAttribute('data-help')));tooltip.hidden=false;
  const ids=new Set((target.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean));ids.add(tooltip.id);target.setAttribute('aria-describedby',[...ids].join(' '));
  if(typeof tooltip.showPopover==='function'){if(tooltip.parentNode!==document.body)document.body.append(tooltip);try{tooltip.showPopover();}catch{}}
  else{const parent=target.closest('dialog')||document.body;if(tooltip.parentNode!==parent)parent.append(tooltip);}
  const r=target.getBoundingClientRect(),b=tooltip.getBoundingClientRect(),x=Math.max(12,Math.min(window.innerWidth-b.width-12,r.left+r.width/2-b.width/2)),below=r.bottom+8,y=below+b.height<=window.innerHeight-12?below:Math.max(12,r.top-b.height-8);tooltip.style.left=x+'px';tooltip.style.top=y+'px';
 }
 const targetFor=e=>e.target?.closest?.('[data-help]');
 document.addEventListener('pointerover',e=>{
  if(tooltip.contains(e.target)){cancelHide();return;}
  const target=targetFor(e);if(!hoverEnabled||pinned||dragging||e.buttons>0||e.pointerType==='touch'||!target)return;
  if(active===target){cancelHide();return;}if(pending===target)return;
  hide();pending=target;showTimer=setTimeout(()=>{showTimer=null;const next=pending;pending=null;if(hoverEnabled&&!dragging&&next)show(next);},800);
 });
 document.addEventListener('pointerout',e=>{const next=e.relatedTarget;if(next&&(active?.contains(next)||pending?.contains(next)||tooltip.contains(next)))return;cancelShow();if(pinned)return;cancelHide();hideTimer=setTimeout(hide,120);});
 // Focus retains the permanent screen-reader description, without opening a visual popup.
 document.addEventListener('focusin',e=>{if(tooltip.contains(e.target)||(pinned&&active===targetFor(e)&&active?.hasAttribute('data-help-trigger')))return;hide();});
 document.addEventListener('focusout',()=>{if(!pinned)hide();});
 document.addEventListener('pointerdown',e=>{dragging=true;cancelShow();const target=targetFor(e);if(!target?.hasAttribute('data-help-trigger')&&!tooltip.contains(e.target))hide();},true);
 document.addEventListener('pointerup',()=>{dragging=false;},true);
 document.addEventListener('pointercancel',()=>{dragging=false;hide();},true);
 document.addEventListener('click',e=>{const target=targetFor(e);if(target?.hasAttribute('data-help-trigger')){e.preventDefault();e.stopPropagation();if(active===target&&pinned)hide();else show(target,true);}else if(!tooltip.contains(e.target))hide();});
 document.addEventListener('keydown',e=>{
  cancelShow();if(e.key==='Escape'&&active){hide();e.preventDefault();e.stopPropagation();return;}
  if((e.key==='Enter'||e.key===' ')&&targetFor(e)?.hasAttribute('data-help-trigger'))return;
  if(e.key==='F1'){const target=targetFor(e)||document.activeElement?.closest?.('[data-help]');if(target){show(target,true);e.preventDefault();e.stopPropagation();return;}}
  hide();
 },true);
 document.addEventListener('input',hide,true);document.addEventListener('change',hide,true);
 document.addEventListener('scroll',hide,true);window.addEventListener('resize',hide);
}
