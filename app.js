let boundaryScan=null,boundaryId=null,boundaryOverlay=false;
let duplicatePreview=null,duplicateScan=null;
let repairPreview=null,markPreview=null,markGroups=[],markGroupsKey=null,markDiagnostics=null;
const pendingPreview=()=>repairPreview||markPreview||duplicatePreview;
function clearPreviewState(){repairPreview=null;markPreview=null;duplicatePreview=null;boundaryOverlay=false;}
function resetBoundaryReview(){boundaryScan=null;boundaryId=null;boundaryOverlay=false;}
function resetDuplicateReview(){duplicatePreview=null;duplicateScan=null;}
function resetMarkGroups(){markPreview=null;markGroups=[];markGroupsKey=null;markDiagnostics=null;}
const hostedAssets=typeof HOSTED_ASSETS==='undefined'?null:HOSTED_ASSETS;
const $=id=>document.getElementById(id);
initAppearance();
let pdfjs,doc=null,raw=[],objects=[],stats={},warnings=[],pageInfo=null,fileName='',referenceImage='',scale=1,selected=new Set(),history=[],mode='paths',measureMode=false,measurePoints=[],sourceToken=0,loading=false;
let visible=Object.fromEntries(Object.keys(LAYERS).map(k=>[k,k!=='reference']));
let sourceFingerprint=null,vectorRaw=[],conversionMode='vector',rasterBatches=[],rasterCanvas=null,rasterRegion=null,rasterMask=null,rasterReviewed=false,selectRasterMode=false,rasterCounter=0;
let selectionMarquee=null;
let exportLayers=new Set(['cut','holes','hardware','inner','score']);
const NS='http://www.w3.org/2000/svg';
const svgNode=(tag,attrs={})=>{const n=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
const human=n=>Number(n).toFixed(2);
const safeBase=()=>fileName.replace(/\.pdf$/i,'').replace(/[^a-z0-9_-]+/gi,'_')||'leather-pattern';
const setStatus=s=>$('status').textContent=s;
let toastTimer;
function toast(s){$('toast').textContent=s;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4200);setStatus(s);}
function busy(s){loading=!!s;$('busy').hidden=!s;$('busyText').textContent=s||'';}
const downloadManager=createDownloadManager({document,window,navigator,URL,Blob});
function download(name,content,type='image/svg+xml'){downloadManager.prepare(name,content,type);setStatus('File ready: '+name);}
if(location.protocol==='https:'||location.protocol==='http:'){$('downloadBrowserLink').href=location.href;$('downloadBrowserLink').hidden=false;}
function checkpoint(){clearPreviewState();history.push({objects:structuredClone(objects),raw:structuredClone(raw),scale,stats:structuredClone(stats),conversionMode,rasterBatches:structuredClone(rasterBatches),rasterReviewed,rasterRegion:structuredClone(rasterRegion)});if(rasterBatches.length)rasterReviewed=false;if(history.length>25)history.shift();$('undo').disabled=false;}
function resetSelection(){clearPreviewState();resetMarkGroups();resetDuplicateReview();resetBoundaryReview();selected.clear();measurePoints=[];}
function settings(){return {dedupe:$('dedupe').checked,join:$('join').checked,tolerance:Number($('tolerance').value)};}
function rebuild(record=true){if(!raw.length)return;if(record)checkpoint();const result=prepare(raw,settings());objects=result.objects;stats=result.stats;resetSelection();render();toast('Cleanup rebuilt from original vectors. Manual assignments were reset.');}
function currentOptions(){const diameter=$('resizeHoles').checked?Number($('holeDiameter').value):null;if(diameter!==null&&(!Number.isFinite(diameter)||diameter<.25||diameter>5))throw new Error('Choose a hole diameter from 0.25 to 5 mm.');return {width:pageInfo.width,height:pageInfo.height,scale,holeDiameter:diameter,crop:$('exportSize').value==='crop',title:fileName+' · page '+pageInfo.number,layers:[...exportLayers]};}
function layerCounts(){return Object.fromEntries(Object.keys(LAYERS).map(k=>[k,objects.filter(o=>o.layer===k).length]));}
function currentAudit(){const a=auditExport(objects,{layers:[...exportLayers]}),r=rasterAudit(objects,{reviewed:rasterReviewed,layers:[...exportLayers],batches:conversionMode==='raster'?rasterBatches:[]});return {...a,raster:r,blocked:a.blocked||r.pending};}
function ensureExportReady(){if(pendingPreview())throw new Error('Apply or cancel the pending preview before exporting.');const audit=currentAudit();if(audit.raster.pending)throw new Error('Check the raster overlay and verify scale, then confirm the review checkbox.');if(audit.unresolved.length)throw new Error('Resolve the paths marked Needs review first.');if(audit.suspectedExclusions.length)throw new Error('Review the suspected pattern features being excluded first.');return audit;}
function updateExportState(){const audit=currentAudit(),count=audit.unresolved.length+audit.suspectedExclusions.length,can=pageInfo&&audit.summary.some(s=>s.included);$('export').disabled=!can||audit.blocked||!!pendingPreview();const n=$('exportNotice');n.classList.toggle('ok',!!can&&!audit.blocked);
 n.textContent=!pageInfo?'Import a PDF or load the reviewed sample to begin.':pendingPreview()?'Apply or cancel the pending preview before exporting.':(!objects.length&&pageInfo)?(conversionMode==='raster'?'No raster paths yet. Select a pattern area and click Trace area.':'No vector paths found. Use Raster trace for an image-based pattern.'):audit.raster.pending&&count?`${count} paths need an assignment or explicit exclusion, followed by raster overlay/scale review.`:audit.raster.pending?'Raster trace needs review. Check the overlay and scale, then confirm the checkbox in Trace image area.':audit.suspectedExclusions.length?`${audit.suspectedExclusions.length} suspected pattern features are excluded without an assignment. Review them before export.`:count?`${count} paths still need review. Assign an operation or exclude them before export.`:'Ready to export the included geometry. Check the inventory below and verify size in xTool Studio.';
 $('reviewBanner').textContent=(!objects.length&&pageInfo)?(conversionMode==='raster'?'Image pattern: select one piece, preview the threshold, then trace it.':'No vector paths available. Choose Raster trace to create approximate cut geometry.'):audit.raster.pending?'Raster geometry is approximate. Inspect the overlay and calibrate from a known dimension before export.':count?`${count} paths need review. Inspect their geometry, then assign an operation or explicitly exclude them.`:pageInfo?'Check the export inventory and overlay. Classification suggests roles; original geometry is preserved.':'Import a PDF to inspect its original vector geometry. Unresolved pattern features block export.';
 $('reviewBanner').style.background=(count||audit.raster.pending)?'var(--warning-bg)':'var(--mint)';$('reviewBanner').classList.toggle('ready',!(count||audit.raster.pending));
 const inventory=$('exportInventory');inventory.replaceChildren();
 for(const entry of audit.summary){if(!entry.total)continue;const row=document.createElement('div');row.className='inventory-row'+(entry.excluded?' omitted':'');row.textContent=`${entry.name}: ${entry.included} included / ${entry.total} total`;inventory.append(row);}
 if(audit.annotationsExcluded){const row=document.createElement('div');row.className='small';row.textContent=`${audit.annotationsExcluded} dimension annotation paths excluded.`;inventory.append(row);}
 if(audit.confirmedPatternExclusions){const row=document.createElement('div');row.className='small';row.textContent=`${audit.confirmedPatternExclusions} possible pattern features explicitly excluded by you.`;inventory.append(row);}
 if(audit.raster.batchCount){const row=document.createElement('div');row.className='small';row.textContent=`Raster options omitted ${audit.raster.omittedPoints} point marks and ${audit.raster.omittedShortLines} short strokes. ${audit.raster.pending?'Overlay/scale review pending.':'Overlay/scale review confirmed.'}`;inventory.append(row);}
 $('reviewExcluded').hidden=!audit.suspectedExclusions.length;
}

