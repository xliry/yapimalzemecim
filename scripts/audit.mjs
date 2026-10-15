import lighthouse from 'lighthouse';
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const executablePath=process.env.CHROME_PATH || 'C:/Users/mdmel/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const browser=await chromium.launch({executablePath,headless:true,args:['--remote-debugging-port=9229']});
await fs.mkdir('output/lighthouse',{recursive:true});
const paths=process.argv.slice(2);
const targets=paths.length?paths:['/','/urunler/plywood/','/rehber/osb-3-nedir/','/teklif/'];
const scores=[];
const origin=process.env.AUDIT_ORIGIN||'http://127.0.0.1:4173';
try{
 for(const target of targets){
  const {lhr,report}=await lighthouse(origin+target,{port:9229,output:['json','html'],logLevel:'error',onlyCategories:['performance','accessibility','best-practices','seo'],formFactor:'mobile',screenEmulation:{mobile:true,width:390,height:844,deviceScaleFactor:1,disabled:false}},{extends:'lighthouse:default',settings:{throttlingMethod:'simulate',maxWaitForLoad:35000}});
  const name=target==='/'?'home':target.split('/').filter(Boolean).join('-');
  await fs.writeFile(`output/lighthouse/${name}.json`,report[0]);await fs.writeFile(`output/lighthouse/${name}.html`,report[1]);
  const result={path:target,scores:Object.fromEntries(Object.entries(lhr.categories).map(([k,v])=>[k,Math.round(v.score*100)])),metrics:Object.fromEntries(['largest-contentful-paint','cumulative-layout-shift','total-blocking-time'].map(k=>[k,lhr.audits[k]?.displayValue])),failures:Object.values(lhr.audits).filter(a=>a.score!==null&&a.score<1&&['binary','numeric'].includes(a.scoreDisplayMode)).map(a=>({id:a.id,title:a.title,score:a.score,details:a.details}))};
  scores.push(result);console.log(JSON.stringify({path:result.path,scores:result.scores,metrics:result.metrics,failed:result.failures.map(f=>f.id)}));
 }
}finally{await browser.close();}
await fs.writeFile('output/lighthouse/summary.json',JSON.stringify(scores,null,2));
