import { initQuote } from './quote-client.js';
import { initHeroGallery } from './hero-gallery.js';
import { initCatalog } from './catalog-client.js';
import config from '../site.config.mjs';

initHeroGallery();

const $ = (s, p=document) => p.querySelector(s);
const $$ = (s, p=document) => [...p.querySelectorAll(s)];
const fmt = n => new Intl.NumberFormat('tr-TR', {maximumFractionDigits:2, minimumFractionDigits:2}).format(n);
const track = (name, detail={}) => {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({event:name, ...detail});
  let trackingAllowed=false;try{trackingAllowed=localStorage.getItem('ym-consent')==='granted';}catch{}
  if (window.fbq && trackingAllowed) {
    const mapped={quote_prepared:'CustomizeProduct',quote_submitted:'Lead',contact_click:'Contact'};
    if(mapped[name]) window.fbq('track',mapped[name],detail);
  }
};

const menu = $('.menu-toggle');
const navigation = $('.main-nav');
function closeMenu({restoreFocus=false}={}){
 const wasOpen=menu?.getAttribute('aria-expanded')==='true';
 menu?.setAttribute('aria-expanded','false');menu?.setAttribute('aria-label','Menüyü aç');navigation?.classList.remove('open');document.body.classList.remove('menu-open');
 if(wasOpen&&restoreFocus)menu.focus();
}
menu?.addEventListener('click',()=>{
  const open=menu.getAttribute('aria-expanded')!=='true';
  if(!open){closeMenu({restoreFocus:true});return;}
  menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Menüyü kapat':'Menüyü aç');
  navigation.classList.add('open');document.body.classList.add('menu-open');
  navigation.querySelector('a[href]')?.focus();
});
document.addEventListener('keydown',e=>{
 if(menu?.getAttribute('aria-expanded')!=='true')return;
 if(e.key==='Escape'){e.preventDefault();closeMenu({restoreFocus:true});return;}
 if(e.key==='Tab'){
  const controls=[menu,...$$('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])',navigation)].filter(control=>control.getClientRects().length);
  const current=controls.indexOf(document.activeElement);
  const next=current<0?1:(current+(e.shiftKey?-1:1)+controls.length)%controls.length;
  e.preventDefault();controls[next]?.focus();
 }
});
$$('.main-nav a').forEach(a=>a.addEventListener('click',()=>closeMenu()));
window.matchMedia('(min-width:761px)').addEventListener('change',e=>{if(e.matches)closeMenu();});

$$('[data-filter]').forEach(button=>button.addEventListener('click',()=>{
 const filter=button.dataset.filter;
 $$('[data-filter]').forEach(b=>{const active=b===button;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
 $$('.product-card').forEach(card=>card.hidden=filter!=='all' && card.dataset.group!==filter);
 window.dispatchEvent(new Event('ym:layout'));
}));

initCatalog({track});

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

initQuote({config,track});
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


const loadMotion=()=>{if(!$('.hero,.lab-visual,.section-heading,.product-card,.calculator,.faq-layout'))return;if('requestIdleCallback' in window)requestIdleCallback(()=>import('./motion.js'),{timeout:1800});else setTimeout(()=>import('./motion.js'),500);};
if(document.readyState==='complete')loadMotion();else window.addEventListener('load',loadMotion,{once:true});
