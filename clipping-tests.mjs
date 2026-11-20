import assert from 'node:assert/strict';
import fs from 'node:fs';
import {extract,prepare,circleInfo,exportSVG,MM} from './geometry.mjs';
let pdfjs;try{pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');}catch{pdfjs=await import('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs');}
const O=pdfjs.OPS,V={transform:[1,0,0,-1,0,792]},rect=(x,y,w,h)=>[0,x,y,1,x+w,y,1,x+w,y+h,1,x,y+h,4];
const paint=(data,name='stroke')=>['constructPath',[O[name],[new Float32Array(data)],new Float32Array([0,0,612,792])]];
const clip=data=>[['clip',[]],paint(data,'endPath')];
function circle(cx=100,cy=100,r=1.5/MM/2){const k=r*.5522847498;return [0,cx+r,cy,2,cx+r,cy+k,cx+k,cy+r,cx,cy+r,2,cx-k,cy+r,cx-r,cy+k,cx-r,cy,2,cx-r,cy-k,cx-k,cy-r,cx,cy-r,2,cx+k,cy-r,cx+r,cy-k,cx+r,cy,4];}
const run=steps=>extract({fnArray:steps.map(s=>O[s[0]]),argsArray:steps.map(s=>s[1])},V,O);
let count=0;function test(name,fn){fn();console.log('PASS',name);count++;}
test('Page-sized clip preserves an enclosed 1.5 mm round mark',()=>{const e=run([...clip(rect(0,0,612,792)),paint(circle())]),p=prepare(e.objects);assert.equal(p.objects[0].layer,'hardware');assert.equal(e.objects[0].clipped,false);assert.equal(e.clipInfo.containedPaths,1);assert.ok(Math.abs(circleInfo(p.objects[0]).r*2-1.5)<.001);assert.equal(e.warnings.length,0);});
test('Geometry crossing a rectangular clip stays under review',()=>{const e=run([...clip(rect(0,0,100,200)),paint(circle())]),p=prepare(e.objects);assert.equal(p.objects[0].layer,'unassigned');assert.equal(e.objects[0].clipped,true);assert.match(p.objects[0].reason,/Clip boundary/);});
test('Completely clipped-out geometry is reference only',()=>{const e=run([...clip(rect(0,0,10,10)),paint(circle())]),p=prepare(e.objects);assert.equal(p.objects[0].layer,'reference');assert.equal(p.objects[0].outsideClip,true);assert.throws(()=>exportSVG(p.objects,{width:216,height:279}),/No exportable/);});
test('Non-rectangular clip cannot be cleared using only bounding boxes',()=>{const e=run([...clip([0,0,0,1,200,0,1,200,200,4]),paint(circle())]);assert.equal(prepare(e.objects).objects[0].layer,'unassigned');});
test('Compound clipping rectangles remain conservative',()=>{const e=run([...clip([...rect(0,0,612,792),...rect(90,90,20,20)]),paint(circle())]);assert.equal(prepare(e.objects).objects[0].layer,'unassigned');});
test('Clip bounds remain in page space after later transformations',()=>{const e=run([...clip(rect(0,0,200,200)),['transform',[1,0,0,1,300,0]],paint(circle())]);assert.equal(e.objects[0].outsideClip,true);});
test('Nested clips respect save and restore',()=>{const e=run([...clip(rect(0,0,612,792)),['save',[]],...clip(rect(0,0,10,10)),paint(circle()),['restore',[]],paint(circle())]);assert.equal(e.objects[0].outsideClip,true);assert.equal(e.objects[1].outsideClip,false);assert.equal(e.objects[1].clipped,false);});
test('A form bounding box permits fully enclosed paths',()=>{const e=run([['paintFormXObjectBegin',[[1,0,0,1,50,50],[0,0,200,200]]],paint(circle()),['paintFormXObjectEnd',[]]]);assert.equal(prepare(e.objects).objects[0].layer,'hardware');assert.equal(e.clipInfo.rectangularClips,1);});
test('Pending clip is applied after painting its defining path',()=>{const e=run([['clip',[]],paint(rect(0,0,10,10)),paint(circle())]);assert.equal(e.objects[0].clipped,false);assert.equal(e.objects[0].outsideClip,false);assert.equal(e.objects[1].outsideClip,true);});
if(process.env.LUGGAGE_TEST_PDF){
 const d=await pdfjs.getDocument({data:new Uint8Array(fs.readFileSync(process.env.LUGGAGE_TEST_PDF)),isEvalSupported:false}).promise;
 const page=await d.getPage(2),vp=page.getViewport({scale:1}),e=extract(await page.getOperatorList(),vp,O),p=prepare(e.objects);
 test('Luggage page 2: 110 holes classified; only the intentional open window needs review',()=>{assert.equal(e.objects.length,126);assert.equal(p.objects.filter(o=>o.layer==='holes').length,110);assert.equal(p.objects.filter(o=>o.layer==='unassigned').length,1);assert.equal(p.objects.find(o=>o.layer==='unassigned').id,'p68');assert.ok(p.objects.filter(o=>o.layer==='holes').every(o=>Math.abs(circleInfo(o).r*2-1.5)<.01));assert.equal(e.clipInfo.affectedPaths,0);});
 test('Luggage calibration square retains its physical 25.4 mm size',()=>{const square=p.objects.find(o=>o.id==='p8');assert.ok(Math.abs(square.bbox.w-25.4)<.001);assert.ok(Math.abs(square.bbox.h-25.4)<.001);});
 await d.destroy();
}
console.log(`${count} clipping checks passed.`);
