(function(){'use strict';const params=new URLSearchParams(location.search);params.delete('visao');location.replace('/documentos.html?'+params+location.hash);})();
