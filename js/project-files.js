/* One management screen, two existing metadata sources; never copy rows or blobs. */
(function () {
  'use strict';
  const image = path => /\.(jpe?g|png|webp|gif|avif|bmp)$/i.test(String(path || '').split('?')[0]);
  function ref(id) { const photo = String(id).startsWith('foto:'); return { table: photo ? 'fotos' : 'documentos', id: photo ? String(id).slice(5) : id }; }
  function payload(data, photo) {
    if (!photo) return data;
    const { tipo, autoral, ...rest } = data;
    return { ...rest, categoria: tipo || 'foto', ...(typeof autoral === 'boolean' ? { protection_mode: autoral ? 'authored_photo' : 'administrative' } : {}) };
  }
  async function rows(table) {
    const all = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabaseClient.from(table).select('*').order('created_at', { ascending: false }).range(offset, offset + 499);
      if (error) throw error;
      all.push(...data);
      if (data.length < 500) return all;
    }
  }
  async function list() {
    const [docs, photos] = await Promise.all([rows('documentos'), rows('fotos')]);
    const merged = [...docs.map(row => ({ ...row, source: 'documentos', storage_bucket: row.storage_bucket || BUCKETS.DOCUMENTOS })),
      ...photos.map(row => ({ ...row, id: 'foto:' + row.id, source: 'fotos', tipo: row.categoria || 'foto', storage_bucket: row.storage_bucket || BUCKETS.FOTOS }))];
    // Same physical object already registered in both sources is shown once.
    const seen = new Set();
    const unique = merged.filter(row => { const key = row.storage_bucket + '/' + row.arquivo; if (row.arquivo && seen.has(key)) return false; seen.add(key); return true; });
    return Promise.all(unique.sort((a,b) => Date.parse(b.created_at) - Date.parse(a.created_at)).map(async row => {
      try { return { ...row, url: await dbGerarUrlArquivo(row.storage_bucket, row.arquivo), urlErro: '' }; }
      catch { return { ...row, url: '', urlErro: 'Não foi possível abrir o arquivo.' }; }
    }));
  }
  const removeBlob = window.dbExcluirArquivoStorage;
  window.dbExcluirArquivoStorage = async (bucket, path) => {
    // Old rows may share a physical object. Do not break another registration.
    for (const table of ['documentos','fotos']) {
      const { data, error } = await supabaseClient.from(table).select('storage_bucket').eq('arquivo', path);
      if (error) throw error;
      if ((data || []).some(row => (row.storage_bucket || (table === 'fotos' ? BUCKETS.FOTOS : BUCKETS.DOCUMENTOS)) === bucket)) return;
    }
    return removeBlob(bucket, path);
  };
  window.CMEProjectFiles = { image, bucket: file => image(file?.name) ? BUCKETS.FOTOS : BUCKETS.DOCUMENTOS };
  window.dbBuscarDocumentos = list;
  window.dbBuscarFotos = async () => (await list()).filter(row => image(row.arquivo));
  window.dbCriarDocumento = async data => {
    const photo = image(data.arquivo), table = photo ? 'fotos' : 'documentos';
    const { data: saved, error } = await supabaseClient.from(table).insert(payload(data, photo)).select();
    if (error) throw error;
    return saved;
  };
  window.dbEditarDocumento = async (id, data) => {
    const target = ref(id);
    if (target.table === 'fotos' && !image(data.arquivo)) throw new Error('Um registro do álbum precisa conter uma imagem. Cadastre o PDF como um novo documento.');
    const { data: saved, error } = await supabaseClient.from(target.table).update(payload(data, target.table === 'fotos')).eq('id', target.id).select();
    if (error) throw error;
    if (!saved?.length) throw new Error('Arquivo não encontrado ou acesso recusado.');
    return saved;
  };
  window.dbExcluirDocumento = async id => {
    const target = ref(id);
    const { data, error } = await supabaseClient.from(target.table).delete().eq('id', target.id).select('id');
    if (error) throw error;
    if (!data?.length) throw new Error('Arquivo não encontrado ou acesso recusado.');
  };
})();
