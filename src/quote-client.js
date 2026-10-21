export function initQuote({config,track}){
 const $=s=>document.querySelector(s),form=$('#quote-form');if(!form)return;
 let quoteText='',requestId=crypto.randomUUID(),sending=false,payload=null;
 const button=form.querySelector('button[type="submit"]');button.disabled=false;
 const phone=form.elements.phone;
 const validatePhone=()=>{const value=phone.value.trim(),digits=value.replace(/\D/g,'');phone.setCustomValidity(value&&(!/^[+\d\s().-]+$/.test(value)||digits.length<10||digits.length>15)?'Telefon numaranızı 10–15 rakamla yazın. Boşluk ve + işareti kullanabilirsiniz.':'');};
 phone.addEventListener('input',validatePhone);
 const params=new URLSearchParams(location.search);
 for(const [param,field]of [['urun','product'],['miktar','quantity'],['birim','unit'],['kalinlik','thickness']])if(params.get(param))form.elements[field].value=params.get(param);
 const initialDetails=[];
 if(params.get('ebat'))initialDetails.push(`Levha ölçüsü: ${params.get('ebat').slice(0,100)} mm`);
 if(params.get('secenek'))initialDetails.push(`Ürün seçeneği: ${params.get('secenek').slice(0,150)}`);
 form.elements.details.value=initialDetails.join('\n');
 const invalidate=()=>{if(sending)return;requestId=crypto.randomUUID();payload=null;quoteText='';$('#quote-result').hidden=true;$('#quote-preview').textContent='';$('#quote-result-status').textContent='';$('#copy-quote').textContent='Özeti kopyalayın';$('#send-whatsapp')?.removeAttribute('href');$('#send-email')?.removeAttribute('href');button.textContent='Talebimi gönderin →';};
 form.addEventListener('input',invalidate);form.addEventListener('change',invalidate);
 function makeSummary(data){
  const product=form.elements.product.selectedOptions[0].textContent;
  return `YAPI MALZEMECİM — TEKLİF TALEBİ\n\nAd Soyad: ${data.name}\nFirma: ${data.company||'Belirtilmedi'}\nTelefon: ${data.phone}\nE-posta: ${data.email||'Belirtilmedi'}\n\nÜrün: ${product}\nÖlçü / Kalınlık / Kesit / Boy: ${data.thickness||'Birlikte netleştirilecek'}\nMiktar: ${data.quantity} ${data.unit}\nTeslimat şehri: ${data.city}\n\nProje detayları:\n${data.details||'Belirtilmedi'}\n\nBu dosya bir talep özetidir. Sipariş veya fiyat taahhüdü değildir.`;
 }
 function showSummary(message){
  $('#quote-preview').textContent=quoteText;$('#quote-result-status').textContent=message;$('#quote-result').hidden=false;
  if($('#send-whatsapp'))$('#send-whatsapp').href=`https://wa.me/${config.whatsapp.replace(/\D/g,'')}?text=${encodeURIComponent(quoteText)}`;
  if($('#send-email'))$('#send-email').href=`mailto:${config.email}?subject=${encodeURIComponent('Malzeme teklif talebi')}&body=${encodeURIComponent(quoteText)}`;
 }
 async function send(data){
  sending=true;const controls=[...form.elements].filter(el=>el instanceof HTMLInputElement||el instanceof HTMLSelectElement||el instanceof HTMLTextAreaElement);controls.forEach(el=>el.disabled=true);button.disabled=true;button.textContent='Talebiniz iletiliyor…';$('#quote-result').hidden=true;
  try{
   const tokenResponse=await fetch('/api/quote-token',{cache:'no-store',signal:AbortSignal.timeout(15000)});const session=await tokenResponse.json();if(!tokenResponse.ok||!session.token)throw new Error('Talep sistemi şu anda kullanılamıyor.');
   const response=await fetch('/api/quotes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,requestId,token:session.token}),signal:AbortSignal.timeout(20000)});
   const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.error||'Talebiniz iletilemedi.');
   quoteText=makeSummary(data)+`\n\nTalep numarası: ${result.reference}`;
   $('#quote-result h3').textContent='Talebiniz alındı.';
   showSummary(`${result.reference} numarasıyla talebiniz kaydedildi. Talep özetinizi indirebilir veya kopyalayabilirsiniz.`);
   button.textContent='Talep kaydedildi';
   track('quote_submitted',{product:data.product,unit:data.unit});
   payload=null;
  }catch(error){
   quoteText=makeSummary(data);$('#quote-result h3').textContent='Talep özeti hazır; gönderim tamamlanmadı.';
   const reason=error.name==='TimeoutError'?'Bağlantı zaman aşımına uğradı.':error.message;
   showSummary(`${reason} Özeti indirerek saklayabilirsiniz. Yeniden göndermek için aşağıdaki gönderim düğmesini kullanın.`);
   button.textContent='Gönderimi yeniden deneyin →';
  }finally{
   controls.forEach(el=>el.disabled=false);button.disabled=false;sending=false;
   $('#quote-result').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
  }
 }
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(sending)return;validatePhone();if(!form.reportValidity())return;
  if(button.textContent==='Talep kaydedildi'){showSummary($('#quote-result-status').textContent);return;}
  if(!payload){const fields=Object.fromEntries(new FormData(form));payload=Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,typeof v==='string'?v.trim():v]));payload.quantity=Number(payload.quantity);payload.consent=fields.consent==='on';payload.website=fields.website||'';quoteText=makeSummary(payload);track('quote_prepared',{product:payload.product,unit:payload.unit});}
  await send(payload);
 });
 $('#download-quote').addEventListener('click',()=>{if(!quoteText)return;const url=URL.createObjectURL(new Blob(['\ufeff'+quoteText],{type:'text/plain;charset=utf-8'})),anchor=document.createElement('a');anchor.href=url;anchor.download='yapi-malzemecim-teklif-talebi.txt';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 $('#copy-quote').addEventListener('click',async event=>{if(!quoteText)return;const control=event.currentTarget;try{await navigator.clipboard.writeText(quoteText);control.textContent='Özet kopyalandı';}catch{$('#quote-result-status').textContent='Otomatik kopyalama kullanılamıyor. Özet metnini seçerek kopyalayabilir veya dosyayı indirebilirsiniz.';}});
}