function renderLayers(){const counts=layerCounts();$('layers').replaceChildren();for(const [key,cfg]of Object.entries(LAYERS)){const row=document.createElement('label');row.className='layer';const cb=document.createElement('input');cb.type='checkbox';cb.checked=visible[key];cb.setAttribute('aria-label','Show '+cfg.name);cb.onchange=()=>{visible[key]=cb.checked;renderStage();};const dot=document.createElement('span');dot.className='dot';dot.style.setProperty('--c',cfg.color);const label=document.createElement('span');label.textContent=cfg.name;const count=document.createElement('span');count.className='layer-count';count.textContent=counts[key];row.append(cb,dot,label,count);setHelp(cb,'Show or hide '+cfg.name+' in the preview only. Export inclusion is controlled separately in Export setup.');$('layers').append(makeHelpRow(row,'Show or hide '+cfg.name+' in the preview only. This does not change which paths are exported.','preview visibility for '+cfg.name));}}
function renderStage(){if(boundaryScan&&boundaryScan.sourceKey!==reviewStateKey(objects))resetBoundaryReview();if(duplicatePreview&&duplicatePreview.beforeKey!==duplicateStateKey(objects))duplicatePreview=null;if(repairPreview&&repairPreview.beforeKey!==reviewStateKey(objects))repairPreview=null;if(markPreview&&markPreview.beforeKey!==markGroupStateKey(objects))markPreview=null;selectionMarquee?.destroy();selectionMarquee=null;updateEditorTools();if(!pageInfo)return;const p=$('paper');p.replaceChildren();p.style.aspectRatio=`${pageInfo.width}/${pageInfo.height}`;const z=Number($('zoom').value)/100;p.style.maxWidth=650*z+'px';p.style.width=(100*z)+'%';
 let boxTool=null;const svg=svgNode('svg',{viewBox:`0 0 ${pageInfo.width} ${pageInfo.height}`,role:'img','aria-label':'Pattern geometry preview'});
 if(mode!=='paths'&&mode!=='mask'&&referenceImage){svg.append(svgNode('image',{href:referenceImage,width:pageInfo.width,height:pageInfo.height,opacity:mode==='overlay'?'0.4':'1'}));}
 if(mode==='mask'&&rasterMask)svg.append(svgNode('image',{href:rasterMask.href,x:rasterMask.region.x,y:rasterMask.region.y,width:rasterMask.region.w,height:rasterMask.region.h}));
 if(mode!=='original'&&mode!=='mask')for(const o of objects){if(!visible[o.layer])continue;const cfg=LAYERS[o.layer];const ci=o.layer==='holes'&&$('resizeHoles').checked?circleInfo(o):null;const attrs={fill:'none',stroke:cfg.color,'stroke-width':o.layer==='reference'?.08:.12,'data-id':o.id,class:'geom'+(selected.has(o.id)?' selected':'')+(pendingPreview()?.ids.includes(o.id)?' repair-before':''),'stroke-linejoin':'round'};
  if(o.layer==='reference'){attrs.opacity='.38';if(o.fill)attrs.fill='#aaa';}
  const el=ci?svgNode('circle',{...attrs,cx:ci.cx,cy:ci.cy,r:Number($('holeDiameter').value)/(2*scale)}):svgNode('path',{...attrs,d:pathData(o.cmds)});
  setHelp(el,`${o.id} · ${cfg.name} · ${human(o.bbox.w*scale)} × ${human(o.bbox.h*scale)} mm. Select this path to inspect or assign its operation.`);svg.append(el);
 }
 if(repairPreview&&(mode==='paths'||mode==='overlay'))for(const o of repairPreview.objects)svg.append(svgNode('path',{d:pathData(o.cmds),class:'repair-preview','aria-label':'Proposed repair, not applied','pointer-events':'none'}));
 if(markPreview&&(mode==='paths'||mode==='overlay'))for(const o of markPreview.objects){
  const ci=o.layer==='holes'&&$('resizeHoles').checked?circleInfo(o):null;
  const attrs={class:'mark-group-preview','aria-label':'Proposed round-mark assignment, not applied','pointer-events':'none'};
  svg.append(ci?svgNode('circle',{...attrs,cx:ci.cx,cy:ci.cy,r:Number($('holeDiameter').value)/(2*scale)}):svgNode('path',{...attrs,d:pathData(o.cmds)}));
 }
 if(duplicatePreview&&(mode==='paths'||mode==='overlay'))for(const id of [...duplicatePreview.keepIds,...duplicatePreview.removeIds]){const o=objects.find(o=>o.id===id);if(!o)continue;svg.append(svgNode('path',{d:pathData(o.cmds),class:duplicatePreview.removeIds.includes(id)?'duplicate-remove':'duplicate-keep','aria-label':duplicatePreview.removeIds.includes(id)?'Proposed duplicate removal, not applied':'Retained source path','pointer-events':'none'}));}
 if(boundaryOverlay&&(mode==='paths'||mode==='overlay')){const part=currentBoundary();if(part){
  for(const gap of part.gaps){svg.append(svgNode('line',{x1:gap.a[0],y1:gap.a[1],x2:gap.b[0],y2:gap.b[1],class:'boundary-gap'}));svg.append(svgNode('circle',{cx:(gap.a[0]+gap.b[0])/2,cy:(gap.a[1]+gap.b[1])/2,r:.85,class:'boundary-gap-marker','aria-label':`Endpoint gap ${gap.distance.toFixed(3)} mm`}));}
  for(const branch of part.branches)svg.append(svgNode('circle',{cx:branch.point[0],cy:branch.point[1],r:1,class:'boundary-branch','aria-label':'Ambiguous boundary junction'}));
  for(const end of part.freeEnds)svg.append(svgNode('circle',{cx:end.point[0],cy:end.point[1],r:.65,class:'boundary-free','aria-label':'Free boundary endpoint'}));
 }}
 if(measurePoints.length){svg.append(svgNode('circle',{cx:measurePoints[0][0],cy:measurePoints[0][1],r:1,fill:'#235840'}));if(measurePoints.length===2)svg.append(svgNode('line',{x1:measurePoints[0][0],y1:measurePoints[0][1],x2:measurePoints[1][0],y2:measurePoints[1][1],stroke:'#235840','stroke-width':.25,'stroke-dasharray':'1 1'}));}
 svg.addEventListener('click',e=>{
  if(boxTool?.consumeClick())return;
  if(selectRasterMode)return;
  if(measureMode){const q=svg.createSVGPoint();q.x=e.clientX;q.y=e.clientY;const pt=q.matrixTransform(svg.getScreenCTM().inverse());if(measurePoints.length===2)measurePoints=[];measurePoints.push([pt.x,pt.y]);if(measurePoints.length===2){const length=dist(...measurePoints);$('measured').value=length.toFixed(4);$('measureReadout').textContent=`${human(length*scale)} mm output / ${human(length)} mm source`;toast('Distance measured. Enter its known size to calibrate.');}renderStage();return;}
  clearPreviewState();const id=e.target.closest('[data-id]')?.getAttribute('data-id');if(id)select(id,e.shiftKey);else {if(!e.shiftKey)selected.clear();renderSelection();renderStage();renderList();}
 });wireRasterSelection(svg);boxTool=wireManualSelection(svg);selectionMarquee=boxTool;p.append(svg);$('viewSummary').textContent=`${human(pageInfo.width*scale)} × ${human(pageInfo.height*scale)} mm page · ${objects.length} objects`;}
function updateEditorTools(){const active=!!pageInfo&&!measureMode&&!selectRasterMode&&(mode==='paths'||mode==='overlay');$('selectTool').disabled=!pageInfo;$('selectTool').classList.toggle('primary',active);$('selectTool').setAttribute('aria-pressed',String(active));$('measureTool').setAttribute('aria-pressed',String(measureMode));$('stage').classList.toggle('box-select-ready',active);}
function previewSelectionBounds(o){const ci=o.layer==='holes'&&$('resizeHoles').checked?circleInfo(o):null;if(ci){const radius=Number($('holeDiameter').value)/(2*scale);if(Number.isFinite(radius)&&radius>0)return {x:ci.cx-radius,y:ci.cy-radius,w:2*radius,h:2*radius};}return o.bbox;}
function wireManualSelection(svg){
 const host=$('stage'),displayBounds=new Map(objects.map(o=>[o.id,previewSelectionBounds(o)]));let rectangle=null,priorReadout=$('measureReadout').textContent;
 const mark=ids=>{for(const node of svg.querySelectorAll('[data-id]'))node.classList.toggle('selected',ids.has(node.getAttribute('data-id')));};
 const clearBox=()=>{if(rectangle){rectangle.remove();rectangle=null;}for(const node of svg.querySelectorAll('.marquee-hit'))node.classList.remove('marquee-hit');};
 return createBoxSelector({host,
  enabled:()=>!pendingPreview()&&!loading&&!measureMode&&!selectRasterMode&&(mode==='paths'||mode==='overlay'),
  toPoint:e=>{const matrix=svg.getScreenCTM();if(!matrix)return null;const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const q=p.matrixTransform(matrix.inverse());return {x:q.x,y:q.y};},
  getObjects:()=>objects,getVisible:()=>visible,getBounds:o=>displayBounds.get(o.id),getSelected:()=>selected,
  onPreview:({box,hits,ids,additive})=>{if(!rectangle){priorReadout=$('measureReadout').textContent;rectangle=svgNode('rect',{class:'marquee-box','pointer-events':'none'});svg.append(rectangle);}for(const [key,value]of Object.entries({x:box.x,y:box.y,width:box.w,height:box.h}))rectangle.setAttribute(key,value);mark(ids);for(const node of svg.querySelectorAll('[data-id]'))node.classList.toggle('marquee-hit',hits.has(node.getAttribute('data-id')));$('measureReadout').textContent=`${ids.size} selected · ${hits.size} inside box${additive?' · adding':''}`;},
  onCommit:ids=>{clearBox();selected=ids;mark(ids);renderSelection();renderList();$('measureReadout').textContent=`${ids.size} paths selected · Shift-drag adds · Escape clears`;setStatus(`${ids.size} paths selected. Assign an operation, exclude, join or split them in the inspector.`);},
  onCancel:before=>{clearBox();mark(before);$('measureReadout').textContent=priorReadout;},
  onBlankClick:additive=>{if(!additive){selected.clear();mark(selected);renderSelection();renderList();$('measureReadout').textContent='Left-drag selects whole paths · Shift-drag adds';}}
 });
}

