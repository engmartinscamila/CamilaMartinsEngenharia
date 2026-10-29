/* Central file catalogue. Existing tables remain the authoritative records; no copies. */
(function () {
  'use strict';
  const image = path => /\.(jpe?g|png|webp|gif|avif|bmp|heic|heif)$/i.test(String(path || '').split('?')[0]);
  const ref = id => String(id).startsWith('foto:') ? {table:'fotos',id:String(id).slice(5)} : String(id).startsWith('biblioteca:') ? {table:'biblioteca',id:String(id).slice(11)} : {table:'documentos',id};
  const defaultBucket = table => window.BUCKETS?.[table.toUpperCase()] || table;
  function payload(data,table) {
    const {tipo,autoral,source, ...rest}=data;
    const authored=autoral===true;
    if(table==='fotos')return {...rest,categoria:tipo||'foto',protection_mode:authored?'authored_photo':'administrative'};
    if(table==='biblioteca')return {...rest,tipo:tipo||'Material',categoria:tipo||'Material',autoral:authored};
    return {...rest,tipo,categoria:tipo||'Documento',autoral:authored,protection_mode:authored?'authored_pdf':'administrative',permitir_download:!authored};
  }
  async function rows(table) {
    const all=[];
    for(let offset=0;;offset+=500){
      const result=await supabaseClient.from(table).select('*').order('created_at',{ascending:false}).order('id').range(offset,offset+499);
      if(result.error)throw new Error('Não foi possível carregar todos os arquivos de '+table+'.');
      all.push(...(result.data||[]));
      if((result.data||[]).length<500)return all;
      if(all.length>=100000)throw new Error('O catálogo excede 100 mil registros. Refine a consulta.');
    }
  }
  async function list() {
    const sources=await Promise.all(['documentos','fotos','biblioteca'].map(async table=>(await rows(table)).map(row=>({...row,id:table==='fotos'?'foto:'+row.id:table==='biblioteca'?'biblioteca:'+row.id:row.id,source:table,tipo:row.categoria||row.tipo||table,storage_bucket:row.storage_bucket||defaultBucket(table),autoral:table==='fotos'?row.protection_mode!=='administrative':row.autoral===true||row.protection_mode==='authored_pdf'}))));
    // Keep cross-project references separate; never hide an authorization boundary.
    const seen=new Map();
    for(const row of sources.flat()){
      const key=row.arquivo?[row.storage_bucket,row.arquivo,row.cliente_id,row.projeto_id].join('|'):row.source+':'+row.id;
      if(seen.has(key)){seen.get(key).references.push({source:row.source,id:row.id});continue;}
      seen.set(key,{...row,references:[{source:row.source,id:row.id}]});
    }
    return Promise.all([...seen.values()].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)).map(async row=>{
      if(row.purged_at)return {...row,url:'',urlErro:'Arquivo guardado fora do Storage. Use Arquivos antigos e restauração.'};
      try{return {...row,url:await dbGerarUrlArquivo(row.storage_bucket,row.arquivo),urlErro:''};}
      catch{return {...row,url:'',urlErro:'Não foi possível abrir o arquivo.'};}
    }));
  }
  const removeBlob=window.dbExcluirArquivoStorage;
  window.dbExcluirArquivoStorage=async(bucket,path)=>{
    for(const table of ['documentos','fotos','biblioteca']){
      const {data,error}=await supabaseClient.from(table).select('storage_bucket').eq('arquivo',path);
      if(error)throw error;
      if((data||[]).some(row=>(row.storage_bucket||defaultBucket(table))===bucket))return {retained:true};
    }
    return removeBlob(bucket,path);
  };
  function bucket(file){return document.getElementById('documentoDestino')?.value==='biblioteca'?'biblioteca':image(file?.name)?defaultBucket('fotos'):defaultBucket('documentos');}
  function validate(file,authored){
    if(!file||file.size>20*1024*1024)throw new Error('Selecione um arquivo de até 20 MB.');
    if(!/\.(pdf|docx?|xlsx?|csv|txt|jpe?g|png|webp|gif|avif|bmp|heic|heif|dwg|dxf|rvt|ifc|skp|zip)$/i.test(file.name))throw new Error('Tipo de arquivo não permitido.');
    if(authored&&!image(file.name)&&!file.name.toLowerCase().endsWith('.pdf'))throw new Error('Documentos autorais protegidos devem estar em PDF.');
  }
  window.CMEProjectFiles={image,bucket,ref,validate};
  window.dbBuscarDocumentos=list;
  window.dbBuscarFotos=async()=>(await list()).filter(row=>image(row.arquivo));
  window.dbCriarDocumento=async data=>{
    const table=data.source==='biblioteca'?'biblioteca':image(data.arquivo)?'fotos':'documentos';
    const {data:saved,error}=await supabaseClient.from(table).insert(payload(data,table)).select();
    if(error)throw error;
    if(!saved?.length)throw new Error('O cadastro do arquivo não foi confirmado.');
    return saved;
  };
  window.dbEditarDocumento=async(id,data)=>{
    const target=ref(id);
    if(target.table==='fotos'&&!image(data.arquivo))throw new Error('Um registro do álbum precisa conter uma imagem. Cadastre o PDF como um novo documento.');
    const {data:saved,error}=await supabaseClient.from(target.table).update(payload(data,target.table)).eq('id',target.id).select();
    if(error)throw error;
    if(!saved?.length)throw new Error('Arquivo não encontrado ou acesso recusado.');
    return saved;
  };
  window.dbExcluirDocumento=async id=>{
    const target=ref(id);
    // Immutable issued documents are protected in the database as well.
    const {data,error}=await supabaseClient.from(target.table).delete().eq('id',target.id).select('id');
    if(error)throw error;
    if(!data?.length)throw new Error('Arquivo não encontrado ou acesso recusado.');
  };
})();
