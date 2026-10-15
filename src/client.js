import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import config from '../site.config.mjs';
gsap.registerPlugin(ScrollTrigger);

const $ = (s, p=document) => p.querySelector(s);
const $$ = (s, p=document) => [...p.querySelectorAll(s)];
const fmt = n => new Intl.NumberFormat('tr-TR', {maximumFractionDigits:2, minimumFractionDigits:2}).format(n);
const track = (name, detail={}) => {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({event:name, ...detail});
  if (window.fbq && localStorage.getItem('ym-consent')==='granted') {
    const mapped={quote_prepared:'CustomizeProduct',contact_click:'Contact'};
    if(mapped[name]) window.fbq('track',mapped[name],detail);
  }
};

const menu = $('.menu-toggle');
function closeMenu(){menu?.setAttribute('aria-expanded','false');menu?.setAttribute('aria-label','Menüyü aç');$('.main-nav')?.classList.remove('open');document.body.classList.remove('menu-open');}
menu?.addEventListener('click',()=>{
  const open=menu.getAttribute('aria-expanded')!=='true';
  menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Menüyü kapat':'Menüyü aç');
  $('.main-nav').classList.toggle('open',open);document.body.classList.toggle('menu-open',open);
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenu();}});
$$('.main-nav a').forEach(a=>a.addEventListener('click',closeMenu));
window.matchMedia('(min-width:761px)').addEventListener('change',e=>{if(e.matches)closeMenu();});