function select(id,add=false){clearPreviewState();if(!add)selected=new Set([id]);else if(selected.has(id))selected.delete(id);else selected.add(id);const o=objects.find(x=>x.id===id);if(o&&!visible[o.layer]){visible[o.layer]=true;renderLayers();}renderStage();renderSelection();renderList();}
function filtered(){const f=$('filter').value;return objects.filter(o=>f==='all'||o.layer===f);}
function renderList(){const list=$('objectList');list.replaceChildren();const shown=filtered();if(!shown.length){const empty=document.createElement('div');empty.className='small';empty.style.padding='12px';empty.textContent=pageInfo?'No objects in this category.':'No geometry yet.';list.append(empty);return;}
 const all=document.createElement('button');all.className='object-row';all.style.display='block';all.textContent=`Select all ${shown.length} listed objects`;all.onclick=()=>{clearPreviewState();selected=new Set(shown.map(o=>o.id));for(const o of shown)visible[o.layer]=true;renderStage();renderSelection();renderList();renderLayers();};setHelp(all,'Select every object in the current list category. This changes selection only; use Assign operation to edit their roles.');list.append(all);
 for(const o of shown){const row=document.createElement('button');row.className='object-row'+(selected.has(o.id)?' selected':'');row.setAttribute('role','listitem');const dot=document.createElement('span');dot.className='dot';dot.style.setProperty('--c',LAYERS[o.layer].color);const label=document.createElement('span');label.textContent=o.id+' · '+(o.closed?'closed':'open');const size=document.createElement('span');size.textContent=human(Math.max(o.bbox.w,o.bbox.h)*scale)+' mm';row.append(dot,label,size);row.onclick=e=>select(o.id,e.shiftKey);setHelp(row,'Select this path to inspect its size and operation. Shift-click to add or remove it from a multiple selection.');list.append(row);}}
