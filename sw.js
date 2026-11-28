/* Fearness — cache opcional dos recursos essenciais. Atualize a versão ao substituir mídias. */
'use strict';
const CACHE='fearness-essential-v6';
const MAX_AGE=12*60*60*1000;
const IMAGES=['poster-corpo-frente','poster-corpo-sobrecarga','poster-corpo-rupture','rosto-frente','rosto-sobrecarga','rosto-rupture','lado','costas','ciclo-fearness','olhos-normal','olhos-reserva','olhos-sobrecarga','mascara-normal','mascara-reserva','mascara-sobrecarga','selo','selo-removido','selo-rupture'];
const VIDEOS=['olhos-normal-sobrecarga','olhos-sobrecarga-normal','mascara-normal-sobrecarga','mascara-sobrecarga-normal','selo-direto-rupture','selo-direto-rupture-inverso','corpo-frente','corpo-sobrecarga','corpo-rupture','selo-sem-selo','selo-sem-selo-inverso','selo-rupture','selo-rupture-inverso',...['olhos','mascara'].flatMap(p=>['normal-reserva','reserva-sobrecarga','sobrecarga-reserva','reserva-normal'].map(s=>p+'-'+s))];
const urls=new Set([...IMAGES.flatMap(n=>['assets/img/'+n+'.webp','assets/img/'+n+'.webp?v=visual3',...(n==='selo'?['assets/img/selo.webp?v=seal4']:[])]),...VIDEOS.flatMap(n=>['assets/video/'+n+'.mp4?v=visual3','assets/video/'+n+'.mp4?v=fps2','assets/video/'+n+'.mp4?v=seek1','assets/video/'+n+'.mp4?v=seek2','assets/video/'+n+'.mp4?v=seek3','assets/video/'+n+'.mp4'])].map(p=>new URL(p,self.registration.scope).href));
self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting())});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{try{for(const key of await caches.keys())if(key.startsWith('fearness-essential-')&&key!==CACHE)await caches.delete(key)}finally{try{const cache=await caches.open(CACHE);for(const request of await cache.keys()){const u=new URL(request.url);if(/\/(olhos|mascara|selo)-.*\.mp4$/.test(u.pathname)&&u.searchParams.get('v')==='fps2')await cache.delete(request)}}catch(_){}await self.clients.claim()}})())});
function fresh(response){const date=Date.parse(response.headers.get('date')||'');return Number.isFinite(date)&&Date.now()-date<MAX_AGE}
async function cachedRange(response,range){
 const m=/^bytes=(\d*)-(\d*)$/i.exec(range.trim());if(!m||(!m[1]&&!m[2]))return null;
 const blob=await response.blob(),size=blob.size;
 let start=m[1]?Number(m[1]):Math.max(0,size-Number(m[2]));
 let end=m[1]&&m[2]?Math.min(size-1,Number(m[2])):size-1;
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=size||start>end)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+size,'Accept-Ranges':'bytes'}});
 const headers=new Headers(response.headers);headers.delete('Content-Encoding');headers.delete('Transfer-Encoding');headers.set('Content-Range',`bytes ${start}-${end}/${size}`);headers.set('Content-Length',String(end-start+1));headers.set('Accept-Ranges','bytes');
 return new Response(blob.slice(start,end+1,blob.type),{status:206,statusText:'Partial Content',headers});
}
async function serve(event){
 const req=event.request,range=req.headers.get('range'),key=req.url;
 let cache,cached;try{cache=await caches.open(CACHE);cached=await cache.match(key)}catch(_){}
 if(cached&&fresh(cached)){
  if(!range)return cached;
  try{const partial=await cachedRange(cached.clone(),range);if(partial)return partial}catch(_){}
 }
 try{
  // Pedidos parciais continuam nativos; nunca montar um vídeo inteiro só para responder a um Range.
  const result=await fetch(req);
  if(cache&&result.ok){
   if(result.status===200&&!result.headers.has('Content-Range')&&result.type!=='opaque'){
    const copy=result.clone();event.waitUntil(cache.put(key,copy).catch(()=>{}));
   }else if(cached&&!fresh(cached))event.waitUntil(cache.delete(key).catch(()=>{}));
  }
  return result;
 }catch(error){
  if(cached){if(!range)return cached;const partial=await cachedRange(cached,range);if(partial)return partial}
  throw error;
 }
}
self.addEventListener('fetch',event=>{if(event.request.method==='GET'&&urls.has(event.request.url))event.respondWith(serve(event))});
