import * as T from './vendor/three.module.js';
import {marshalFace as data} from './marshal-face.js';
const point=i=>new T.Vector3().fromArray(data.positions,i*3);
function curve(parent,ids,material,radius=.003){const path=new T.CatmullRomCurve3(ids.map(i=>point(i).add(new T.Vector3(0,0,.0015))));const m=new T.Mesh(new T.TubeGeometry(path,24,radius,6,false),material);parent.add(m);}
function patch(parent,vertices,indices,material){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();const m=new T.Mesh(g,material);m.castShadow=true;parent.add(m);return m;}
export function makeFittedHead(parent,{skin,lips,brow,eyes,iris,pupil}){
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(data.positions,3));geometry.setIndex(data.indices);geometry.computeVertexNormals();
 geometry.setAttribute('uv',new T.Float32BufferAttribute(data.uv,2));
 const material=new T.MeshStandardMaterial({color:0xffffff,roughness:.86});
 const face=new T.Mesh(geometry,material);face.name='reference-fitted-face';face.castShadow=true;parent.add(face);
 face.userData.rest=Float32Array.from(data.positions);
 if(typeof document!=='undefined')new T.TextureLoader().load(new URL('./marshal-photo.png',import.meta.url).href,texture=>{texture.colorSpace=T.SRGBColorSpace;material.map=texture;material.needsUpdate=true;},undefined,()=>{material.color.copy(skin.color);});
 // Continuous face outline closes into a rounded skull, rather than a face plane on a sphere.
 const outline=[10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];
 const vertices=[],indices=[],n=outline.length;
 for(let j=0;j<=6;j++){const a=j/6*Math.PI/2;for(const id of outline){const p=point(id);vertices.push(p.x*Math.cos(a),p.y*Math.cos(a),p.z*(1-Math.sin(a))-.11*Math.sin(a));}}
 for(let j=0;j<6;j++)for(let i=0;i<n;i++){const a=j*n+i,b=j*n+(i+1)%n;indices.push(a,b,a+n,b,b+n,a+n);}const shellMaterial=skin.clone();shellMaterial.side=T.DoubleSide;patch(parent,vertices,indices,shellMaterial);
 parent.userData.referenceFitted=true;parent.userData.landmarkCount=data.vertexCount;
 return face;
}

export function animateFittedFace(head,time,speaking){
 const face=head.getObjectByName('reference-fitted-face');if(!face)return;
 const positions=face.geometry.attributes.position,rest=face.userData.rest;
 const mouthY=data.positions[14*3+1],mouthX=data.positions[14*3];
 const opening=speaking?(.5+.5*Math.sin(time*22))*.008:0;
 for(let i=0;i<positions.count;i++){
  const x=rest[i*3],y=rest[i*3+1],z=rest[i*3+2];
  const influence=Math.exp(-Math.pow((x-mouthX)/.058,2))*Math.max(0,Math.min(1,(mouthY+.007-y)/.045));
  positions.setXYZ(i,x,y-opening*influence,z+opening*.16*influence);
 }
 positions.needsUpdate=true;face.geometry.computeVertexNormals();
 head.rotation.x=speaking?Math.sin(time*8)*.025:0;
}