function renderSelection(){renderReview();const chosen=objects.filter(o=>selected.has(o.id));$('selectedCount').textContent=chosen.length+' SELECTED';$('noSelection').hidden=!!chosen.length;$('selectionPanel').hidden=!chosen.length;if(!chosen.length)return;const b=selectedBounds(chosen);$('selectedName').textContent=chosen.length===1?chosen[0].id:chosen.length+' paths';$('selectedInfo').textContent=`${human(b.w*scale)} × ${human(b.h*scale)} mm · ${chosen.filter(o=>!o.closed).length} open`;
 const ls=new Set(chosen.map(o=>o.layer));$('assignment').value=ls.size===1?chosen[0].layer:'';const ci=chosen.length===1?circleInfo(chosen[0],{maxDiameter:10}):null;$('selectionReason').textContent=chosen.length===1?chosen[0].reason+(ci?` · original diameter ${human(ci.r*2*scale)} mm`:''):'Use the operation selector to assign all selected paths.';
 $('closeSelected').disabled=chosen.every(o=>o.closed);$('joinSelected').disabled=chosen.filter(o=>!o.closed).length<2;
}
function renderMarkReview(){
 if(markGroupsKey&&markGroupsKey!==markGroupStateKey(objects)){resetMarkGroups();$('markGroupSelect').replaceChildren();$('markGroupRole').value='';}
 $('findMarkGroups').disabled=!pageInfo;
 $('markGroupControls').hidden=!markGroups.length;
 $('markGroupCount').textContent=markGroupsKey?`${markGroups.length} suggested groups`:pageInfo?'Not scanned':'No paths loaded';
 $('markScanInfo').textContent=markDiagnostics?markScanSummary(markDiagnostics):'';
 $('markScanNotes').hidden=!markDiagnostics;
 const group=markGroups[Number($('markGroupSelect').value)||0];
 $('markGroupInfo').textContent=group?`${group.positionCount} editable positions · ${group.ids.length} editable paths · ${group.shape} · source diameter ${group.diameterMin.toFixed(2)}–${group.diameterMax.toFixed(2)} mm ${group.spacing===null?' · includes disconnected rows, corners and hardware candidates.':` · spacing about ${group.spacing.toFixed(2)} mm.`} ${group.manualCount} manual assignment${group.manualCount===1?'':'s'} excluded from changes. Currently: ${group.currentLayers.map(k=>LAYERS[k].name).join(', ')}.${group.currentLayers.length===1&&['holes','hardware'].includes(group.currentLayers[0])?' Already assigned; applying confirms this operation.':''}${group.overlapCount?` ${group.overlapCount} overlapping copies retained.`:''}`:'';
 $('previewMarkGroup').disabled=!group||!$('markGroupRole').value||!!pendingPreview();
 $('markPreviewPanel').hidden=!markPreview;
 $('applyMarkGroup').disabled=!markPreview;
 $('markGroupSummary').textContent=markPreview?markPreview.summary+(markPreview.layer==='holes'&&$('resizeHoles').checked?` The current stitch-hole resize setting (${Number($('holeDiameter').value).toFixed(2)} mm output) applies to these marks.`:''):'';
}
$('markGroupScope').onchange=()=>{resetMarkGroups();$('markGroupSelect').replaceChildren();$('markGroupRole').value='';renderStage();renderSelection();};
$('findMarkGroups').onclick=()=>{
 if(loading||!pageInfo)return;clearPreviewState();
 try{const scan=scanRoundMarks(objects,{scope:$('markGroupScope').value||'rows'});markGroups=scan.groups;markDiagnostics=scan.diagnostics;markGroupsKey=markGroupStateKey(objects);$('markGroupSelect').replaceChildren();
  for(const [i,group]of markGroups.entries()){const option=document.createElement('option');option.value=String(i);option.textContent=`${group.scope==='piece'?'Piece':'Group'} ${i+1}: ${group.positionCount} positions · ${group.ids.length} editable paths`;$('markGroupSelect').append(option);}
  $('markGroupSelect').value='0';$('markGroupRole').value='';renderStage();renderSelection();
  toast(markGroups.length?'Choose a group and its intended operation, then preview the assignment.':($('markGroupScope').value==='piece'?'No editable round marks inside closed cut boundaries. Review open boundaries or use manual selection.':'No regular round-mark rows found. Try Whole piece scope, manual selection, or review outer boundaries.'));
 }catch(error){resetMarkGroups();renderStage();renderSelection();toast(error.message);}
};
for(const id of ['markGroupSelect','markGroupRole'])$(id).onchange=()=>{if(markPreview)markPreview=null;renderStage();renderSelection();};
$('previewMarkGroup').onclick=()=>{
 try{const group=markGroups[Number($('markGroupSelect').value)||0],preview=previewMarkGroup(objects,group,$('markGroupRole').value);clearPreviewState();measureMode=false;selectRasterMode=false;measurePoints=[];$('measureTool').classList.remove('primary');$('selectRasterArea').classList.remove('primary');mode='overlay';updateMode();
  markPreview=preview;selected=new Set(preview.ids);for(const o of objects)if(selected.has(o.id))visible[o.layer]=true;renderLayers();renderStage();renderSelection();renderList();focusSelectedGeometry('auto');
 }catch(error){cancelRepairPreview();toast(error.message);}
};
$('applyMarkGroup').onclick=()=>{
 if(!markPreview)return;
 try{const preview=markPreview,next=applyMarkGroup(objects,preview);checkpoint();objects=next;selected=new Set(preview.ids);render();toast('Round-mark group assigned. Geometry is unchanged. Undo restores previous operations; find groups again to review remaining marks.');}catch(error){cancelRepairPreview();toast(error.message);}
};
$('cancelMarkGroup').onclick=cancelRepairPreview;
function duplicateChoices(){return (duplicateScan?.groups||[]).filter(g=>g.kind===($('duplicateKind').value||'exact'));}
function populateDuplicateChoices(){
 const groups=duplicateChoices();$('duplicateGroup').replaceChildren();
 const all=document.createElement('option');all.value='all';all.textContent=`All compatible groups (${groups.length})`;$('duplicateGroup').append(all);
 for(const group of groups){const option=document.createElement('option');option.value=group.id;option.textContent=`Keep ${group.keepIds.join(', ')} · remove ${group.removeIds.length}`;$('duplicateGroup').append(option);}
 $('duplicateGroup').value=$('duplicateKind').value==='near'&&groups.length?groups[0].id:'all';
}
function renderDuplicateReview(){
 if(duplicateScan&&duplicateScan.sourceKey!==duplicateStateKey(objects))resetDuplicateReview();
 $('findDuplicates').disabled=!pageInfo;$('duplicateControls').hidden=!duplicateScan?.groups.length;
 const exact=duplicateScan?.groups.filter(g=>g.kind==='exact').length||0,near=duplicateScan?.groups.filter(g=>g.kind==='near').length||0;
 $('duplicateCount').textContent=duplicateScan?`${exact} exact · ${near} near`:'Not scanned';
 $('duplicateScanInfo').textContent=duplicateScan?`${exact} removable exact groups; ${near} removable near groups. ${duplicateScan.blocked.length} groups left for manual review (protected copies, conflicting operations/styles or unsupported geometry). ${duplicateScan.protectedManualPaths} paths have manual assignments; ${duplicateScan.includeManualCopies?'matching redundant manual copies are allowed, with a manual keeper retained':'all manual paths are protected'}. Near groups can also contain exact copies.`:'';
 const groups=duplicateChoices(),choice=$('duplicateGroup').value,group=groups.find(g=>g.id===choice);
 $('duplicateGroupInfo').textContent=group?`Retain: ${group.keepIds.join(', ')}. Remove: ${group.removeIds.join(', ')}. ${group.manualCount} source paths have manual assignments.`:groups.length?`${groups.length} compatible groups; ${groups.reduce((n,g)=>n+g.removeIds.length,0)} paths proposed for removal.`:'No removable groups of this match type.';
 if($('duplicateKind').value==='near'&&groups.length)$('duplicateGroupInfo').textContent+=' Near matching uses source centers within 0.03 mm or 10% of diameter, whichever is smaller, and nearly equal diameters. Inspect the original PDF.';
 $('previewDuplicates').disabled=!groups.length||!!pendingPreview();$('duplicatePreviewPanel').hidden=!duplicatePreview;$('applyDuplicates').disabled=!duplicatePreview;
 $('duplicateSummary').textContent=duplicatePreview?duplicatePreview.summary+(duplicatePreview.kind==='near'?` Maximum source center offset: ${duplicatePreview.maxCenterOffset.toFixed(4)} mm; diameter difference: ${duplicatePreview.maxDiameterDifference.toFixed(4)} mm.`:'')+' Overlay shows source paths; export hole-resizing settings stay unchanged.':'';
}
$('duplicateManual').onchange=()=>{resetDuplicateReview();renderStage();renderSelection();};
$('findDuplicates').onclick=()=>{
 if(loading||!pageInfo)return;clearPreviewState();
 try{duplicateScan=findDuplicateGroups(objects,{includeManualCopies:$('duplicateManual').checked});$('duplicateKind').value='exact';populateDuplicateChoices();renderStage();renderSelection();toast('Choose exact copies or near overlaps, then inspect a removal preview.');}catch(error){resetDuplicateReview();renderStage();renderSelection();toast(error.message);}
};
$('duplicateKind').onchange=()=>{clearPreviewState();populateDuplicateChoices();renderStage();renderSelection();};
$('duplicateGroup').onchange=()=>{clearPreviewState();renderStage();renderSelection();};
$('previewDuplicates').onclick=()=>{
 try{const choice=$('duplicateGroup').value,preview=previewDuplicateRemoval(objects,duplicateScan,{kind:$('duplicateKind').value||'exact',groupIds:choice==='all'?null:[choice]});clearPreviewState();measureMode=false;selectRasterMode=false;measurePoints=[];$('measureTool').classList.remove('primary');$('selectRasterArea').classList.remove('primary');mode='overlay';updateMode();duplicatePreview=preview;selected=new Set(preview.ids);for(const o of objects)if(selected.has(o.id))visible[o.layer]=true;renderLayers();renderStage();renderSelection();renderList();focusSelectedGeometry('auto');}catch(error){cancelRepairPreview();toast(error.message);}
};
$('applyDuplicates').onclick=()=>{
 if(!duplicatePreview)return;
 try{const preview=duplicatePreview,next=applyDuplicateRemoval(objects,preview);checkpoint();objects=next;stats.duplicatePaths=(stats.duplicatePaths||0)+preview.removeIds.length;selected=new Set(preview.keepIds);render();toast(`${preview.removeIds.length} duplicate paths removed. Retained source paths are unchanged. Undo restores removals. Rebuilding cleanup or retracing can reintroduce source copies.`);}catch(error){cancelRepairPreview();toast(error.message);}
};
$('cancelDuplicates').onclick=cancelRepairPreview;
function currentBoundary(){return boundaryScan?.components.find(c=>c.id===boundaryId);}
function renderBoundaryReview(){
 if(boundaryScan&&boundaryScan.sourceKey!==reviewStateKey(objects))resetBoundaryReview();
 $('scanBoundaries').disabled=!pageInfo;$('boundaryControls').hidden=!boundaryScan?.components.length;
 $('boundaryCount').textContent=boundaryScan?`${boundaryScan.components.length} components`:'Not scanned';
 $('boundaryScanInfo').textContent=boundaryScan?`${boundaryScan.components.length} unresolved open-boundary components; ${boundaryScan.components.filter(c=>c.repairable).length} have a bounded repair preview. Separate disconnected fragments may belong to the same physical piece; use the PDF to verify.`:'';
 const part=currentBoundary(),active=!!(part&&repairPreview&&part.ids.length===repairPreview.ids.length&&part.ids.every(id=>repairPreview.ids.includes(id)));
 $('boundaryInfo').textContent=part?`${part.ids.length} paths · source bounds ${part.bbox.w.toFixed(3)} × ${part.bbox.h.toFixed(3)} mm · ${part.gaps.length} nearby endpoint gaps · ${part.branches.length} branching junctions · ${part.freeEnds.length} free endpoints. ${part.reason}`:'';
 $('boundaryDetails').textContent=part?[`Paths: ${part.ids.join(', ')}`,part.gaps.length?'Endpoint gaps: '+part.gaps.map(g=>g.distance.toFixed(3)+' mm').join(', '):'',part.branches.length?'Junction paths: '+[...new Set(part.branches.flatMap(b=>b.ids))].join(', '):'',part.freeEnds.length?'Free endpoints: '+part.freeEnds.map(e=>`${e.id} at ${e.point[0].toFixed(3)}, ${e.point[1].toFixed(3)} mm`).join('; '):''].filter(Boolean).join('\n'):'';
 $('showBoundary').disabled=!part;$('previewBoundary').disabled=!part?.repairable||!!pendingPreview();$('boundaryPreviewPanel').hidden=!active;$('applyBoundary').disabled=!active;$('boundarySummary').textContent=active?repairPreview.summary:'';
}
function showBoundary(){
 const part=currentBoundary();if(!part)return;clearPreviewState();measureMode=false;selectRasterMode=false;measurePoints=[];$('measureTool').classList.remove('primary');$('selectRasterArea').classList.remove('primary');mode='overlay';updateMode();boundaryOverlay=true;selected=new Set(part.ids);for(const o of objects)if(selected.has(o.id))visible[o.layer]=true;renderLayers();renderStage();renderSelection();renderList();focusSelectedGeometry('auto');
}
$('scanBoundaries').onclick=()=>{
 if(loading||!pageInfo)return;clearPreviewState();
 try{boundaryScan=findBoundaryIssues(objects,settings());$('boundarySelect').replaceChildren();for(const [i,part]of boundaryScan.components.entries()){const option=document.createElement('option');option.value=part.id;option.textContent=`Boundary ${i+1}: ${part.ids.length} paths · ${part.repairable?'preview available':'manual review'}`;$('boundarySelect').append(option);}boundaryId=boundaryScan.components[0]?.id||null;$('boundarySelect').value=boundaryId||'';if(boundaryId)showBoundary();else{renderStage();renderSelection();toast('No unresolved open boundaries found. Assigned open guides are preserved; closed features may still need operation assignment.');}}catch(error){resetBoundaryReview();renderStage();renderSelection();toast(error.message);}
};
$('boundarySelect').onchange=()=>{boundaryId=$('boundarySelect').value;showBoundary();};$('showBoundary').onclick=showBoundary;
$('previewBoundary').onclick=()=>{
 const part=currentBoundary();if(!part||boundaryScan.sourceKey!==reviewStateKey(objects))return;
 const preview=suggestedRepair(objects,part.targetId,settings());if(!preview){toast(boundaryRepairExplanation(objects,part.targetId,settings()));return;}
 showBoundary();repairPreview=preview;boundaryOverlay=true;renderStage();renderSelection();renderList();
};
$('applyBoundary').onclick=()=>$('applyRepair').onclick();$('cancelBoundary').onclick=cancelRepairPreview;
function currentReviewItems(){const audit=currentAudit();return reviewItems(objects,audit);}
function renderReview(){renderMarkReview();renderDuplicateReview();renderBoundaryReview();
 const queue=currentReviewItems();
 const active=repairPreview?queue.find(o=>o.id===repairPreview.targetId):selected.size===1?queue.find(o=>selected.has(o.id)):null;
 const index=active?queue.findIndex(o=>o.id===active.id):-1;
 $('reviewCount').textContent=index>=0?`${index+1} / ${queue.length}`:`${queue.length} need review`;
 for(const id of ['reviewPrev','reviewNext'])$(id).disabled=!queue.length;
 $('reviewExplanation').textContent=active?`${active.id}: ${reviewExplanation(active,objects,settings())}`:queue.length?'Use Next item to inspect each unresolved or possibly excluded feature.':pageInfo?'No unresolved or suspected excluded paths. Check the overlay and scale before export.':'Load a pattern to review unresolved or possibly excluded features.';
 $('previewRepair').disabled=!active||!!pendingPreview()||active.closed||active.layer!=='unassigned'||active.clipped||!!active.dash?.length;
 $('repairPreviewPanel').hidden=!repairPreview;
 $('applyRepair').disabled=!repairPreview;
 $('repairSummary').textContent=repairPreview?.summary||'';
 $('saveProject').disabled=!pageInfo||!!pendingPreview();
 updateExportState();
}
function navigateReview(direction){
 clearPreviewState();const queue=currentReviewItems();if(!queue.length)return;
 const current=selected.size===1?queue.findIndex(o=>selected.has(o.id)):-1;
 const index=current<0?(direction<0?queue.length-1:0):(current+direction+queue.length)%queue.length;
 measureMode=false;selectRasterMode=false;measurePoints=[];$('measureTool').classList.remove('primary');$('selectRasterArea').classList.remove('primary');
 if(mode==='original'||mode==='mask'){mode='overlay';updateMode();}
 $('filter').value='all';select(queue[index].id);focusSelectedGeometry('auto');
}
function cancelRepairPreview(){clearPreviewState();renderStage();renderSelection();renderList();}
$('reviewPrev').onclick=()=>navigateReview(-1);
$('reviewNext').onclick=()=>navigateReview(1);
$('previewRepair').onclick=()=>{
 clearPreviewState();const active=currentReviewItems().find(o=>selected.size===1&&selected.has(o.id));if(!active)return;
 const suggestion=suggestedRepair(objects,active.id,settings());
 if(!suggestion){toast(boundaryRepairExplanation(objects,active.id,settings()));return;}
 measureMode=false;selectRasterMode=false;measurePoints=[];$('measureTool').classList.remove('primary');$('selectRasterArea').classList.remove('primary');mode='overlay';updateMode();
 repairPreview=suggestion;selected=new Set(suggestion.ids);for(const o of objects)if(selected.has(o.id))visible[o.layer]=true;
 renderLayers();renderStage();renderSelection();renderList();
};
$('applyRepair').onclick=()=>{
 if(!repairPreview)return;
 try{const preview=repairPreview,next=applySuggestedRepair(objects,preview);checkpoint();objects=next;stats.joins=(stats.joins||0)+preview.joins;stats.maxGap=Math.max(stats.maxGap||0,preview.gap);selected=new Set(preview.objects.map(o=>o.id));render();toast('Previewed repair applied. Check internal operation assignments. Undo restores the original paths.');}catch(error){cancelRepairPreview();toast(error.message);}
};
$('cancelRepair').onclick=cancelRepairPreview;
$('tolerance').oninput=()=>{if(!pageInfo)return;if(pendingPreview())cancelRepairPreview();else renderReview();};
function renderPieces(){const dest=$('pieces');dest.replaceChildren();if(!pageInfo)return;const pieces=findPieces(objects);const heading=document.createElement('p');heading.textContent=`${pieces.length} closed outer contours available`;dest.append(heading);for(const piece of pieces){const row=document.createElement('div');row.className='piece';const text=document.createElement('span'),b=selectedBounds(piece.objects);text.textContent=`${piece.name} · ${human(b.w*scale)} × ${human(b.h*scale)}`;const btn=document.createElement('button');btn.textContent='SVG';setHelp(btn,'Export this closed outer contour with its contained assigned features. The canvas fits the piece with a 1 mm source-space margin. Page-wide review checks still apply.');btn.disabled=currentAudit().blocked;btn.onclick=()=>{try{ensureExportReady();download(`${safeBase()}_${piece.name.replace(' ','_')}.svg`,exportSVG(piece.objects,{...currentOptions(),crop:true,title:fileName+' · '+piece.name}));}catch(e){toast(e.message);}};row.append(text,btn);dest.append(row);}}
function render(){updateRasterUI();renderLayers();renderStage();renderSelection();renderList();renderPieces();updateExportState();$('duplicates').textContent=stats.duplicateSegments??'—';$('joins').textContent=stats.joins??'—';$('maxGap').textContent=stats.maxGap!==undefined?human(stats.maxGap)+' mm':'—';$('scaleLabel').textContent=(scale*100).toFixed(3)+'%';$('undo').disabled=!history.length;for(const id of ['saveProject','rebuild','report','calibrate','resetScale'])$(id).disabled=!pageInfo;$('saveProject').disabled=!pageInfo||!!pendingPreview();
 $('issues').replaceChildren();const notes=[...warnings];const ref=objects.filter(o=>o.layer==='reference').length;if(ref)notes.push(`${ref} reference paths are excluded. These include annotations, branding, masks and tiny fragments; inspect their classification.`);const open=objects.filter(o=>!o.closed&&exportLayers.has(o.layer)).length;if(open)notes.push(`${open} assigned export paths are open. They will remain open in the SVG.`);notes.push('Raster traces are approximate; selectable text suppression and thresholding do not guarantee removal of every annotation. Self-intersection repair and kerf compensation are not included.');for(const note of notes){const li=document.createElement('li');li.textContent=note;$('issues').append(li);}}
