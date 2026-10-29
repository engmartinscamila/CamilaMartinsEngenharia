/* Shared physical-file cleanup. Keep the object whenever any reference is still live. */
(function () {
  'use strict';
  const tables=['documentos','fotos','biblioteca'];
  const bucketFor=table=>window.BUCKETS?.[table.toUpperCase()] || table;
  const originalRemove=window.dbExcluirArquivoStorage;
  function warn() {
    let notice=document.getElementById('fileCleanupNotice');
    if (!notice) {
      notice=document.createElement('p'); notice.id='fileCleanupNotice'; notice.setAttribute('role','status');
      notice.className='doc-status warning'; (document.querySelector('main') || document.body).prepend(notice);
    }
    notice.textContent='O cadastro foi removido, mas a limpeza física de um arquivo ficou pendente. Confira Armazenamento e auditoria. Nenhum arquivo ainda referenciado foi removido.';
  }
  async function references(bucket,path) {
    const rows=[];
    for (const table of tables) {
      const result=await window.supabaseClient.from(table).select('id,arquivo,storage_bucket').eq('arquivo',path);
      if (result.error) throw new Error('Não foi possível conferir os vínculos do arquivo. A limpeza física foi interrompida.');
      for (const row of result.data || []) if ((row.storage_bucket || bucketFor(table))===bucket) rows.push({table,...row});
    }
    return rows;
  }
  async function removeBlob(bucket,path) {
    if (!path || (await references(bucket,path)).length) return {retained:true};
    if (typeof originalRemove!=='function') throw new Error('Serviço de armazenamento indisponível.');
    return originalRemove(bucket,path);
  }
  async function removeMetadata(table,id) {
    const {data,error}=await window.supabaseClient.from(table).delete().eq('id',id).select('id');
    if (error) throw error;
    if (data?.length!==1) throw new Error('A remoção do cadastro não foi confirmada. O arquivo foi preservado.');
  }
  async function removeItem(table,id) {
    const result=await window.supabaseClient.from(table).select('id,arquivo,storage_bucket').eq('id',id).maybeSingle();
    if (result.error || !result.data) throw new Error('Registro não encontrado ou acesso recusado.');
    await removeMetadata(table,id);
    try { await removeBlob(result.data.storage_bucket || bucketFor(table),result.data.arquivo); }
    catch { warn(); }
    return true;
  }
  window.dbExcluirArquivoStorage=removeBlob;
  window.dbExcluirArquivoBiblioteca=id=>removeItem('biblioteca',id);
  window.dbExcluirFoto=id=>removeItem('fotos',id);
  window.dbExcluirRegistroPorArquivo=async (bucket,path) => {
    const rows=await references(bucket,path);
    for (const row of rows) await removeMetadata(row.table,row.id);
    try { await removeBlob(bucket,path); } catch { warn(); }
    return true;
  };
  window.CMEFileOperations={references,removeBlob,removeItem};
})();
