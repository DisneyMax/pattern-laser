// Serve only the built artifact, under the same project prefix used by GitHub Pages.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../_site/',import.meta.url)),prefix='/pattern-laser/';
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.pdf':'application/pdf','.svg':'image/svg+xml','.png':'image/png','.md':'text/plain'};
const server=http.createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname==='/favicon.ico'){res.writeHead(204).end();return;}
  if(!pathname.startsWith(prefix)){res.writeHead(404).end();return;}
  const filename=path.resolve(root,pathname.slice(prefix.length)||'index.html');
  if(!filename.startsWith(root)){res.writeHead(403).end();return;}
  const data=await fs.readFile(filename);
  res.writeHead(200,{'Content-Type':mime[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-store'}).end(data);
 }catch{res.writeHead(404).end();}
});
server.listen(Number(process.env.PLAYWRIGHT_PORT||4173),'127.0.0.1',()=>console.log('Serving built Pattern Laser at /pattern-laser/'));
