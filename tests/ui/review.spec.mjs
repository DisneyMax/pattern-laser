import fs from 'node:fs/promises';
import {test,expect,openApp,downloadText,local} from './helpers.mjs';

test.beforeEach(async({page})=>{await openApp(page);});
async function original(page){await page.locator('#originalSample').click();await expect(page.locator('#busy')).toBeHidden();await expect(page.locator('#reviewCount')).toHaveText('7 need review');}
async function joinFixture(page,{branch=false}={}){
 const project=JSON.parse(await fs.readFile(local('examples/YOMMY_reviewed.pattern.json'),'utf8'));
 const shape=(id,cmds,layer='unassigned')=>({id,sourceIds:[id],cmds,stroke:'#000000',fill:null,alpha:1,width:.1,dash:[],layer,manualLayer:layer==='unassigned'?null:layer,reason:'UI review fixture'});
 const objects=[shape('left',[['M',5,5],['L',15,5],['L',15,15]]),shape('right',[['M',15,15],['L',5,15],['L',5,5.04]]),shape('unrelated',[['M',60,40],['L',70,40],['L',70,50],['L',60,50],['Z']],'hardware')];
 if(branch)objects.push(shape('spur',[['M',15,15],['L',17,17]]));
 Object.assign(project,{fileName:'review-fixture.pdf',pageInfo:{width:120,height:100,number:1},objects,raw:objects,vectorRaw:objects,referenceImage:'',scale:1,rasterBatches:[],conversionMode:'vector',warnings:[],stats:{}});
 await page.locator('#projectFile').setInputFiles({name:'review.pattern.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
 await expect(page.locator('#reviewCount')).toHaveText(`${branch?3:2} need review`);
}

test('review navigation wraps, reveals and fits each unresolved path',async({page})=>{
 await original(page);await page.locator('#reviewNext').click();
 await expect(page.locator('#selectedName')).toHaveText('p5');await expect(page.locator('#reviewCount')).toHaveText('1 / 7');
 await expect(page.locator('#reviewExplanation')).toContainText('0.082 mm exceeds the 0.030 mm');
 await expect(page.locator('#paper [data-id="p5"]')).toBeInViewport({ratio:.9});
 await page.locator('#reviewPrev').click();await expect(page.locator('#selectedName')).toHaveText('p344r0');await expect(page.locator('#reviewCount')).toHaveText('7 / 7');
 await page.locator('#reviewNext').click();await expect(page.locator('#selectedName')).toHaveText('p5');
});

test('closing preview leaves the report unchanged; Cancel and Undo preserve the original',async({page},testInfo)=>{
 await original(page);await page.locator('#reviewNext').click();await page.locator('#previewRepair').click();
 await expect(page.locator('.repair-preview')).toHaveCount(1);await expect(page.locator('#repairSummary')).toContainText('0.082 mm');
 await testInfo.attach('closing-repair-preview',{body:await page.screenshot(),contentType:'image/png'});
 await expect(page.locator('#saveProject')).toBeDisabled();await expect(page.locator('#export')).toBeDisabled();
 const before=JSON.parse((await downloadText(page,testInfo,()=>page.locator('#report').click())).text);expect(before.unresolved).toHaveLength(7);
 await page.locator('#cancelRepair').click();await expect(page.locator('.repair-preview')).toHaveCount(0);await expect(page.locator('#reviewCount')).toHaveText('1 / 7');
 await page.locator('#previewRepair').click();await page.locator('#applyRepair').click();
 await expect(page.locator('#reviewCount')).toHaveText('6 need review');await expect(page.locator('#paper [data-id="p5"]')).toHaveAttribute('stroke','#FF0000');
 const applied=JSON.parse((await downloadText(page,testInfo,()=>page.locator('#report').click())).text);expect(applied.unresolved).toHaveLength(6);expect(applied.cleanup.tolerance).toBe(.03);
 await page.locator('#undo').click();await expect(page.locator('#reviewCount')).toHaveText('7 need review');await expect(page.locator('#paper [data-id="p5"]')).toHaveAttribute('stroke','#9A7600');
});

test('join preview applies only the proposed component and preserves unrelated operations',async({page},testInfo)=>{
 await joinFixture(page);const before=JSON.parse((await downloadText(page,testInfo,()=>page.locator('#report').click())).text);
 await page.locator('#reviewNext').click();await page.locator('#previewRepair').click();await expect(page.locator('#repairSummary')).toContainText('Join 2 paths');
 await expect(page.locator('#paper .geom')).toHaveCount(3);await page.locator('#applyRepair').click();
 await expect(page.locator('#paper .geom')).toHaveCount(2);await expect(page.locator('#export')).toBeEnabled();
 const after=JSON.parse((await downloadText(page,testInfo,()=>page.locator('#report').click())).text);expect(after.unresolved).toEqual([]);
 expect(after.paths.find(p=>p.id==='unrelated')).toEqual(before.paths.find(p=>p.id==='unrelated'));
 expect(after.paths.find(p=>p.id!=='unrelated').sourceIds).toEqual(['left','right']);
});

test('branching paths do not offer a repair that guesses through the junction',async({page})=>{
 await joinFixture(page,{branch:true});await page.locator('#reviewNext').click();
 await expect(page.locator('#reviewExplanation')).toContainText('branching paths');await page.locator('#previewRepair').click();
 await expect(page.locator('#status')).toContainText('No unambiguous small-gap repair');await expect(page.locator('#repairPreviewPanel')).toBeHidden();
 await expect(page.locator('#reviewCount')).toHaveText('1 / 3');await expect(page.locator('#export')).toBeDisabled();
});

test('Escape and tolerance or assignment changes discard previews before they can be applied',async({page})=>{
 await original(page);await page.locator('#reviewNext').click();await page.locator('#previewRepair').click();await page.keyboard.press('Escape');
 await expect(page.locator('#repairPreviewPanel')).toBeHidden();await expect(page.locator('#reviewCount')).toHaveText('1 / 7');
 await page.locator('#previewRepair').click();await page.locator('#tolerance').fill('0.1');
 await expect(page.locator('#repairPreviewPanel')).toBeHidden();await expect(page.locator('#applyRepair')).toBeDisabled();
 await page.locator('#previewRepair').click();await page.locator('#assignment').selectOption('score');
 await expect(page.locator('#repairPreviewPanel')).toBeHidden();await expect(page.locator('#applyRepair')).toBeDisabled();
 await expect(page.locator('#paper [data-id="p5"]')).toHaveAttribute('stroke','#00A6D6');
 await page.locator('#reviewNext').click();await page.locator('#previewRepair').click();await page.locator('#viewOriginal').click();
 await expect(page.locator('#repairPreviewPanel')).toBeHidden();await expect(page.locator('#saveProject')).toBeEnabled();
 await page.locator('#previewRepair').click();await page.locator('#measureTool').click();await expect(page.locator('#repairPreviewPanel')).toBeHidden();
});
