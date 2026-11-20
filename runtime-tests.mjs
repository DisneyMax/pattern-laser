import assert from 'node:assert/strict';
import {loadPdfRuntime,loadSampleBytes} from './runtime-assets.mjs';
let count=0;
async function test(name,fn){await fn();console.log('PASS',name);count++;}
await test('Hosted PDF engine imports the supplied URL and uses its same-origin worker',async()=>{
 const options={},engine={GlobalWorkerOptions:options};let requested;
 const result=await loadPdfRuntime({urls:{engine:'https://example.test/pattern-laser/assets/pdf.mjs',worker:'https://example.test/pattern-laser/assets/worker.mjs'},importModule:async url=>(requested=url,engine),urlAPI:{createObjectURL(){throw Error('Hosted loader must not create blobs');}}});
 assert.equal(result,engine);assert.equal(requested,'https://example.test/pattern-laser/assets/pdf.mjs');assert.equal(options.workerSrc,'https://example.test/pattern-laser/assets/worker.mjs');
});
await test('Offline PDF engine and worker use embedded bytes without network requests',async()=>{
 const blobs=[],revoked=[],engine={GlobalWorkerOptions:{}};
 await loadPdfRuntime({embeddedEngine:'engine',embeddedWorker:'worker',decode64:x=>new TextEncoder().encode(x),urlAPI:{createObjectURL:blob=>(blobs.push(blob),'blob:'+blobs.length),revokeObjectURL:url=>revoked.push(url)},importModule:async url=>{assert.equal(url,'blob:1');return engine;}});
 assert.equal(await blobs[0].text(),'engine');assert.equal(await blobs[1].text(),'worker');assert.deepEqual(revoked,['blob:1']);assert.equal(engine.GlobalWorkerOptions.workerSrc,'blob:2');
});
await test('Failed offline engine import revokes its temporary URL',async()=>{
 const revoked=[];await assert.rejects(loadPdfRuntime({embeddedEngine:'engine',decode64:x=>x,urlAPI:{createObjectURL:()=> 'blob:engine',revokeObjectURL:url=>revoked.push(url)},importModule:async()=>{throw Error('blocked');}}),/blocked/);assert.deepEqual(revoked,['blob:engine']);
});
await test('Failed hosted engine imports propagate without pretending to initialize a worker',async()=>{
 await assert.rejects(loadPdfRuntime({urls:{engine:'missing',worker:'worker'},importModule:async()=>{throw Error('Not found');}}),/Not found/);
});
await test('Hosted sample downloads preserve exact binary bytes',async()=>{
 const data=Uint8Array.of(37,80,68,70,0,255);const result=await loadSampleBytes({url:'https://example.test/pattern-laser/assets/sample.pdf',fetchImpl:async url=>{assert.ok(url.endsWith('/assets/sample.pdf'));return {ok:true,arrayBuffer:async()=>data.buffer};}});assert.deepEqual(result,data);
});
await test('Offline sample loading decodes embedded bytes and never fetches',async()=>{
 const result=await loadSampleBytes({embedded:'JVBERg==',decode64:x=>Uint8Array.from(atob(x),c=>c.charCodeAt(0)),fetchImpl:()=>{throw Error('Offline request');}});assert.equal(new TextDecoder().decode(result),'%PDF');
});
await test('Missing hosted samples produce an actionable error rather than decoding an error page',async()=>{
 await assert.rejects(loadSampleBytes({url:'missing',fetchImpl:async()=>({ok:false,status:404,arrayBuffer:()=>{throw Error('must not parse');}})}),/Sample download failed \(404\)/);
});
await test('Network errors during sample loading remain errors',async()=>{
 await assert.rejects(loadSampleBytes({url:'sample',fetchImpl:async()=>{throw Error('Network unavailable');}}),/Network unavailable/);
});
console.log(`${count} runtime asset checks passed.`);
