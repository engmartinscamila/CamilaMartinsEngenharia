#!/usr/bin/env python3
"""Repara SOMENTE o encontro parede/telhado da Tiny House e o tom terroso da Vitalle.
Funciona sobre o pacote público e não exige dependências de terceiros.
"""
import json, struct, hashlib, pathlib, sys

ROOT=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else pathlib.Path('site-public')

def read_glb(src):
    if src[:4]!=b'glTF': raise ValueError('GLB inválido')
    size=struct.unpack_from('<I',src,8)[0]
    if size!=len(src):raise ValueError(f'GLB truncado: {size}!={len(src)}')
    p=12; chunks=[]
    while p<size:
        length,kind=struct.unpack_from('<II',src,p);p+=8
        chunks.append((kind,src[p:p+length]));p+=length
    j=json.loads(next(data for kind,data in chunks if kind==0x4e4f534a).rstrip(b' \x00'))
    b=next(data for kind,data in chunks if kind==0x004e4942)
    return j,bytearray(b)

def save_glb(dst,j,b):
    j['buffers'][0]['byteLength']=len(b)
    js=json.dumps(j,ensure_ascii=False,separators=(',',':')).encode('utf-8')
    js+=b' '*((-len(js))%4)
    b+=b'\x00'*((-len(b))%4)
    out=struct.pack('<III',0x46546c67,2,12+8+len(js)+8+len(b))
    out+=struct.pack('<II',len(js),0x4e4f534a)+js
    out+=struct.pack('<II',len(b),0x004e4942)+b
    dst.parent.mkdir(parents=True,exist_ok=True);dst.write_bytes(out)
    return out

def add_view(j,blob,payload,target=None):
    off=len(blob)
    blob.extend(payload)
    blob.extend(b'\x00'*((-len(blob))%4))
    v={'buffer':0,'byteOffset':off,'byteLength':len(payload)}
    if target:v['target']=target
    j['bufferViews'].append(v)
    return len(j['bufferViews'])-1

def add_accessor(j,v,component_type,count,kind,minimum=None,maximum=None):
    a={'bufferView':v,'byteOffset':0,'componentType':component_type,'count':count,'type':kind}
    if minimum is not None: a['min']=minimum
    if maximum is not None: a['max']=maximum
    j['accessors'].append(a)
    return len(j['accessors'])-1

