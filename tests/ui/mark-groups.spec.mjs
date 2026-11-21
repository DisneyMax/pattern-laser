import fs from 'node:fs/promises';
import {test,expect,openApp,downloadText,local,drag} from './helpers.mjs';
import {markRows,overlappingRow,curvedRow} from '../marks/fixtures.mjs';
import {rasterPattern} from '../patterns/fixtures.mjs';

test.beforeEach(async({page})=>{await openApp(page);});
async function project(page,{gap=false,customObjects=null}={}){
 const data=JSON.parse(await fs.readFile(local('examples/YOMMY_reviewed.pattern.json'),'utf8')),objects=customObjects||markRows({manual:[2]});
 if(gap)objects.push({id:'gap',sourceIds:['gap'],cmds:[['M',65,55],['L',75,55],['L',75,65],['L',65,65],['L',65,55.08]],stroke:'#000000',fill:null,alpha:1,width:.1,dash:[],layer:'unassigned',reason:'Small gap'});
 Object.assign(data,{fileName:'round-groups.pdf',sourceFingerprint:null,pageInfo:{width:100,height:80,number:1},objects,raw:objects,vectorRaw:objects,referenceImage:'',scale:1,rasterBatches:[],conversionMode:'vector',warnings:[],stats:{}});
 await page.locator('#projectFile').setInputFiles({name:'round-groups.pattern.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
 await expect(page.locator('#fileName')).toContainText('round-groups.pdf');
}
async function chooseEditableRow(page){
 await page.locator('#findMarkGroups').click();await expect(page.locator('#markGroupSelect option')).toHaveCount(2);
 const value=await page.locator('#markGroupSelect option').evaluateAll(options=>options.find(o=>o.textContent.includes('5 positions · 5 editable paths')).value);
 await page.locator('#markGroupSelect').selectOption(value);await expect(page.locator('#markGroupInfo')).toContainText('1 manual assignment excluded');
}
async function preview(page,role='holes'){
 await page.locator('#markGroupRole').selectOption(role);await page.locator('#previewMarkGroup').click();await expect(page.locator('#markPreviewPanel')).toBeVisible();
}

test('group preview is non-destructive; Apply and Undo preserve source geometry and manual choices',async({page},testInfo)=>{
 await project(page);const before=JSON.parse((await downloadText(page,testInfo,()=>page.locator('#saveProject').click())).text);
 await chooseEditableRow(page);await expect(page.locator('#previewMarkGroup')).toBeDisabled();await preview(page);
 await expect(page.locator('.mark-group-preview')).toHaveCount(5);await expect(page.locator('#export')).toBeDisabled();await expect(page.locator('#saveProject')).toBeDisabled();
 await expect(page.locator('#markGroupSummary')).toContainText('Assign 5 paths at 5 positions as Stitch holes');
 await testInfo.attach('round-mark-group-preview',{body:await page.screenshot(),contentType:'image/png'});
 const pending=JSON.parse((await downloadText(page,testInfo,()=>page.locator('#report').click())).text);for(const layer of ['holes','hardware'])expect(pending.counts[layer]).toBe(before.objects.filter(o=>o.layer===layer).length);
 await page.locator('#cancelMarkGroup').click();await expect(page.locator('.mark-group-preview')).toHaveCount(0);await expect(page.locator('#export')).toBeEnabled();
 await page.locator('#previewMarkGroup').click();await page.locator('#applyMarkGroup').click();
 const after=JSON.parse((await downloadText(page,testInfo,()=>page.locator('#saveProject').click())).text);
 for(const original of before.objects){const result=after.objects.find(o=>o.id===original.id);expect(result.cmds).toEqual(original.cmds);expect(result.bbox).toEqual(original.bbox);if(original.id==='a2'||original.id.startsWith('b'))expect(result).toEqual(original);}
 expect(after.objects.filter(o=>o.layer==='holes')).toHaveLength(11);expect(after.objects.find(o=>o.id==='a2').manualLayer).toBe('hardware');
 await page.locator('#undo').click();const restored=JSON.parse((await downloadText(page,testInfo,()=>page.locator('#saveProject').click())).text);expect(restored.objects).toEqual(before.objects);
});

test('group assignments survive save/reopen and protected rows are not proposed again',async({page},testInfo)=>{
 await project(page);await chooseEditableRow(page);await preview(page);await page.locator('#applyMarkGroup').click();
 const saved=await downloadText(page,testInfo,()=>page.locator('#saveProject').click());await page.reload();await expect(page.locator('#drop')).toBeEnabled();await page.locator('#projectFile').setInputFiles(saved.filename);
 await expect(page.locator('#fileName')).toContainText('round-groups.pdf');
 await page.locator('#findMarkGroups').click();await expect(page.locator('#markGroupSelect option')).toHaveCount(1);await expect(page.locator('#markGroupInfo')).toContainText('6 editable positions');
 const report=JSON.parse((await downloadText(page,testInfo,()=>page.locator('#report').click())).text);expect(report.counts.holes).toBe(11);expect(report.counts.hardware).toBe(1);
});

test('group and repair previews are exclusive and operation/view changes cancel stale group previews',async({page})=>{
 await project(page,{gap:true});await page.locator('#reviewNext').click();await page.locator('#previewRepair').click();await expect(page.locator('.repair-preview')).toHaveCount(1);
 await chooseEditableRow(page);await expect(page.locator('.repair-preview')).toHaveCount(0);await preview(page);
 await page.keyboard.press('Escape');await expect(page.locator('#markPreviewPanel')).toBeHidden();await expect(page.locator('#saveProject')).toBeEnabled();
 await page.locator('#previewMarkGroup').click();await page.locator('#markGroupRole').selectOption('hardware');await expect(page.locator('#markPreviewPanel')).toBeHidden();
 await page.locator('#previewMarkGroup').click();await page.locator('#viewOriginal').click();await expect(page.locator('.mark-group-preview')).toHaveCount(0);await expect(page.locator('#markPreviewPanel')).toBeHidden();
 await page.locator('#previewMarkGroup').click();await page.locator('#tolerance').fill('0.1');await expect(page.locator('#markPreviewPanel')).toBeHidden();
 await page.locator('#reviewNext').click();await page.locator('#previewRepair').click();await expect(page.locator('.repair-preview')).toHaveCount(1);await expect(page.locator('#markPreviewPanel')).toBeHidden();
});

test('150 DPI raster mark rows can be reviewed as a group and require fresh raster acknowledgement',async({page},testInfo)=>{
 await page.locator('#file').setInputFiles({name:'raster-groups.pdf',mimeType:'application/pdf',buffer:rasterPattern()});await expect(page.locator('#fileName')).toHaveText('raster-groups.pdf');await expect(page.locator('#busy')).toBeHidden();
 await page.locator('#rasterDpi').selectOption('150');await page.locator('#rasterPoints').check();await page.locator('#selectRasterArea').click();await drag(page,[1,1],[119,119]);await page.locator('#traceRaster').click();await expect(page.locator('#busy')).toBeHidden();
 await expect(page.locator('#paper .geom')).toHaveCount(15);await page.locator('#rasterReviewed').check();await expect(page.locator('#export')).toBeEnabled();
 const before=JSON.parse((await downloadText(page,testInfo,()=>page.locator('#saveProject').click())).text);
 await page.locator('#findMarkGroups').click();await expect(page.locator('#markGroupSelect option')).toHaveCount(2);await preview(page,'holes');await expect(page.locator('.mark-group-preview')).toHaveCount(6);
 await page.locator('#applyMarkGroup').click();await expect(page.locator('#rasterReviewed')).not.toBeChecked();await expect(page.locator('#export')).toBeDisabled();
 const after=JSON.parse((await downloadText(page,testInfo,()=>page.locator('#saveProject').click())).text);const changed=after.objects.filter(o=>o.reason.startsWith('Round-mark group explicitly assigned'));
 expect(changed).toHaveLength(6);for(const original of before.objects)expect(after.objects.find(o=>o.id===original.id).cmds).toEqual(original.cmds);
 await page.locator('#rasterReviewed').check();await expect(page.locator('#export')).toBeEnabled();
});


test('group preview reflects explicit output hole resizing without changing source commands',async({page},testInfo)=>{
 await project(page);const before=JSON.parse((await downloadText(page,testInfo,()=>page.locator('#saveProject').click())).text);
 await page.locator('#resizeHoles').check();await page.locator('#holeDiameter').fill('1.5');await chooseEditableRow(page);await preview(page);
 await expect(page.locator('#markGroupSummary')).toContainText('1.50 mm output');await expect(page.locator('circle.mark-group-preview')).toHaveCount(5);
 for(const radius of await page.locator('circle.mark-group-preview').evaluateAll(nodes=>nodes.map(n=>Number(n.getAttribute('r')))))expect(radius).toBe(.75);
 await page.locator('#applyMarkGroup').click();const saved=JSON.parse((await downloadText(page,testInfo,()=>page.locator('#saveProject').click())).text);
 for(const original of before.objects)expect(saved.objects.find(o=>o.id===original.id).cmds).toEqual(original.cmds);
 const svg=(await downloadText(page,testInfo,()=>page.locator('#export').click())).text;expect(svg).toContain('r="0.75"');
});


test('overlapping copies share positions while Apply, save/reopen and Undo retain every source path',async({page},testInfo)=>{
 await project(page,{customObjects:overlappingRow({manual:true})});
 const before=JSON.parse((await downloadText(page,testInfo,()=>page.locator('#saveProject').click())).text);
 await page.locator('#findMarkGroups').click();await expect(page.locator('#markGroupSelect option')).toHaveCount(1);
 await expect(page.locator('#markGroupSelect')).toContainText('6 positions · 23 editable paths');
 await expect(page.locator('#markScanInfo')).toContainText('18 overlapping copies');await expect(page.locator('#markScanInfo')).toContainText('All source paths remain');
 await preview(page,'hardware');await expect(page.locator('.mark-group-preview')).toHaveCount(23);await expect(page.locator('#markGroupSummary')).toContainText('23 paths at 6 positions');
 await expect(page.locator('#markGroupSummary')).toContainText('does not remove repeated laser paths');
 await page.locator('#applyMarkGroup').click();const saved=await downloadText(page,testInfo,()=>page.locator('#saveProject').click()),after=JSON.parse(saved.text);
 expect(after.objects).toHaveLength(before.objects.length);for(const original of before.objects){const result=after.objects.find(o=>o.id===original.id);expect(result.cmds).toEqual(original.cmds);expect(result.bbox).toEqual(original.bbox);if(original.manualLayer)expect(result).toEqual(original);}
 expect(after.objects.filter(o=>o.manualLayer==='hardware')).toHaveLength(24);
 await page.locator('#undo').click();const restored=JSON.parse((await downloadText(page,testInfo,()=>page.locator('#saveProject').click())).text);expect(restored.objects).toEqual(before.objects);
 await page.locator('#projectFile').setInputFiles({name:'reviewed-copies.pattern.json',mimeType:'application/json',buffer:Buffer.from(saved.text)});await page.locator('#findMarkGroups').click();await expect(page.locator('#markGroupControls')).toBeHidden();await expect(page.locator('#markScanInfo')).toContainText('24 manual assignments');
});

test('gently curved stitching is previewed as one group with existing assignments clearly identified',async({page})=>{
 await project(page,{customObjects:curvedRow()});await page.locator('#findMarkGroups').click();await expect(page.locator('#markGroupSelect option')).toHaveCount(1);
 await expect(page.locator('#markGroupInfo')).toContainText('7 editable positions');await expect(page.locator('#markGroupInfo')).toContainText('continuous row');
 await expect(page.locator('#markGroupInfo')).toContainText('Already assigned; applying confirms');await preview(page);await expect(page.locator('.mark-group-preview')).toHaveCount(7);
});

test('original YOMMY sample groups overlapping rows and explains holes excluded by open boundaries',async({page},testInfo)=>{
 await page.locator('#originalSample').click();await expect(page.locator('#busy')).toBeHidden();
 await page.locator('#findMarkGroups').click();await expect(page.locator('#markGroupSelect option')).toHaveCount(5);
 await expect(page.locator('#markGroupSelect')).toContainText('30 positions · 71 editable paths');
 await page.locator('#markScanNotes summary').click();await expect(page.locator('#markScanInfo')).toBeVisible();
 await expect(page.locator('#markScanInfo')).toContainText('217 round paths outside recognized closed cut boundaries');
 await expect(page.locator('#markScanInfo')).toContainText('123 overlapping copies');
 await expect(page.locator('#markScanInfo')).toContainText('6 editable positions did not form');
 const report=JSON.parse((await downloadText(page,testInfo,()=>page.locator('#report').click())).text);expect(report.counts.holes).toBe(438);expect(report.unresolved).toHaveLength(7);
 await page.locator('#markScanNotes summary').click();await preview(page);await expect(page.locator('.mark-group-preview')).toHaveCount(71);await testInfo.attach('yommy-continuous-group-preview',{body:await page.screenshot(),contentType:'image/png'});
 await page.locator('#cancelMarkGroup').click();await expect(page.locator('#export')).toBeDisabled();
});


test('whole-piece scope highlights all eligible holes on both sides and around corners of the public sample',async({page},testInfo)=>{
 await page.locator('#originalSample').click();await expect(page.locator('#busy')).toBeHidden();await page.locator('#markGroupScope').selectOption('piece');await page.locator('#findMarkGroups').click();
 await expect(page.locator('#markGroupSelect option')).toHaveCount(2);await expect(page.locator('#markGroupSelect')).toContainText('53 positions · 124 editable paths');await expect(page.locator('#markGroupSelect')).toContainText('45 positions · 97 editable paths');
 await preview(page);await expect(page.locator('.mark-group-preview')).toHaveCount(124);await expect(page.locator('#markGroupSummary')).toContainText('hardware candidates regardless of spacing or size');
 await page.locator('#cancelMarkGroup').click();await page.locator('#markGroupSelect').selectOption('1');await preview(page);await expect(page.locator('.mark-group-preview')).toHaveCount(97);
 await testInfo.attach('whole-piece-round-mark-preview',{body:await page.screenshot(),contentType:'image/png'});
 const report=JSON.parse((await downloadText(page,testInfo,()=>page.locator('#report').click())).text);expect(report.counts.holes).toBe(438);expect(report.unresolved).toHaveLength(7);
 await page.locator('#markGroupScope').selectOption('rows');await expect(page.locator('#markPreviewPanel')).toBeHidden();await expect(page.locator('#markGroupControls')).toBeHidden();await expect(page.locator('#saveProject')).toBeEnabled();
 await page.locator('#findMarkGroups').click();await expect(page.locator('#markGroupSelect option')).toHaveCount(5);
});

test('whole-piece scope applies every disconnected row in one Undo step and preserves manual choices',async({page},testInfo)=>{
 await project(page);const before=JSON.parse((await downloadText(page,testInfo,()=>page.locator('#saveProject').click())).text);
 await page.locator('#markGroupScope').selectOption('piece');await page.locator('#findMarkGroups').click();await expect(page.locator('#markGroupSelect option')).toHaveCount(1);
 await expect(page.locator('#markGroupInfo')).toContainText('11 editable positions');await expect(page.locator('#markGroupInfo')).toContainText('1 manual assignment excluded');
 await preview(page,'hardware');await expect(page.locator('.mark-group-preview')).toHaveCount(11);await page.locator('#applyMarkGroup').click();
 const after=JSON.parse((await downloadText(page,testInfo,()=>page.locator('#saveProject').click())).text);expect(after.objects.filter(o=>o.manualLayer==='hardware')).toHaveLength(12);for(const original of before.objects){const result=after.objects.find(o=>o.id===original.id);expect(result.cmds).toEqual(original.cmds);if(original.manualLayer)expect(result).toEqual(original);}
 await page.locator('#undo').click();const restored=JSON.parse((await downloadText(page,testInfo,()=>page.locator('#saveProject').click())).text);expect(restored.objects).toEqual(before.objects);
});
