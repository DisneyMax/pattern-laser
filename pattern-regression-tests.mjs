import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import {extract,prepare,MM,LAYERS,circleInfo,pathData,exportSVG,auditExport} from './geometry.mjs';
import {rasterTrace,rasterAudit,rasterTextBoxes} from './raster.mjs';
import {suggestedRepair} from './review.mjs';
import {vectorPattern,transformedPattern,clippedPattern,branchedPattern,rasterPattern} from './tests/patterns/fixtures.mjs';

let count=0;
async function test(name,fn){await fn();console.log('PASS',name);count++;}
const close=(actual,expected,tolerance=.002)=>assert.ok(Math.abs(actual-expected)<=tolerance,`Expected ${expected} ± ${tolerance} mm; received ${actual}`);
const box=(actual,expected,tolerance=.002)=>['x','y','w','h'].forEach((key,i)=>close(actual[key],expected[i],tolerance));
const layerCounts=objects=>Object.fromEntries(Object.keys(LAYERS).map(layer=>[layer,objects.filter(o=>o.layer===layer).length]));
const sizes=objects=>objects.filter(o=>o.layer==='cut').map(o=>[o.bbox.w,o.bbox.h]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
const exportReady=objects=>{const audit=auditExport(objects);return !audit.blocked&&audit.summary.some(row=>row.included>0);};
async function documentFrom(bytes){return pdfjs.getDocument({data:new Uint8Array(bytes),isEvalSupported:false}).promise;}
async function pageResult(doc,number=1){
 const page=await doc.getPage(number),viewport=page.getViewport({scale:1});
 const source=extract(await page.getOperatorList(),viewport,pdfjs.OPS),result=prepare(source.objects);
 return {page,viewport,source,objects:result.objects,stats:result.stats,width:viewport.width*MM,height:viewport.height*MM};
}
async function withPdf(bytes,fn){const doc=await documentFrom(bytes);try{return await fn(doc);}finally{await doc.destroy();}}
async function renderPage(page,dpi){
 const {createCanvas}=await import('@napi-rs/canvas');
 const viewport=page.getViewport({scale:dpi/72}),physical=page.getViewport({scale:1}),canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height)),ctx=canvas.getContext('2d');
 await page.render({canvasContext:ctx,viewport,background:'white'}).promise;
 return {canvas,ctx,viewport,width:physical.width*MM,height:physical.height*MM,pixelMmX:physical.width*MM/canvas.width,pixelMmY:physical.height*MM/canvas.height};
}
async function publicPatterns(){
 const results={};
 for(const [format,expectedPage]of [['a4',[210,297]],['letter',[215.9,279.4]]]){
  await test(`${format}: actual PDF preserves panels, 12 filled stitch dots, fastener and internal slot`,async()=>{
   results[format]=await withPdf(vectorPattern({format,gray:format==='letter'}),async doc=>pageResult(doc));
   const r=results[format];close(r.width,expectedPage[0]);close(r.height,expectedPage[1]);
   assert.deepEqual(layerCounts(r.objects),{cut:2,holes:12,hardware:1,inner:1,score:0,unassigned:0,reference:0});assert.equal(exportReady(r.objects),true);
   const svg=exportSVG(r.objects,r);assert.equal((svg.match(/<path /g)||[]).length,16);assert.match(svg,new RegExp(`width="${expectedPage[0]}mm"`));assert.match(svg,new RegExp(`height="${expectedPage[1]}mm"`));
   box(r.objects.find(o=>o.layer==='inner').bbox,[55,65,6,12]);
  });
 }
 await test('A4 and Letter keep identical physical geometry regardless of page size and fill colour',()=>{
  for(let i=0;i<16;i++)assert.equal(pathData(results.a4.objects[i].cmds),pathData(results.letter.objects[i].cmds));
 });
 await test('One-inch calibration square, stitch diameter and fastener diameter retain physical sizes',()=>{
  const r=results.a4,calibration=r.objects.find(o=>o.layer==='cut'&&o.bbox.x>110);box(calibration.bbox,[120,40,25.4,25.4]);
  for(const hole of r.objects.filter(o=>o.layer==='holes'))close(circleInfo(hole).r*2,1);
  const hardware=r.objects.find(o=>o.layer==='hardware');close(hardware.bbox.w,2.4);close(hardware.bbox.h,2.4);
 });
 await test('Stitch resizing changes only the 12 stitch holes in actual PDF export',()=>{
  const r=results.a4,svg=exportSVG(r.objects,{...r,holeDiameter:2});assert.equal((svg.match(/<circle /g)||[]).length,12);assert.equal((svg.match(/r="1"/g)||[]).length,12);
  const hardware=r.objects.find(o=>o.layer==='hardware');assert.ok(svg.includes(`<path id="${hardware.id}" d="${pathData(hardware.cmds)}"`));
 });
 await test('Duplicate PDF painting is removed without losing stitch marks or cutouts',async()=>withPdf(vectorPattern({duplicate:true}),async doc=>{
  const r=await pageResult(doc);assert.equal(r.source.objects.length,17);assert.equal(r.objects.length,16);assert.equal(r.stats.duplicatePaths,1);assert.deepEqual(layerCounts(r.objects),layerCounts(results.a4.objects));
 }));
 const transformed=await documentFrom(transformedPattern());
 try{
  for(const [number,expectedPage,expectedBox,label]of [[1,[210,297],[100,50,20,40],'nested graphics transform'],[2,[297,210],[227,20,40,80],'90-degree page rotation'],[3,[180,250],[20,23,80,40],'non-zero CropBox origin']]){
   await test(`${label}: displayed page dimensions and cut geometry remain in millimetres`,async()=>{const r=await pageResult(transformed,number);close(r.width,expectedPage[0]);close(r.height,expectedPage[1]);assert.equal(r.objects.length,1);assert.equal(r.objects[0].layer,'cut');box(r.objects[0].bbox,expectedBox);});
  }
 }finally{await transformed.destroy();}
 await test('Rectangular PDF clipping preserves enclosed cuts, excludes outside art and gates crossing paths',async()=>withPdf(clippedPattern(),async doc=>{
  const r=await pageResult(doc);assert.equal(r.objects.filter(o=>o.layer==='cut').length,1);assert.equal(r.objects.filter(o=>o.layer==='reference').length,1);assert.equal(r.objects.filter(o=>o.layer==='unassigned').length,1);assert.equal(exportReady(r.objects),false);
  const crossing=r.objects.find(o=>o.layer==='unassigned');assert.equal(crossing.clipped,true);box(crossing.bbox,[60,20,30,20]);assert.equal(suggestedRepair(r.objects,crossing.id),null);
 }));
 await test('Real PDF small gaps receive previews while the branched component remains under review',async()=>withPdf(branchedPattern(),async doc=>{
  const r=await pageResult(doc);assert.equal(r.objects.length,4);assert.ok(r.objects.every(o=>o.layer==='unassigned'));assert.equal(exportReady(r.objects),false);
  const preview=suggestedRepair(r.objects,r.objects[0].id);assert.equal(preview.kind,'close');close(preview.gap,.08);assert.equal(suggestedRepair(r.objects,r.objects[1].id),null);assert.ok(r.objects.every(o=>!o.closed));
 }));
 await withPdf(rasterPattern(),async doc=>{
  const r=await pageResult(doc);
  await test('Image-only PDF cannot produce a successful empty vector export',()=>{assert.equal(r.objects.length,0);assert.equal(r.source.images,1);assert.equal(exportReady(r.objects),false);assert.throws(()=>exportSVG(r.objects,r),/No exportable/);});
  const rendered=await renderPage(r.page,300),pixels=rendered.ctx.getImageData(0,0,rendered.canvas.width,rendered.canvas.height),settings={pixelMmX:rendered.pixelMmX,pixelMmY:rendered.pixelMmY,threshold:150,pruneMm:1.2,simplifyMm:.08};
  const trace=rasterTrace(pixels,settings),clean=prepare(trace.objects).objects;
  await test('PDF-rendered raster recovers three centreline outlines, suppresses the watermark and records omitted marks',()=>{
   assert.equal(clean.length,3);assert.ok(clean.every(o=>o.closed&&o.layer==='cut'));assert.equal(trace.stats.omittedPoints,12);assert.equal(rasterAudit(clean).pending,true);assert.equal(rasterAudit(clean,{reviewed:true}).pending,false);
   const sorted=[...clean].sort((a,b)=>a.bbox.y-b.bbox.y||a.bbox.x-b.bbox.x);for(const [i,expected]of [[0,[10.2,10.2,39.6,29.6]],[1,[64.2,10.2,35.6,29.6]],[2,[10.2,60.2,79.6,39.6]]])box(sorted[i].bbox,expected,.3);
  });
  await test('150 DPI raster tracing retains every point location even when inferred operation roles vary',async()=>{
   const low=await renderPage(r.page,150),image=low.ctx.getImageData(0,0,low.canvas.width,low.canvas.height),objects=prepare(rasterTrace(image,{pixelMmX:low.pixelMmX,pixelMmY:low.pixelMmY,threshold:150,includePoints:true}).objects).objects;
   const points=objects.filter(o=>o.rasterKind==='point');assert.equal(points.length,12);assert.equal(objects.filter(o=>o.layer==='cut').length,3);assert.ok(points.every(o=>['holes','hardware'].includes(o.layer)));
   const expected=[16,22,28,34,40,46,67,73,79,85,91,97],ordered=points.sort((a,b)=>a.bbox.x-b.bbox.x);for(let i=0;i<ordered.length;i++){const b=ordered[i].bbox;close(b.x+b.w/2,expected[i],.3);close(b.y+b.h/2,17,.3);assert.ok(b.w>.6&&b.w<1.1);}
  });
  await test('Optional raster marks preserve 12 stitch suggestions and physical SVG dimensions',()=>{
   const detailed=prepare(rasterTrace(pixels,{...settings,includePoints:true}).objects).objects;assert.equal(detailed.filter(o=>o.layer==='cut').length,3);assert.equal(detailed.filter(o=>o.layer==='holes').length,12);assert.equal(detailed.filter(o=>o.layer==='unassigned').length,0);
   const svg=exportSVG(detailed,r);assert.match(svg,/width="120mm"/);assert.match(svg,/height="120mm"/);assert.equal((svg.match(/<path /g)||[]).length,15);
  });
 });
}
async function privatePatterns(){
 const directory=process.env.PATTERN_CORPUS_DIR;
 if(!directory)throw new Error('PATTERN_CORPUS_DIR is required for --private. No private files have been tested.');
 const catalog=JSON.parse(await fs.readFile(new URL('./tests/patterns/private-baselines.json',import.meta.url),'utf8')),loaded=new Map();
 assert.equal(catalog.schemaVersion,1);
 // Preflight the complete corpus before claiming any per-page validation.
 for(const file of catalog.files){
  const bytes=await fs.readFile(path.join(directory,file.fileName)).catch(()=>{throw new Error(`Private corpus is missing ${file.id}: ${file.fileName}`);});
  await test(`${file.id}: source SHA-256 matches the pinned baseline`,()=>assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),file.sha256,`Wrong PDF version for ${file.id}; do not regenerate expectations automatically.`));loaded.set(file.id,bytes);
 }
 const results=new Map();
 for(const file of catalog.files){
  await withPdf(loaded.get(file.id),async doc=>{
   assert.equal(doc.numPages,file.pages.length,`${file.id} page count`);
   for(const expected of file.pages){
    await test(`${file.id} page ${expected.number}: dimensions, inventory, annotations and export gate`,async()=>{
     const r=await pageResult(doc,expected.number);close(r.width,expected.sizeMm[0],.01);close(r.height,expected.sizeMm[1],.01);assert.deepEqual(layerCounts(r.objects),expected.counts);assert.equal(r.objects.filter(o=>o.autoRole==='dimension').length,expected.dimensionPaths);assert.equal(r.source.images,expected.images);assert.equal(exportReady(r.objects),expected.exportReady);
     const actualSizes=sizes(r.objects);assert.equal(actualSizes.length,expected.cutSizesMm.length);for(let i=0;i<actualSizes.length;i++)for(let axis=0;axis<2;axis++)close(actualSizes[i][axis],expected.cutSizesMm[i][axis],.01);
     if(file.id==='pick-case')assert.ok(r.objects.filter(o=>o.stroke==='#ffffff').every(o=>o.layer==='reference'),'White masks must never become cut contours.');
     if(file.id.startsWith('makesupply'))for(const o of r.objects.filter(o=>['holes','hardware'].includes(o.layer))){const original=r.source.objects.find(p=>p.id===o.id);assert.ok(original,`Missing original round mark ${o.id}`);assert.equal(pathData(o.cmds).replace(/(?: Z)+$/,''),pathData(original.cmds).replace(/(?: Z)+$/,''),'Round mark geometry must retain the source curves and position.');}
     if(expected.exportReady){const svg=exportSVG(r.objects,r);assert.equal((svg.match(/<path /g)||[]).length,Object.entries(expected.counts).filter(([key])=>!['reference','unassigned'].includes(key)).reduce((sum,[,value])=>sum+value,0));}
     results.set(`${file.id}:${expected.number}`,r);
    });
   }
   if(file.id==='hahns'){
    const page=await doc.getPage(1),rendered=await renderPage(page,300);rendered.ctx.fillStyle='white';const text=await page.getTextContent();for(const b of rasterTextBoxes(text.items,rendered.viewport.transform))rendered.ctx.fillRect(b.x,b.y,b.w,b.h);
    const outlines=[],marks=[];
    for(const [i,region]of [{x:46,y:109,w:123,h:79.4},{x:46,y:221,w:123,h:81},{x:196,y:109,w:58,h:194}].entries()){
     const x=Math.floor(region.x/rendered.pixelMmX),y=Math.floor(region.y/rendered.pixelMmY),w=Math.ceil(region.w/rendered.pixelMmX),h=Math.ceil(region.h/rendered.pixelMmY),image=rendered.ctx.getImageData(x,y,w,h),options={xMm:x*rendered.pixelMmX,yMm:y*rendered.pixelMmY,pixelMmX:rendered.pixelMmX,pixelMmY:rendered.pixelMmY,idPrefix:'private'+i,threshold:150};
     outlines.push(...rasterTrace(image,options).objects);marks.push(...rasterTrace(image,{...options,includePoints:true}).objects);
    }
    await test('hahns raster: three outlines agree with printed dimensions within 0.3 mm',()=>{const clean=prepare(outlines).objects;assert.equal(clean.length,3);for(const o of clean){assert.equal(o.layer,'cut');assert.ok(o.closed);const expected=o.bbox.x>180?[55,190]:[120,78];close(o.bbox.w,expected[0],.3);close(o.bbox.h,expected[1],.3);}assert.equal(rasterAudit(clean).pending,true);});
    await test('hahns raster: optional point marks retain 64 stitching suggestions',()=>{const detailed=prepare(marks).objects;assert.equal(detailed.filter(o=>o.layer==='holes').length,64);assert.equal(detailed.filter(o=>o.layer==='cut').length,3);});
   }
  });
 }
 await test('MakeSupply Letter/A4 retain equal cut dimensions and the same 96 stitch / 2 fastener inventory',()=>{
  const a=results.get('makesupply-a4:1'),b=results.get('makesupply-letter:1');assert.deepEqual(layerCounts(a.objects),layerCounts(b.objects));for(let i=0;i<sizes(a.objects).length;i++)for(let axis=0;axis<2;axis++)close(sizes(a.objects)[i][axis],sizes(b.objects)[i][axis],.01);
 });
}
if(process.argv.includes('--private'))await privatePatterns();else await publicPatterns();
console.log(`${count} ${process.argv.includes('--private')?'private':'generated public'} pattern checks passed.`);
