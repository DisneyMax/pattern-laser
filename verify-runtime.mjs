// Exercise the actual emitted PDF engine/worker and exact hosted sample, without a browser.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {loadPdfRuntime,loadSampleBytes} from './runtime-assets.mjs';
const root=new URL('./_site/',import.meta.url),manifest=JSON.parse(await fs.readFile(new URL('assets-manifest.json',root),'utf8'));
const urls=Object.fromEntries(['engine','worker','sample'].map(key=>[key,new URL(manifest[key],root).href]));
const pdfjs=await loadPdfRuntime({urls});
const bytes=await loadSampleBytes({url:urls.sample,fetchImpl:async url=>({ok:true,arrayBuffer:async()=>{const data=await fs.readFile(new URL(url));return data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);}})});
const doc=await pdfjs.getDocument({data:bytes,isEvalSupported:false}).promise;
try{
 assert.equal(doc.numPages,1);
 const page=await doc.getPage(1),viewport=page.getViewport({scale:1});
 assert.equal(viewport.width,612);assert.equal(viewport.height,792);
 const operators=await page.getOperatorList();assert.ok(operators.fnArray.length>100);
 console.log('Emitted PDF engine and worker loaded the hosted YOMMY sample at 612 × 792 pt.');
}finally{await doc.destroy();}
