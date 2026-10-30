/* Revisão V17 em GLB binário: preserva todos os nós e as texturas do SketchUp;
   recompõe coberturas e gramado, elimina faces órfãs e calibra materiais PBR.
   Executado ao abrir a maquete, sem alterar arquivos-base usados em outras páginas. */
export function upgradeUrbenGLB(buffer) {
  const bytes = new Uint8Array(buffer);
  const dv = new DataView(buffer);
  if (dv.getUint32(0, true) !== 0x46546c67 || dv.getUint32(4, true) !== 2) {
    throw Error('Casa Urben: GLB de origem inválido');
  }
  const jsonLen = dv.getUint32(12, true);
  const binHeaderOffset = 20 + jsonLen;
  const binLen = dv.getUint32(binHeaderOffset, true);
  const originalBin = bytes.subarray(binHeaderOffset + 8, binHeaderOffset + 8 + binLen);
  const j = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLen)));
  const newParts = [];
  let totalBinLen = originalBin.length;
  function append(data) {
    const pad = (4 - totalBinLen % 4) % 4;
    if (pad) { newParts.push(new Uint8Array(pad)); totalBinLen += pad; }
    const start = totalBinLen;
    const part = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    newParts.push(part);
    totalBinLen += part.byteLength;
    return start;
  }
  function addAccessor(data, componentType, type, target) {
    const pos = append(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
    const vi = j.bufferViews.length;
    j.bufferViews.push({buffer: 0, byteOffset: pos, byteLength: data.byteLength, target});
    const ai = j.accessors.length;
    j.accessors.push({bufferView: vi, byteOffset: 0, componentType, count:
      data.length / (type === 'VEC3' ? 3 : type === 'VEC2' ? 2 : 1), type});
    return ai;
  }
  const mat = j.materials;
  const adjust=(i,o)=>{const m=mat[i];if(!m)return;Object.assign(m.pbrMetallicRoughness,o);};
  adjust(0,{roughnessFactor:.66,metallicFactor:.04});
  adjust(1,{roughnessFactor:.09,metallicFactor:.01});
  adjust(2,{roughnessFactor:1,metallicFactor:0,baseColorFactor:[.84,.90,.79,1]});
  adjust(6,{roughnessFactor:.82,metallicFactor:0});
  adjust(28,{roughnessFactor:.39,metallicFactor:0});
  adjust(29,{baseColorFactor:[.35,.67,.76,.52],roughnessFactor:.08,metallicFactor:0});
  if(mat[29]){mat[29].alphaMode='BLEND';mat[29].doubleSided=true;}
  for(const i of [1,10,14,20]){
    if(!mat[i])continue;
    if(i!==1)adjust(i,{roughnessFactor:.13,metallicFactor:0});
    mat[i].alphaMode='BLEND';mat[i].doubleSided=true;mat[i].extras={surfaceType:'glass'};
  }
  function updateMesh(name, tris, y, uvScale) {
    const m = j.meshes.find(mesh => mesh.name === name);
    if(!m)throw Error('Casa Urben: geometria indisponível: ' + name);
    const pos=[],normal=[],uv=[],indices=[];
    for(const triangle of tris){
      let t=triangle;
      const a=t[0],b=t[1],c=t[2];
      const cross=(b[1]-a[1])*(c[0]-a[0])-(b[0]-a[0])*(c[1]-a[1]);
      if(cross < 0)t=[a,c,b];
      for(const p of t){
        indices.push(pos.length/3);
        pos.push(p[0],y,p[1]);
        normal.push(0,1,0);
        uv.push(p[0]*uvScale,p[1]*uvScale);
      }
    }
    const prim=m.primitives[0];
    prim.attributes = {
      POSITION: addAccessor(new Float32Array(pos),5126,'VEC3',34962),
      NORMAL: addAccessor(new Float32Array(normal),5126,'VEC3',34962),
      TEXCOORD_0: addAccessor(new Float32Array(uv),5126,'VEC2',34962)
    };
    prim.indices=addAccessor(new Uint32Array(indices),5125,'SCALAR',34963);
  }
  updateMesh('Urben_Cobertura_Principal_Membrana_Continua',[
    [[-4.747,16.218],[.098,11.853],[-4.747,6.583]],
    [[-4.747,16.218],[.098,16.218],[.098,11.853]],
    [[4.805,11.853],[.714,6.583],[.098,11.853]],
    [[4.805,11.853],[4.805,4.703],[.714,6.583]],
    [[4.805,4.703],[.714,4.703],[.714,6.583]],
    [[-4.747,6.583],[.098,11.853],[-1.589,7.094]],
    [[.098,11.853],[-.486,7.094],[-1.589,7.094]],
    [[.098,11.853],[.714,6.583],[-.486,7.094]]
  ],4.181,.3);
  updateMesh('Urben_Cobertura_Fundos_Membrana_Continua',[
    [[-4.717,6.483],[-4.367,6.483],[-4.717,1.302]],
    [[-4.367,6.633],[-.186,6.633],[-4.367,6.483]],
    [[-.186,6.633],[.764,4.753],[-4.367,6.483]],
    [[-.186,6.633],[.764,6.633],[.764,4.753]],
    [[4.755,4.753],[4.755,4.603],[.764,4.753]],
    [[4.805,4.603],[4.805,.26],[4.755,4.603]],
    [[1.082,-9.066],[-4.717,-2.499],[-.189,-.787]],
    [[1.082,-9.066],[-4.717,-9.066],[-4.717,-2.499]],
    [[-4.717,-2.499],[-4.717,1.302],[-.189,-.787]],
    [[-4.717,1.302],[1.082,.26],[-.189,-.787]],
    [[-4.717,1.302],[.764,4.753],[1.082,.26]],
    [[-4.717,1.302],[-4.367,6.483],[.764,4.753]],
    [[.764,4.753],[4.755,4.603],[1.082,.26]],
    [[4.755,4.603],[4.805,.26],[1.082,.26]]
  ],2.982,.3);
  updateMesh('Urben_Gramado_Recortado_Fora_Do_Tanque',[
    [[.9,-.32],[5.948,-9.525],[.9,-9.525]],
    [[.9,-.32],[5.948,-.32],[5.948,-9.525]],
    [[5.948,-24.209],[4.65,-20.14],[5.948,-9.525]],
    [[5.948,-24.209],[-2.39,-20.14],[4.65,-20.14]],
    [[5.948,-24.209],[-5.702,-24.209],[-2.39,-20.14]],
    [[-5.702,-24.209],[-5.702,-9.525],[-2.39,-20.14]],
    [[-5.702,-9.525],[-2.39,-13.09],[-2.39,-20.14]],
    [[-5.702,-9.525],[.9,-9.525],[-2.39,-13.09]],
    [[.9,-9.525],[4.65,-13.09],[-2.39,-13.09]],
    [[.9,-9.525],[5.948,-9.525],[4.65,-13.09]],
    [[5.948,-9.525],[4.65,-20.14],[4.65,-13.09]]
  ],-.021,.9);
  // Substitui por triângulos degenerados as 4 faces triangulares avulsas do piso externo.
  function clearFaces(meshName, faces) {
    const m=j.meshes.find(mesh=>mesh.name===meshName);
    if(!m)return;
    const ac=j.accessors[m.primitives[0].indices],v=j.bufferViews[ac.bufferView];
    const stride=ac.componentType===5125?4:2,offset=binHeaderOffset+8+(v.byteOffset||0)+(ac.byteOffset||0);
    for(const face of faces)for(let k=1;k<3;k++){
      const addr=offset+stride*(face*3+k);
      if(stride===4)dv.setUint32(addr,dv.getUint32(offset+stride*face*3,true),true);
      else dv.setUint16(addr,dv.getUint16(offset+stride*face*3,true),true);
    }
  }
  clearFaces('pavers_004',[1050,1052,1055,1057]);
  clearFaces('glass_001',[0]);
  // Textura de gramado recriada proceduralmente apenas sobre a superfície já recortada.
  // Mantém todos os demais mapas originais de pedra, madeira, pintura, vidro e cerâmica.
  if(typeof document!=='undefined' && j.textures?.[6] && j.images){
    const cn=document.createElement('canvas');cn.width=cn.height=512;
    const ctx=cn.getContext('2d');const pixels=ctx.createImageData(512,512);
    let seed=428;
    for(let i=0;i<pixels.data.length;i+=4){
      seed=(1664525*seed+1013904223)>>>0;
      const grain=(seed/4294967296-.5)*30,band=Math.sin((i/4%512)*.045+Math.floor(i/4/512)*.07)*9;
      pixels.data[i]=77+grain*.7+band*.5;
      pixels.data[i+1]=103+grain+band;
      pixels.data[i+2]=58+grain*.55+band*.4;
      pixels.data[i+3]=255;
    }
    ctx.putImageData(pixels,0,0);
    const b64=cn.toDataURL('image/png').split(',')[1],raw=atob(b64);
    const imageData=Uint8Array.from(raw,c=>c.charCodeAt(0));
    const start=append(imageData);
    const bi=j.bufferViews.length;j.bufferViews.push({buffer:0,byteOffset:start,byteLength:imageData.length});
    const newImage=j.images.length;j.images.push({bufferView:bi,mimeType:'image/png',name:'Casa Urben V17 grass texture'});
    j.textures[6].source=newImage;
  }
  const padBin=(4-totalBinLen%4)%4;if(padBin){newParts.push(new Uint8Array(padBin));totalBinLen+=padBin;}
  j.buffers[0].byteLength=totalBinLen;
  j.asset.generator='Camila Martins Engenharia | Casa Urben V17 (revisão sobre geometria V16)';
  j.extras={...(j.extras||{}),revision:'V17',publishedIn:'portfolio'};
  const encode=new TextEncoder().encode(JSON.stringify(j));
  const jsonPadding=(4-encode.length%4)%4;
  const paddedJSON=new Uint8Array(encode.length+jsonPadding);paddedJSON.set(encode);paddedJSON.fill(32,encode.length);
  const length=12+8+paddedJSON.length+8+totalBinLen;
  const output=new Uint8Array(length);const o=new DataView(output.buffer);
  o.setUint32(0,0x46546c67,true);o.setUint32(4,2,true);o.setUint32(8,length,true);
  o.setUint32(12,paddedJSON.length,true);o.setUint32(16,0x4e4f534a,true);
  output.set(paddedJSON,20);
  const binOff=20+paddedJSON.length;
  o.setUint32(binOff,totalBinLen,true);o.setUint32(binOff+4,0x004e4942,true);
  output.set(originalBin,binOff+8);
  let off=binOff+8+originalBin.length;
  for(const part of newParts){output.set(part,off);off+=part.length;}
  return output.buffer;
}
