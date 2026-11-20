import {test as base,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {deflateSync} from 'node:zlib';
export {expect};
export const repository=new URL('../../',import.meta.url);
export const local=name=>fileURLToPath(new URL(name,repository));
export const test=base.extend({
 page:async({page},use)=>{
  const uncaught=[];page.on('pageerror',error=>uncaught.push(error.message));
  await use(page);
  expect(uncaught,'No uncaught browser errors').toEqual([]);
 },
});
export async function openApp(page){
 await page.goto('./');
 await expect(page.locator('#drop')).toBeEnabled();
 await expect(page.locator('#status')).toContainText('Ready');
}
export async function reviewedProject(page){
 await page.locator('#projectFile').setInputFiles(local('examples/YOMMY_reviewed.pattern.json'));
 await expect(page.locator('#fileName')).toContainText('YOMMY');
 await expect(page.locator('#export')).toBeEnabled();
}
export async function selectionProject(page){
 const project=JSON.parse(await fs.readFile(local('examples/YOMMY_reviewed.pattern.json'),'utf8'));
 const rectangle=(id,x,y,w,h,layer)=>({id,sourceIds:[id],cmds:[['M',x,y],['L',x+w,y],['L',x+w,y+h],['L',x,y+h],['Z']],stroke:'#000000',fill:null,alpha:1,width:.1,dash:[],layer,manualLayer:layer,reason:'UI test fixture'});
 const objects=[rectangle('outer',5,5,90,80,'cut'),rectangle('holeA',20,20,2,2,'holes'),rectangle('holeB',30,20,2,2,'holes'),rectangle('hidden',25,20,2,2,'reference'),rectangle('piece',65,50,10,10,'cut')];
 Object.assign(project,{fileName:'selection-fixture.pdf',sourceFingerprint:null,pageInfo:{width:120,height:100,number:1},objects,raw:objects,vectorRaw:objects,referenceImage:'',scale:1,rasterBatches:[],conversionMode:'vector',warnings:[],stats:{}});
 await page.locator('#projectFile').setInputFiles({name:'selection.pattern.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
 await expect(page.locator('#fileName')).toContainText('selection-fixture.pdf');
 await expect(page.locator('#paper .geom')).toHaveCount(4);
}
export async function point(page,x,y){
 await page.locator('#paper > svg').scrollIntoViewIfNeeded();
 return page.locator('#paper > svg').evaluate((svg,{x,y})=>{const p=svg.createSVGPoint();p.x=x;p.y=y;const q=p.matrixTransform(svg.getScreenCTM());return {x:q.x,y:q.y};},{x,y});
}
export async function drag(page,from,to,{add=false,release=true}={}){
 const a=await point(page,...from),b=await point(page,...to);
 if(add)await page.keyboard.down('Shift');
 await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});
 if(release)await page.mouse.up();
 if(add)await page.keyboard.up('Shift');
}
export async function downloadText(page,testInfo,trigger){
 await trigger();await expect(page.locator('#downloadDialog')).toBeVisible();
 const pending=page.waitForEvent('download');await page.locator('#downloadSaveLink').click();const download=await pending;
 const name=download.suggestedFilename(),filename=testInfo.outputPath(name);await download.saveAs(filename);
 const text=await fs.readFile(filename,'utf8');await page.locator('#downloadClose').click();return {name,text,filename};
}
// A generated image-only PDF avoids adding third-party pattern artwork to the suite.
export function rasterPdf(){
 const side=400,pixels=Buffer.alloc(side*side,255);
 for(let y=50;y<=350;y++)for(let x=50;x<=350;x++)if(x<56||x>344||y<56||y>344)pixels[y*side+x]=0;
 const image=deflateSync(pixels),content=Buffer.from('q 283.464567 0 0 283.464567 0 0 cm /Im0 Do Q');
 const stream=(dictionary,data)=>Buffer.concat([Buffer.from(dictionary+` /Length ${data.length} >>\nstream\n`),data,Buffer.from('\nendstream')]);
 const objects=[Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),Buffer.from('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 283.464567 283.464567] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>'),stream('<< /Type /XObject /Subtype /Image /Width 400 /Height 400 /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode',image),stream('<<',content)];
 const chunks=[Buffer.from('%PDF-1.4\n')],offsets=[0];let size=chunks[0].length;
 for(let i=0;i<objects.length;i++){offsets.push(size);const chunk=Buffer.concat([Buffer.from(`${i+1} 0 obj\n`),objects[i],Buffer.from('\nendobj\n')]);chunks.push(chunk);size+=chunk.length;}
 chunks.push(Buffer.from(`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${size}\n%%EOF`));
 return Buffer.concat(chunks);
}
