import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=process.env.QA_ORIGIN||'http://127.0.0.1:4173';
const executablePath=process.env.CHROME_PATH||process.env.QA_CHROME||'C:/Users/mdmel/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const quoteFixture={ok:true,reference:'YM-TEST2345',id:'42f62ee6-c81e-43d8-b43e-9a1385c52b5d'};
const tests=[];
const browser=await chromium.launch({executablePath,headless:true});

async function stubQuoteApi(context){
 const submissions=[];
 await context.route('**/api/quote-token',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({token:'qa-ui-token'})}));
 await context.route('**/api/quotes',route=>{
  submissions.push(route.request().postDataJSON());
  return route.fulfill({status:201,contentType:'application/json',body:JSON.stringify(quoteFixture)});
 });
 return {submissions};
}

async function scenario(name,options,action){
 const context=await browser.newContext(options);
 const started=Date.now();
 try{
  const quoteApi=await stubQuoteApi(context);
  await action(context,quoteApi);
  tests.push({name,status:'passed',durationMs:Date.now()-started});
 }catch(error){
  tests.push({name,status:'failed',durationMs:Date.now()-started,error:error.stack||error.message});
 }finally{await context.close();}
}

try{
 await scenario('quote-summary-invalidated-after-edit',{viewport:{width:390,height:844},reducedMotion:'reduce',acceptDownloads:true},async(context,quoteApi)=>{
  const page=await context.newPage();
  await page.goto(`${base}/teklif/?urun=plywood&miktar=36&birim=adet`,{waitUntil:'networkidle'});
  for(const [name,value] of Object.entries({name:'Regresyon Testi',phone:'05550000000',city:'İstanbul'}))await page.locator(`#quote-form [name="${name}"]`).fill(value);
  await page.locator('#quote-form [name="consent"]').check();
  await page.locator('#quote-form button[type="submit"]').click();
  await page.locator('#quote-result').waitFor({state:'visible'});
  assert.equal(await page.locator('#quote-result h3').textContent(),'Talebiniz alındı.');
  assert.match(await page.locator('#quote-preview').textContent(),/Talep numarası: YM-TEST2345/);
  assert.match(await page.locator('#quote-preview').textContent(),/Miktar: 36 adet/);
  assert.equal(quoteApi.submissions.length,1);
  assert.equal(quoteApi.submissions[0].quantity,36);
  assert.equal(quoteApi.submissions[0].token,'qa-ui-token');

  await page.locator('#quote-form [name="quantity"]').fill('72');
  assert.equal(await page.locator('#quote-result').isVisible(),false,'Düzenleme eski özeti gizlemeli');
  assert.equal(await page.locator('#quote-preview').textContent(),'','Eski özet metni temizlenmeli');
  for(const selector of ['#send-whatsapp','#send-email']){
   const link=page.locator(selector);
   if(await link.count())assert.equal(await link.getAttribute('href'),null,'Eski gönderim bağlantısı temizlenmeli');
  }
  let unexpectedDownloads=0;
  const countDownload=()=>{unexpectedDownloads++;};
  page.on('download',countDownload);
  await page.locator('#download-quote').evaluate(button=>button.click());
  await page.waitForTimeout(150);
  page.off('download',countDownload);
  assert.equal(unexpectedDownloads,0,'Geçersizleşmiş özet programatik tıklamayla da indirilememeli');

  await page.locator('#quote-form button[type="submit"]').click();
  await page.locator('#quote-result').waitFor({state:'visible'});
  assert.equal(await page.locator('#quote-result h3').textContent(),'Talebiniz alındı.');
  assert.match(await page.locator('#quote-preview').textContent(),/Miktar: 72 adet/);
  assert.equal(quoteApi.submissions.length,2);
  assert.equal(quoteApi.submissions[1].quantity,72,'Düzenlenen miktar yeni API isteğine aktarılmalı');
  assert.notEqual(quoteApi.submissions[0].requestId,quoteApi.submissions[1].requestId,'Düzenlenen talebin yeni istek kimliği olmalı');
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#download-quote').click()]);
  assert.match(await fs.readFile(await download.path(),'utf8'),/Miktar: 72 adet/,'Yenilenen dosya güncel miktarı içermeli');
  await page.locator('#quote-form [name="product"]').selectOption('osb');
  assert.equal(await page.locator('#quote-result').isVisible(),false,'Select change olayı da özeti geçersizleştirmeli');
 });

 await scenario('mobile-menu-focus-order-and-escape',{viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'},async context=>{
  const page=await context.newPage();
  await page.goto(base,{waitUntil:'networkidle'});
  const menu=page.locator('.menu-toggle');
  const first=page.locator('.main-nav a').first();
  const last=page.locator('.main-nav a').last();
  const focused=locator=>locator.evaluate(element=>element===document.activeElement);
  await menu.click();
  assert.equal(await focused(first),true,'Menü açılınca ilk bağlantı odaklanmalı');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await focused(menu),true,'İlk bağlantıdan Shift+Tab kapatma düğmesine gitmeli');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await focused(last),true,'Kapatma düğmesinden Shift+Tab son bağlantıya dönmeli');
  await page.keyboard.press('Tab');
  assert.equal(await focused(menu),true,'Son bağlantıdan Tab kapatma düğmesine dönmeli');
  await page.keyboard.press('Tab');
  assert.equal(await focused(first),true,'Kapatma düğmesinden Tab ilk bağlantıya gitmeli');
  await page.keyboard.press('Escape');
  assert.equal(await menu.getAttribute('aria-expanded'),'false');
  assert.equal(await page.locator('.main-nav').isVisible(),false);
  assert.equal(await focused(menu),true,'Escape odağı menü düğmesine döndürmeli');
  assert.equal(await page.locator('body').evaluate(element=>element.classList.contains('menu-open')),false);
 });

 await scenario('magnetic-controls-respect-live-motion-preference',{viewport:{width:1440,height:1000},reducedMotion:'no-preference'},async context=>{
  // Count actual registered handlers without depending on GSAP internals or a test-only app export.
  await context.addInitScript(()=>{
   const listeners=new WeakMap();
   const add=EventTarget.prototype.addEventListener;
   const remove=EventTarget.prototype.removeEventListener;
   EventTarget.prototype.addEventListener=function(type,listener,options){
    if(type==='mousemove'||type==='mouseleave'){
     let types=listeners.get(this);if(!types){types=new Map();listeners.set(this,types);}
     let handlers=types.get(type);if(!handlers){handlers=new Set();types.set(type,handlers);}
     handlers.add(listener);
    }
    return add.call(this,type,listener,options);
   };
   EventTarget.prototype.removeEventListener=function(type,listener,options){
    listeners.get(this)?.get(type)?.delete(listener);
    return remove.call(this,type,listener,options);
   };
   window.magneticHandlerCounts=()=>{
    const button=document.querySelector('.hero-actions .button');
    const types=listeners.get(button);
    return {move:types?.get('mousemove')?.size||0,leave:types?.get('mouseleave')?.size||0};
   };
  });
  const page=await context.newPage();
  await page.goto(base,{waitUntil:'networkidle'});
  assert.equal(await page.evaluate(()=>matchMedia('(pointer:fine)').matches),true,'Bu senaryo fare işaretçili masaüstü görünümü gerektirir');
  const button=page.locator('.hero-actions .button');
  const expectHandlers=async expected=>{
   // Motion arrives through an idle-time dynamic import, which may run after networkidle.
   await page.waitForFunction(count=>{const actual=window.magneticHandlerCounts();return actual.move===count&&actual.leave===count;},expected,{timeout:12000,polling:50});
  };
  const move=()=>button.evaluate(element=>{
   const rect=element.getBoundingClientRect();
   element.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientX:rect.right-4,clientY:rect.bottom-4}));
  });
  await expectHandlers(1);
  await move();
  await page.waitForTimeout(80);
  assert.notEqual(await button.evaluate(element=>element.style.transform),'','Hareket açıkken manyetik etki çalışmalı');
  for(let cycle=0;cycle<2;cycle++){
   await page.emulateMedia({reducedMotion:'reduce'});
   await expectHandlers(0);
   await move();
   await page.waitForTimeout(120);
   assert.equal(await button.evaluate(element=>element.style.transform),'','Azaltılmış harekette eski veya yeni transform kalmamalı');
   await page.emulateMedia({reducedMotion:'no-preference'});
   await expectHandlers(1);
   await move();
   await page.waitForTimeout(50);
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  await expectHandlers(0);
  assert.equal(await button.evaluate(element=>element.style.transform),'');
 });
}finally{await browser.close();}

const report={origin:base,generatedAt:new Date().toISOString(),scope:'UI regresyonları; teklif token/gönderim API yanıtları stub edilir. Gerçek API/storage scripts/test-api.mjs kapsamındadır.',passed:tests.filter(test=>test.status==='passed').length,failed:tests.filter(test=>test.status==='failed').length,tests};
await fs.mkdir(path.join(root,'output'),{recursive:true});
await fs.writeFile(path.join(root,'output','regression-tests.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(report.failed)process.exitCode=1;
