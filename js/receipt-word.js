/* Native, editable OOXML (.docx). No HTML disguised as a Word document. */
(function () {
  'use strict';
  const xml = value => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const encoder = new TextEncoder();
  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) { crc ^= byte; for(let bit=0;bit<8;bit++) crc=(crc>>>1)^((crc&1)?0xedb88320:0); }
    return (crc ^ 0xffffffff) >>> 0;
  }
  function zip(files) {
    const parts=[], central=[]; let offset=0, centralSize=0;
    for (const [filename,content] of Object.entries(files)) {
      const name=encoder.encode(filename),data=encoder.encode(content),checksum=crc32(data);
      const local=new Uint8Array(30+name.length),lv=new DataView(local.buffer);
      lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint16(6,0x800,true);lv.setUint16(12,33,true);lv.setUint32(14,checksum,true);lv.setUint32(18,data.length,true);lv.setUint32(22,data.length,true);lv.setUint16(26,name.length,true);local.set(name,30);
      const directory=new Uint8Array(46+name.length),dv=new DataView(directory.buffer);
      dv.setUint32(0,0x02014b50,true);dv.setUint16(4,20,true);dv.setUint16(6,20,true);dv.setUint16(8,0x800,true);dv.setUint16(14,33,true);dv.setUint32(16,checksum,true);dv.setUint32(20,data.length,true);dv.setUint32(24,data.length,true);dv.setUint16(28,name.length,true);dv.setUint32(42,offset,true);directory.set(name,46);
      parts.push(local,data);central.push(directory);offset+=local.length+data.length;centralSize+=directory.length;
    }
    const end=new Uint8Array(22),ev=new DataView(end.buffer),count=central.length;
    ev.setUint32(0,0x06054b50,true);ev.setUint16(8,count,true);ev.setUint16(10,count,true);ev.setUint32(12,centralSize,true);ev.setUint32(16,offset,true);
    return new Blob([...parts,...central,end],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
  }
  function paragraph(text,{bold=false,size=24,align='left',before=0,after=180,title=false}={}) {
    const runs=String(text).split('\n').map((line,i)=>`${i?'<w:r><w:br/></w:r>':''}<w:r><w:rPr>${bold?'<w:b/>':''}<w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${xml(line)}</w:t></w:r>`).join('');
    return `<w:p><w:pPr>${title?'<w:pStyle w:val="Title"/>':''}<w:jc w:val="${align}"/><w:spacing w:before="${before}" w:after="${after}" w:line="320" w:lineRule="auto"/><w:widowControl/></w:pPr>${runs}</w:p>`;
  }
  function build(row) {
    if(!row?.id || !row.snapshot?.issuer) throw new Error('Abra um recibo emitido antes de salvar em Word.');
    const s=row.snapshot,issued=new Date(row.created_at).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}),formatDate=d=>String(d).slice(0,10).split('-').reverse().join('/');
    const number=`REC-${String(row.receipt_number).padStart(6,'0')}/${issued.slice(0,4)}`,amount=Number(row.amount).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    const body=[paragraph('Camila Martins Engenharia',{bold:true,size:28}),paragraph(s.issuer.title||'Prestação de serviços',{size:20,after:400}),paragraph('Recibo de prestação de serviços',{title:true,bold:true,size:36}),paragraph(number,{bold:true,after:320}),paragraph(amount,{bold:true,size:36,align:'right',after:320}),paragraph(`Recebi de ${s.payer_name}${s.payer_document?', CPF/CNPJ '+s.payer_document:''}, a importância de ${amount}, referente a:`),paragraph(row.description,{after:320}),paragraph(`Projeto: ${s.project_name}${s.contract_number?'\nContrato: '+s.contract_number:''}\nRecebimento: ${formatDate(row.paid_on)}\nForma de pagamento: ${row.payment_method}`),paragraph(`${s.city}, ${formatDate(issued)}.`),paragraph('________________________________________',{align:'center',before:800,after:80}),paragraph(`${s.issuer.name}\nCPF/CNPJ: ${s.issuer.document}`,{align:'center',after:300}),paragraph(`Emitido em ${new Date(row.created_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})} · ${number}`,{size:18})].join('');
    const declaration='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    return zip({
      '[Content_Types].xml':declaration+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
      '_rels/.rels':declaration+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      'word/document.xml':declaration+`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567"/></w:sectPr></w:body></w:document>`,
      'word/styles.xml':declaration+'<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:color w:val="000000"/><w:sz w:val="24"/><w:lang w:val="pt-BR"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:color w:val="000000"/><w:sz w:val="36"/></w:rPr></w:style></w:styles>',
      'word/_rels/document.xml.rels':declaration+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    });
  }
  window.CMEReceiptWord={build};
})();
