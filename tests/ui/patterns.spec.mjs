import {test,expect,openApp,downloadText,drag} from './helpers.mjs';
import {vectorPattern,transformedPattern,clippedPattern,rasterPattern} from '../patterns/fixtures.mjs';

test.beforeEach(async({page})=>{await openApp(page);});
async function upload(page,name,buffer){
 await page.locator('#file').setInputFiles({name,mimeType:'application/pdf',buffer});
 await expect(page.locator('#fileName')).toHaveText(name);await expect(page.locator('#busy')).toBeHidden();
}

test('generated A4/Letter patterns export all stitch marks, fastener, cutout and one-inch square',async({page},testInfo)=>{
 for(const [format,canvas]of [['a4','210mm'],['letter','215.9mm']]){
  await upload(page,`${format}-pattern.pdf`,vectorPattern({format,gray:format==='letter'}));
  await expect(page.locator('#paper .geom')).toHaveCount(16);await expect(page.locator('#export')).toBeEnabled();
  const report=JSON.parse((await downloadText(page,testInfo,()=>page.locator('#report').click())).text);
  expect(report.counts.cut).toBe(2);expect(report.counts.holes).toBe(12);expect(report.counts.hardware).toBe(1);expect(report.counts.inner).toBe(1);expect(report.unresolved).toEqual([]);
  const square=report.paths.find(p=>p.layer==='cut'&&p.boundsMm.x>110).boundsMm;expect(square.w).toBeCloseTo(25.4,2);expect(square.h).toBeCloseTo(25.4,2);
  const svg=await downloadText(page,testInfo,()=>page.locator('#export').click());expect(svg.text).toContain(`width="${canvas}"`);expect((svg.text.match(/<path /g)||[])).toHaveLength(16);
 }
});

test('multi-page PDF switching retains rotation, nested transforms and CropBox scale',async({page},testInfo)=>{
 await upload(page,'transformed-pattern.pdf',transformedPattern());await expect(page.locator('#page option')).toHaveCount(3);
 await expect(page.locator('#viewSummary')).toContainText('210.00 × 297.00 mm');
 await page.locator('#page').selectOption('2');await expect(page.locator('#busy')).toBeHidden();await expect(page.locator('#viewSummary')).toContainText('297.00 × 210.00 mm');
 await page.locator('#page').selectOption('3');await expect(page.locator('#busy')).toBeHidden();await expect(page.locator('#viewSummary')).toContainText('180.00 × 250.00 mm');
 const report=JSON.parse((await downloadText(page,testInfo,()=>page.locator('#report').click())).text);expect(report.paths).toHaveLength(1);
 const bounds=report.paths[0].boundsMm;for(const [key,value]of Object.entries({x:20,y:23,w:80,h:40}))expect(bounds[key]).toBeCloseTo(value,2);
 await expect(page.locator('#export')).toBeEnabled();
});

test('PDF clip crossings stay reviewable and cannot silently become exportable cuts',async({page})=>{
 await upload(page,'clipped-pattern.pdf',clippedPattern());await expect(page.locator('#export')).toBeDisabled();await expect(page.locator('#reviewCount')).toHaveText('1 need review');
 await page.locator('#reviewNext').click();await expect(page.locator('#reviewExplanation')).toContainText('Clipping affects this path');await expect(page.locator('#previewRepair')).toBeDisabled();
 await expect(page.locator('#paper .geom')).toHaveCount(2);await expect(page.locator('#export')).toBeDisabled();
});

test('multi-panel raster PDF suppresses a watermark and retains optional marks through review and export',async({page},testInfo)=>{
 await upload(page,'raster-pattern.pdf',rasterPattern());await expect(page.locator('#conversionMode')).toHaveValue('raster');
 await page.locator('#selectRasterArea').click();await drag(page,[1,1],[119,119]);await page.locator('#traceRaster').click();await expect(page.locator('#busy')).toBeHidden();
 await expect(page.locator('#paper .geom')).toHaveCount(3);await expect(page.locator('#rasterStats')).toContainText('12 point marks');await expect(page.locator('#export')).toBeDisabled();
 await page.locator('#rasterPoints').check();await page.locator('#traceRaster').click();await expect(page.locator('#busy')).toBeHidden();
 await expect(page.locator('#paper .geom')).toHaveCount(15);await expect(page.locator('#rasterReviewed')).not.toBeChecked();await expect(page.locator('#export')).toBeDisabled();
 await page.locator('#rasterReviewed').check();await expect(page.locator('#export')).toBeEnabled();
 const report=JSON.parse((await downloadText(page,testInfo,()=>page.locator('#report').click())).text);expect(report.counts.cut).toBe(3);expect(report.counts.holes+report.counts.hardware).toBe(12);expect(report.unresolved).toEqual([]);
 const points=report.paths.filter(p=>['holes','hardware'].includes(p.layer)).sort((a,b)=>a.boundsMm.x-b.boundsMm.x),centres=[16,22,28,34,40,46,67,73,79,85,91,97];
 for(let i=0;i<points.length;i++){const b=points[i].boundsMm;expect(Math.abs(b.x+b.w/2-centres[i])).toBeLessThan(.3);expect(Math.abs(b.y+b.h/2-17)).toBeLessThan(.3);}
 const svg=await downloadText(page,testInfo,()=>page.locator('#export').click());expect(svg.text).toContain('width="120mm"');expect((svg.text.match(/<path /g)||[])).toHaveLength(15);
});