async function loadPDF(bytes,name){if(loading)return;if(pendingPreview())cancelRepairPreview();const token=++sourceToken;busy('Opening PDF and reading page geometry…');try{
 const next=await pdfjs.getDocument({data:bytes,isEvalSupported:false,stopAtErrors:false}).promise;if(token!==sourceToken){await next.destroy();return;}if(doc)await doc.destroy();doc=next;fileName=name;history=[];scale=1;raw=[];objects=[];pageInfo=null;referenceImage='';selected.clear();$('fileName').textContent=name;$('page').replaceChildren();for(let i=1;i<=doc.numPages;i++){const option=document.createElement('option');option.value=i;option.textContent='Page '+i;$('page').append(option);}$('page').disabled=doc.numPages<2;await readPage(1);toast(conversionMode==='raster'?'Image-based PDF loaded. Select a pattern area, then click Trace area.':'PDF loaded. Review the amber paths and reference artwork.');
 }catch(e){console.error(e);toast('Could not load PDF: '+e.message);}finally{busy('');}}
async function readPage(number){clearPreviewState();resetMarkGroups();resetDuplicateReview();resetBoundaryReview();const p=await doc.getPage(number),vp=p.getViewport({scale:1});const extracted=extract(await p.getOperatorList(),vp,pdfjs.OPS);sourceFingerprint=doc.fingerprints?.[0]||null;vectorRaw=extracted.objects;raw=vectorRaw;warnings=extracted.warnings.filter(w=>!w.includes('Scanned PDFs need')).map(w=>w.startsWith('Raster images detected:')?'Image content detected. Use Raster trace mode to select and convert image areas.':w);rasterBatches=[];rasterCanvas=null;rasterMask=null;rasterRegion=null;rasterReviewed=false;rasterCounter=0;selectRasterMode=false;conversionMode=!raw.length?'raster':'vector';if(conversionMode==='raster')raw=[];pageInfo={width:vp.width*MM,height:vp.height*MM,number};scale=1;history=[];selected.clear();measurePoints=[];
 // Read operators before rendering: PDF.js can replace its packed data with Path2D while rendering.
 const maxSide=1500,renderScale=Math.min(2,maxSide/Math.max(vp.width,vp.height));const canvas=document.createElement('canvas'),rv=p.getViewport({scale:renderScale});canvas.width=Math.ceil(rv.width);canvas.height=Math.ceil(rv.height);
 try{await p.render({canvasContext:canvas.getContext('2d'),viewport:rv,background:'white'}).promise;referenceImage=canvas.toDataURL('image/png');}catch(e){referenceImage='';warnings.push('PDF reference preview could not render: '+e.message);}
 const result=prepare(raw,settings());objects=result.objects;stats=result.stats;$('pageSize').textContent=`${human(pageInfo.width)} × ${human(pageInfo.height)} mm · ${doc.numPages} page${doc.numPages===1?'':'s'}`;$('zoom').value=100;$('filter').value='unassigned';mode=conversionMode==='raster'?'original':'paths';updateMode();render();}
