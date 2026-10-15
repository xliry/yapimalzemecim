import pages from '../../generated/pages.json';
export const dynamic = 'force-dynamic';
const content = pages as Record<string, string>;
function respond(request:Request, head=false){
 const pathname=new URL(request.url).pathname;
 if(pathname==='/index.html')return Response.redirect(new URL('/',request.url),301);
 const normalized=pathname==='/'?'/':pathname.endsWith('/')?pathname:pathname+'/';
 const html=content[normalized];
 if(html && pathname!==normalized){const destination=new URL(request.url);destination.pathname=normalized;return Response.redirect(destination,301);}
 return new Response(head?null:(html||content['/404.html']),{
  status:html?200:404,
  headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, max-age=0, must-revalidate','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'SAMEORIGIN'}
 });
}
export function GET(request:Request){return respond(request);}
export function HEAD(request:Request){return respond(request,true);}
