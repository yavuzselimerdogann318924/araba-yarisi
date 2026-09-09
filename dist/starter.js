import {makeFittedHead} from './fitted-head.js?v=face-6';
import * as T from './vendor/three.module.js';
import {ROAD_HALF,clamp} from './simulation.js';

// A fully geometric, stylized marshal. No photo textures or face-image UVs.
const mat=(color,roughness=.7,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
function ellipsoid(parent,material,position,scale){const m=new T.Mesh(new T.SphereGeometry(1,20,14),material);m.position.set(...position);m.scale.set(...scale);m.castShadow=true;parent.add(m);return m;}
function tube(parent,points,radius,material){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));const m=new T.Mesh(new T.TubeGeometry(curve,18,radius,7,false),material);m.castShadow=true;parent.add(m);return m;}
function garment(parent,rings,material){const vertices=[],indices=[],n=28;for(const [y,x,z] of rings)for(let i=0;i<=n;i++){const a=i/n*Math.PI*2,fold=1+.022*Math.cos(a*8);vertices.push(Math.sin(a)*x*fold,y,Math.cos(a)*z*fold);}for(let j=0;j<rings.length-1;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i,b=a+n+1;indices.push(a,a+1,b,a+1,b+1,b);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));if(rings[1][0]<rings[0][0])for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];g.setIndex(indices);g.computeVertexNormals();const m=new T.Mesh(g,material);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
export function makeStarter(){
 const root=new T.Group(),body=new T.Group();root.add(body);
 const skin=mat(0xc5957d,.82),cream=mat(0xf4ead4,.87),white=mat(0xe5e9ee,.92),hair=mat(0x30201c,.88),highlight=mat(0x5c3e2d,.82),gold=mat(0xd4ad62,.3,.75),eyes=mat(0xf4eee8,.5),iris=mat(0x594438,.48),pupil=mat(0x171516),lips=mat(0xa65d66,.72),brow=mat(0x352622);
 const hips=new T.Group();hips.position.y=.88;body.add(hips);
 garment(hips,[[-.07,.205,.125],[.06,.20,.125],[.18,.16,.10]],white);
 const torso=new T.Group();torso.position.y=.91;body.add(torso);
 garment(torso,[[0,.22,.135],[.14,.168,.106],[.27,.19,.125],[.38,.223,.128],[.40,.216,.125]],cream);
 // Draped satin hem and diagonal cloth folds.
 for(let i=0;i<3;i++)tube(torso,[[-.19,.02+i*.037,.11],[-.03,.07+i*.04,.124],[.18,.15+i*.028,.09]],.006,cream);
 ellipsoid(torso,skin,[0,.422,0],[.218,.075,.12]);
 ellipsoid(torso,skin,[0,.50,0],[.063,.115,.062]);
 const head=new T.Group();head.position.set(0,.665,.008);torso.add(head);
 makeFittedHead(head,{skin,lips,brow,eyes,iris,pupil});
 for(const side of [-1,1]){
  ellipsoid(head,skin,[side*.129,-.005,.018],[.018,.038,.020]);
  ellipsoid(head,gold,[side*.135,-.039,.023],[.008,.018,.006]);
 }
 // Crown mesh covers the back and crown, leaving the modeled face exposed.
 const cap=new T.Mesh(new T.SphereGeometry(1,24,14,0,Math.PI*2,0,1.33),hair);cap.scale.set(.137,.19,.123);cap.position.y=.012;head.add(cap);
 ellipsoid(head,hair,[0,.015,-.085],[.135,.153,.071]);
 for(const side of [-1,1])for(let i=0;i<10;i++){
  const x=side*(.060+i*.008),z=i<5?.045:-.028;
  tube(head,[[side*.012,.178,-.003],[x,.12,z],[side*(.13+i*.004),-.03,z],[side*(.138+i*.006),-.20,z+.012],[side*(.165+i*.005),-.37,z+.022],[side*(.142+i*.005),-.48,z+.035]],.012,i%5===0?highlight:hair);
 }
 tube(torso,[[-.12,.456,.073],[-.065,.405,.123],[0,.395,.132],[.067,.412,.115],[.12,.454,.072]],.0025,gold);
 ellipsoid(torso,gold,[0,.384,.137],[.009,.013,.003]);
 const legs=[],arms=[];
 for(const side of [-1,1]){
  const hip=new T.Group();hip.position.set(side*.104,.88,0);body.add(hip);
  garment(hip,[[0,.094,.108],[-.2,.108,.114],[-.43,.12,.122]],white);
  const knee=new T.Group();knee.position.y=-.43;hip.add(knee);
  garment(knee,[[0,.12,.122],[-.18,.128,.124],[-.37,.14,.13]],white);
  ellipsoid(knee,cream,[0,-.387,.039],[.082,.04,.15]);legs.push({hip,knee});
  const shoulder=new T.Group();shoulder.position.set(side*.223,.401,0);torso.add(shoulder);
  ellipsoid(shoulder,skin,[side*.008,-.125,0],[.045,.158,.048]);
  const elbow=new T.Group();elbow.position.set(side*.015,-.26,0);shoulder.add(elbow);
  ellipsoid(elbow,skin,[0,-.118,0],[.033,.14,.035]);
  ellipsoid(elbow,skin,[0,-.25,.004],[.031,.056,.024]);
  for(let i=0;i<4;i++)ellipsoid(elbow,skin,[-.021+i*.014,-.293,.01],[.006,.025-i*.002,.007]);
  const bracelet=new T.Mesh(new T.TorusGeometry(.036,.004,6,16),gold);bracelet.rotation.x=Math.PI/2;bracelet.position.y=-.206;elbow.add(bracelet);
  arms.push({shoulder,elbow});
 }
 const flag=new T.Group();flag.position.set(0,-.26,.02);flag.rotation.z=Math.PI;arms[1].elbow.add(flag);
 const pole=new T.Mesh(new T.CylinderGeometry(.009,.009,.78,8),mat(0x514840,.4,.3));pole.position.y=.3;flag.add(pole);
 const flagGeometry=new T.PlaneGeometry(.65,.43,12,8);flagGeometry.translate(.335,.46,0);
 const flagMaterial=mat(0xeeeeee);flagMaterial.side=T.DoubleSide;flagMaterial.vertexColors=true;
 // Checker colors are geometry attributes, not a bitmap.
 const checker=flagGeometry.toNonIndexed(),colors=[];const points=checker.attributes.position;
 for(let i=0;i<points.count;i+=3){let x=0,y=0;for(let k=0;k<3;k++){x+=points.getX(i+k)/3;y+=points.getY(i+k)/3;}const light=(Math.floor((x-.01)/(.65/6))+Math.floor((y-.245)/(.43/4)))%2===0;for(let k=0;k<3;k++)colors.push(...(light?[.93,.93,.89]:[.035,.045,.05]));}
 checker.setAttribute('color',new T.Float32BufferAttribute(colors,3));const cloth=new T.Mesh(checker,flagMaterial);flag.add(cloth);flagGeometry.dispose();
 const base=Float32Array.from(checker.attributes.position.array);
 root.userData={kind:'race-marshal',photoTexture:false};
 return {root,body,head,legs,arms,flag,cloth,base};
}
export function starterPose(remaining,raceTime,active){
 if(active){const elapsed=7-clamp(remaining,0,7),walk=clamp(elapsed/3,0,1);return {s:54+6*walk,walking:elapsed<3,phase:elapsed*8,raise:clamp((elapsed-3)/.7,0,1),signal:clamp((elapsed-6.45)/.55,0,1),turn:Math.PI*clamp((elapsed-2.7)/.6,0,1)};}
 return {s:60-4*clamp((raceTime-1)/3,0,1),walking:raceTime>1&&raceTime<4,phase:raceTime*8,raise:raceTime<1?1:0,signal:1,turn:Math.PI};
}
export function updateStarter(npc,track,remaining,raceTime,active,elapsed){
 const pose=starterPose(remaining,raceTime,active),f=track.at(pose.s),lane=ROAD_HALF+1.6;
 npc.root.position.set(f.x+f.nx*lane,f.y+.04,f.z+f.nz*lane);npc.root.rotation.y=Math.atan2(f.tx,f.tz)+pose.turn;
 const gait=pose.walking?Math.sin(pose.phase):0;npc.body.position.y=pose.walking?Math.abs(Math.cos(pose.phase))*.025:Math.sin(elapsed*1.6)*.003;
 npc.legs.forEach(({hip,knee},i)=>{const v=gait*(i?1:-1);hip.rotation.x=v*.39;knee.rotation.x=Math.max(0,-v)*.44;});
 npc.arms.forEach(({shoulder,elbow},i)=>{shoulder.rotation.x=-gait*(i?1:-1)*.28;shoulder.rotation.z=(i?-1:1)*.06;elbow.rotation.x=-.12;});
 npc.arms[1].shoulder.rotation.z=-pose.raise*(2.7-pose.signal*1.65);npc.arms[1].elbow.rotation.x=-.2-pose.raise*.15;
 npc.head.rotation.y=active&&pose.walking?-.18:Math.sin(elapsed*.7)*.05;
 const p=npc.cloth.geometry.attributes.position;for(let i=0;i<p.count;i++){const x=npc.base[i*3];p.setZ(i,Math.sin(x*11+elapsed*7)*.04*(x/.67));}p.needsUpdate=true;
}
