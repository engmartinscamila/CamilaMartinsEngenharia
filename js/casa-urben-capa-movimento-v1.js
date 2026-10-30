/* Casa Urben — movimento de câmera baseado SOMENTE na foto 03 original.
   Usa vídeo HTML5 alimentado pelo Canvas para ter capa dinâmica e manter a mesma
   camada de mídia dos cartões Tiny House e Vitalle. */
(() => {
  'use strict';
  const card=document.querySelector('.featured-project-card[href*="casa-urban"]');
  if(!card||card.dataset.urbenLiveCover==='1')return;
  const photo=card.querySelector('img');
  if(!photo)return;
  card.dataset.urbenLiveCover='1';
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData=!!navigator.connection?.saveData;
  if(reduced||saveData||!window.IntersectionObserver)return;
  const canvas=document.createElement('canvas');
  canvas.width=740; canvas.height=780;
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx)return;
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  let video=null, initialized=false, active=false, raf=0, clock=0;
  function draw(now) {
    raf=0;
    if(!active||document.hidden||!initialized||!photo.naturalWidth)return;
    const sec=(now-clock)/1000;
    const cycle=(sec%20)/20;
    const ease=.5-.5*Math.cos(cycle*Math.PI*2);
    const sourceW=photo.naturalWidth,sourceH=photo.naturalHeight;
    const zoom=1.025+.024*(.5-.5*Math.cos(sec*Math.PI/9));
    const cropH=sourceH/zoom, cropW=cropH*canvas.width/canvas.height;
    const x=Math.max(0,sourceW-cropW)*ease;
    const y=(sourceH-cropH)*(.45+.08*Math.sin(sec*.22));
    ctx.drawImage(photo,x,y,cropW,cropH,0,0,canvas.width,canvas.height);
    raf=requestAnimationFrame(draw);
  }
  function start(){
    if(!active||document.hidden||!initialized)return;
    if(!raf){clock=performance.now();raf=requestAnimationFrame(draw);}
    if(video)video.play().catch(()=>{});
  }
  function stop(){
    if(raf)cancelAnimationFrame(raf);
    raf=0;
    if(video)video.pause();
  }
  function install(){
    if(initialized||!photo.complete||!photo.naturalWidth)return;
    initialized=true;
    try {
      if(typeof canvas.captureStream!=='function')throw Error('No captureStream');
      const stream=canvas.captureStream(24);
      video=document.createElement('video');
      video.className='featured-project-video urben-foto03-em-movimento';
      video.muted=true;video.autoplay=true;video.playsInline=true;video.loop=true;
      video.setAttribute('aria-hidden','true');
      video.setAttribute('disablepictureinpicture','');
      video.srcObject=stream;
      video.addEventListener('loadeddata',()=>card.classList.add('is-video-ready'),{once:true});
      card.insertBefore(video,card.querySelector('.featured-project-overlay'));
    }catch(e){
      canvas.className='featured-project-video urben-foto03-em-movimento';
      canvas.setAttribute('aria-hidden','true');
      card.insertBefore(canvas,card.querySelector('.featured-project-overlay'));
      card.classList.add('is-video-ready');
    }
    start();
  }
  if(photo.complete)install();else photo.addEventListener('load',install,{once:true});
  const io=new IntersectionObserver(entries=>{
    active=entries.some(e=>e.isIntersecting&&e.intersectionRatio>=.12);
    if(active){if(!initialized)install();start();}else stop();
  },{threshold:[0,.12,.4],rootMargin:'90px 0px'});
  io.observe(card);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else start();});
})();