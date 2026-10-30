// Casa Urben V17: visualizador integrado à galeria, sem dependência de URL de prévia.
const style=document.createElement('style');
style.textContent='#urben3d-btn{background:#071b2c;border:1px solid #c3a46c;border-radius:7px;color:white;padding:12px 19px;margin:14px 0;cursor:pointer;font-weight:600}#urben3d-btn:hover{background:#25445b}#urben3d-modal[hidden]{display:none!important}#urben3d-modal{position:fixed;inset:0;z-index:99999;background:#061626;color:#fff;display:flex;flex-direction:column;font:13px system-ui,sans-serif}#urben3d-modal .top{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:11px 16px;border-bottom:1px solid #526475}#urben3d-modal .top strong{color:#dec18c;font-size:16px}#urben3d-stage{position:relative;flex:1;min-height:0;background:#cad9df}#urben3d-stage canvas{width:100%;height:100%;display:block;touch-action:none}#urben3d-controls{position:absolute;top:12px;left:12px;right:12px;display:flex;gap:6px;flex-wrap:wrap}#urben3d-controls button,#urben3d-close{border:1px solid #45596c;border-radius:6px;padding:9px 12px;background:#0b1e2ff0;color:white;cursor:pointer;font-size:12px}#urben3d-controls button.active{border-color:#e4be7c;background:#314c63}#urben3d-message{position:absolute;inset:0;display:grid;place-content:center;text-align:center;background:#cfdee2;color:#0b2638;font-size:15px;padding:15px}#urben3d-modal footer{background:#071827;padding:10px;color:#c6d2de;font-size:11px}@media(max-width:650px){#urben3d-controls{top:5px;left:5px;right:5px;gap:3px}#urben3d-controls button{font-size:11px;padding:7px 6px}}';
document.head.appendChild(style);
const modal=document.createElement('div');
modal.id='urben3d-modal';modal.hidden=true;modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','Casa Urben visualização 3D');
modal.innerHTML='<div class="top"><strong>Casa Urben · Modelo 3D V17</strong><button id="urben3d-close" type="button">Fechar ✕</button></div><div id="urben3d-stage"><canvas id="urben3d-canvas"></canvas><div id="urben3d-controls"><button class="active" data-v="frente">Fachada</button><button data-v="lateral">Lateral</button><button data-v="fundos">Fundos</button><button data-v="tres">3/4</button><button data-v="implantacao">Implantação</button><button data-v="piscina">Piscina</button><button data-v="pergolado">Pergolado</button><button id="urben3d-spin">Girar 360°</button></div><div id="urben3d-message" role="status">Preparando maquete 3D…</div></div><footer>Arraste para girar · Role para aproximar · Versão V17 em revisão de acabamentos</footer>';
document.body.append(modal);
const stage=modal.querySelector('#urben3d-stage'),canvas=modal.querySelector('#urben3d-canvas'),message=modal.querySelector('#urben3d-message');
let T,scene,camera,renderer,controls,model,loaded=false,loading=false,raf=0,lastFocus=null,lastOverflow='';
const views={
frente:[[12,8,38],[0,1.5,14]],lateral:[[30,13,2],[0,1.5,1]],fundos:[[15,13,-35],[0,1,-14]],
tres:[[29,26,48],[0,1,1]],implantacao:[[0,66,.01],[0,0,0]],piscina:[[10,7,-28],[1,.4,-16]],pergolado:[[14,6,-9],[1,1,-1]]
};
function view(name){if(!controls)return;const p=views[name]||views.frente;camera.position.set(...p[0]);controls.target.set(...p[1]);controls.update();modal.querySelectorAll('[data-v]').forEach(b=>b.classList.toggle('active',b.dataset.v===name));}
function correct(root){
const nodes={};root.traverse(o=>{if(o.isMesh){nodes[o.name]=o;o.receiveShadow=true;}});
if(nodes.glass_001)nodes.glass_001.visible=false;
const paving=nodes.pavers_004;
if(paving&&paving.geometry.index){const ix=paving.geometry.index.array;const cleaned=[];const bad=new Set([1050,1052,1055,1057]);for(let i=0;i<ix.length/3;i++)if(!bad.has(i))cleaned.push(ix[i*3],ix[i*3+1],ix[i*3+2]);const g=paving.geometry.clone();g.setIndex(cleaned);paving.geometry=g;}
const lawn=nodes.Urben_Gramado_Recortado_Fora_Do_Tanque;
if(lawn){
lawn.visible=false;
const shape=new T.Shape();shape.moveTo(-5.702,-24.209);shape.lineTo(5.948,-24.209);shape.lineTo(5.948,-9.525);shape.lineTo(-5.702,-9.525);shape.closePath();
const hole=new T.Path();hole.moveTo(-2.39,-20.14);hole.lineTo(-2.39,-13.09);hole.lineTo(4.65,-13.09);hole.lineTo(4.65,-20.14);hole.closePath();shape.holes.push(hole);
const behind=new T.Shape();behind.moveTo(.90,-9.525);behind.lineTo(5.948,-9.525);behind.lineTo(5.948,-.32);behind.lineTo(.90,-.32);behind.closePath();
const g=new T.ShapeGeometry([shape,behind]);g.rotateX(-Math.PI/2);g.translate(0,-.021,0);
const p=g.getAttribute('position'),uv=new Float32Array(p.count*2);for(let i=0;i<p.count;i++){uv[2*i]=p.getX(i)*.9;uv[2*i+1]=p.getZ(i)*.9;}g.setAttribute('uv',new T.BufferAttribute(uv,2));g.computeVertexNormals();
const c=document.createElement('canvas');c.width=c.height=256;const context=c.getContext('2d'),image=context.createImageData(256,256);let r=127;
for(let i=0;i<image.data.length;i+=4){r=(1664525*r+1013904223)>>>0;let v=(r/4294967296-.5)*32;image.data[i]=77+v*.7;image.data[i+1]=103+v;image.data[i+2]=58+v*.5;image.data[i+3]=255;}context.putImageData(image,0,0);
const tex=new T.CanvasTexture(c);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.colorSpace=T.SRGBColorSpace;
const mesh=new T.Mesh(g,new T.MeshStandardMaterial({name:'Gramado V17',map:tex,roughness:1,side:T.DoubleSide}));mesh.receiveShadow=true;root.add(mesh);
}
const visited=new Set();
root.traverse(o=>{if(!o.isMesh)return;let opaque=true;
for(const m of (Array.isArray(o.material)?o.material:[o.material])){if(!m)continue;
if(!visited.has(m)){visited.add(m);const n=(m.name||'').toLowerCase(),type=m.userData?.surfaceType;
if(n.includes('cobertura')){m.roughness=.67;m.metalness=.03;m.side=T.DoubleSide;}
if(n.includes('stucco')||n.includes('pintura')){m.roughness=.85;m.metalness=0;}
if(n.includes('ceramic')||n.includes('ceramica')){m.roughness=.42;m.metalness=0;}
if(type==='water'){m.transparent=true;m.opacity=Math.min(m.opacity,.52);m.roughness=.1;m.depthWrite=false;m.side=T.DoubleSide;}
if(type==='glass'){m.transparent=true;m.opacity=Math.min(m.opacity,.45);m.roughness=.13;m.depthWrite=false;}
m.needsUpdate=true;
}if(m.transparent)opaque=false;}o.castShadow=opaque;});
}
async function getBinary(){
const arr=Array(31);let next=0,done=0;
const base=new URL('previews/casa-urben-v16-assets/',new URL('./',location.href));
await Promise.all(Array.from({length:4},async()=>{while(next<arr.length){
const i=next++,url=new URL('part-'+String(i+1).padStart(2,'0')+'.txt',base);
const r=await fetch(url,{cache:'force-cache'});if(!r.ok)throw Error('arquivo '+(i+1)+' (HTTP '+r.status+')');
arr[i]=(await r.text()).trim();message.textContent='Carregando modelo: '+(++done)+' de 31';}}));
const z=Uint8Array.from(atob(arr.join('')),c=>c.charCodeAt(0));
const raw=await new Response(new Blob([z]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer();
if(raw.byteLength!==11742280)throw Error('Arquivo 3D incompleto.');return raw;
}
function resize(){if(!renderer||modal.hidden)return;camera.aspect=stage.clientWidth/stage.clientHeight;camera.updateProjectionMatrix();renderer.setSize(stage.clientWidth,stage.clientHeight,false);}
function draw(){if(modal.hidden||!renderer)return;controls.update();renderer.render(scene,camera);raf=requestAnimationFrame(draw);}
async function initialize(){
if(loading||loaded)return;loading=true;
try{const [Three,{GLTFLoader},{OrbitControls},{RoomEnvironment}]=await Promise.all([
import('three'),import('three/addons/loaders/GLTFLoader.js'),import('three/addons/controls/OrbitControls.js'),import('three/addons/environments/RoomEnvironment.js')]);
T=Three;renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
scene=new T.Scene();scene.background=new T.Color('#cad9df');camera=new T.PerspectiveCamera(45,1,.1,200);
controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.07;controls.minDistance=2;controls.maxDistance=100;controls.maxPolarAngle=Math.PI*.485;
scene.add(new T.HemisphereLight(0xdcecff,0xa2a18b,.85));
const sun=new T.DirectionalLight(0xffedda,2.4);sun.position.set(-18,30,28);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-32;sun.shadow.camera.right=32;sun.shadow.camera.top=32;sun.shadow.camera.bottom=-32;sun.shadow.camera.near=1;sun.shadow.camera.far=110;sun.shadow.normalBias=.025;scene.add(sun);
const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.05);scene.environment=env.texture;room.dispose();pmrem.dispose();
const glb=await getBinary();message.textContent='Preparando acabamentos…';
model=(await new Promise((yes,no)=>new GLTFLoader().parse(glb,'',yes,no))).scene;
correct(model);scene.add(model);loaded=true;loading=false;message.hidden=true;view('frente');resize();draw();
}catch(e){loading=false;console.error(e);message.hidden=false;message.textContent='Não foi possível carregar o modelo 3D: '+e.message;}
}
function show(){lastFocus=document.activeElement;lastOverflow=document.body.style.overflow;modal.hidden=false;document.body.style.overflow='hidden';modal.querySelector('#urben3d-close').focus();if(loaded){resize();cancelAnimationFrame(raf);draw();}else initialize();}
function close(){modal.hidden=true;document.body.style.overflow=lastOverflow;cancelAnimationFrame(raf);if(controls)controls.autoRotate=false;modal.querySelector('#urben3d-spin').textContent='Girar 360°';if(lastFocus&&lastFocus.focus)lastFocus.focus();}
modal.querySelector('#urben3d-close').onclick=close;document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden){e.stopImmediatePropagation();close();}});
modal.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{if(controls)controls.autoRotate=false;modal.querySelector('#urben3d-spin').textContent='Girar 360°';view(b.dataset.v);});
modal.querySelector('#urben3d-spin').onclick=e=>{if(!controls)return;controls.autoRotate=!controls.autoRotate;e.currentTarget.textContent=controls.autoRotate?'Parar rotação':'Girar 360°';};
window.addEventListener('resize',resize);
function attach(){const section=document.getElementById('casa-urban')||document.getElementById('casa-urben');
if(!section||section.querySelector('#urben3d-btn'))return;
const parent=section.querySelector('.gallery-project-heading');if(!parent)return;
const target=parent.firstElementChild||parent,btn=document.createElement('button');btn.id='urben3d-btn';btn.type='button';btn.textContent='◉ Explorar Casa Urben em 3D';btn.onclick=show;target.append(btn);}
attach();new MutationObserver(attach).observe(document.getElementById('galleryProjects')||document.body,{childList:true,subtree:true});
