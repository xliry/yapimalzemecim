import http from 'node:http';
import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
const root=path.resolve('dist');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.avif':'image/avif','.jpg':'image/jpeg','.png':'image/png','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8','.json':'application/json'};
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  let pathname=decodeURIComponent(url.pathname);
  if(pathname.endsWith('/'))pathname+='index.html';
  let target=path.resolve(root,'.'+pathname);
  if(!target.startsWith(root+path.sep)&&target!==root){res.writeHead(403);return res.end();}
  try{const info=await stat(target);if(info.isDirectory()){res.writeHead(301,{Location:url.pathname+'/'});return res.end();}}
  catch{res.writeHead(404,{'Content-Type':'text/html; charset=utf-8'});return res.end(await readFile(path.join(root,'404.html')));}
  const data=await readFile(target);
  res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':pathname.includes('/assets/')?'public,max-age=3600':'no-cache','X-Content-Type-Options':'nosniff'});res.end(data);
 }catch{res.writeHead(400);res.end('Bad request');}
});
server.listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173'));
