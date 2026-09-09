import * as T from './vendor/three.module.js';

export const DRIVER_PROFILES = [
  {id:0,name:'1',shirt:0xe3ddca,hair:0x211c18,longHair:true,photo:'./drivers/driver-01.jpeg',geometry:'./drivers/driver-01.json'},
  {id:1,name:'2',shirt:0x111c27,hair:0x281711,longHair:false,photo:'./drivers/driver-02.jpeg',geometry:'./drivers/driver-02.json'},
];
const UP=new T.Vector3(0,1,0);
const sphere=new T.SphereGeometry(1,18,14);
const unitLimb=new T.CylinderGeometry(1,1,1,10);
const black=new T.MeshStandardMaterial({color:0x152027,roughness:.84});
const seatMaterial=new T.MeshStandardMaterial({color:0x25323a,roughness:.96});
const gold=new T.MeshStandardMaterial({color:0xb79b55,roughness:.36,metalness:.62});
function add(parent,geometry,material,position=[0,0,0],scale=[1,1,1]){
  const m=new T.Mesh(geometry,material);m.position.set(...position);m.scale.set(...scale);m.castShadow=true;parent.add(m);return m;
}
function limb(parent,material,a,b,radius){
  const m=add(parent,unitLimb,material);placeLimb(m,a,b,radius);return m;
}
function placeLimb(m,a,b,radius){
  const av=new T.Vector3(...a),bv=new T.Vector3(...b),delta=bv.clone().sub(av);
  m.position.copy(av).add(bv).multiplyScalar(.5);m.quaternion.setFromUnitVectors(UP,delta.clone().normalize());m.scale.set(radius,delta.length(),radius);
}
function merge(geometries){
  const positions=[],normals=[];
  for(const original of geometries){const g=original.index?original.toNonIndexed():original;positions.push(...g.attributes.position.array);normals.push(...g.attributes.normal.array);if(g!==original)g.dispose();original.dispose();}
  const result=new T.BufferGeometry();result.setAttribute('position',new T.Float32BufferAttribute(positions,3));result.setAttribute('normal',new T.Float32BufferAttribute(normals,3));return result;
}
function hairGeometry(profile,width){
  const parts=[];
  const positions=[],indices=[],cols=28,rows=16;
  for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
    const theta=col/cols*Math.PI*2,phi=(1.90-.86*Math.cos(theta))*row/rows;
    positions.push(width*1.16*Math.sin(theta)*Math.sin(phi),.072+.19*Math.cos(phi),-.03+.16*Math.cos(theta)*Math.sin(phi));
  }
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){const a=row*(cols+1)+col,b=a+cols+1;indices.push(a,b,a+1,b,b+1,a+1);}
  const cap=new T.BufferGeometry();cap.setAttribute('position',new T.Float32BufferAttribute(positions,3));cap.setIndex(indices);cap.computeVertexNormals();parts.push(cap);
  const length=profile.hairLength??(profile.longHair?.34:.23);
  for(const side of [-1,1])for(let strand=0;strand<15;strand++){
    const t=strand/14,depth=-.13+t*.19;
    const points=[new T.Vector3(side*width*.53,.19,depth*.5),new T.Vector3(side*width*1.07,.055,depth),new T.Vector3(side*width*1.12,-.10,depth),new T.Vector3(side*width*(profile.longHair?1.09:1.19),-length+(t*.027),depth+.015)];
    const tube=new T.TubeGeometry(new T.CatmullRomCurve3(points),11,.014+(1-t)*.006,5,false);parts.push(tube);
  }
  // Swept strands follow the two reference hairstyles without covering the face.
  for(let i=0;i<9;i++){
    const t=i/8,side=profile.longHair?1:(i<4?-1:1);
    const points=[new T.Vector3(-.035+side*t*.018,.233,-.006),new T.Vector3(side*width*.64,.19,.038),new T.Vector3(side*width*1.04,.103,.055),new T.Vector3(side*width*1.12,-.04,-.005)];
    parts.push(new T.TubeGeometry(new T.CatmullRomCurve3(points),12,.009,5,false));
  }
  return merge(parts);
}
function headShell(data){
  const oval=[10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];
  const positions=[],indices=[];
  for(let ring=0;ring<5;ring++)for(const id of oval){
    const x=data.positions[id*3],y=data.positions[id*3+1],z=data.positions[id*3+2],t=ring/4,scale=Math.cos(t*Math.PI/2);
    positions.push(x*scale,y*scale,z*(1-t)-.125*Math.sin(t*Math.PI/2));
  }
  for(let ring=0;ring<4;ring++)for(let i=0;i<oval.length;i++){
    const a=ring*oval.length+i,b=ring*oval.length+(i+1)%oval.length,c=a+oval.length,d=b+oval.length;indices.push(a,c,b,b,c,d);
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function createDriverAsset(profile,data,texture){
  texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(data.positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(data.uv,2));geometry.setIndex(data.indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
  return {...profile,faceGeometry:geometry,faceMaterial:new T.MeshBasicMaterial({map:texture,toneMapped:false,side:T.DoubleSide}),headShell:headShell(data),skinMaterial:new T.MeshStandardMaterial({color:data.skin,roughness:.94,side:T.DoubleSide}),shirtMaterial:new T.MeshStandardMaterial({color:profile.shirt,roughness:.96}),hairMaterial:new T.MeshStandardMaterial({color:profile.hair,roughness:.83,side:T.DoubleSide}),hairGeometry:hairGeometry(profile,data.halfWidth),width:data.halfWidth};
}

export async function loadDriverAssets(){
  const loader=new T.TextureLoader();
  return Promise.all(DRIVER_PROFILES.map(async profile=>{
    const [texture,data]=await Promise.all([loader.loadAsync(profile.photo),fetch(profile.geometry).then(r=>{if(!r.ok)throw new Error('Driver geometry could not load');return r.json();})]);
    return createDriverAsset(profile,data,texture);
  }));
}

export function makeDriver(asset){
  const group=new T.Group(),torso=new T.Group(),head=new T.Group();group.add(torso);torso.add(head);head.position.set(0,.785,-.025);
  head.scale.setScalar(.78);
  const face=add(head,asset.faceGeometry,asset.faceMaterial);face.name='photo-reconstructed-face';
  add(head,asset.headShell,asset.skinMaterial);
  add(head,asset.hairGeometry,asset.hairMaterial);
  for(const side of [-1,1]){
    add(head,sphere,asset.skinMaterial,[side*asset.width*1.015,-.025,-.001],[.022,.039,.024]);
    if(asset.longHair)add(head,new T.TorusGeometry(.014,.0035,5,12),gold,[side*asset.width*1.035,-.058,.008]);
  }
  add(torso,new T.CylinderGeometry(.049,.061,.11,14),asset.skinMaterial,[0,.591,-.012]);
  add(torso,sphere,asset.shirtMaterial,[0,.346,-.018],[.193,.245,.115]);
  add(torso,sphere,asset.shirtMaterial,[0,.524,-.012],[.218,.085,.111]);
  add(torso,sphere,asset.skinMaterial,[0,.563,.077],[.071,.041,.021]);
  if(asset.longHair&&!asset.sleeveless){
    for(const side of [-1,1]){
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([side*.027,.592,.091,side*.11,.529,.111,side*.071,.458,.114],3));g.computeVertexNormals();
      const collar=add(torso,g,black);collar.material=new T.MeshStandardMaterial({color:0x24292b,roughness:.85,side:T.DoubleSide});
    }
    for(let i=0;i<3;i++)add(torso,sphere,gold,[0,.44-i*.066,.101],[.007,.007,.005]);
    const chain=new T.CatmullRomCurve3([new T.Vector3(-.045,.57,.10),new T.Vector3(0,.507,.122),new T.Vector3(.045,.57,.10)]);
    add(torso,new T.TubeGeometry(chain,16,.0025,5,false),gold);add(torso,sphere,gold,[0,.505,.126],[.009,.014,.003]);
  }
  // A diagonal belt and a seated lower body remain part of every driver model.
  limb(torso,black,[-.15,.545,.112],[.115,.163,.091],.014);
  add(group,sphere,black,[0,.113,-.03],[.159,.093,.131]);
  for(const side of [-1,1]){limb(group,black,[side*.082,.095,.004],[side*.09,.005,.28],.071);limb(group,black,[side*.09,.005,.28],[side*.09,-.18,.41],.053);}
  const wheel=new T.Group();wheel.position.set(0,.428,.372);wheel.rotation.x=-.27;group.add(wheel);
  const wheelSpin=new T.Group();wheel.add(wheelSpin);
  add(wheelSpin,new T.TorusGeometry(.128,.014,8,28),black);
  for(let i=0;i<3;i++){const spoke=add(wheelSpin,new T.BoxGeometry(.018,.122,.013),black,[0,-.055,0]);spoke.rotation.z=i*Math.PI*2/3;spoke.position.set(Math.sin(i*Math.PI*2/3)*.055,-Math.cos(i*Math.PI*2/3)*.055,0);}
  add(wheelSpin,new T.CylinderGeometry(.032,.032,.023,12),black).rotation.x=Math.PI/2;
  const arms=[];
  for(const side of [-1,1]){
    const shoulder=[side*.19,.51,.008],elbow=[side*.206,.332,.179],hand=[side*.126,.428,.372];
    const upper=limb(torso,asset.sleeveless?asset.skinMaterial:asset.shirtMaterial,shoulder,elbow,.052),lower=limb(torso,asset.longHair&&!asset.sleeveless?asset.shirtMaterial:asset.skinMaterial,elbow,hand,asset.longHair?.039:.034);
    const palm=add(torso,sphere,asset.skinMaterial,hand,[.029,.034,.023]);arms.push({side,shoulder,elbow,upper,lower,palm});
  }
  return {group,head,torso,wheel,wheelSpin,arms,asset};
}

export function animateDriver(driver,steer,time,speed=0){
  const turn=steer*.62;
  driver.wheelSpin.rotation.z=-turn;
  driver.head.rotation.y=steer*.09;driver.head.rotation.z=-steer*Math.min(speed/60,1)*.025;
  driver.torso.position.y=Math.sin(time*1.7)*.0016;
  for(const arm of driver.arms){
    const x=arm.side*.126*Math.cos(turn),wy=-arm.side*.126*Math.sin(turn),hand=[x,.428+wy*Math.cos(-.27),.372+wy*Math.sin(-.27)];
    placeLimb(arm.lower,arm.elbow,hand,driver.asset.longHair?.039:.034);arm.palm.position.set(...hand);arm.palm.rotation.z=-turn;
  }
}

export function makeSeat(){
  const group=new T.Group();
  add(group,new T.BoxGeometry(.41,.075,.4),seatMaterial,[0,.06,-.06]);
  const back=add(group,new T.BoxGeometry(.36,.50,.10),seatMaterial,[0,.345,-.21]);back.rotation.x=-.1;
  add(group,sphere,black,[0,.635,-.24],[.126,.12,.047]);
  for(const side of [-1,1])add(group,sphere,black,[side*.17,.31,-.15],[.042,.22,.069]);
  return group;
}

export class DriverPortrait {
  constructor(assets){
    this.scene=new T.Scene();this.scene.background=new T.Color(0x243640);
    this.scene.add(new T.HemisphereLight(0xf1f4ee,0x687b82,2.6));
    const key=new T.DirectionalLight(0xffe8cc,2.2);key.position.set(-2,3,4);this.scene.add(key);
    this.root=new T.Group();this.scene.add(this.root);this.root.add(makeSeat());
    this.drivers=assets.map(a=>{const d=makeDriver(a);this.root.add(d.group);return d;});
    this.camera=new T.PerspectiveCamera(36,1,.02,20);this.yaw=0;this.selected=0;this.select(0);
    const dash=add(this.root,new T.BoxGeometry(.9,.12,.17),black,[0,.20,.58]);dash.rotation.x=-.05;
  }
  select(id){this.selected=id;this.drivers.forEach((d,i)=>{d.group.visible=i===id;});}
  render(renderer,rect,canvasHeight,mode,steer,time,speed){
    if(rect.width<1||rect.height<1)return;
    const d=this.drivers[this.selected];animateDriver(d,steer,time,speed);
    this.root.rotation.y=mode==='selection'?this.yaw:0;
    this.camera.aspect=rect.width/rect.height;
    if(mode==='selection'){
      const dist=this.camera.aspect<.75?1.80:1.53;
      this.camera.position.set(.11,.83,dist);this.camera.lookAt(0,.59,.015);this.camera.fov=35;
    }else{this.camera.position.set(.12,.81,1.13);this.camera.lookAt(0,.645,.045);this.camera.fov=33;}
    this.camera.updateProjectionMatrix();
    renderer.setScissorTest(true);renderer.setScissor(rect.x,canvasHeight-rect.y-rect.height,rect.width,rect.height);renderer.setViewport(rect.x,canvasHeight-rect.y-rect.height,rect.width,rect.height);renderer.clear(true,true,true);renderer.render(this.scene,this.camera);renderer.setScissorTest(false);
  }
}
