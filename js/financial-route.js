/* O financeiro antigo é somente um atalho para a área integrada (sem segundo controlador). */
(function(){
  'use strict';
  const query = new URLSearchParams(location.search);
  if (!query.has('view')) query.set('view', 'summary');
  location.replace('/portal/admin/finance-center/?' + query.toString() + location.hash);
})();
