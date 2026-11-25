import fs from 'node:fs/promises';
import {test,expect,openApp,downloadText,local} from './helpers.mjs';
import {boundaryFixture} from '../boundaries/fixtures.mjs';

test.beforeEach(async({page})=>{await openApp(page);});
async function saved(page,testInfo){return JSON.parse((await downloadText(page,testInfo,()=>page.locator('#saveProject').click())).text);}
async function fixture(page,{raster=false,manualSpur=false}={}){
 const data=JSON.parse(await fs.readFile(local('examples/YOMMY_reviewed.pattern.json'),'utf8')),objects=boundaryFixture({branch:true,sourceType:raster?'raster':'vector'});
 if(manualSpur){const spur=objects.find(o=>o.id==='spur');spur.layer=spur.manualLayer='score';}
 Object.assign(data,{fileName:'junction-fixture.pdf',sourceFingerprint:null,pageInfo:{width:100,height:80,number:1},objects,raw:objects,vectorRaw:raster?[]:objects,referenceImage:'',scale:1,rasterBatches:raster?[{id:'rt1',region:{x:0,y:0,w:100,h:80},objects:structuredClone(objects),settings:{dpi:300},stats:{}}]:[],conversionMode:raster?'raster':'vector',warnings:[],stats:{},resizeHoles:false});
 await page.locator('#projectFile').setInputFiles({name:'junctions.pattern.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await expect(page.locator('#fileName')).toContainText('junction-fixture.pdf');await page.locator('#scanBoundaries').click();
}
const pathRow=(page,id)=>page.locator(`[data-junction-path="${id}"]`);
async function openJunction(page){await page.locator('.boundary-branch[role="button"]').first().click();await expect(page.locator('#junctionPanel')).toBeVisible();}

test('red marker clicks list connected paths; hover and keyboard focus trace individual paths without editing',async({page},testInfo)=>{
 await fixture(page);const before=await saved(page,testInfo);await openJunction(page);await expect(page.locator('#junctionPaths button')).toHaveCount(3);await expect(page.locator('.marquee-box')).toHaveCount(0);
 await pathRow(page,'left').hover();await expect(page.locator('[data-id="left"]')).toHaveClass(/junction-trace/);await expect(page.locator('[data-id="left"]')).toHaveCSS('stroke','rgb(22, 139, 210)');await expect(page.locator('[data-id="left"]')).toHaveCSS('stroke-width','2.5px');await expect(page.locator('[data-id="right"]')).toHaveClass(/junction-context/);await page.mouse.move(700,30);await expect(page.locator('.junction-trace')).toHaveCount(0);
 await pathRow(page,'spur').focus();await expect(page.locator('[data-id="spur"]')).toHaveClass(/junction-trace/);await testInfo.attach('junction-path-trace',{body:await page.screenshot(),contentType:'image/png'});expect((await saved(page,testInfo)).objects).toEqual(before.objects);await expect(page.locator('#undo')).toBeDisabled();
 await pathRow(page,'spur').click();await expect(page.locator('.junction-exclusion-preview')).toHaveCount(1);await expect(page.locator('#exclusionSummary')).toContainText('Exclude the entire spur path');await expect(page.locator('#exclusionSummary')).toBeInViewport();await expect(page.locator('.boundary-branch')).toHaveCount(0);await expect(page.locator('#saveProject')).toBeDisabled();await expect(page.locator('#export')).toBeDisabled();
 await testInfo.attach('construction-path-exclusion-preview',{body:await page.screenshot(),contentType:'image/png'});
 const report=JSON.parse((await downloadText(page,testInfo,()=>page.locator('#report').click())).text);expect(report.unresolved).toHaveLength(3);
 await page.locator('#cancelExclusion').click();await expect(page.locator('#junctionPanel')).toBeVisible();await expect(page.locator('.boundary-branch')).toHaveCount(1);expect((await saved(page,testInfo)).objects).toEqual(before.objects);await expect(page.locator('#undo')).toBeDisabled();
 await pathRow(page,'spur').click();await page.keyboard.press('Escape');await expect(page.locator('#exclusionPreviewPanel')).toBeHidden();await expect(page.locator('#junctionPanel')).toBeVisible();
});

test('keyboard junction editing rescans to a repairable boundary, retains geometry, exports without the spur and supports separate Undo steps',async({page},testInfo)=>{
 await fixture(page);const before=await saved(page,testInfo),marker=page.locator('.boundary-branch[role="button"]').first();await marker.focus();await marker.press('Enter');await expect(page.locator('#junctionPaths button').first()).toBeFocused();
 await pathRow(page,'spur').focus();await pathRow(page,'spur').press('Enter');await page.locator('#applyExclusion').click();await expect(page.locator('#previewBoundary')).toBeEnabled();await expect(page.locator('.boundary-branch')).toHaveCount(0);const excluded=await saved(page,testInfo);
 expect(excluded.objects).toHaveLength(before.objects.length);for(const original of before.objects){const result=excluded.objects.find(o=>o.id===original.id);if(original.id==='spur'){expect(result.cmds).toEqual(original.cmds);expect(result.bbox).toEqual(original.bbox);expect(result.manualLayer).toBe('reference');}else expect(result).toEqual(original);}
 const report=JSON.parse((await downloadText(page,testInfo,()=>page.locator('#report').click())).text);expect(report.boundaryReview.components).toHaveLength(1);expect(report.boundaryReview.components[0].repairable).toBe(true);
 await page.locator('#previewBoundary').click();await page.locator('#applyBoundary').click();const svg=(await downloadText(page,testInfo,()=>page.locator('#export').click())).text;expect(svg).not.toContain('id="spur"');expect(svg).toContain('width="100mm"');expect((svg.match(/<path /g)||[])).toHaveLength(3);
 await page.locator('#undo').click();expect((await saved(page,testInfo)).objects).toEqual(excluded.objects);await page.locator('#undo').click();expect((await saved(page,testInfo)).objects).toEqual(before.objects);
 await page.locator('#projectFile').setInputFiles({name:'excluded.pattern.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(excluded))});await page.locator('#scanBoundaries').click();await expect(page.locator('#previewBoundary')).toBeEnabled();expect((await saved(page,testInfo)).objects.find(o=>o.id==='spur').manualLayer).toBe('reference');
});

test('exclusion previews cancel on context, view or selection changes and cannot apply stale edits',async({page},testInfo)=>{
 await fixture(page);const before=await saved(page,testInfo);await page.locator('#junctionSelect').selectOption('0');await pathRow(page,'spur').click();await page.locator('#junctionSelect').selectOption('');await expect(page.locator('#exclusionPreviewPanel')).toBeHidden();await expect(page.locator('#junctionPanel')).toBeHidden();await page.locator('#junctionSelect').selectOption('0');await pathRow(page,'spur').click();await page.locator('#viewOriginal').click();await expect(page.locator('#exclusionPreviewPanel')).toBeHidden();await expect(page.locator('#applyExclusion')).toBeDisabled();
 await page.locator('#showBoundary').click();await page.locator('#junctionSelect').selectOption('0');await pathRow(page,'spur').click();await page.locator('#findDuplicates').click();await expect(page.locator('#exclusionPreviewPanel')).toBeHidden();
 await page.locator('#showBoundary').click();await page.locator('#junctionSelect').selectOption('0');await pathRow(page,'spur').click();await page.locator('#findMarkGroups').click();await expect(page.locator('#exclusionPreviewPanel')).toBeHidden();
 await page.locator('#showBoundary').click();await page.locator('#junctionSelect').selectOption('0');await pathRow(page,'spur').click();await page.locator('#filter').selectOption('all');await page.locator('#objectList .object-row').first().click();await expect(page.locator('#applyExclusion')).toBeDisabled();await expect(page.locator('#junctionPanel')).toBeHidden();expect((await saved(page,testInfo)).objects).toEqual(before.objects);
});

test('explicit manual-guide exclusion warns about the operation change, resets raster review and is undoable',async({page},testInfo)=>{
 await fixture(page,{raster:true,manualSpur:true});await page.locator('#rasterReviewed').check();const before=await saved(page,testInfo);await openJunction(page);await pathRow(page,'spur').click();await expect(page.locator('#exclusionSummary')).toContainText('existing manual operation');await page.locator('#applyExclusion').click();await expect(page.locator('#rasterReviewed')).not.toBeChecked();await expect(page.locator('#previewBoundary')).toBeEnabled();
 const after=await saved(page,testInfo);expect(after.objects.find(o=>o.id==='spur').manualLayer).toBe('reference');for(const id of ['hole','guide'])expect(after.objects.find(o=>o.id===id)).toEqual(before.objects.find(o=>o.id===id));await page.locator('#undo').click();await expect(page.locator('#rasterReviewed')).toBeChecked();expect((await saved(page,testInfo)).objects).toEqual(before.objects);
});

test('public sample junction inspection supports individual traces and rescans the same affected component after an explicit exclusion',async({page},testInfo)=>{
 await page.locator('#originalSample').click();await expect(page.locator('#busy')).toBeHidden();const before=await saved(page,testInfo);await page.locator('#scanBoundaries').click();await page.locator('#boundarySelect').selectOption('boundary:p336');await expect(page.locator('.boundary-branch[role="button"]')).toHaveCount(4);
 for(let i=0;i<4;i++){await page.locator('#junctionSelect').selectOption(String(i));if(await pathRow(page,'p342r0').count())break;}
 await expect(pathRow(page,'p342r0')).toBeVisible();await pathRow(page,'p342r0').hover();await expect(page.locator('[data-id="p342r0"]')).toHaveClass(/junction-trace/);await pathRow(page,'p342r0').click();await page.locator('#applyExclusion').click();await expect(page.locator('#boundarySelect')).toHaveValue('boundary:p336');await expect(page.locator('#boundaryInfo')).toContainText('4 paths');
 const after=await saved(page,testInfo);expect(after.objects).toHaveLength(before.objects.length);for(const original of before.objects){const result=after.objects.find(o=>o.id===original.id);if(original.id==='p342r0'){expect(result.manualLayer).toBe('reference');expect(result.cmds).toEqual(original.cmds);}else expect(result).toEqual(original);}
 await page.locator('#undo').click();expect((await saved(page,testInfo)).objects).toEqual(before.objects);
});
