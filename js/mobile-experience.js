/* Camila Martins Engenharia — controles compartilhados para web mobile */
(function(){
  'use strict';

  const MOBILE_QUERY='(max-width: 760px)';

  function isMobile(){return window.matchMedia(MOBILE_QUERY).matches;}

  function setupAdminDrawer(){
    const sidebar=document.querySelector('.layout .sidebar');
    if(!sidebar || document.querySelector('.cme-mobile-menu-toggle')) return;

    const button=document.createElement('button');
    button.type='button';
    button.className='cme-mobile-menu-toggle';
    button.setAttribute('aria-label','Abrir menu');
    button.setAttribute('aria-expanded','false');
    button.innerHTML='<i class="fa-solid fa-bars" aria-hidden="true"></i>';

    const backdrop=document.createElement('div');
    backdrop.className='cme-mobile-menu-backdrop';
    backdrop.setAttribute('aria-hidden','true');

    const close=()=>{
      sidebar.classList.remove('open');
      backdrop.classList.remove('show');
      document.body.classList.remove('cme-mobile-menu-open');
      button.setAttribute('aria-expanded','false');
      button.setAttribute('aria-label','Abrir menu');
      button.innerHTML='<i class="fa-solid fa-bars" aria-hidden="true"></i>';
    };
    const open=()=>{
      sidebar.classList.add('open');
      backdrop.classList.add('show');
      document.body.classList.add('cme-mobile-menu-open');
      button.setAttribute('aria-expanded','true');
      button.setAttribute('aria-label','Fechar menu');
      button.innerHTML='<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
    };

    button.addEventListener('click',()=>sidebar.classList.contains('open')?close():open());
    backdrop.addEventListener('click',close);
    sidebar.querySelectorAll('a.menu-item').forEach(link=>link.addEventListener('click',()=>{if(isMobile())close();}));
    document.addEventListener('keydown',event=>{if(event.key==='Escape')close();});
    window.matchMedia(MOBILE_QUERY).addEventListener?.('change',event=>{if(!event.matches)close();});

    document.body.append(backdrop,button);
  }

  function improveScrollableTables(){
    document.querySelectorAll('table').forEach(table=>{
      if(table.closest('.table-responsive,.doc-table-wrap')) return;
      if(!isMobile()) return;
      const parent=table.parentElement;
      if(!parent || parent.classList.contains('cme-mobile-table-wrap')) return;
      const wrap=document.createElement('div');
      wrap.className='cme-mobile-table-wrap table-responsive';
      parent.insertBefore(wrap,table);
      wrap.appendChild(table);
    });
  }

  function markExternalTouchTargets(){
    if(!isMobile()) return;
    document.querySelectorAll('button,a,input,select,textarea').forEach(el=>{
      if(el.matches('input[type="hidden"]')) return;
      el.classList.add('cme-touch-target');
    });
  }

  function init(){
    setupAdminDrawer();
    improveScrollableTables();
    markExternalTouchTargets();
    const observer=new MutationObserver(()=>{
      improveScrollableTables();
      markExternalTouchTargets();
    });
    observer.observe(document.body,{childList:true,subtree:true});
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
