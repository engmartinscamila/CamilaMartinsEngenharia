/* Application exports are generated locally; nothing is written to public hosting. */
(function () {
  'use strict';
  const encoder = new TextEncoder(), MAX_BYTES = 256 * 1024 * 1024;
  let running = false;
  const bytes = value => value instanceof Uint8Array ? value : encoder.encode(value);
  const sha256 = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes(value))))
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
  function crc32(data) {
    let crc = 0xffffffff;
    for (const byte of data) { crc ^= byte; for (let bit=0; bit<8; bit++) crc=(crc>>>1)^((crc&1)?0xedb88320:0); }
    return (crc ^ 0xffffffff) >>> 0;
  }
  function zip(entries) {
    if (entries.length > 65535) throw new Error('Há arquivos demais para este pacote.');
    const parts=[], central=[], names=new Set(); let offset=0, centralSize=0;
    for (const [filename, content] of entries) {
      if (names.has(filename) || /(^\/|\\|(?:^|\/)\.\.(?:\/|$))/.test(filename)) throw new Error('Nome inválido no pacote.');
      names.add(filename);
      const name=encoder.encode(filename), data=bytes(content), checksum=crc32(data);
      if (name.length>65535 || offset+data.length>MAX_BYTES) throw new Error('O ZIP excede 256 MB. Exporte o JSON e use o backup de arquivos do servidor.');
      const local=new Uint8Array(30+name.length), lv=new DataView(local.buffer);
      lv.setUint32(0,0x04034b50,true); lv.setUint16(4,20,true); lv.setUint16(6,0x800,true); lv.setUint16(12,33,true);
      lv.setUint32(14,checksum,true); lv.setUint32(18,data.length,true); lv.setUint32(22,data.length,true); lv.setUint16(26,name.length,true); local.set(name,30);
      const dir=new Uint8Array(46+name.length), dv=new DataView(dir.buffer);
      dv.setUint32(0,0x02014b50,true); dv.setUint16(4,20,true); dv.setUint16(6,20,true); dv.setUint16(8,0x800,true); dv.setUint16(14,33,true);
      dv.setUint32(16,checksum,true); dv.setUint32(20,data.length,true); dv.setUint32(24,data.length,true); dv.setUint16(28,name.length,true); dv.setUint32(42,offset,true); dir.set(name,46);
      parts.push(local,data); central.push(dir); offset+=local.length+data.length; centralSize+=dir.length;
    }
    const end=new Uint8Array(22), ev=new DataView(end.buffer);
    ev.setUint32(0,0x06054b50,true); ev.setUint16(8,central.length,true); ev.setUint16(10,central.length,true); ev.setUint32(12,centralSize,true); ev.setUint32(16,offset,true);
    return new Blob([...parts,...central,end],{type:'application/zip'});
  }
  function validate(data) {
    if (data?.version!==3 || !data.tables || !Array.isArray(data.storage_objects)) throw new Error('O servidor não confirmou o inventário da exportação.');
    for (const table of ['clientes','contratos','projetos','documentos','fotos','financeiro','payment_receipts']) {
      if (!Array.isArray(data.tables[table])) throw new Error(`Tabela obrigatória ausente: ${table}.`);
    }
    for (const [table, rows] of Object.entries(data.tables)) {
      if (!Array.isArray(rows) || rows.length!==data.counts?.[table]) throw new Error(`Contagem incompleta: ${table}.`);
    }
    const keys=new Set();
    for (const object of data.storage_objects) {
      const key=object.bucket+'\0'+object.path;
      if (!object.bucket || !object.path || keys.has(key) || !Number.isSafeInteger(object.size) || object.size<0) throw new Error('Inventário de arquivos inválido.');
      keys.add(key);
    }
    return data;
  }
  async function snapshot(client) {
    const result=await client.rpc('admin_export_application_backup');
    if (result.error) throw new Error('Falha na exportação dos dados. Nenhum pacote parcial foi gerado.');
    return validate(result.data);
  }
  async function collect(client, includeFiles, progress=()=>{}) {
    progress('Lendo dados administrativos e conferindo contagens...');
    const data=await snapshot(client), entries=[], files=[];
    const json=JSON.stringify(data,null,2);
    const manifest={version:1, created_at:data.created_at, includes_files:includeFiles,
      data_sha256:await sha256(json), tables:data.counts, files, limitations:data.limitations};
    if (!includeFiles) return {blob:new Blob([json],{type:'application/json;charset=utf-8'}),manifest};
    const total=data.storage_objects.reduce((sum,item)=>sum+item.size,0);
    if (total+encoder.encode(json).length>MAX_BYTES-1048576) throw new Error('Os arquivos excedem o limite de 256 MB. Exporte os dados em JSON e utilize o backup de arquivos do servidor.');
    entries.push(['dados.json',json]);
    let downloaded=0;
    for (let i=0;i<data.storage_objects.length;i++) {
      const object=data.storage_objects[i];
      progress(`Copiando e verificando arquivo ${i+1} de ${data.storage_objects.length}...`);
      const result=await client.storage.from(object.bucket).download(object.path);
      if (result.error || !result.data) throw new Error(`Não foi possível copiar o arquivo ${i+1}. O ZIP foi cancelado.`);
      const content=new Uint8Array(await result.data.arrayBuffer()); downloaded+=content.length;
      if (content.length!==object.size || downloaded>MAX_BYTES-1048576) throw new Error('Tamanho de arquivo divergente ou limite excedido. O ZIP foi cancelado.');
      const entry=`files/${String(i+1).padStart(6,'0')}`;
      files.push({...object,entry,sha256:await sha256(content)}); entries.push([entry,content]);
    }
    progress('Conferindo se os dados e os arquivos permaneceram estáveis...');
    const after=await snapshot(client);
    if (JSON.stringify(after.tables)!==JSON.stringify(data.tables) || JSON.stringify(after.storage_objects)!==JSON.stringify(data.storage_objects)) {
      throw new Error('Os dados mudaram durante a cópia. Gere novamente quando não houver alterações em andamento.');
    }
    entries.push(['manifesto.json',JSON.stringify(manifest,null,2)]);
    entries.push(['LEIA-ME.txt','Exportação administrativa Camila Martins Engenharia\n\n'+data.limitations.join('\n')+
      '\n\nConfira os hashes SHA-256 do manifesto antes de restaurar. O manifesto relaciona cada entrada files/ ao bucket e caminho originais.\nNão importe diretamente sobre dados existentes: recibos, aceites e snapshots exigem restauração administrativa controlada.']);
    return {blob:zip(entries),manifest};
  }
  async function run(includeFiles, progress=()=>{}) {
    if (running) throw new Error('Uma exportação já está em andamento.');
    running=true;
    try {
      const result=await collect(window.supabaseClient,includeFiles,progress);
      const url=URL.createObjectURL(result.blob), a=document.createElement('a');
      a.href=url; a.download=`camila-martins-dados-${new Date().toISOString().replace(/[:.]/g,'-')}.${includeFiles?'zip':'json'}`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),30000);
      return result.manifest;
    } finally { running=false; }
  }
  window.CMEAdminBackup={run,collect,validate,zip,sha256};
})();
