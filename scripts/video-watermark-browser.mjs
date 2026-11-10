// Vídeo enviado pelo painel recebe a marca timbrada no navegador (FFmpeg WebAssembly).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
const localPkgs=process.env.FFMPEG_PKGS||path.resolve('node_modules');
const map={'@ffmpeg/ffmpeg@0.12.10':'@ffmpeg/ffmpeg','@ffmpeg/core@0.12.6':'@ffmpeg/core','@ffmpeg/util@0.12.1':'@ffmpeg/util'};
const browser=await chromium.launch({headless:true});
try{
 const ctx=await browser.newContext(),page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await ctx.route('**/*',r=>{
  const url=r.request().url();
  if(r.request().isNavigationRequest())return r.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'});
  const m=url.match(/cdn\.jsdelivr\.net\/npm\/(@ffmpeg\/[a-z]+@[0-9.]+)\/(.+)$/);
  if(m){const local=path.join(localPkgs,map[m[1]]||'',m[2]);if(fs.existsSync(local))return r.fulfill({body:fs.readFileSync(local),contentType:local.endsWith('.wasm')?'application/wasm':'text/javascript',headers:{'access-control-allow-origin':'*'}});return r.continue();}
  return r.abort();
 });
 await page.goto('http://127.0.0.1:45999/teste.html');
 await page.evaluate(()=>{window.supabaseClient={auth:{getSession:async()=>({data:{session:{access_token:'t'}},error:null})},storage:{from:()=>({})}};});
 await page.addScriptTag({content:fs.readFileSync('js/portfolio-r2-bridge.js','utf8')});
 const src='assets/projetos/tiny-house-signature/videos/tiny-house-novo-hiperrealista.mp4';
 const bytes=[...fs.readFileSync(src)];
 const out=await page.evaluate(async b=>{const f=new File([new Uint8Array(b)],'video.mp4',{type:'video/mp4'});const v=await window.CME_PORTFOLIO_R2_BRIDGE.watermarkVideo(f);return {type:v.type,data:[...new Uint8Array(await v.arrayBuffer())]};},bytes);
 assert.equal(out.type,'video/mp4');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cme-video-'));
 const file=path.join(dir,'out.mp4');fs.writeFileSync(file,Buffer.from(out.data));
 const info=execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=codec_name,width,height','-of','csv=p=0',file]).toString().trim();
 assert.match(info,/^h264,720,756/);
 // O quadro marcado difere do original.
 const frame=(f)=>execFileSync('ffmpeg',['-v','error','-ss','2','-i',f,'-frames:v','1','-f','rawvideo','-pix_fmt','gray','-s','72x76','-']);
 const a=frame(src),b2=frame(file);let diff=0;for(let i=0;i<a.length;i++)diff+=Math.abs(a[i]-b2[i]);
 assert.ok(diff/a.length>1.5,`marca visível no vídeo (diferença média ${(diff/a.length).toFixed(2)})`);
 if(process.env.CME_SHOTS)execFileSync('ffmpeg',['-v','error','-y','-ss','2','-i',file,'-frames:v','1',path.join(process.env.CME_SHOTS,'video-painel.jpg')]);
 assert.deepEqual(errors,[]);
 console.log('PASS: vídeo enviado pelo painel sai com a marca timbrada gravada (H.264, mesmo tamanho).');
}finally{await browser.close();}
