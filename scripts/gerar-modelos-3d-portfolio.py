#!/usr/bin/env python3
"""Reconstrucoes arquitetonicas aproximadas a partir de videos/referencias.
Nao representa a geometria executiva original dos projetos.
Gera GLB otimizado para visualizacao 3D web.
"""
from __future__ import annotations
import math
import random
from pathlib import Path
import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial
from trimesh.visual import TextureVisuals

ROOT=Path("assets/projetos")
rng=random.Random(29)

COLORS={
 "cream":((218,214,196,255),.9,0),
 "white":((234,231,219,255),.92,0),
 "stucco":((212,206,195,255),.96,0),
 "warmgray":((167,159,151,255),.92,0),
 "taupe":((126,96,90,255),.92,0),
 "taupe2":((146,115,109,255),.93,0),
 "wood":((110,66,39,255),.65,0),
 "wood2":((147,95,55,255),.68,0),
 "woodlight":((175,122,71,255),.68,0),
 "black":((23,25,27,255),.55,.35),
 "coal":((40,40,43,255),.75,.18),
 "steel":((79,81,85,255),.4,.66),
 "aluminium":((128,127,125,255),.38,.65),
 "glazing":((28,47,55,255),.09,.42),
 "glazing2":((44,65,69,255),.10,.35),
 "glow":((223,174,98,255),.31,.05),
 "linen":((216,205,180,255),.88,0),
 "stone1":((104,95,81,255),.99,0),
 "stone2":((144,130,109,255),.98,0),
 "stone3":((170,150,122,255),.98,0),
 "stone4":((117,111,99,255),.98,0),
 "concrete":((157,154,148,255),.95,0),
 "paving":((117,117,116,255),.9,0),
 "grass":((64,83,56,255),.99,0),
 "hedge":((42,77,46,255),.99,0),
 "green":((75,100,61,255),.99,0),
 "foliage":((55,103,64,255),.99,0),
 "soil":((99,85,64,255),.99,0),
 "carblack":((19,23,27,255),.3,.52),
 "carwhite":((204,206,205,255),.34,.32),
 "rubber":((26,27,28,255),.9,0),
}
class Model:
 def __init__(self):
  self.buckets={}
  self.mats={}
  for key,(rgba,rough,metal) in COLORS.items():
   emissive=[0.7,0.35,0.08] if key=="glow" else [0,0,0]
   self.mats[key]=PBRMaterial(name=key,baseColorFactor=list(rgba),
      roughnessFactor=rough,metallicFactor=metal,emissiveFactor=emissive,
      doubleSided=True)
 def add(self,key,mesh):
  self.buckets.setdefault(key,[]).append(mesh)
 def box(self,key,x,y,z,w,d,h):
  if min(w,d,h)<=0: return
  obj=trimesh.creation.box(extents=(w,d,h))
  obj.apply_translation((x,y,z))
  self.add(key,obj)
 def cyl(self,key,x,y,z,r,height,axis="z",sections=12):
  obj=trimesh.creation.cylinder(radius=r,height=height,sections=sections)
  if axis=="x": obj.apply_transform(trimesh.transformations.rotation_matrix(math.pi/2,(0,1,0)))
  if axis=="y": obj.apply_transform(trimesh.transformations.rotation_matrix(math.pi/2,(1,0,0)))
  obj.apply_translation((x,y,z))
  self.add(key,obj)
 def ball(self,key,x,y,z,r,subdivisions=1):
  obj=trimesh.creation.icosphere(subdivisions=subdivisions,radius=r)
  obj.apply_translation((x,y,z))
  self.add(key,obj)
 def frame(self,x,y,z,w,h,depth=.09,wood=False,cols=1,rows=1):
  c="wood2" if wood else "black"
  self.box("glazing",x,y,z,w-.04,.025,h-.04)
  self.box(c,x-w/2,y,z,.07,depth,h)
  self.box(c,x+w/2,y,z,.07,depth,h)
  self.box(c,x,y,z+h/2,w,depth,.07)
  self.box(c,x,y,z-h/2,w,depth,.08)
  for i in range(1,cols):
   self.box(c,x-w/2+w*i/cols,y-.008,z,.037,depth+.01,h)
  for i in range(1,rows):
   self.box(c,x,y-.009,z-h/2+h*i/rows,w,depth+.01,.035)
 def doors(self,x,y,z,w=1.65,h=2.25,cols=2,rows=4):
  self.frame(x,y,z,w,h,cols=cols,rows=rows)
  self.ball("aluminium",x+.2,y-.09,z-.12,.033)
 def shrub(self,x,y,z=0,r=.23):
  self.cyl("wood",x,y,z+.17,.028,.34,sections=8)
  self.ball("green",x,y,z+.38,r)
  self.ball("hedge",x+r*.28,y-r*.12,z+.49,r*.72)
 def tree(self,x,y,h=2.3):
  self.cyl("wood",x,y,h*.36,.085,h*.72,sections=9)
  for dx,dy,dz,rad in [(-.4,0,.72,.53),(.3,.18,.88,.57),(.03,-.2,.55,.6)]:
   self.ball("foliage",x+dx,y+dy,h*.65+dz,rad,subdivisions=2)
 def site(self,w,d,green=True):
  self.box("soil",0,0,-.145,w+2.0,d+3,.26)
  self.box("grass" if green else "paving",0,0,-.01,w+.8,d+2,.04)
 def export(self,path):
  scene=trimesh.Scene()
  for key,objects in self.buckets.items():
   joined=trimesh.util.concatenate(objects)
   joined.visual=TextureVisuals(material=self.mats[key])
   scene.add_geometry(joined,geom_name=key)
  # A modelagem foi construida em Z-up; GLTF utiliza Y-up.
  matrix=trimesh.transformations.rotation_matrix(-math.pi/2,(1,0,0))
  scene.apply_transform(matrix)
  path.parent.mkdir(parents=True,exist_ok=True)
  path.write_bytes(scene.export(file_type="glb"))
  print(f"{path}: {path.stat().st_size:,} bytes; {len(self.buckets)} materiais")
