import fs from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import sharp from 'sharp';
import config from '../site.config.mjs';
import { adminPage } from '../src/admin.mjs';
import {products,articles,generalFaq} from '../src/content.mjs';
import {layout,home,catalog,productPage,guideIndex,articlePage,about,quote,privacy,esc,arrow} from '../src/templates.mjs';
const dir='generated/ssg';
const buildPath=path.resolve(dir),projectPath=path.resolve('.');
if(!buildPath.startsWith(projectPath+path.sep)||buildPath!==path.join(projectPath,'generated','ssg'))throw new Error('Unsafe generated output path');
await fs.rm(buildPath,{recursive:true,force:true});
await fs.mkdir(path.join(dir,'assets'),{recursive:true});
await fs.cp('public',dir,{recursive:true});
const names=['hero','plywood-film','plywood-birch','osb','timber'];
await Promise.all(names.map(async name=>{
 const source=`public/assets/${name}.png`;
 await sharp(source).resize({width:name==='hero'?1920:900,withoutEnlargement:true}).webp({quality:name==='hero'?82:79,effort:5}).toFile(`${dir}/assets/${name}.webp`);
 // Source PNGs are retained in the repository; only optimized assets are shipped.
 await fs.unlink(`${dir}/assets/${name}.png`).catch(()=>{});
}));
await sharp('public/assets/hero.png').resize({width:960}).webp({quality:77,effort:5}).toFile(`${dir}/assets/hero-960.webp`);
await Promise.all([960,1536].map(width=>sharp('public/assets/hero.png').resize({width}).avif({quality:53,effort:5}).toFile(`${dir}/assets/hero${width===960?'-960':''}.avif`)));
await sharp('public/assets/hero.png').resize(1200,630,{fit:'cover',position:'centre'}).jpeg({quality:85}).toFile(`${dir}/assets/social.jpg`);
await build({entryPoints:{site:'src/client.js',admin:'src/admin-client.js'},bundle:true,minify:true,format:'esm',target:['es2020'],outdir:`${dir}/assets`,entryNames:'[name]',chunkNames:'chunks/[name]-[hash]',splitting:true,define:{'process.env.SITE_ORIGIN':JSON.stringify(config.origin)}});
await build({entryPoints:['src/style.css'],bundle:true,minify:true,outfile:`${dir}/assets/site.css`,external:['/assets/*']});
const faqSchema=items=>({'@context':'https://schema.org','@type':'FAQPage',mainEntity:items.map(f=>({'@type':'Question',name:f.q,acceptedAnswer:{'@type':'Answer',text:f.a}}))});
const crumbs=items=>({'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{title:'Ana sayfa',url:'/'},...items].map((x,i)=>({'@type':'ListItem',position:i+1,name:x.title,item:config.origin+x.url}))});
const pages=[
 {path:'/',title:'Yapı Malzemecim | Plywood, Kontrplak, OSB ve Kereste',description:'Plywood, kontrplak, OSB ve kereste ürünlerini tanıyın. Teknik rehberler, levha hesaplayıcısı ve projenize özel malzeme talebi hazırlama deneyimi.',body:home(),jsonld:[faqSchema(generalFaq)]},
 {path:'/urunler/',title:'Plywood, Kontrplak, OSB ve Kereste Ürünleri | Yapı Malzemecim',description:'Ahşap yapı malzemelerini kullanım alanı, yüzey ve teknik seçim bilgileriyle karşılaştırın. Filmli plywood, ham kontrplak, OSB ve kereste gruplarını inceleyin.',body:catalog(),type:'CollectionPage',jsonld:[crumbs([{title:'Ürünler',url:'/urunler/'}])]},
 {path:'/rehber/',title:'Plywood ve Ahşap Malzeme Rehberi | Yapı Malzemecim',description:'Plywood kalınlığı, OSB/3, levha metrajı, kontrplak bakımı ve kereste seçimi hakkında kaynaklı bilgilerle malzeme ihtiyacınızı doğru planlayın.',body:guideIndex(),type:'CollectionPage',jsonld:[crumbs([{title:'Malzeme rehberi',url:'/rehber/'}])]},
 {path:'/hakkimizda/',title:'Yaklaşımımız: Doğru Malzeme, Açık Bilgi | Yapı Malzemecim',description:'Yapı Malzemecim’in malzeme seçimi ve teklif hazırlığı yaklaşımını tanıyın. Ürün özellikleri, miktar ve teslimat koşullarını birlikte değerlendirin.',body:about(),type:'AboutPage'},
 {path:'/teklif/',title:'Plywood ve Yapı Malzemeleri Teklif Hazırlama | Yapı Malzemecim',description:'Ürün, ölçü, kalınlık, miktar ve teslimat şehrinizi belirterek yapı malzemeleri talep özetinizi hazırlayın. Talep dosyanızı indirin ve detayları netleştirin.',body:quote()},
 {path:'/iletisim/',title:'İletişim ve Malzeme Talebi | Yapı Malzemecim',description:'Plywood, kontrplak, OSB ve kereste ihtiyacınızı ürün ve teslimat detaylarıyla bir araya getirin. Projeniz için iletişim ve teklif hazırlığına başlayın.',body:quote(true),type:'ContactPage'},
 {path:'/gizlilik/',title:'Gizlilik, Çerezler ve Veri Kullanımı | Yapı Malzemecim',description:'Teklif hazırlama aracının, yerel depolamanın ve isteğe bağlı analiz araçlarının veri kullanımını inceleyin. Gizlilik ve çerez tercihlerinizi yönetin.',body:privacy()}
];
const productDescriptions={
 plywood:'Filmli plywood ve kalıp kontrplağını tanıyın. 18 ve 21 mm seçenekleri, levha ölçüleri, gövde yapısı ve proje bazlı teklif hazırlığı hakkında bilgi edinin.',
 kontrplak:'Ham kontrplak için ağaç türü, yüzey sınıfı, kalınlık ve kullanım alanını karşılaştırın. Mobilya, ambalaj ve üretim projeniz için talep hazırlayın.',
 osb:'OSB levha ve OSB/3 sınıfının kullanım alanlarını, neme dayanım sınırlarını ve ölçü seçeneklerini öğrenin. Projeniz için doğru teklif bilgilerini hazırlayın.',
 kereste:'İnşaatlık kereste için kesit, boy, ağaç türü ve miktar bilgilerini netleştirin. Kalıplık tahta, çıta ve moralye taleplerinizi ölçülü bir listeye dönüştürün.'
};
for(const p of products)pages.push({path:`/urunler/${p.slug}/`,title:`${p.title}: Özellikler ve Teklif Bilgileri | Yapı Malzemecim`,description:productDescriptions[p.slug],body:productPage(p),jsonld:[faqSchema(p.faq),crumbs([{title:'Ürünler',url:'/urunler/'},{title:p.title,url:`/urunler/${p.slug}/`}])]});
for(const a of articles)pages.push({path:`/rehber/${a.slug}/`,title:`${a.title} | Yapı Malzemecim`,description:a.excerpt,body:articlePage(a),type:'Article',jsonld:[crumbs([{title:'Malzeme rehberi',url:'/rehber/'},{title:a.title,url:`/rehber/${a.slug}/`}]),{'@context':'https://schema.org','@type':'Article',headline:a.title,description:a.excerpt,datePublished:'2026-10-15',dateModified:'2026-10-15',author:{'@type':'Organization',name:config.name,url:config.origin},publisher:{'@id':config.origin+'/#organization'},mainEntityOfPage:config.origin+`/rehber/${a.slug}/`,image:config.origin+'/assets/social.jpg'},faqSchema(a.faq)]});
const admin={path:'/yonetim/',title:'Talep Yönetimi | Yapı Malzemecim',description:'Yapı Malzemecim proje taleplerini yetkili erişimle inceleme ve görüşme durumu takip ekranı.',body:adminPage(),noindex:true};
for(const page of [...pages,admin]){const file=path.join(dir,page.path,'index.html');await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,layout(page));}
await fs.writeFile(`${dir}/404.html`,layout({path:'/404.html',title:'Sayfa bulunamadı | Yapı Malzemecim',description:'Aradığınız sayfa bulunamadı. Yapı Malzemecim ürünlerine ve malzeme rehberlerine ana sayfadan ulaşabilirsiniz.',body:`<section class="wrap empty-page"><span class="eyebrow">404 / SAYFA BULUNAMADI</span><h1>Bu sayfa yerinde yok.</h1><p>Ürünlere ve rehberlere ana sayfadan devam edebilirsiniz.</p><a class="button" href="/">Ana sayfaya dönün ${arrow}</a></section>`,noindex:true}));
await fs.writeFile(`${dir}/sitemap.xml`,`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.map(p=>`\n<url><loc>${config.origin+p.path}</loc><lastmod>2026-10-15</lastmod></url>`).join('')}\n</urlset>`);
await fs.writeFile(`${dir}/robots.txt`,`User-agent: *\nAllow: /\n\nSitemap: ${config.origin}/sitemap.xml\n`);
const llms=`# Yapı Malzemecim\n\n> Plywood, kontrplak, OSB ve kereste hakkında Türkçe ürün ve uygulama bilgileri; yaklaşık levha hesabı ve malzeme talebi hazırlama aracı.\n\n## Önemli bağlam\n\n- Ürün ölçüleri genel talep örnekleridir; güncel stok, fiyat, sertifika veya teslimat garantisi değildir. Kesin bilgi gerçek ürün föyü ve teklifle doğrulanır.\n- OSB/3 neme dayanıklı kullanım sınıfıdır, su geçirmez değildir. Yapısal malzeme seçimi proje hesabına bağlıdır.\n- Marka ve ürün görselleri yapay zekâ ile üretilmiş temsilî görsellerdir.\n- Teklif formu ziyaretçinin açık gönderimiyle bir talep kaydı oluşturur. İletişim bilgileri ve talep kayıtları herkese açık değildir; yönetim ekranı ek yetkilendirme gerektirir.\n\n## Ürünler\n${products.map(p=>`- [${p.title}](${config.origin}/urunler/${p.slug}/): ${p.short}`).join('\n')}\n\n## Malzeme rehberleri\n${articles.map(a=>`- [${a.title}](${config.origin}/rehber/${a.slug}/): ${a.excerpt}`).join('\n')}\n\n## Kurumsal ve iletişim\n- [Yaklaşımımız](${config.origin}/hakkimizda/)\n- [Teklif hazırlama](${config.origin}/teklif/)\n- [İletişim](${config.origin}/iletisim/)\n- [Gizlilik](${config.origin}/gizlilik/)\n\n## Optional\n- [Tam içerik](${config.origin}/llms-full.txt)\n- [Site haritası](${config.origin}/sitemap.xml)\n`;
await fs.writeFile(`${dir}/llms.txt`,llms);
await fs.writeFile(`${dir}/llms-full.txt`,llms+'\n\n'+products.map(p=>`# ${p.title}\n${p.description}\n${p.specs.map(s=>s.label+': '+s.value).join('\n')}\n${p.notes.join('\n\n')}`).join('\n\n')+'\n\n'+articles.map(a=>`# ${a.title}\n${a.excerpt}\n\n${a.sections.map(s=>`## ${s.title}\n${s.body}`).join('\n\n')}\n\nKaynaklar:\n${a.sources.map(s=>s.url).join('\n')}`).join('\n\n'));
await fs.writeFile(`${dir}/_headers`,'/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: SAMEORIGIN\n/assets/*\n  Cache-Control: public, max-age=86400\n');
await fs.writeFile(`${dir}/site-manifest.json`,JSON.stringify({name:config.name,lang:'tr-TR',pages:pages.map(({path,title,description})=>({path,title,description}))},null,2));
console.log(`Built ${pages.length} static pages. Optimized images, GSAP, sitemap, robots and LLM files ready.`);