$$('[data-filter]').forEach(button=>button.addEventListener('click',()=>{
 const filter=button.dataset.filter;
 $$('[data-filter]').forEach(b=>{const active=b===button;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
 $$('.product-card').forEach(card=>card.hidden=filter!=='all' && card.dataset.group!==filter);
 ScrollTrigger.refresh();
}));

$$('[data-thickness]').forEach(button=>button.addEventListener('click',()=>{
 $$('[data-thickness]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});
 $('#thickness-copy').textContent=`${button.dataset.thickness} mm — Proje hesabına göre seçim`;
 const image=$('.lab-visual>img');
 if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)gsap.fromTo(image,{scale:button.dataset.thickness==='21'?1:1.025},{scale:button.dataset.thickness==='21'?1.025:1,duration:.6,ease:'power2.out'});
 track('material_explore',{thickness:button.dataset.thickness});
}));

const calc=$('#calculator');
if(calc){
 const update=()=>{
  const data=new FormData(calc), area=Number(data.get('area')), size=Number(data.get('size')), waste=Number(data.get('waste'));
  if(!Number.isFinite(area)||area<=0||area>1000000){$('#calc-output').textContent='Geçerli bir alan girin';$('#calc-area').textContent='0,01 – 1.000.000 m² arasında';$('#calc-quote').setAttribute('aria-disabled','true');$('#calc-quote').removeAttribute('href');return;}
  const count=Math.ceil(area*(1+waste/100)/size);
  $('#calc-output').innerHTML=`<strong>${count.toLocaleString('tr-TR')}</strong> levha`;
  $('#calc-area').textContent=`${fmt(count*size)} m² toplam levha alanı`;
  $('#calc-quote').removeAttribute('aria-disabled');
  $('#calc-quote').href=`/teklif/?miktar=${count}&birim=adet&ebat=${size===3.125?'1250x2500':'1220x2440'}`;
 };
 calc.addEventListener('input',update);calc.addEventListener('change',update);calc.addEventListener('submit',e=>e.preventDefault());update();
}

const quote=$('#quote-form');
let quoteText='';
if(quote){
 const phoneInput=quote.elements.phone;
 const validatePhone=()=>{
  const phone=phoneInput.value.trim(),digits=phone.replace(/\D/g,'');
  phoneInput.setCustomValidity(phone && (!/^[+\d\s().-]+$/.test(phone)||digits.length<10||digits.length>15)?'Telefon numaranızı 10–15 rakamla yazın. Boşluk ve + işareti kullanabilirsiniz.':'');
 };
 phoneInput.addEventListener('input',validatePhone);
 const params=new URLSearchParams(location.search);
 if(params.has('urun'))quote.elements.product.value=params.get('urun');
 if(params.has('miktar'))quote.elements.quantity.value=params.get('miktar');
 if(params.has('birim'))quote.elements.unit.value=params.get('birim');
 if(params.has('ebat'))quote.elements.details.value=`Levha ölçüsü: ${params.get('ebat')} mm`;
 quote.addEventListener('submit',e=>{
  e.preventDefault();validatePhone();if(!quote.reportValidity())return;
  const data=Object.fromEntries(new FormData(quote));
  const product=quote.elements.product.selectedOptions[0].textContent;
  quoteText=`YAPI MALZEMECİM — TEKLİF TALEBİ\n\nAd Soyad: ${data.name.trim()}\nFirma: ${data.company.trim()||'Belirtilmedi'}\nTelefon: ${data.phone.trim()}\nE-posta: ${data.email.trim()||'Belirtilmedi'}\n\nÜrün: ${product}\nKalınlık / Kesit: ${data.thickness.trim()||'Birlikte netleştirilecek'}\nMiktar: ${data.quantity} ${data.unit}\nTeslimat şehri: ${data.city.trim()}\n\nProje detayları:\n${data.details.trim()||'Belirtilmedi'}\n\nBu dosya bir talep özetidir. Sipariş veya fiyat taahhüdü değildir.`;
  $('#quote-preview').textContent=quoteText;
  $('#quote-result-status').textContent=config.whatsapp||config.email?'Özeti indirin veya iletişim uygulamasında açın. Mesajı ilgili uygulamada siz gönderirsiniz.':'Bilgileriniz cihazınızda işlendi. Henüz bir satış kanalına gönderim yapılmadı. Dosyayı indirin veya metni kopyalayın.';
  $('#quote-result').hidden=false;
  if($('#send-whatsapp'))$('#send-whatsapp').href=`https://wa.me/${config.whatsapp.replace(/\D/g,'')}?text=${encodeURIComponent(quoteText)}`;
  if($('#send-email'))$('#send-email').href=`mailto:${config.email}?subject=${encodeURIComponent('Malzeme teklif talebi — '+product)}&body=${encodeURIComponent(quoteText)}`;
  $('#quote-result').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
  track('quote_prepared',{product:data.product,unit:data.unit});
 });
 $('#download-quote').addEventListener('click',()=>{
  const blob=new Blob(['\ufeff'+quoteText],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='yapi-malzemecim-teklif-talebi.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 $('#copy-quote').addEventListener('click',async e=>{
  const button=e.currentTarget;
  try{await navigator.clipboard.writeText(quoteText);button.textContent='Özet kopyalandı';}
  catch{$('#quote-result-status').textContent='Otomatik kopyalama kullanılamıyor. Özet metnini seçerek kopyalayabilir veya dosyayı indirebilirsiniz.';}
 });
}
$$('a[href^="tel:"],a[href^="https://wa.me/"]').forEach(a=>a.addEventListener('click',()=>track('contact_click',{channel:a.href.startsWith('tel:')?'phone':'whatsapp'})));

function loadTracking(){
 if(config.googleTagId && !$('#ym-google-tag')){
  const script=document.createElement('script');script.id='ym-google-tag';script.async=true;script.src=`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(config.googleTagId)}`;document.head.append(script);
  window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments);};
  window.gtag('consent','default',{ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted',analytics_storage:'granted'});
  window.gtag('js',new Date());window.gtag('config',config.googleTagId);
 }
 if(config.metaPixelId && !window.fbq){
  const fbq=function(){fbq.callMethod?fbq.callMethod.apply(fbq,arguments):fbq.queue.push(arguments);};fbq.queue=[];fbq.loaded=true;fbq.version='2.0';window.fbq=fbq;
  const script=document.createElement('script');script.async=true;script.src='https://connect.facebook.net/en_US/fbevents.js';document.head.append(script);fbq('init',config.metaPixelId);fbq('track','PageView');
 }
}
const consent=$('#consent');
let consentValue;try{consentValue=localStorage.getItem('ym-consent');}catch{}
if(consentValue==='granted')loadTracking();
if(!consentValue&&(config.googleTagId||config.metaPixelId))consent.hidden=false;
$$('[data-consent-settings]').forEach(button=>button.addEventListener('click',()=>{consent.hidden=false;consent.querySelector('button')?.focus();}));
$$('[data-consent]').forEach(button=>button.addEventListener('click',()=>{
 const choice=button.dataset.consent;
 try{localStorage.setItem('ym-consent',choice);}catch{}
 consent.hidden=true;
 if(choice==='granted')loadTracking();
 else{
  window.gtag?.('consent','update',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'});
  if(consentValue==='granted')location.reload();
 }
 consentValue=choice;
}));

// GSAP keeps the document readable before scripts load and respects reduced motion.
const mm=gsap.matchMedia();
mm.add('(prefers-reduced-motion: no-preference)',()=>{
 const hero=$('.hero');
 if(hero){
  gsap.from('.hero h1>span',{y:27,duration:1.05,stagger:.11,ease:'power3.out',delay:.08});
  gsap.from('.hero-eyebrow,.hero-copy>p,.hero-actions',{y:15,duration:.85,stagger:.12,ease:'power2.out'});
  gsap.to('.hero-photo',{yPercent:15,ease:'none',scrollTrigger:{trigger:hero,start:'top top',end:'bottom top',scrub:1}});
  gsap.to('.hero-aura',{x:130,y:100,duration:9,repeat:-1,yoyo:true,ease:'sine.inOut'});
 }
 $$('.section-heading,.process-grid,.calculator,.faq-layout>div:first-child').forEach(el=>gsap.from(el,{y:28,duration:.85,ease:'power3.out',scrollTrigger:{trigger:el,start:'top 91%',once:true}}));
 $$('.product-card').forEach((el,i)=>gsap.from(el,{y:30,duration:.75,delay:(i%4)*.06,ease:'power2.out',scrollTrigger:{trigger:el,start:'top 94%',once:true}}));
 if($('.lab-visual'))gsap.to('.lab-orbit',{rotation:35,ease:'none',scrollTrigger:{trigger:'.material-lab',start:'top bottom',end:'bottom top',scrub:1.3}});
 if(window.matchMedia('(pointer:fine)').matches){
  $$('.hero-actions .button,.round-link').forEach(button=>{
   button.addEventListener('mousemove',event=>{const r=button.getBoundingClientRect();gsap.to(button,{x:(event.clientX-r.left-r.width/2)*.09,y:(event.clientY-r.top-r.height/2)*.13,duration:.35,ease:'power2.out'});});
   button.addEventListener('mouseleave',()=>gsap.to(button,{x:0,y:0,duration:.6,ease:'elastic.out(1,.4)'}));
  });
 }
});
window.addEventListener('load',()=>ScrollTrigger.refresh());