function updateMode(){const hadPreview=!!pendingPreview();clearPreviewState();for(const [id,val]of [['viewPaths','paths'],['viewOverlay','overlay'],['viewOriginal','original'],['viewMask','mask']])$(id).classList.toggle('active',mode===val);if(hadPreview)renderReview();}
function assign(layer){if(!selected.size||!LAYERS[layer])return;checkpoint();for(const o of objects)if(selected.has(o.id)){o.layer=layer;o.manualLayer=layer;o.reason='Manually assigned';}render();}
function decode64(s){const b=atob(s),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a;}
function report(){const sourceBounds=selectedBounds(objects.filter(o=>exportLayers.has(o.layer)));return {utility:'Pattern / laser 0.4.0',source:fileName,sourceFingerprint,page:pageInfo,conversionMode,rasterTracing:rasterBatches.map(b=>({id:b.id,region:b.region,settings:b.settings,stats:b.stats})),outputScale:scale,cleanup:settings(),stats,counts:layerCounts(),boundaryReview:boundaryScan&&boundaryScan.sourceKey===reviewStateKey(objects)?{limit:boundaryScan.limit,components:boundaryScan.components}:null,exportAudit:currentAudit(),exportLayers:[...exportLayers],holeResizing:$('resizeHoles').checked?Number($('holeDiameter').value):null,outputBoundsMm:Object.fromEntries(Object.entries(sourceBounds).map(([k,v])=>[k,v*scale])),warnings,unresolved:objects.filter(o=>o.layer==='unassigned').map(o=>({id:o.id,bbox:o.bbox,reason:o.reason})),paths:objects.map(o=>({id:o.id,sourceIds:o.sourceIds,layer:o.layer,closed:o.closed,boundsMm:o.bbox,reason:o.reason,detectedRole:o.autoRole||null,possiblePatternFeature:!!o.omissionCandidate}))};}
function updateRasterUI(){
 $('attachRasterSource').hidden=!!doc||!rasterBatches.length;$('conversionMode').value=conversionMode;$('conversionMode').disabled=!pageInfo;$('rasterPanel').hidden=conversionMode!=='raster';
 $('selectRasterArea').disabled=!pageInfo||!doc;$('previewRaster').disabled=!pageInfo||!doc||!rasterRegion;$('traceRaster').disabled=!pageInfo||!doc||!rasterRegion;$('clearRaster').disabled=!rasterBatches.length;
 $('rasterReviewed').checked=rasterReviewed;$('rasterReviewed').disabled=!rasterBatches.length;$('viewMask').hidden=!rasterMask;
 $('rasterThresholdValue').textContent=$('rasterThreshold').value;
 $('rasterAreaLabel').textContent=rasterRegion?`${human(rasterRegion.w)} × ${human(rasterRegion.h)} mm at ${human(rasterRegion.x)}, ${human(rasterRegion.y)}`:'No area selected · select one pattern piece at a time';
 if(rasterRegion)for(const [id,key]of [['rasterX','x'],['rasterY','y'],['rasterW','w'],['rasterH','h']])$(id).value=Number(rasterRegion[key].toFixed(3));
 const a=rasterAudit(objects,{reviewed:rasterReviewed,layers:[...exportLayers],batches:rasterBatches});
 $('rasterStats').textContent=rasterBatches.length?`${a.batchCount} traced areas · ${a.included} included paths. Options omitted ${a.omittedPoints} point marks and ${a.omittedShortLines} short open strokes.`:'Outlines are traced to a single centreline. Small round marks and short open guides are optional.';
 if(rasterBatches.length){const last=rasterBatches[rasterBatches.length-1];$('rasterStats').textContent+=` Last trace: ${last.settings.dpi} DPI, threshold ${last.settings.threshold}, tolerance ${last.settings.simplifyMm} mm.`;}
 if(a.borderComponents)$('rasterStats').textContent+=` ${a.borderComponents} components touched a selection edge; check for cropped geometry.`;
}
function clipRasterRegion(r){const x=Math.max(0,Math.min(pageInfo.width,Number(r.x))),y=Math.max(0,Math.min(pageInfo.height,Number(r.y))),w=Math.min(pageInfo.width-x,Math.max(0,Number(r.w))),h=Math.min(pageInfo.height-y,Math.max(0,Number(r.h)));if(![x,y,w,h].every(Number.isFinite)||w<1||h<1)throw new Error('Choose an area at least 1 × 1 mm, inside the PDF page.');return {x,y,w,h};}
function wireRasterSelection(svg){
 svg.style.touchAction=selectRasterMode?'none':'auto';
 const position=e=>{const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const q=p.matrixTransform(svg.getScreenCTM().inverse());return {x:Math.max(0,Math.min(pageInfo.width,q.x)),y:Math.max(0,Math.min(pageInfo.height,q.y))};};
 let start=null;
 const draw=()=>{let box=svg.querySelector('#rasterSelectionOutline');if(!box){box=svgNode('rect',{id:'rasterSelectionOutline',fill:'#23584018',stroke:'#235840','stroke-width':.3,'stroke-dasharray':'2 1','pointer-events':'none'});svg.append(box);}if(rasterRegion)for(const [attr,key]of [['x','x'],['y','y'],['width','w'],['height','h']])box.setAttribute(attr,rasterRegion[key]);};
 if(rasterRegion&&conversionMode==='raster')draw();
 svg.addEventListener('pointerdown',e=>{if(!selectRasterMode||e.button!==0)return;e.preventDefault();start=position(e);rasterRegion={x:start.x,y:start.y,w:0,h:0};draw();svg.setPointerCapture(e.pointerId);});
 svg.addEventListener('pointermove',e=>{if(!start)return;const q=position(e);rasterRegion={x:Math.min(start.x,q.x),y:Math.min(start.y,q.y),w:Math.abs(q.x-start.x),h:Math.abs(q.y-start.y)};draw();});
 svg.addEventListener('pointerup',e=>{if(!start)return;e.preventDefault();start=null;selectRasterMode=false;$('selectRasterArea').classList.remove('primary');svg.style.touchAction='auto';updateEditorTools();try{rasterRegion=clipRasterRegion(rasterRegion);updateRasterUI();toast('Area selected. Preview the threshold or trace this area.');}catch(error){rasterRegion=null;toast(error.message);renderStage();}if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);});
 svg.addEventListener('pointercancel',()=>{start=null;selectRasterMode=false;$('selectRasterArea').classList.remove('primary');svg.style.touchAction='auto';updateEditorTools();});
}
async function getRasterPixels(){
 if(!doc)throw new Error('Reopen the source PDF to trace additional areas. A saved project retains its geometry but not the high-resolution page canvas.');
 if(!rasterRegion)throw new Error('Select a pattern area first.');const region=clipRasterRegion(rasterRegion),dpi=Number($('rasterDpi').value),suppress=$('rasterSuppressText').checked;
 if(!rasterCanvas||rasterCanvas.dpi!==dpi||rasterCanvas.suppress!==suppress){
  const page=await doc.getPage(pageInfo.number),vp=page.getViewport({scale:dpi/72});
  if(vp.width*vp.height>26000000)throw new Error('This page is too large at this DPI. Choose 150 DPI.');
  const canvas=document.createElement('canvas');canvas.width=Math.ceil(vp.width);canvas.height=Math.ceil(vp.height);const ctx=canvas.getContext('2d',{willReadFrequently:true});await page.render({canvasContext:ctx,viewport:vp,background:'white'}).promise;
  if(suppress){const text=await page.getTextContent();ctx.fillStyle='white';for(const b of rasterTextBoxes(text.items,vp.transform))ctx.fillRect(b.x,b.y,b.w,b.h);}
  rasterCanvas={canvas,dpi,suppress};
 }
 const c=rasterCanvas.canvas,px=pageInfo.width/c.width,py=pageInfo.height/c.height,x=Math.floor(region.x/px),y=Math.floor(region.y/py),w=Math.min(c.width-x,Math.ceil(region.w/px)),h=Math.min(c.height-y,Math.ceil(region.h/py));
 if(w*h>8000000)throw new Error('Select a smaller area (one pattern piece) or choose 150 DPI.');
 const image=c.getContext('2d',{willReadFrequently:true}).getImageData(x,y,w,h);
 return {image,region:{x:x*px,y:y*py,w:w*px,h:h*py},settings:{threshold:Number($('rasterThreshold').value),pixelMmX:px,pixelMmY:py,xMm:x*px,yMm:y*py,minAreaMm2:Number($('rasterSpeckle').value),pruneMm:Number($('rasterPrune').value),simplifyMm:Number($('rasterSimplify').value),includePoints:$('rasterPoints').checked,includeOpen:$('rasterOpen').checked}};
}
function showRasterMask(pixels){const {image,settings,region}=pixels,canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const copy=new ImageData(new Uint8ClampedArray(image.data),image.width,image.height);for(let i=0;i<copy.data.length;i+=4){const v=(.2126*copy.data[i]+.7152*copy.data[i+1]+.0722*copy.data[i+2])<settings.threshold?0:255;copy.data[i]=copy.data[i+1]=copy.data[i+2]=v;copy.data[i+3]=255;}canvas.getContext('2d').putImageData(copy,0,0);rasterMask={href:canvas.toDataURL('image/png'),region};}
async function traceInWorker(pixels,prefix){
 const code=`self.onmessage=e=>{try{const result=(${rasterTrace.toString()})(e.data.image,e.data.settings);self.postMessage({result});}catch(error){self.postMessage({error:error.message});}};`,url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));let worker;
 try{worker=new Worker(url);return await new Promise((resolve,reject)=>{worker.onmessage=e=>e.data.error?reject(new Error(e.data.error)):resolve(e.data.result);worker.onerror=()=>reject(new Error('The browser blocked or could not run the trace worker. Open the utility in a recent desktop Chrome or Edge browser.'));worker.postMessage({image:{width:pixels.image.width,height:pixels.image.height,data:pixels.image.data},settings:{...pixels.settings,idPrefix:prefix}},[pixels.image.data.buffer]);});}finally{if(worker)worker.terminate();URL.revokeObjectURL(url);}
}
function overlapRatio(a,b){const intersection=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));return intersection/Math.min(a.w*a.h,b.w*b.h);}
function rebuildRasterGeometry(){raw=rasterBatches.flatMap(b=>b.objects);const result=prepare(raw,settings());objects=result.objects;stats=result.stats;resetSelection();rasterReviewed=false;}
$('conversionMode').onchange=()=>{if(!pageInfo)return;checkpoint();conversionMode=$('conversionMode').value;raw=conversionMode==='raster'?rasterBatches.flatMap(b=>b.objects):vectorRaw;const result=prepare(raw,settings());objects=result.objects;stats=result.stats;resetSelection();mode=conversionMode==='raster'?'original':'paths';updateMode();render();toast(conversionMode==='raster'?'Raster mode: select one pattern area, then trace it.':'Vector geometry restored. Switching modes rebuilds page geometry.');};
$('attachRasterSource').onclick=()=>$('attachRasterFile').click();
$('attachRasterFile').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;busy('Attaching the original source PDF…');let next=null;try{if(!sourceFingerprint)throw new Error('This snapshot has no source fingerprint. Its geometry can still be edited and exported, but a new tracing session is needed to add areas.');next=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false}).promise;if(next.fingerprints?.[0]!==sourceFingerprint)throw new Error('This is a different PDF from the source saved in the project.');const page=await next.getPage(pageInfo.number),vp=page.getViewport({scale:1});if(Math.abs(vp.width*MM-pageInfo.width)>.01||Math.abs(vp.height*MM-pageInfo.height)>.01)throw new Error('The source page dimensions do not match the saved project.');if(doc)await doc.destroy();doc=next;next=null;rasterCanvas=null;updateRasterUI();toast('Original PDF attached. Current edits are retained; tracing new areas rebuilds geometry.');}catch(error){if(next)await next.destroy();toast(error.message);}finally{busy('');}};
$('selectRasterArea').onclick=()=>{measureMode=false;$('measureTool').classList.remove('primary');selectRasterMode=true;mode='original';updateMode();$('selectRasterArea').classList.add('primary');renderStage();toast('Drag a rectangle around one pattern piece. Leave logos and dimension labels outside.');};
for(const id of ['rasterX','rasterY','rasterW','rasterH'])$(id).onchange=()=>{try{rasterRegion=clipRasterRegion({x:$('rasterX').value,y:$('rasterY').value,w:$('rasterW').value,h:$('rasterH').value});updateRasterUI();renderStage();}catch(e){toast(e.message);}};
$('rasterThreshold').oninput=()=>{$('rasterThresholdValue').textContent=$('rasterThreshold').value;};
$('previewRaster').onclick=async()=>{busy('Rendering threshold preview…');try{const pixels=await getRasterPixels();showRasterMask(pixels);mode='mask';updateMode();renderStage();updateRasterUI();toast('Threshold preview ready. Click Trace area to apply these settings to geometry.');}catch(e){toast(e.message);}finally{busy('');}};
$('traceRaster').onclick=async()=>{busy('Tracing the selected area to single centrelines…');try{
 const pixels=await getRasterPixels();showRasterMask(pixels);const prefix='rt'+(++rasterCounter),result=await traceInWorker(pixels,prefix);
 if(!result.objects.length)throw new Error('No usable outline found. Adjust the threshold, enlarge the area, or include open lines.');
 const overlapping=rasterBatches.filter(b=>overlapRatio(b.region,pixels.region)>.05);if(overlapping.some(b=>overlapRatio(b.region,pixels.region)<.7))throw new Error('This area partly overlaps an earlier trace. Use distinct areas, or clear traces before tracing a larger area.');
 checkpoint();rasterBatches=rasterBatches.filter(b=>!overlapping.includes(b));for(const o of result.objects)o.rasterBatch=prefix;
 rasterBatches.push({id:prefix,region:pixels.region,objects:result.objects,stats:result.stats,settings:{...pixels.settings,dpi:Number($('rasterDpi').value),suppressText:$('rasterSuppressText').checked}});rebuildRasterGeometry();mode='overlay';updateMode();render();toast('Raster paths added. Check the overlay and physical scale before export.');
 }catch(e){toast(e.message);}finally{busy('');}};