def tiny():
 m=Model();W=9.4;D=5.6;front=-D/2
 m.site(W,D,True)
 m.box("cream",0,0,1.42,W,D,2.84)
 # painel de madeira sob o telhado ligeiramente inclinado
 m.box("woodlight",0,0,2.88,W+.6,D+.6,.19)
 roof=trimesh.creation.box(extents=(W+.75,D+.75,.24))
 roof.apply_transform(trimesh.transformations.rotation_matrix(-.045,(1,0,0)))
 roof.apply_translation((0,0,3.02))
 m.add("taupe",roof)
 for x in [-4.22,-1.7,1.6,4.23]:
  m.box("wood2",x,front-.075,1.48,.22,.2,2.96)
 for x,w,z,h in [(-2.83,1.78,1.56,1.37),(0,1.62,1.45,2.27),(2.9,1.75,1.55,1.85)]:
  if abs(x)<.1: m.doors(x,front-.115,z,w,h,cols=2,rows=4)
  else: m.frame(x,front-.12,z,w,h,cols=2,rows=1)
 for i in range(6):
  x=-3.8+i*1.45
  m.box("wood2",x,D/2+.04,1.45,.13,.11,2.9)
 m.frame(-2,D/2+.09,1.54,1.5,1.46,cols=2)
 m.frame(2.5,D/2+.09,1.54,1.6,1.55,cols=2)
 for side in [-1,1]:
  xx=side*(W/2+.04)
  m.box("wood2",xx,0,1.5,.09,.16,2.98)
  m.frame(xx,0,1.56,1.45,1.45,cols=2) if False else None
 for x in [-4.25,-1.72,1.62,4.2]:
  m.box("glow",x,front-.17,.35,.12,.08,.18)
 for x in [-4.65,4.65]:
  m.shrub(x,front-.65,r=.38)
 m.tree(-5.6,2.2,2.5)
 for x in [-3.7,-2.8,2.5,3.45]:
  m.shrub(x,front-.6,r=.23)
 for j in range(5):
  m.box("concrete",0,front-1.0-j*.43,-.015,1.9,.34,.06)
 m.export(ROOT/"tiny-house-signature"/"modelo-3d-aproximado.glb")
def vitalle():
 m=Model();W=12.3;D=11.8;front=-D/2
 m.site(W,D,False)
 # tres sobrados contiguos, volumetria referencial, nao executiva
 m.box("white",0,0,1.65,W,D,3.3)
 m.box("taupe",0,0,4.68,W,D,2.76)
 m.box("taupe2",0,front-.03,6.05,W,.12,.18)
 m.box("taupe",0,0,6.13,W+.25,D+.16,.20)
 for c in [-4.1,0,4.1]:
  m.box("stucco",c,front-.18,1.7,3.92,.22,3.1)
  m.frame(c-.55,front-.31,1.9,1.35,1.25,cols=2)
  m.box("taupe2",c,front-.25,4.6,3.9,.18,2.7)
  m.box("warmgray",c,front-.44,4.65,2.38,.21,2.2)
  m.doors(c,front-.58,4.74,1.64,2.12,cols=2,rows=3)
  m.box("concrete",c,front-.98,3.55,2.65,.8,.13)
  # guarda-corpo de vidro: faixa translucida simulada com tom frio
  m.box("glazing2",c,front-1.35,3.97,2.52,.04,.86)
  m.box("black",c,front-1.38,4.41,2.65,.047,.052)
  for dx in [-1.27,1.27]:
   m.box("black",c+dx,front-1.36,3.95,.045,.09,.9)
  m.frame(c-1.45,front-.3,5.03,.44,.44)
  # muro frontal, portao horizontal com ripas
  ygate=front-3.45
  m.box("taupe",c,ygate,1.15,4.08,.29,2.3)
  m.box("coal",c,ygate-.19,1.13,3.33,.06,2.12)
  for zz in np.arange(.24,2.14,.18):
   m.box("black",c,ygate-.245,float(zz),3.31,.04,.055)
  m.box("glow",c+1.83,ygate-.27,1.40,.08,.06,.22)
  for y in np.linspace(-1.4,D/2-.8,3):
   m.frame(c+.7,y,4.9,1.65,1.25,cols=2)
 for x in [-W/2,-W/6,W/6,W/2]:
  m.box("taupe2",x,front-3.5,1.16,.16,.4,2.32)
 for x in [-6.0,-4.0,-2.0,0,2.0,4.0,6.0]:
  m.shrub(x,front-3.86,0,.18)
 m.tree(-7.6,front+1,3.5)
 m.tree(7.6,D/2-1,2.8)
 m.export(ROOT/"empreendimento-vitalle"/"modelo-3d-aproximado.glb")
