/* Galeria: videos cinematograficos nas capas; 3D somente pelo botao Explorar 3D. */
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
    },
    {
      id: 'urben',
      title: 'Casa Urben',
      cardHref: 'casa-urban',
      partDirectory: 'previews/casa-urben-v16-assets',
      parts: 31,
      packed: 'base64-deflate',
      bytes: 11742280,
      checksum: 'c46dc0e83d8945c9b9e4469cd2ab343b42666d5c65cfc7e991734fd5bfab0e7c',
      orbit: '32deg 72deg auto'
    }
  ];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const requests = new Map();
  const grid = document.querySelector('.featured-projects-grid');
  if (!grid || !window.fetch || !window.Blob) return;

  async function modelURL(spec) {
    if (requests.has(spec.id)) return requests.get(spec.id);
    const job = (async () => {
      if (spec.src) return spec.src;
      if (spec.packed === 'base64-deflate') {
        // Casa Urben: utiliza o GLB de origem já hospedado, remontado byte a byte.
        // A interface, os controles e o modal são os mesmos de Tiny House e Vitalle.
        const chunks = new Array(spec.parts);
        let next = 0;
        await Promise.all(Array.from({length: 4}, async () => {
          while (next < chunks.length) {
            const i = next++;
            const path = spec.partDirectory + '/part-' + String(i + 1).padStart(2, '0') + '.txt';
            const response = await fetch(path, { cache: 'force-cache' });
            if (!response.ok) throw new Error('Não foi possível carregar uma parte do modelo Casa Urben (' + response.status + ')');
            chunks[i] = (await response.text()).trim();
          }
        }));
        const compressed = Uint8Array.from(atob(chunks.join('')), c => c.charCodeAt(0));
        if (!('DecompressionStream' in window)) throw new Error('O navegador não oferece descompactação 3D');
        const buffer = await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer();
        const bytes = new Uint8Array(buffer);
        if (bytes.byteLength !== spec.bytes || new DataView(buffer).getUint32(0, true) !== 0x46546c67) {
          throw new Error('O arquivo 3D da Casa Urben está incompleto');
        }
        if (spec.checksum && crypto?.subtle) {
          const digest = await crypto.subtle.digest('SHA-256', buffer);
          const sha = [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('');
          if (sha !== spec.checksum) throw new Error('Integridade da Casa Urben não confirmada');
        }
        return URL.createObjectURL(new Blob([buffer], { type: 'model/gltf-binary' }));
      }
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

  // O GLB é carregado somente quando o visitante abre a maquete.
  // As capas mantêm suas imagens e vídeos cinematográficos originais.
  for (const spec of specs) {
    const card = [...grid.querySelectorAll('.featured-project-card')]
      .find(el => el.getAttribute('href')?.includes(spec.cardHref));
    if (!card) continue;
    const holder = document.createElement('div');
    holder.className = 'featured-project-3d-wrap';
    card.parentNode.insertBefore(holder, card);
    holder.appendChild(card);
    const button = document.createElement('button');
    button.className = 'portfolio3d-explore';
    button.type = 'button';
    button.textContent = 'Explorar 3D ↗';
    button.setAttribute('aria-label', 'Abrir maquete 3D interativa de ' + spec.title);
    button.addEventListener('click', () => openModel(spec));
    holder.appendChild(button);
  }
})();
