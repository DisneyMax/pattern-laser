import fs from 'node:fs/promises';
import {test,expect,openApp,downloadText,local} from './helpers.mjs';
import {boundaryFixture} from '../boundaries/fixtures.mjs';

test.beforeEach(async({page})=>{await openApp(page);});
async function saved(page,testInfo){return JSON.parse((await downloadText(page,testInfo,()=>page.locator('#saveProject').click())).text);}
async function original(page){await page.locator('#originalSample').click();await expect(page.locator('#busy')).toBeHidden();await expect(page.locator('#reviewCount')).toHaveText('7 need review');}
async function fixture(page,{branch=false,raster=false}={}){
 const data=JSON.parse(await fs.readFile(local('examples/YOMMY_reviewed.pattern.json'),'utf8')),objects=boundaryFixture({branch,sourceType:raster?'raster':'vector'});
 Object.assign(data,{fileName:'boundary-fixture.pdf',sourceFingerprint:null,pageInfo:{width:100,height:80,number:1},objects,raw:objects,vectorRaw:raster?[]:objects,referenceImage:'',scale:1,rasterBatches:raster?[{id:'rt1',region:{x:0,y:0,w:100,h:80},objects:structuredClone(objects),settings:{dpi:300},stats:{}}]:[],conversionMode:raster?'raster':'vector',warnings:[],stats:{},resizeHoles:false});
 await page.locator('#projectFile').setInputFiles({name:'boundaries.pattern.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await expect(page.locator('#fileName')).toContainText('boundary-fixture.pdf');
}

test('public sample groups seven paths into three issues and shows measured gaps and manual junctions without mutation',async({page},testInfo)=>{
 await original(page);const before=await saved(page,testInfo);await page.locator('#scanBoundaries').click();await expect(page.locator('#boundarySelect option')).toHaveCount(3);await expect(page.locator('#boundaryScanInfo')).toContainText('2 have a bounded repair preview');await expect(page.locator('.boundary-gap-marker')).toHaveCount(1);await expect(page.locator('#boundaryInfo')).toContainText('0 branching junctions');
 await page.locator('#previewBoundary').click();await expect(page.locator('.repair-preview')).toHaveCount(1);await expect(page.locator('#boundarySummary')).toContainText('Source bounds');await expect(page.locator('#saveProject')).toBeDisabled();await expect(page.locator('#export')).toBeDisabled();
 const pending=JSON.parse((await downloadText(page,testInfo,()=>page.locator('#report').click())).text);expect(pending.unresolved).toHaveLength(7);expect(pending.boundaryReview.components).toHaveLength(3);expect(pending.boundaryReview.sourceKey).toBeUndefined();await page.locator('#cancelBoundary').click();expect((await saved(page,testInfo)).objects).toEqual(before.objects);
 await page.locator('#boundarySelect').selectOption('boundary:p336');await expect(page.locator('#selectedName')).toHaveText('5 paths');await expect(page.locator('.boundary-branch')).toHaveCount(4);await expect(page.locator('.boundary-free')).toHaveCount(0);await expect(page.locator('#previewBoundary')).toBeDisabled();await expect(page.locator('#boundaryInfo')).toContainText('competing continuations');await testInfo.attach('boundary-junction-diagnostics',{body:await page.screenshot(),contentType:'image/png'});
 expect((await saved(page,testInfo)).objects).toEqual(before.objects);
});

test('public sample repairs retain source dimensions, every hole and other operations, with one Undo step per contour',async({page},testInfo)=>{
 await original(page);const before=await saved(page,testInfo);
 for(const id of ['p5','p226']){await page.locator('#scanBoundaries').click();await page.locator('#boundarySelect').selectOption('boundary:'+id);await page.locator('#previewBoundary').click();await page.locator('#applyBoundary').click();}
 await expect(page.locator('#reviewCount')).toHaveText('5 need review');const after=await saved(page,testInfo);
 for(const o of before.objects){const result=after.objects.find(r=>r.id===o.id);if(['p5','p226'].includes(o.id)){expect(result.bbox).toEqual(o.bbox);expect(result.closed).toBe(true);expect(result.manualLayer).toBe('cut');}else expect(result).toEqual(o);}
 await page.locator('#scanBoundaries').click();await expect(page.locator('#boundarySelect option')).toHaveCount(1);await expect(page.locator('#previewBoundary')).toBeDisabled();await expect(page.locator('#export')).toBeDisabled();
 await page.locator('#undo').click();await expect(page.locator('#reviewCount')).toHaveText('6 need review');await page.locator('#undo').click();expect((await saved(page,testInfo)).objects).toEqual(before.objects);
});

test('fragment join exports at calibrated scale, preserves manual holes/guides and survives project reopening',async({page},testInfo)=>{
 await fixture(page);await page.locator('#known').fill('125');await page.locator('#measured').fill('100');await page.locator('#calibrate').click();const before=await saved(page,testInfo);
 await page.locator('#scanBoundaries').click();await expect(page.locator('#boundarySelect option')).toHaveCount(1);await page.locator('#previewBoundary').click();await expect(page.locator('#boundarySummary')).toContainText('Join 2 paths into one closed contour');await expect(page.locator('#boundarySummary')).toContainText('10.000 × 10.000 mm stay unchanged');await page.locator('#applyBoundary').click();
 const after=await saved(page,testInfo);for(const id of ['hole','guide'])expect(after.objects.find(o=>o.id===id)).toEqual(before.objects.find(o=>o.id===id));expect(after.objects).toHaveLength(3);expect(after.scale).toBe(1.25);
 const svg=(await downloadText(page,testInfo,()=>page.locator('#export').click())).text;expect(svg).toContain('width="125mm"');expect(svg).toContain('height="100mm"');expect((svg.match(/<path /g)||[])).toHaveLength(3);
 const sizes=await page.evaluate(text=>{const root=new DOMParser().parseFromString(text,'image/svg+xml').documentElement;root.style.position='absolute';root.style.left='-10000px';document.body.append(root);const cut=root.querySelector('#cut path').getBBox(),hole=root.querySelector('#holes path').getBBox();const result={cutWidth:cut.width,cutHeight:cut.height,holeWidth:hole.width,holeHeight:hole.height};root.remove();return result;},svg);expect(sizes.cutWidth).toBeCloseTo(12.5,5);expect(sizes.cutHeight).toBeCloseTo(12.5,5);expect(sizes.holeWidth).toBeCloseTo(1.25,5);expect(sizes.holeHeight).toBeCloseTo(1.25,5);
 await page.locator('#undo').click();expect((await saved(page,testInfo)).objects).toEqual(before.objects);
 await page.locator('#projectFile').setInputFiles({name:'repaired.pattern.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(after))});await page.locator('#scanBoundaries').click();await expect(page.locator('#boundaryCount')).toHaveText('0 components');await expect(page.locator('#export')).toBeEnabled();
});

test('raster boundary repair resets acknowledgement and Undo restores geometry and review state',async({page},testInfo)=>{
 await fixture(page,{raster:true});await page.locator('#rasterReviewed').check();const before=await saved(page,testInfo);await page.locator('#scanBoundaries').click();await page.locator('#previewBoundary').click();await page.locator('#applyBoundary').click();await expect(page.locator('#rasterReviewed')).not.toBeChecked();await expect(page.locator('#export')).toBeDisabled();
 await page.locator('#undo').click();await expect(page.locator('#rasterReviewed')).toBeChecked();expect((await saved(page,testInfo)).objects).toEqual(before.objects);
});

test('boundary previews cancel on view or selection changes and remain exclusive with other review tools',async({page})=>{
 await fixture(page);await page.locator('#scanBoundaries').click();await page.locator('#previewBoundary').click();await page.locator('#viewOriginal').click();await expect(page.locator('.repair-preview')).toHaveCount(0);await expect(page.locator('#boundaryPreviewPanel')).toBeHidden();
 await page.locator('#showBoundary').click();await expect(page.locator('.boundary-gap-marker')).toHaveCount(1);await page.locator('#previewBoundary').click();await page.locator('#findDuplicates').click();await expect(page.locator('.repair-preview')).toHaveCount(0);
 await page.locator('#showBoundary').click();await page.locator('#previewBoundary').click();await page.locator('#findMarkGroups').click();await expect(page.locator('.repair-preview')).toHaveCount(0);
 await page.locator('#showBoundary').click();await page.locator('#previewBoundary').click();await page.locator('#filter').selectOption('all');await page.locator('#objectList .object-row').first().click();await expect(page.locator('#boundaryPreviewPanel')).toBeHidden();await expect(page.locator('.boundary-gap-marker')).toHaveCount(0);await expect(page.locator('#saveProject')).toBeEnabled();
});

test('manual exclusion of a construction spur permits rescanning and previewing the intended closed boundary',async({page},testInfo)=>{
 await fixture(page,{branch:true});await page.locator('#scanBoundaries').click();await expect(page.locator('.boundary-branch')).toHaveCount(1);await expect(page.locator('#previewBoundary')).toBeDisabled();await expect(page.locator('#boundaryInfo')).toContainText('explicitly exclude construction spurs');
 await page.locator('#objectList .object-row').filter({hasText:'spur · open'}).click();await page.locator('#excludeSelected').click();await page.locator('#scanBoundaries').click();await expect(page.locator('#previewBoundary')).toBeEnabled();await page.locator('#previewBoundary').click();await page.locator('#applyBoundary').click();
 const result=await saved(page,testInfo);expect(result.objects.find(o=>o.id==='spur').manualLayer).toBe('reference');expect(result.objects.find(o=>o.id==='hole').manualLayer).toBe('holes');expect(result.objects.find(o=>o.id==='guide').manualLayer).toBe('score');await expect(page.locator('#export')).toBeEnabled();
});