def car(m,x,y,z,color):
 m.box(color,x,y,z+.55,1.68,3.45,.68)
 m.box(color,x,y+.2,z+1.05,1.48,1.72,.62)
 m.box("glazing",x,y-.69,z+1.16,1.27,.06,.4)
 m.box("glazing",x,y+.91,z+1.16,1.26,.06,.41)
 for xx in [-.86,.86]:
  for yy in [-1.13,1.12]:
   m.cyl("rubber",x+xx,y+yy,z+.34,.36,.2,axis="x")
   m.cyl("aluminium",x+(xx+.11 if xx>0 else xx-.11),y+yy,z+.34,.20,.035,axis="x")
 for xx in [-.49,.49]:
  m.box("glow",x+xx,y-1.755,z+.60,.33,.055,.13)
def urben():
 m=Model();W=15.8;D=10.3;front=-D/2
 m.site(W,D,True)
 m.box("coal",0,1,1.65,W-1.0,D-1.2,3.3)
 # volume de pedra alto a esquerda e fachada ripada
 m.box("stone1",-5.9,.6,3.24,4.0,8.0,6.48)
 m.box("black",-5.7,.6,6.58,4.65,8.6,.34)
 # revestimento pedra com juntas irregulares
 for k in range(10):
  zz=.38+k*.59
  xx=-7.68
  while xx<-4.10:
   ww=min(rng.uniform(.35,.95),-4.1-xx)
   key=rng.choice(["stone1","stone2","stone3","stone4"])
   m.box(key,xx+ww/2,front-.13,zz,ww-.035,.09,.55)
   xx+=ww
 m.box("wood", -3.2,front-.28,4.05,1.16,.22,4.6)
 for x in np.arange(-3.75,-2.6,.14):
  m.box("woodlight",float(x),front-.43,4.2,.07,.12,4.0)
 # cobertura horizontal garagem
 m.box("black",2.2,front-1.95,3.54,11.75,5.2,.48)
 m.box("wood2",2.2,front-1.95,3.22,11.45,4.95,.13)
 m.box("black",2.2,front-1.95,3.06,11.68,.045,.075)
 for x in [-2.5,-.25,2,4.25,6.4]:
  m.box("glow",x,front-3.85,3.12,.16,.11,.09)
 # detalhe de fita LED com curvas ortogonais
 m.box("glow",2.2,front-4.25,3.10,9.8,.035,.04)
 m.box("glow",2.2,front+.15,3.10,9.8,.035,.04)
 m.box("glow",-2.68,front-2.1,3.10,.04,4.15,.04)
 m.box("glow",7.06,front-2.1,3.10,.04,4.15,.04)
 # parede atras da garagem, com ripado central
 m.box("warmgray",2.2,front+2.1,1.56,11.0,.25,3.1)
 for x in np.arange(2.4,5.9,.19):
  m.box("wood",float(x),front+1.89,1.62,.09,.14,2.9)
 # fechamentos laterais e colunas
 m.box("coal",-3.80,front-1.7,1.56,.34,5.8,3.0)
 m.box("coal",7.75,front-1.7,1.56,.25,5.8,3.0)
 m.box("stone4",-7.8,front+2.4,.95,.38,5.4,1.9)
 m.frame(-4.25,front-.43,2.1,1.2,1.7,cols=2)
 # dois carros sob o pergolado
 car(m,0,front-2.1,.07,"carblack")
 car(m,4.2,front-2.05,.07,"carwhite")
 for x in [-7.1,-4.85,7.3]:
  m.shrub(x,front-4.75,r=.33)
 m.tree(-9.0,front-2.25,2.8)
 m.tree(9.0,front+.45,3.2)
 for i in range(6):
  m.box("concrete",0,front-4.6-i*.38,-.02,11.9,.26,.04)
 m.export(ROOT/"casa-urban"/"modelo-3d-aproximado.glb")
if __name__=="__main__":
 tiny();vitalle();urben()
