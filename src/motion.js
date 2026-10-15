import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);
const $=(s,p=document)=>p.querySelector(s);
const $$=(s,p=document)=>[...p.querySelectorAll(s)];
// GSAP keeps the document readable before scripts load and respects reduced motion.
const mm=gsap.matchMedia();
mm.add('(prefers-reduced-motion: no-preference)',context=>{
 const cleanup=[];
 const hero=$('.hero');
 if(hero){
  if(performance.now()<1600)gsap.from('.hero h1>span',{y:27,duration:1.05,stagger:.11,ease:'power3.out',delay:.08});
  if(performance.now()<1600)gsap.from('.hero-eyebrow,.hero-copy>p,.hero-actions',{y:15,duration:.85,stagger:.12,ease:'power2.out'});
  gsap.to('.hero-photo',{yPercent:15,ease:'none',scrollTrigger:{trigger:hero,start:'top top',end:'bottom top',scrub:1}});
  gsap.to('.hero-aura',{x:130,y:100,duration:9,repeat:-1,yoyo:true,ease:'sine.inOut'});
 }
 $$('.section-heading,.process-grid,.calculator,.faq-layout>div:first-child').forEach(el=>gsap.from(el,{y:28,duration:.85,ease:'power3.out',scrollTrigger:{trigger:el,start:'top 91%',once:true}}));
 $$('.product-card').forEach((el,i)=>gsap.from(el,{y:30,duration:.75,delay:(i%4)*.06,ease:'power2.out',scrollTrigger:{trigger:el,start:'top 94%',once:true}}));
 if($('.lab-visual'))gsap.to('.lab-orbit',{rotation:35,ease:'none',scrollTrigger:{trigger:'.material-lab',start:'top bottom',end:'bottom top',scrub:1.3}});
 if(window.matchMedia('(pointer:fine)').matches){
  $$('.hero-actions .button,.round-link').forEach(button=>{
   const move=context.add(null,event=>{const r=button.getBoundingClientRect();gsap.to(button,{x:(event.clientX-r.left-r.width/2)*.09,y:(event.clientY-r.top-r.height/2)*.13,duration:.35,ease:'power2.out',overwrite:'auto'});});
   const leave=context.add(null,()=>gsap.to(button,{x:0,y:0,duration:.6,ease:'elastic.out(1,.4)',overwrite:'auto'}));
   button.addEventListener('mousemove',move);button.addEventListener('mouseleave',leave);
   cleanup.push(()=>{button.removeEventListener('mousemove',move);button.removeEventListener('mouseleave',leave);button.style.removeProperty('transform');});
  });
 }
 return ()=>cleanup.forEach(remove=>remove());
});
window.addEventListener('load',()=>ScrollTrigger.refresh());

window.addEventListener('ym:layout',()=>ScrollTrigger.refresh());
