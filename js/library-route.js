(function(){'use strict';const params=new URLSearchParams(location.search);params.set('visao','biblioteca');location.replace('/documentos.html?'+params+location.hash);})();
