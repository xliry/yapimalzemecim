import fs from 'node:fs/promises';
import path from 'node:path';
const input=path.resolve('generated/ssg');
const output=path.resolve('generated/public');
const pages={};
const project=path.resolve('.');
if(output!==path.join(project,'generated','public'))throw new Error('Unsafe public output path');
await fs.rm(output,{recursive:true,force:true});
await fs.mkdir(output,{recursive:true});
async function walk(dir,relative=''){
 for(const entry of await fs.readdir(dir,{withFileTypes:true})){
  const file=path.join(dir,entry.name),rel=path.join(relative,entry.name);
  if(entry.isDirectory()){await walk(file,rel);continue;}
  if(entry.name.endsWith('.html')){
   const route=rel==='index.html'?'/':'/'+rel.replaceAll('\\','/').replace(/index\.html$/,'');
   pages[route]=await fs.readFile(file,'utf8');
  }else{
   const target=path.join(output,rel);await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(file,target);
  }
 }
}
await walk(input);
await fs.writeFile('generated/pages.json',JSON.stringify(pages));
console.log(`Prepared ${Object.keys(pages).length} HTML responses and optimized public assets.`);