$('clearRaster').onclick=()=>{checkpoint();rasterBatches=[];rebuildRasterGeometry();rasterMask=null;render();toast('Raster traces cleared. Undo restores them.');};
$('rasterReviewed').onchange=()=>{rasterReviewed=$('rasterReviewed').checked;updateExportState();renderPieces();};
$('viewMask').onclick=()=>{mode='mask';updateMode();renderStage();};

// Initialize controls, before loading the local PDF engine.
for(const [key,cfg]of Object.entries(LAYERS)){
 const opt=document.createElement('option');opt.value=key;opt.textContent=cfg.name;$('assignment').append(opt);const f=opt.cloneNode(true);if(key!=='unassigned')$('filter').append(f);
 if(['reference','unassigned'].includes(key))continue;const label=document.createElement('label');label.className='export-check';const cb=document.createElement('input');cb.type='checkbox';cb.value=key;cb.checked=true;setHelp(cb,'Include '+cfg.name+' in the exported SVG. This is separate from preview visibility. The export inventory shows omitted counts.');cb.onchange=()=>{cb.checked?exportLayers.add(key):exportLayers.delete(key);updateExportState();renderPieces();};const dot=document.createElement('span');dot.className='dot';dot.style.setProperty('--c',cfg.color);label.append(cb,dot,document.createTextNode(cfg.name));$('exportLayers').append(makeHelpRow(label,'Include '+cfg.name+' in SVG export. Unchecking it omits these objects and shows the omitted count in the inventory.','export inclusion for '+cfg.name));
}
const mixed=document.createElement('option');mixed.value='';mixed.textContent='Mixed operations';mixed.disabled=true;$('assignment').prepend(mixed);
$('file').onchange=e=>{const f=e.target.files[0];if(f)f.arrayBuffer().then(b=>loadPDF(new Uint8Array(b),f.name));e.target.value='';};
$('drop').onclick=()=>$('file').click();$('drop').ondragover=e=>{e.preventDefault();$('drop').classList.add('dragging');};$('drop').ondragleave=()=>$('drop').classList.remove('dragging');$('drop').ondrop=async e=>{e.preventDefault();$('drop').classList.remove('dragging');const f=e.dataTransfer.files[0];if(f){if(!/\.pdf$/i.test(f.name)){toast('Choose a PDF file.');return;}await loadPDF(new Uint8Array(await f.arrayBuffer()),f.name);}};
const loadOriginalSample=async()=>{if(loading)return;busy('Loading the original sample PDF…');try{const data=await loadSampleBytes({url:hostedAssets?.sample,embedded:typeof SAMPLE_PDF==='undefined'?null:SAMPLE_PDF,decode64});$('dedupe').checked=true;$('join').checked=true;$('tolerance').value='0.03';busy('');await loadPDF(data,'CARD HOLDER YOMMY.pdf');}catch(e){busy('');toast('Could not load the original sample: '+e.message);}};
const loadSample=async()=>{if(loading)return;busy('Loading the reviewed sample…');try{const data=await loadSampleBytes({url:hostedAssets?.reviewedSample,embedded:typeof SAMPLE_PROJECT==='undefined'?null:SAMPLE_PROJECT,decode64});await restoreProject(JSON.parse(new TextDecoder().decode(data)),{reviewedSample:true});}catch(e){toast('Could not load the supplied sample: '+e.message);}finally{busy('');}};$('sample').onclick=loadSample;$('emptySample').onclick=loadSample;$('originalSample').onclick=loadOriginalSample;
$('page').onchange=async()=>{if(!doc||loading)return;busy('Reading page and rebuilding geometry…');try{await readPage(Number($('page').value));toast('Page changed; previous page edits are not retained. Save a project before switching.');}catch(e){toast(e.message);pageInfo=null;objects=[];raw=[];render();}finally{busy('');}};
$('rebuild').onclick=()=>rebuild(true);
$('assignment').onchange=()=>assign($('assignment').value);$('excludeSelected').onclick=()=>assign('reference');
$('closeSelected').onclick=()=>{const chosen=objects.filter(o=>selected.has(o.id)&&!o.closed),tol=Number($('tolerance').value);const valid=chosen.filter(o=>dist(end(o.cmds[0]),end(last(o.cmds)))<=tol);if(!valid.length){toast('No selected gap is within the join tolerance. Increase tolerance up to 0.2 mm or leave the path open.');return;}checkpoint();for(const o of valid){o.cmds.push(['Z']);refresh(o);o.layer='cut';o.manualLayer='cut';o.reason='Gap closed within chosen tolerance';}render();toast(`Closed ${valid.length} contour${valid.length===1?'':'s'} within tolerance.`);};
$('splitSelected').onclick=()=>{if(!selected.size)return;checkpoint();const split=[];let seq=0;for(const o of objects){if(!selected.has(o.id)){split.push(o);continue;}for(const [p,c]of segments(o.cmds)){const id=o.id+'s'+seq++;split.push(refresh({...structuredClone(o),id,cmds:[['M',...p],c],closed:false,layer:'unassigned',manualLayer:null,reason:'Split segment · assign or join'}));}}objects=split;resetSelection();render();toast('Selected paths split into editable segments. Original source remains available.');};
$('joinSelected').onclick=()=>{const chosen=objects.filter(o=>selected.has(o.id)&&!o.closed);if(chosen.length<2)return;const chosenIds=new Set(chosen.map(o=>o.id)),preservedSelection=[...selected].filter(id=>!chosenIds.has(id));checkpoint();const inputs=chosen.map(o=>({...structuredClone(o),manualLayer:null,layer:'unassigned'}));const result=prepare(inputs,{dedupe:false,join:true,tolerance:Number($('tolerance').value)});objects=[...objects.filter(o=>!chosenIds.has(o.id)),...result.objects];stats.joins=(stats.joins||0)+result.stats.joins;stats.maxGap=Math.max(stats.maxGap||0,result.stats.maxGap);selected=new Set([...preservedSelection,...result.objects.map(o=>o.id)]);render();toast(`${result.stats.joins} endpoint joins applied; ambiguous branches remain separate.`);};
function focusSelectedGeometry(behavior='smooth'){
 const chosen=objects.filter(o=>selected.has(o.id));if(!chosen.length||!pageInfo)return;
 const b=selectedBounds(chosen),stage=$('stage'),style=getComputedStyle(stage);
 const padX=parseFloat(style.paddingLeft)+parseFloat(style.paddingRight),padY=parseFloat(style.paddingTop)+parseFloat(style.paddingBottom);
 const basePixels=$('paper').getBoundingClientRect().width/(Number($('zoom').value)/100)/pageInfo.width;
 const ratio=Math.min((stage.clientWidth-padX-24)/(Math.max(b.w,1)*basePixels),(stage.clientHeight-padY-24)/(Math.max(b.h,1)*basePixels));
 $('zoom').value=Math.min(250,Math.max(50,Math.floor(ratio*100/10)*10));renderStage();
 const pixels=$('paper').getBoundingClientRect().width/pageInfo.width;
 stage.scrollTo({left:Math.max(0,(b.x+b.w/2)*pixels+parseFloat(style.paddingLeft)-stage.clientWidth/2),top:Math.max(0,(b.y+b.h/2)*pixels+parseFloat(style.paddingTop)-stage.clientHeight/2),behavior});
}
$('focusSelected').onclick=()=>focusSelectedGeometry();
$('reviewExcluded').onclick=()=>{selected=new Set(currentAudit().suspectedExclusions);visible.reference=true;$('filter').value='reference';renderStage();renderLayers();renderList();renderSelection();};
$('filter').onchange=renderList;for(const [id,val]of [['viewPaths','paths'],['viewOverlay','overlay'],['viewOriginal','original']])$(id).onclick=()=>{mode=val;updateMode();renderStage();};$('zoom').oninput=renderStage;$('fit').onclick=()=>{$('zoom').value=100;renderStage();$('stage').scrollTo(0,0);};
$('selectTool').onclick=()=>{clearPreviewState();measureMode=false;selectRasterMode=false;measurePoints=[];$('measureTool').classList.remove('primary');$('selectRasterArea').classList.remove('primary');if(mode==='original'||mode==='mask'){mode='overlay';updateMode();}renderStage();renderReview();$('measureReadout').textContent='Left-drag selects whole paths · Shift-drag adds';toast('Select: click a path or left-drag a box. Only whole visible paths inside the box are selected.');};
$('measureTool').onclick=()=>{clearPreviewState();selectRasterMode=false;$('selectRasterArea').classList.remove('primary');measureMode=!measureMode;measurePoints=[];$('measureTool').classList.toggle('primary',measureMode);toast(measureMode?'Measure: click two points on the PDF page.':'Selection tool active.');renderStage();renderReview();};
$('calibrate').onclick=()=>{const known=Number($('known').value),measured=Number($('measured').value);if(!(known>0&&measured>0&&Number.isFinite(known/measured))){toast('Enter positive known and measured distances.');return;}checkpoint();scale=known/measured;render();toast('Uniform output scale updated.');};$('resetScale').onclick=()=>{checkpoint();scale=1;render();};
$('resizeHoles').onchange=()=>{$('holeDiameter').disabled=!$('resizeHoles').checked;renderStage();renderReview();};$('holeDiameter').oninput=()=>{renderStage();renderReview();};
$('undo').onclick=()=>{const prev=history.pop();if(!prev)return;objects=prev.objects;raw=prev.raw??raw;scale=prev.scale;stats=prev.stats;conversionMode=prev.conversionMode??conversionMode;rasterBatches=prev.rasterBatches??rasterBatches;rasterReviewed=prev.rasterReviewed??false;rasterRegion=prev.rasterRegion??null;rasterMask=null;mode=conversionMode==='raster'?'overlay':'paths';updateMode();resetSelection();render();toast('Previous edit restored.');};document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){e.preventDefault();$('undo').click();}if(e.key==='Escape'){if(selectionMarquee?.cancel()){e.preventDefault();return;}if(pendingPreview()){e.preventDefault();cancelRepairPreview();return;}selectRasterMode=false;$('selectRasterArea').classList.remove('primary');measureMode=false;$('measureTool').classList.remove('primary');resetSelection();renderStage();renderSelection();renderList();}});
$('export').onclick=()=>{try{ensureExportReady();download(`${safeBase()}_page${pageInfo.number}_xtool.svg`,exportSVG(objects,currentOptions()));setStatus('SVG ready to save. Check the dimensions after import into xTool Studio.');}catch(e){toast(e.message);}};
$('calibrationFile').onclick=()=>download('100mm_calibration.svg',calibrationSVG());$('report').onclick=()=>download(safeBase()+'_geometry_report.json',JSON.stringify(report(),null,2),'application/json');
$('saveProject').onclick=()=>{if(pendingPreview()){toast('Apply or cancel the pending preview before saving the project.');return;}const data={format:'pattern-laser-project',version:1,engineVersion:'0.4.0',sourceFingerprint,conversionMode,vectorRaw,rasterBatches,rasterReviewed,rasterCounter,fileName,pageInfo,raw,objects,stats,warnings,referenceImage,scale,settings:settings(),exportLayers:[...exportLayers],resizeHoles:$('resizeHoles').checked,holeDiameter:Number($('holeDiameter').value)};download(safeBase()+'_page'+pageInfo.number+'.pattern.json',JSON.stringify(data),'application/json');setStatus('Project snapshot ready to save.');};
$('project').onclick=()=>$('projectFile').click();
function validateObjects(list){if(!Array.isArray(list)||list.length>30000)throw new Error('Invalid geometry list.');const ids=new Set();for(const o of list){if(typeof o.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(o.id)||ids.has(o.id))throw new Error('Invalid or repeated path identifier.');ids.add(o.id);if(!LAYERS[o.layer]||(o.manualLayer&&!LAYERS[o.manualLayer]))throw new Error('Invalid operation assignment.');if(!Array.isArray(o.cmds)||o.cmds.length>50000||!o.cmds.length||o.cmds[0][0]!=='M')throw new Error('Invalid path.');for(const c of o.cmds){if(!Array.isArray(c)||!({M:3,L:3,C:7,Q:5,Z:1}[c[0]]===c.length)||!c.slice(1).every(n=>Number.isFinite(n)&&Math.abs(n)<1e6))throw new Error('Invalid path command.');}if(!Array.isArray(o.sourceIds)||!Array.isArray(o.dash))throw new Error('Invalid source information.');refresh(o);}return list;}
async function restoreProject(p,{reviewedSample=false}={}){if(p.format!=='pattern-laser-project'||p.version!==1)throw new Error('Unsupported project format.');if(!p.pageInfo||![p.pageInfo.width,p.pageInfo.height,p.scale].every(n=>Number.isFinite(n)&&n>0&&n<100000))throw new Error('Invalid project dimensions.');const newRaw=validateObjects(p.raw),newObjects=validateObjects(p.objects);if(doc){await doc.destroy();doc=null;}raw=newRaw;sourceFingerprint=typeof p.sourceFingerprint==='string'?p.sourceFingerprint:null;objects=classifyPatternFeatures(newObjects);vectorRaw=p.vectorRaw?validateObjects(p.vectorRaw):newRaw.filter(o=>o.sourceType!=='raster');conversionMode=p.conversionMode==='raster'?'raster':'vector';rasterBatches=Array.isArray(p.rasterBatches)?p.rasterBatches.map(b=>({...b,objects:validateObjects(b.objects),stats:b.stats||{}})):[];rasterReviewed=false;rasterCounter=Number.isInteger(p.rasterCounter)?p.rasterCounter:rasterBatches.length;rasterCanvas=null;rasterRegion=null;rasterMask=null;pageInfo=p.pageInfo;scale=p.scale;fileName=String(p.fileName||'pattern.pdf');warnings=Array.isArray(p.warnings)?p.warnings.map(String):[];stats=p.stats||{};referenceImage=typeof p.referenceImage==='string'&&p.referenceImage.startsWith('data:image/png;base64,')?p.referenceImage:'';history=[];resetSelection();for(const k of ['dedupe','join'])$(k).checked=p.settings?.[k]!==false;$('tolerance').value=Math.max(0,Math.min(.2,Number(p.settings?.tolerance)||.03));exportLayers=new Set((p.exportLayers||['cut','holes','hardware','inner','score']).filter(k=>['cut','holes','hardware','inner','score'].includes(k)));if(!p.engineVersion)exportLayers.add('hardware');$('resizeHoles').checked=!!p.resizeHoles;$('holeDiameter').value=p.holeDiameter>=.25&&p.holeDiameter<=5?p.holeDiameter:1;$('holeDiameter').disabled=!p.resizeHoles;for(const label of $('exportLayers').children){const cb=label.querySelector('input');cb.checked=exportLayers.has(cb.value);}$('page').replaceChildren();const option=document.createElement('option');option.textContent='Page '+pageInfo.number;$('page').append(option);$('page').disabled=true;$('fileName').textContent=fileName+(reviewedSample?' · reviewed sample':' · saved project');$('pageSize').textContent=reviewedSample?'Reviewed example · use Open original PDF for cleanup practice':'Current-page snapshot · open the PDF to select other pages';mode=conversionMode==='raster'?'overlay':'paths';updateMode();render();toast(reviewedSample?'Reviewed YOMMY sample loaded. Check the overlay and scale, then export.':conversionMode==='raster'?'Project restored. Raster geometry needs a fresh overlay and scale review.':'Project restored. Check the overlay and export settings.');}
$('projectFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{if(f.size>40000000)throw new Error('Project is too large.');await restoreProject(JSON.parse(await f.text()));}catch(e){toast('Could not open project: '+e.message);}};
renderLayers();for(const id of ['sample','emptySample','originalSample','drop'])$(id).disabled=true;
try{
 pdfjs=await loadPdfRuntime({urls:hostedAssets,embeddedEngine:typeof PDF_ENGINE==='undefined'?null:PDF_ENGINE,embeddedWorker:typeof PDF_WORKER==='undefined'?null:PDF_WORKER,decode64});
 for(const id of ['sample','emptySample','originalSample','drop'])$(id).disabled=false;setStatus('Ready · open a PDF or try the supplied pattern.');
}catch(e){console.error(e);setStatus('PDF engine could not start. Open this file in a recent Chrome or Edge browser.');for(const id of ['sample','emptySample','originalSample','drop'])$(id).disabled=true;}
