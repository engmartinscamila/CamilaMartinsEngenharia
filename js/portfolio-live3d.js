/* Galeria 3D — Tiny House + Vitalle. Casa Urben permanece inalterada. */
(() => {
  'use strict';
  const specs = [
    {
      id: 'tiny',
      title: 'Tiny House Signature',
      cardHref: 'tiny-house-signature',
      src: 'assets/projetos/tiny-house-signature/3d-aprovado/modelo-3d-fechado.glb?v=20261030-2',
      orbit: '30deg 75deg auto'
    },
    {
      id: 'vitalle',
      title: 'Empreendimento Vitalle',
      cardHref: 'empreendimento-vitalle',
      src: 'assets/projetos/empreendimento-vitalle/modelo-3d-v6-aprovado.glb?v=20261030-2',
      orbit: '25deg 74deg auto'
    }
  ];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const configs = new Map();
  const requests = new Map();
  const ready = new Map();
  const grid = document.querySelector('.featured-projects-grid');
  if (!grid || !window.fetch || !window.Blob) return;

  async function modelURL(spec) {
    if (requests.has(spec.id)) return requests.get(spec.id);
    const job = (async () => {
      if (spec.src) return spec.src;
      // Partes binárias remontam o GLB ORIGINAL byte a byte no navegador;
      // não há downgrade de textura ou geometria na Tiny House.
      const paths = Array.from({length:spec.parts}, (_,i) =>
        spec.partDirectory + '/modelo-3d.glb.part' + String(i + 1).padStart(2, '0'));
      const buffers = await Promise.all(paths.map(async path => {
        const resp = await fetch(path, {cache:'force-cache'});
        if (!resp.ok) throw new Error('Não foi possível carregar o arquivo 3D (' + resp.status + ')');
        return resp.arrayBuffer();
      }));
      const length = buffers.reduce((total,buffer) => total + buffer.byteLength, 0);
      if (length !== spec.bytes) throw new Error('Modelo 3D incompleto');
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const buffer of buffers) {
        bytes.set(new Uint8Array(buffer), offset);
        offset += buffer.byteLength;
      }
      if (new DataView(bytes.buffer).getUint32(0,true) !== 0x46546c67) {
        throw new Error('O formato do modelo 3D é inválido');
      }
      if (spec.checksum && window.crypto && window.crypto.subtle) {
        const digest = await crypto.subtle.digest('SHA-256', bytes.buffer);
        const sha = [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
        if (sha !== spec.checksum) throw new Error('Integridade do modelo 3D não confirmada');
      }
      return URL.createObjectURL(new Blob([bytes], {type:'model/gltf-binary'}));
    })();
    requests.set(spec.id, job);
    job.catch(() => requests.delete(spec.id));
    return job;
  }

  const dialog = document.createElement('dialog');
  dialog.className = 'portfolio3d-modal';
  dialog.setAttribute('aria-label','Visualização tridimensional do projeto');
  dialog.innerHTML =
    '<div class="portfolio3d-modal-header"><h3 id="portfolio3d-dialog-title">Explorar 3D</h3>' +
    '<button type="button" class="portfolio3d-close" aria-label="Fechar visualização">Fechar ×</button></div>' +
    '<p class="portfolio3d-state" role="status" hidden></p>' +
    '<div class="portfolio3d-modal-stage"></div>' +
    '<p class="portfolio3d-instructions">Arraste para girar • Use a roda do mouse ou gesto de pinça para aproximar</p>';
  document.body.appendChild(dialog);
  const stage = dialog.querySelector('.portfolio3d-modal-stage');
  const state = dialog.querySelector('.portfolio3d-state');
  const close = dialog.querySelector('.portfolio3d-close');
  let modalViewer = null;
  function message(text) {
    state.textContent = text;
    state.hidden = !text;
  }
  close.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{ if(event.target===dialog) dialog.close(); });
  dialog.addEventListener('close',()=>{if(modalViewer) modalViewer.removeAttribute('auto-rotate');});
  async function openModel(spec) {
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('#portfolio3d-dialog-title').textContent = spec.title;
    stage.replaceChildren();
    modalViewer = null;
    message('Carregando a maquete tridimensional…');
    try {
      const src = await modelURL(spec);
      if (!dialog.open) return;
      if (!customElements.get('model-viewer')) throw new Error('Visualização 3D não suportada neste navegador');
      const viewer = document.createElement('model-viewer');
      viewer.className = 'portfolio3d-full';
      viewer.setAttribute('alt','Maquete 3D interativa de ' + spec.title);
      viewer.setAttribute('camera-controls','');
      viewer.setAttribute('interaction-prompt','none');
      viewer.setAttribute('camera-orbit',spec.orbit);
      viewer.setAttribute('shadow-intensity','0.65');
      viewer.setAttribute('tone-mapping','aces');
      viewer.setAttribute('exposure','1.05');
      viewer.setAttribute('loading','eager');
      if(!reducedMotion) viewer.setAttribute('auto-rotate','');
      viewer.addEventListener('load',()=>message(''),{once:true});
      viewer.addEventListener('error',()=>message('Não foi possível mostrar o modelo 3D. Feche e tente novamente.'),{once:true});
      viewer.src = src;
      modalViewer = viewer;
      stage.appendChild(viewer);
    } catch (error) {
      console.error('Galeria 3D:', error);
      message('Visualização 3D indisponível. As imagens do projeto continuam acessíveis.');
    }
  }

  for (const spec of specs) {
    const card = [...grid.querySelectorAll('.featured-project-card')]
      .find(el=>el.getAttribute('href')?.includes(spec.cardHref));
    if (!card) continue;
    const holder=document.createElement('div');
    holder.className='featured-project-3d-wrap';
    card.parentNode.insertBefore(holder,card);
    holder.appendChild(card);
    const button=document.createElement('button');
    button.className='portfolio3d-explore';
    button.type='button';
    button.textContent='Explorar 3D ↗';
    button.setAttribute('aria-label','Abrir maquete 3D interativa de ' + spec.title);
    button.addEventListener('click',()=>openModel(spec));
    holder.appendChild(button);
    const viewer = document.createElement('model-viewer');
    viewer.className='portfolio3d-inline';
    viewer.setAttribute('alt','Maquete tridimensional giratória de ' + spec.title);
    viewer.setAttribute('loading','lazy');
    viewer.setAttribute('reveal','auto');
    viewer.setAttribute('interaction-prompt','none');
    viewer.setAttribute('camera-orbit',spec.orbit);
    viewer.setAttribute('tone-mapping','aces');
    viewer.setAttribute('shadow-intensity','0.55');
    viewer.setAttribute('exposure','1.05');
    viewer.setAttribute('rotation-per-second','7deg');
    if (!reducedMotion) viewer.setAttribute('auto-rotate','');
    viewer.addEventListener('load',()=>{
      card.classList.add('is-3d-visible');
      card.classList.add('is-model-ready');
      card.querySelector('video')?.pause();
      ready.set(spec.id,true);
    });
    viewer.addEventListener('error',()=>{
      card.classList.remove('is-3d-visible');
      card.classList.remove('is-model-ready');
    });
    card.insertBefore(viewer,card.querySelector('.featured-project-overlay'));
    configs.set(spec.id,{spec,card,viewer});
  }

  async function loadCard(item) {
    try { const src=await modelURL(item.spec);item.viewer.src=src; }
    catch(e) { console.warn('Galeria 3D:',e); }
  }
  if ('IntersectionObserver' in window) {
    const observer=new IntersectionObserver(entries=>{
      for(const entry of entries) {
        if (!entry.isIntersecting) continue;
        const item=[...configs.values()].find(a=>a.card===entry.target);
        if (item) loadCard(item);
        observer.unobserve(entry.target);
      }
    },{rootMargin:'350px 0px',threshold:.01});
    for (const item of configs.values()) observer.observe(item.card);
  } else {
    for (const item of configs.values()) loadCard(item);
  }
})();