def fix_tiny(base):
    path=base/'assets/projetos/tiny-house-signature/3d-aprovado'
    parts=sorted(path.glob('modelo-3d.glb.part*'))
    if len(parts)!=15:raise ValueError('Tiny House: 15 partes GLB esperadas; encontradas '+str(len(parts)))
    j,b=read_glb(b''.join(p.read_bytes() for p in parts))
    # Remove o remendo anterior, que nao segue a inclinação da cobertura.
    for node in j.get('nodes',[]):
        if 'fechamento_parede_alta_sob_telhado' in node.get('name',''):
            node.pop('mesh',None)
    # Fechamento com topo inclinado: o beiral sobe à esquerda e desce à direita.
    # Telhado existente: intradorso 3.462m no lado alto e 3.121m no baixo.
    # Avança apenas 2 mm sobre os limites para evitar luz na fresta.
    x0,x1=-4.708,4.708
    z0,z1=-2.504,2.504
    y0=2.91
    high,low=3.455,3.114
    p=[(x0,y0,z0),(x0,y0,z1),(x0,high,z0),(x0,high,z1),
       (x1,y0,z0),(x1,y0,z1),(x1,low,z0),(x1,low,z1)]
    # malha prismática 6 faces, normais individuais, UV por superfície
    face_quads=[(0,2,6,4),    # z negativo
                (1,5,7,3),    # z positivo
                (0,1,3,2),    # x negativo
                (4,6,7,5),    # x positivo
                (0,4,5,1),    # base inferior
                (2,3,7,6)]   # topo inclinado
    import math
    vertices=[];normals=[];uv=[];indices_by_material={'stucco_white':[],'stucco_mint':[]}
    for face_no,q in enumerate(face_quads):
        a,c,d=[p[q[i]] for i in [0,1,2]]
        u=[c[k]-a[k] for k in range(3)];v=[d[k]-a[k] for k in range(3)]
        cross=[u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]]
        length=math.sqrt(sum(t*t for t in cross)); n=[t/length for t in cross]
        base_idx=len(vertices)
        for k in q:
            x,y,z=p[k];vertices.append(p[k]);normals.append(n)
            # Revestimento PBR existente permanece, sem colar imagem no 3D.
            uv.append(((x-x0)/10 if face_no in (0,1,4,5) else (z-z0)/5,
                       (y-2.9)/3 if face_no<4 else (z-z0)/5))
        matkey = "stucco_white" if face_no in (0,2,4) else "stucco_mint"
        indices_by_material[matkey].extend((base_idx,base_idx+1,base_idx+2,base_idx,base_idx+2,base_idx+3))
    packed=lambda vs,code: struct.pack('<'+code*len(vs),*vs)
    flat=lambda xx:[v for a in xx for v in a]
    p_view=add_view(j,b,packed(flat(vertices),'f'),34962)
    n_view=add_view(j,b,packed(flat(normals),'f'),34962)
    uv_view=add_view(j,b,packed(flat(uv),'f'),34962)

    positions=add_accessor(j,p_view,5126,len(vertices),'VEC3',list(map(min,zip(*vertices))),list(map(max,zip(*vertices))))
    normal=add_accessor(j,n_view,5126,len(normals),'VEC3')
    tex=add_accessor(j,uv_view,5126,len(uv),'VEC2')
    primitives=[]
    for matkey,indices in indices_by_material.items():
        idx_view=add_view(j,b,packed(indices,'H'),34963)
        idx=add_accessor(j,idx_view,5123,len(indices),'SCALAR')
        material=next(i for i,m in enumerate(j['materials']) if m.get('name')==matkey)
        primitives.append({'attributes':{'POSITION':positions,'NORMAL':normal,'TEXCOORD_0':tex},'indices':idx,'material':material,'mode':4})
    j['meshes'].append({'name':'parede_continua_ate_telhado_inclinado','primitives':primitives})
    mesh_idx=len(j['meshes'])-1
    j['nodes'].append({'name':'parede_continua_ate_telhado_inclinado','mesh':mesh_idx})
    j['scenes'][j.get('scene',0)]['nodes'].append(len(j['nodes'])-1)
    result=save_glb(path/'modelo-3d-fechado.glb',j,b)
    print('Tiny House: fechamento contínuo; SHA256',hashlib.sha256(result).hexdigest(),'bytes',len(result))
    return len(result)

def fix_vitalle(base):
    path=base/'assets/projetos/empreendimento-vitalle/modelo-3d-v6-aprovado.glb'
    j,b=read_glb(path.read_bytes())
    # Escurece apenas pintura de alvenaria e muros. Pedra, madeira, vidro e metal inalterados.
    targets=('Pintura uniforme - Terracota suave','Muros laterais - tinta uniforme')
    changed=[]
    for m in j.get('materials',[]):
        name=m.get('name','')
        if name in targets:
            pbr=m.setdefault('pbrMetallicRoughness',{})
            pbr['baseColorFactor']=[177/255,137/255,123/255,1.0]
            changed.append(name)
    if len(changed)!=len(targets):raise ValueError('Materiais ausentes Vitalle: '+repr(set(targets)-set(changed)))
    result=save_glb(path,j,b)
    print('Vitalle: marrom uniforme #B1897B aplicado a',changed,'bytes',len(result))
    return len(result)

if __name__=='__main__':
    fix_tiny(ROOT)
    fix_vitalle(ROOT)