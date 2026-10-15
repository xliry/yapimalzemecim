const $=s=>document.querySelector(s);
const labels={new:'Yeni',contacted:'Görüşüldü',quoted:'Teklif verildi',closed:'Tamamlandı'};
const products={plywood:'Filmli Plywood',kontrplak:'Ham Kontrplak',osb:'OSB Levha',kereste:'İnşaatlık Kereste',diger:'Diğer / Kararlaştırılacak'};
let key='',quotes=[],cursor=null,busy=false;
let authMode='key';
fetch('/api/runtime',{cache:'no-store'}).then(r=>r.json()).then(runtime=>{authMode=runtime.adminAuth;if(authMode==='chatgpt-and-key'){$('#admin-chatgpt-login').hidden=false;$('#admin-auth-description').textContent='Bu ekran için ChatGPT oturumu ve yönetim anahtarı gerekir. Anahtar yalnızca bu sekmenin belleğinde tutulur.';}}).catch(()=>{});
const status=message=>{$('#admin-status').textContent=message;};
async function request(url,options={}){
 const response=await fetch(url,{...options,headers:{Authorization:`Bearer ${key}`,...options.headers},cache:'no-store',credentials:'same-origin'});
 const data=await response.json().catch(()=>({error:'Sunucu yanıtı okunamadı.'}));
 if(!response.ok)throw new Error(response.status===401?(authMode==='chatgpt-and-key'?'Önce ChatGPT hesabınızla giriş yapın.':'Yönetim anahtarınızı kontrol edin.'):response.status===403?'Yönetim anahtarı doğrulanamadı.':data.error||'İşlem tamamlanamadı.');
 return data;
}
function text(tag,value,cls=''){const element=document.createElement(tag);element.textContent=String(value??'');if(cls)element.className=cls;return element;}
function render(){
 const list=$('#admin-list');list.replaceChildren();
 const filter=$('#admin-filter').value,visible=quotes.filter(q=>filter==='all'||q.status===filter);
 if(!visible.length){list.append(text('p',quotes.length?'Bu durumda bir talep bulunmuyor.':'Henüz bir talep bulunmuyor. Yeni talepler burada görünecek.','admin-empty'));return;}
 for(const quote of visible){
  const article=text('article','','admin-lead'),head=text('div','','admin-lead-head'),body=text('div','','admin-lead-body');
  const info=text('div');info.append(text('span',quote.reference,'eyebrow'),text('h2',quote.name));
  const time=text('time',new Intl.DateTimeFormat('tr-TR',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Istanbul'}).format(new Date(quote.createdAt)));time.dateTime=new Date(quote.createdAt).toISOString();info.append(time);
  const label=text('label','Görüşme durumu'),select=document.createElement('select');select.setAttribute('aria-label',quote.reference+' görüşme durumu');
  for(const [value,title]of Object.entries(labels)){const option=text('option',title);option.value=value;select.append(option);}select.value=quote.status;label.append(select);head.append(info,label);
  const facts=text('dl');
  for(const [title,value]of [['Ürün',products[quote.product]||quote.product],['Miktar',`${quote.quantity} ${quote.unit}`],['Kalınlık / Kesit',quote.thickness||'Belirtilmedi'],['Teslimat',quote.city],['Firma',quote.company||'Belirtilmedi']]){const row=text('div');row.append(text('dt',title),text('dd',value));facts.append(row);}
  const contact=text('div','','admin-contact');const phone=text('a',quote.phone);phone.href='tel:'+quote.phone.replace(/[^+\d]/g,'');contact.append(phone);
  if(quote.email){const email=text('a',quote.email);email.href='mailto:'+encodeURIComponent(quote.email);contact.append(email);}
  const details=text('p',quote.details||'Ek proje detayı belirtilmedi.','admin-details');body.append(facts,contact,details);article.append(head,body);list.append(article);
  select.addEventListener('change',async()=>{const previous=quote.status;select.disabled=true;try{await request(`/api/admin/quotes/${quote.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:select.value})});quote.status=select.value;status(quote.reference+' durumu güncellendi.');render();}catch(error){select.value=previous;status(error.message);}finally{select.disabled=false;}});
 }
}
async function load(more=false){
 if(busy)return;busy=true;status('Talepler yükleniyor…');
 try{const result=await request('/api/admin/quotes?limit=25'+(more&&cursor?'&before='+encodeURIComponent(cursor):''));quotes=more?[...quotes,...result.quotes]:result.quotes;cursor=result.nextCursor||null;$('#admin-access').hidden=true;$('#admin-workspace').hidden=false;$('#admin-more').hidden=!cursor;render();status(`${quotes.length} talep gösteriliyor.`);}
 catch(error){status(error.message);if(!quotes.length){key='';$('#admin-key').value='';}}
 finally{busy=false;}
}
$('#admin-login').addEventListener('submit',e=>{e.preventDefault();key=$('#admin-key').value.trim();$('#admin-key').value='';load();});
$('#admin-refresh').addEventListener('click',()=>load());
$('#admin-more').addEventListener('click',()=>load(true));
$('#admin-filter').addEventListener('change',render);
$('#admin-lock').addEventListener('click',()=>{key='';quotes=[];cursor=null;$('#admin-list').replaceChildren();$('#admin-workspace').hidden=true;$('#admin-access').hidden=false;status('Yönetim erişimi bu sekmede kapatıldı.');$('#admin-key').focus();});
$('#admin-export').addEventListener('click',async e=>{
 const button=e.currentTarget;button.disabled=true;
 try{const response=await fetch('/api/admin/export',{headers:{Authorization:`Bearer ${key}`},cache:'no-store',credentials:'same-origin'});if(!response.ok)throw new Error('Dosya indirilemedi. Yönetim erişimini kontrol edin.');const blob=await response.blob(),url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download='yapi-malzemecim-talepler.csv';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Talep listesi indirildi.');}
 catch(error){status(error.message);}finally{button.disabled=false;}
});
window.addEventListener('pagehide',()=>{key='';quotes=[];$('#admin-key').value='';$('#admin-list').replaceChildren();$('#admin-workspace').hidden=true;$('#admin-access').hidden=false;});
