/*
CAMILA MARTINS ENGENHARIA
Migração segura da galeria atual para Cloudflare R2.
Não apaga a origem. Só publica o manifesto ao final.
*/
(function(){
"use strict";

const API="https://cme-public-media.eng-martins-camila.workers.dev";
const MANIFEST="assets/projetos/galeria.json?v=20260828-2";
const LIMIT=95*1024*1024;
const WATERMARK="Camila Martins Engenharia";

let btn,status;

document.addEventListener("DOMContentLoaded",init,{once:true});

async function init(){
  btn=document.getElementById("portfolioMigrateR2");
  status=document.getElementById("portfolioR2Status");
  if(!btn||!status)return;
  btn.disabled=true;
  btn.addEventListener("click",migrate);
  setStatus("Verificando conexão com o Cloudflare R2...");
  try{
    const r=await fetch(API+"/health",{cache:"no-store"});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||!d.ok||d.storage!=="cloudflare-r2")throw new Error();
    btn.disabled=false;
    setStatus("R2 conectado. Migração disponível.","sucesso");
  }catch{
    setStatus("R2 ainda não está conectado. Configure o Worker antes de migrar.","aviso");
  }
}

async function migrate(){
  if(!confirm("Migrar a galeria pública atual para o Cloudflare R2?\n\nNada será apagado da origem. O manifesto R2 só será publicado depois que todos os uploads terminarem."))return;
  btn.disabled=true;
  try{
    const token=await tokenAdmin();
    const srcManifest=await loadManifest();
    const next=structuredClone(srcManifest);
    const tasks=makeTasks(next);
    if(!tasks.length)throw new Error("Nenhuma mídia encontrada para migrar.");

    for(let i=0;i<tasks.length;i++){
      const t=tasks[i];
      setStatus("Migrando "+(i+1)+" de "+tasks.length+": "+t.name);
      const raw=await fetchBlob(t.src);
      if(raw.size>LIMIT)throw new Error(t.name+" excede 95 MB.");
      const blob=t.watermark?await addWatermark(raw,t.name):raw;
      const result=await upload(token,t.key,blob,blob.type||mime(t.name));
      t.apply(result);
    }

    setStatus("Arquivos enviados. Publicando manifesto...");
    await putManifest(token,next);

    const check=await fetch(API+"/api/manifest?v="+Date.now(),{cache:"no-store"});
    const checked=await check.json().catch(()=>({}));
    if(!check.ok||!Array.isArray(checked.projetos))throw new Error("Não foi possível confirmar o manifesto no R2.");

    setStatus("Migração concluída: "+tasks.length+" arquivo(s) copiados. A origem permanece intacta.","sucesso");
    alert("Migração para o R2 concluída com sucesso.\n\nOs arquivos antigos continuam intactos.");
  }catch(e){
    console.error(e);
    setStatus("Migração interrompida: "+(e.message||"erro desconhecido"),"erro");
    alert("A migração foi interrompida.\n\n"+(e.message||""));
  }finally{
    btn.disabled=false;
  }
}

function makeTasks(manifest){
  const out=[];
  for(const p of manifest.projetos||[]){
    const slug=p.slug||"projeto";
    for(const img of p.imagens||[]){
      if(!img.src)continue;
      const name=fileName(img.src)||"imagem.webp";
      out.push({
        name,
        src:img.src,
        key:"portfolio/"+slug+"/imagem/"+safeName(name),
        watermark:true,
        apply(r){
          img.src=r.url;
          img.storagePath=r.key;
          img.watermark="embedded";
        }
      });
    }

    for(const video of p.videos||[]){
      if(video.src){
        const name=fileName(video.src)||"video.mp4";
        out.push({
          name,
          src:video.src,
          key:"portfolio/"+slug+"/video/"+safeName(name),
          watermark:false,
          apply(r){
            video.src=r.url;
            video.storagePath=r.key;
            video.watermark="player-overlay";
          }
        });
      }
      if(video.poster){
        const name=fileName(video.poster)||"poster.webp";
        out.push({
          name,
          src:video.poster,
          key:"portfolio/"+slug+"/poster/"+safeName(name),
          watermark:true,
          apply(r){
            video.poster=r.url;
            video.posterStoragePath=r.key;
            video.posterWatermark="embedded";
          }
        });
      }
    }
  }
  return out;
}

async function tokenAdmin(){
  if(!window.supabaseClient)throw new Error("Supabase não carregado.");
  const result=await window.supabaseClient.auth.getSession();
  if(result.error)throw result.error;
  const token=result.data&&result.data.session&&result.data.session.access_token;
  if(!token)throw new Error("Sessão administrativa expirada.");
  return token;
}

async function loadManifest(){
  const r=await fetch(MANIFEST,{cache:"no-store"});
  if(!r.ok)throw new Error("Não foi possível carregar o manifesto atual.");
  const d=await r.json();
  if(!Array.isArray(d.projetos))throw new Error("Manifesto atual inválido.");
  return d;
}

async function fetchBlob(src){
  const r=await fetch(src,{cache:"no-store"});
  if(!r.ok)throw new Error("Não foi possível baixar "+src+" ("+r.status+").");
  return r.blob();
}

async function upload(token,key,blob,type){
  const r=await fetch(API+"/api/upload?key="+encodeURIComponent(key),{
    method:"PUT",
    headers:{
      authorization:"Bearer "+token,
      "content-type":type||"application/octet-stream"
    },
    body:blob
  });
  const d=await r.json().catch(()=>({}));
  if(!r.ok||!d.ok)throw new Error(d.error||("Falha ao enviar "+key+"."));
  return d;
}

async function putManifest(token,manifest){
  const r=await fetch(API+"/api/manifest",{
    method:"PUT",
    headers:{
      authorization:"Bearer "+token,
      "content-type":"application/json"
    },
    body:JSON.stringify(manifest,null,2)
  });
  const d=await r.json().catch(()=>({}));
  if(!r.ok||!d.ok)throw new Error(d.error||"Falha ao publicar o manifesto.");
}

async function addWatermark(blob,name){
  if(!String(blob.type||"").startsWith("image/"))return blob;
  const image=await createImageBitmap(blob);
  const canvas=document.createElement("canvas");
  canvas.width=image.width;
  canvas.height=image.height;
  const ctx=canvas.getContext("2d",{alpha:true});
  ctx.drawImage(image,0,0);

  const small=Math.min(canvas.width,canvas.height);
  const size=Math.max(18,Math.round(small*0.024));
  const pad=Math.max(16,Math.round(small*0.025));
  ctx.save();
  ctx.font="500 "+size+"px Montserrat, Arial, sans-serif";
  ctx.textBaseline="bottom";
  ctx.textAlign="right";
  const width=ctx.measureText(WATERMARK).width;
  const x=canvas.width-pad;
  const y=canvas.height-pad;
  const px=Math.max(10,Math.round(size*0.5));
  const py=Math.max(6,Math.round(size*0.28));
  ctx.fillStyle="rgba(1,9,20,.22)";
  ctx.fillRect(x-width-px*2,y-size-py,width+px*2,size+py*2);
  ctx.strokeStyle="rgba(0,0,0,.20)";
  ctx.lineWidth=Math.max(1,size*.055);
  ctx.strokeText(WATERMARK,x-px,y);
  ctx.fillStyle="rgba(255,255,255,.58)";
  ctx.fillText(WATERMARK,x-px,y);
  ctx.restore();
  if(image.close)image.close();

  const outType=imageType(blob.type,name);
  const quality=(outType==="image/jpeg"||outType==="image/webp")?.92:undefined;
  return new Promise((resolve,reject)=>{
    canvas.toBlob(b=>b?resolve(b):reject(new Error("Falha ao aplicar a marca d'água.")),outType,quality);
  });
}

function imageType(type,name){
  if(type==="image/jpeg"||type==="image/png"||type==="image/webp")return type;
  const byName=mime(name);
  return byName.startsWith("image/")?byName:"image/webp";
}

function mime(name){
  const ext=String(name||"").split(".").pop().toLowerCase();
  return ({
    jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp",
    gif:"image/gif",mp4:"video/mp4",webm:"video/webm",mov:"video/quicktime"
  })[ext]||"application/octet-stream";
}

function fileName(src){
  try{
    return decodeURIComponent(new URL(src,location.href).pathname.split("/").pop()||"");
  }catch{
    return String(src||"").split("/").pop()||"";
  }
}

function safeName(name){
  const text=String(name||"arquivo");
  const dot=text.lastIndexOf(".");
  const ext=dot>0?text.slice(dot+1).toLowerCase().replace(/[^a-z0-9]/g,""):"";
  const base=(dot>0?text.slice(0,dot):text)
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")||"arquivo";
  return ext?base+"."+ext:base;
}

function setStatus(text,type){
  if(!status)return;
  status.textContent=text;
  status.dataset.type=type||"";
}
})();