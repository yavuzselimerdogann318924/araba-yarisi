import * as T from './vendor/three.module.js';
import {marshalFace as data} from './marshal-face.js';
const point=i=>new T.Vector3().fromArray(data.positions,i*3);
function curve(parent,ids,material,radius=.003){const path=new T.CatmullRomCurve3(ids.map(i=>point(i).add(new T.Vector3(0,0,.0015))));const m=new T.Mesh(new T.TubeGeometry(path,24,radius,6,false),material);parent.add(m);}
function patch(parent,vertices,indices,material){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();const m=new T.Mesh(g,material);m.castShadow=true;parent.add(m);return m;}
export function makeFittedHead(parent,{skin,lips,brow,eyes,iris,pupil}){
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(data.positions,3));geometry.setIndex(data.indices);geometry.computeVertexNormals();
 let start=0;for(let i=1;i<=data.groups.length;i++)if(i===data.groups.length||data.groups[i]!==data.groups[start]){geometry.addGroup(start*3,(i-start)*3,data.groups[start]);start=i;}
 const face=new T.Mesh(geometry,[skin,lips]);face.name='reference-fitted-face';face.castShadow=true;parent.add(face);
 // Continuous face outline closes into a rounded skull, rather than a face plane on a sphere.
 const outline=[10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];
 const vertices=[],indices=[],n=outline.length;
 for(let j=0;j<=6;j++){const a=j/6*Math.PI/2;for(const id of outline){const p=point(id);vertices.push(p.x*Math.cos(a),p.y*Math.cos(a),p.z*(1-Math.sin(a))-.11*Math.sin(a));}}
 for(let j=0;j<6;j++)for(let i=0;i<n;i++){const a=j*n+i,b=j*n+(i+1)%n;indices.push(a,b,a+n,b,b+n,a+n);}const shellMaterial=skin.clone();shellMaterial.side=T.DoubleSide;patch(parent,vertices,indices,shellMaterial);
 for(const ids of data.eyes){
  const points=ids.map(point),center=points.reduce((a,p)=>a.add(p),new T.Vector3()).multiplyScalar(1/points.length);
  const verts=[],triangles=[],count=points.length;
  // Sculpted sclera, iris and pupil rings clipped to the measured eyelid opening.
  for(let ring=0;ring<4;ring++)for(const p of points){const dx=p.x-center.x,dy=p.y-center.y,d=Math.hypot(dx,dy),r=ring===0?1:ring===1?Math.min(.009/d,.94):ring===2?Math.min(.0043/d,.45):0;verts.push(center.x+dx*r,center.y+dy*r,ring===0?p.z:center.z+.0015);}
  for(let ring=0;ring<3;ring++)for(let i=0;i<count;i++){const a=ring*count+i,b=ring*count+(i+1)%count;triangles.push(a,b,a+count,b,b+count,a+count);}
  const mats=[eyes,iris,pupil].map(m=>{const c=m.clone();c.side=T.DoubleSide;return c;});const eye=patch(parent,verts,triangles,mats);eye.geometry.clearGroups();for(let i=0;i<3;i++)eye.geometry.addGroup(i*count*6,count*6,i);
  const dot=new T.Mesh(new T.SphereGeometry(.0013,8,6),eyes);dot.position.copy(center).add(new T.Vector3(-.002,.002,.0028));parent.add(dot);
 }
 for(const ids of data.brows)curve(parent,ids,brow,.0035);
 const inner=data.mouth.map(point),center=inner.reduce((a,p)=>a.add(p),new T.Vector3()).multiplyScalar(1/inner.length);center.z-=.001;
 const mouthVertices=[...center.toArray(),...inner.flatMap(p=>[p.x,p.y,p.z-.0006])],mouthIndices=[];for(let i=0;i<inner.length;i++)mouthIndices.push(0,i+1,(i+1)%inner.length+1);
 const mouthMaterial=new T.MeshStandardMaterial({color:0x603b3e,roughness:.85,side:T.DoubleSide});patch(parent,mouthVertices,mouthIndices,mouthMaterial);
 parent.userData.referenceFitted=true;parent.userData.landmarkCount=data.vertexCount;
 return face;
}
