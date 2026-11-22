import fs from 'node:fs/promises';
import {test,expect,openApp,downloadText,local} from './helpers.mjs';
import {duplicateFixture} from '../duplicates/fixtures.mjs';
import {circleInfo} from '../../geometry.mjs';

test.beforeEach(async({page})=>{await openApp(page);});
async function project(page,{allManual=false,raster=false,gap=false}={}){
 const data=JSON.parse(await fs.readFile(local('examples/YOMMY_reviewed.pattern.json'),'utf8')),objects=duplicateFixture({allManual,sourceType:raster?'raster':'vector'});
 if(gap)objects.push({id:'gap',sourceIds:['gap'],cmds:[['M',65,55],['L',75,55],['L',75,65],['L',65,65],['L',65,55.08]],stroke:'#000000',fill:null,alpha:1,width:.1,dash:[],layer:'unassigned',reason:'Small gap'});
 const batches=raster?[{id:'rt1',region:{x:0,y:0,w:100,h:80},objects:structuredClone(objects),settings:{dpi:300},stats:{omittedPoints:0,omittedShortLines:0}}]:[];
 Object.assign(data,{fileName:'duplicate-fixture.pdf',sourceFingerprint:null,pageInfo:{width:100,height:80,number:1},objects,raw:objects,vectorRaw:raster?[]:objects,referenceImage:'',scale:1,rasterBatches:batches,conversionMode:raster?'raster':'vector',warnings:[],stats:{},resizeHoles:false});
 await page.locator('#projectFile').setInputFiles({name:'duplicates.pattern.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await expect(page.locator('#fileName')).toContainText('duplicate-fixture.pdf');
}
async function saved(page,testInfo){return JSON.parse((await downloadText(page,testInfo,()=>page.locator('#saveProject').click())).text);}
async function nearAll(page){await page.locator('#duplicateKind').selectOption('near');await expect(page.locator('#duplicateGroup')).not.toHaveValue('all');await page.locator('#duplicateGroup').selectOption('all');await page.locator('#previewDuplicates').click();}

test('exact preview and Cancel preserve the report; Apply removes copies in one Undo step',async({page},testInfo)=>{
 await project(page);const before=await saved(page,testInfo);await page.locator('#findDuplicates').click();await expect(page.locator('#duplicateCount')).toHaveText('6 exact · 6 near');
 await page.locator('#previewDuplicates').click();await expect(page.locator('.duplicate-keep')).toHaveCount(6);await expect(page.locator('.duplicate-remove')).toHaveCount(6);await expect(page.locator('#export')).toBeDisabled();await expect(page.locator('#saveProject')).toBeDisabled();await expect(page.locator('#undo')).toBeDisabled();
 const report=JSON.parse((await downloadText(page,testInfo,()=>page.locator('#report').click())).text);expect(report.counts.holes).toBe(18);
 await page.locator('#cancelDuplicates').click();expect((await saved(page,testInfo)).objects).toEqual(before.objects);await expect(page.locator('#export')).toBeEnabled();
 await page.locator('#previewDuplicates').click();await page.locator('#applyDuplicates').click();const after=await saved(page,testInfo);expect(after.objects).toHaveLength(13);for(const o of after.objects)expect(o).toEqual(before.objects.find(original=>original.id===o.id));
 await page.locator('#undo').click();expect((await saved(page,testInfo)).objects).toEqual(before.objects);await expect(page.locator('#undo')).toBeDisabled();
});

test('near removal previews all positions explicitly, exports one original path per hole and survives save/reopen',async({page},testInfo)=>{
 await project(page);const before=await saved(page,testInfo);await page.locator('#findDuplicates').click();await nearAll(page);await expect(page.locator('.duplicate-remove')).toHaveCount(12);await expect(page.locator('.duplicate-keep')).toHaveCount(6);await expect(page.locator('#duplicateSummary')).toContainText('19 → 7');
 await testInfo.attach('near-overlap-removal-preview',{body:await page.screenshot(),contentType:'image/png'});
 await page.locator('#applyDuplicates').click();const after=await saved(page,testInfo);expect(after.objects).toHaveLength(7);for(const o of after.objects)expect(o).toEqual(before.objects.find(original=>original.id===o.id));
 for(let i=0;i<6;i++){const ci=circleInfo(after.objects.find(o=>o.id===`h${i}a`));expect(ci.cx).toBeCloseTo(10+i*6,8);expect(ci.cy).toBeCloseTo(15,8);}
 const svg=(await downloadText(page,testInfo,()=>page.locator('#export').click())).text;expect((svg.match(/<path /g)||[])).toHaveLength(7);expect(svg).toContain('width="100mm"');expect(svg).toContain('height="80mm"');
 await page.reload();await expect(page.locator('#drop')).toBeEnabled();await page.locator('#projectFile').setInputFiles({name:'cleaned.pattern.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(after))});await page.locator('#findDuplicates').click();await expect(page.locator('#duplicateCount')).toHaveText('0 exact · 0 near');await expect(page.locator('#export')).toBeEnabled();
});

test('manual copies are protected by default and explicit matching-copy cleanup retains their operations',async({page},testInfo)=>{
 await project(page,{allManual:true});const before=await saved(page,testInfo);await page.locator('#findDuplicates').click();await expect(page.locator('#duplicateCount')).toHaveText('0 exact · 0 near');await expect(page.locator('#duplicateControls')).toBeHidden();
 await page.locator('#duplicateManual').check();await page.locator('#findDuplicates').click();await nearAll(page);await expect(page.locator('#duplicateSummary')).toContainText('12 matching manual copies');await page.locator('#applyDuplicates').click();
 const after=await saved(page,testInfo);expect(after.objects.filter(o=>o.manualLayer==='holes')).toHaveLength(6);for(const o of after.objects)expect(o).toEqual(before.objects.find(original=>original.id===o.id));
});

test('raster removal requires fresh acknowledgement and Undo restores the prior review and geometry',async({page},testInfo)=>{
 await project(page,{raster:true});await page.locator('#rasterReviewed').check();await expect(page.locator('#export')).toBeEnabled();const before=await saved(page,testInfo);
 await page.locator('#findDuplicates').click();await page.locator('#previewDuplicates').click();await page.locator('#applyDuplicates').click();await expect(page.locator('#rasterReviewed')).not.toBeChecked();await expect(page.locator('#export')).toBeDisabled();
 await page.locator('#undo').click();await expect(page.locator('#rasterReviewed')).toBeChecked();await expect(page.locator('#export')).toBeEnabled();expect((await saved(page,testInfo)).objects).toEqual(before.objects);
});

test('duplicate, row and repair previews are exclusive; Escape, match changes and view changes cancel pending removals',async({page})=>{
 await project(page,{gap:true});await page.locator('#reviewNext').click();await page.locator('#previewRepair').click();await expect(page.locator('.repair-preview')).toHaveCount(1);
 await page.locator('#findDuplicates').click();await expect(page.locator('.repair-preview')).toHaveCount(0);await page.locator('#previewDuplicates').click();await page.keyboard.press('Escape');await expect(page.locator('#duplicatePreviewPanel')).toBeHidden();
 await page.locator('#previewDuplicates').click();await page.locator('#duplicateKind').selectOption('near');await expect(page.locator('#duplicatePreviewPanel')).toBeHidden();await page.locator('#previewDuplicates').click();await page.locator('#viewOriginal').click();await expect(page.locator('.duplicate-remove')).toHaveCount(0);
 await page.locator('#previewDuplicates').click();await page.locator('#filter').selectOption('all');await page.locator('#objectList .object-row').first().click();await expect(page.locator('#duplicatePreviewPanel')).toBeHidden();
 await page.locator('#previewDuplicates').click();await page.locator('#findMarkGroups').click();await expect(page.locator('.duplicate-remove')).toHaveCount(0);await page.locator('#markGroupRole').selectOption('holes');await page.locator('#previewMarkGroup').click();await expect(page.locator('.mark-group-preview')).not.toHaveCount(0);
 await page.locator('#findDuplicates').click();await expect(page.locator('.mark-group-preview')).toHaveCount(0);await page.locator('#previewDuplicates').click();await page.locator('#assignment').selectOption('hardware');await expect(page.locator('#duplicatePreviewPanel')).toBeHidden();await expect(page.locator('#saveProject')).toBeEnabled();
});

test('public PDF cleanup retains every round-mark position and leaves unresolved boundaries for review',async({page},testInfo)=>{
 await page.locator('#originalSample').click();await expect(page.locator('#busy')).toBeHidden();const before=await saved(page,testInfo);await page.locator('#findDuplicates').click();await nearAll(page);await page.locator('#applyDuplicates').click();const after=await saved(page,testInfo);
 expect(after.objects.length).toBeLessThan(before.objects.length);for(const o of after.objects)expect(o).toEqual(before.objects.find(original=>original.id===o.id));
 const retained=after.objects.filter(o=>o.layer==='holes').map(o=>circleInfo(o,{maxDiameter:10}));for(const original of before.objects.filter(o=>o.layer==='holes')){const ci=circleInfo(original,{maxDiameter:10});expect(retained.some(c=>Math.hypot(c.cx-ci.cx,c.cy-ci.cy)<=.030001&&Math.abs(c.r-ci.r)*2<=.0201)).toBe(true);}
 const report=JSON.parse((await downloadText(page,testInfo,()=>page.locator('#report').click())).text);expect(report.unresolved).toHaveLength(7);await expect(page.locator('#export')).toBeDisabled();
});
