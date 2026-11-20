// Shared by the hosted app and the single-file offline build.
export async function loadPdfRuntime({urls=null,embeddedEngine,embeddedWorker,decode64,importModule=specifier=>import(specifier),urlAPI=URL,BlobType=Blob}){
 if(urls){
  const engine=await importModule(urls.engine);
  engine.GlobalWorkerOptions.workerSrc=urls.worker;
  return engine;
 }
 const engineURL=urlAPI.createObjectURL(new BlobType([decode64(embeddedEngine)],{type:'text/javascript'}));
 let engine;
 try{engine=await importModule(engineURL);}finally{urlAPI.revokeObjectURL(engineURL);}
 engine.GlobalWorkerOptions.workerSrc=urlAPI.createObjectURL(new BlobType([decode64(embeddedWorker)],{type:'text/javascript'}));
 return engine;
}
export async function loadSampleBytes({url=null,embedded,decode64,fetchImpl=globalThis.fetch}){
 if(!url)return decode64(embedded);
 const response=await fetchImpl(url);
 if(!response.ok)throw new Error(`Sample download failed (${response.status}). Please try again.`);
 return new Uint8Array(await response.arrayBuffer());
}
