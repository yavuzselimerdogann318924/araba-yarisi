import {makeStarter,updateStarter} from './starter.js?v=face-6';
import * as T from './vendor/three.module.js';
import { ROAD_HALF, clamp } from './simulation.js';
import { loadDriverAssets, makeDriver, makeSeat, animateDriver, DriverPortrait } from './drivers.js?v=drivers-2';

const UP=new T.Vector3(0,1,0);
function rng(seed=54321){return()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};}
function material(color,roughness=.8,metalness=0){return new T.MeshStandardMaterial({color,roughness,metalness});}
function mesh(geometry,mat,x=0,y=0,z=0){const m=new T.Mesh(geometry,mat);m.position.set(x,y,z);return m;}
function canvasTexture(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;return tex;}

function asphaltTexture(){
  const random=rng(81);
  const tex=canvasTexture(256,256,(ctx,w,h)=>{
    const data=ctx.createImageData(w,h);
    for(let i=0;i<data.data.length;i+=4){const v=100+random()*33;data.data[i]=v;data.data[i+1]=v+3;data.data[i+2]=v+5;data.data[i+3]=255;}ctx.putImageData(data,0,0);
  });
  tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.anisotropy=4;return tex;
}

function strip(track,start,end,mat,lift=.035,step=2.4,filter=null){
  const pos=[],uv=[],indices=[];let k=0;
  for(let s=0;s<track.length;s+=step){
    if(filter&&!filter(s))continue;
    const a=track.at(s),b=track.at(Math.min(s+step,track.length));
    for(const [f,v] of [[a,s],[b,s+step]])for(const side of [start,end]){pos.push(f.x+f.nx*side,f.y+lift,f.z+f.nz*side);uv.push(side/5,v/5);}
    indices.push(k,k+2,k+1,k+1,k+2,k+3);k+=4;
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
  const m=new T.Mesh(g,mat);m.receiveShadow=true;return m;
}

function makeHull(sections,mat,openCabin=false){
  const vertices=[],indices=[];
  for(const [z,w,bottom,top] of sections)vertices.push(-w,bottom,z,w,bottom,z,w,top,z,-w,top,z);
  for(let r=0;r<sections.length-1;r++)for(let s=0;s<4;s++){if(openCabin&&r===2&&s===2)continue;const a=r*4+s,b=r*4+(s+1)%4,c=a+4,d=b+4;indices.push(a,b,c,b,d,c);}
  indices.push(0,3,1,1,3,2);
  const end=(sections.length-1)*4;indices.push(end,end+1,end+3,end+1,end+2,end+3);
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();
  const m=new T.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;return m;
}

export function makeCar(color,id){
  const group=new T.Group(),body=new T.Group();group.add(body);
  const paint=material(color,.26,.42),black=material(0x12181c,.54,.12),glass=new T.MeshStandardMaterial({color:0xb5d5dc,roughness:.22,metalness:.06,transparent:true,opacity:.13,depthWrite:false,side:T.DoubleSide}),chrome=material(0xaebdc2,.25,.8),stripe=material(0xf5ecd9,.42,.18);
  body.add(makeHull([[-2.25,.83,.34,.64],[-1.8,1.0,.30,.83],[-.8,1.02,.30,.85],[.65,1.0,.30,.8],[1.82,.96,.32,.66],[2.22,.83,.38,.57]],paint,true));
  body.add(mesh(new T.BoxGeometry(2.06,.12,3.8),black,0,.28,-.03));
  const windows=makeHull([[-1.16,.78,.75,.81],[-.55,.7,.78,1.36],[.43,.68,.78,1.38],[1.02,.82,.72,.79]],glass);windows.castShadow=false;windows.renderOrder=2;body.add(windows);
  for(const side of [-1,1]){
    const seat=makeSeat();seat.position.set(side*.37,.34,-.1);body.add(seat);
    for(const [a,b] of [[[side*.7,1.36,-.55],[side*.78,.81,-1.16]],[[side*.68,1.38,.43],[side*.82,.79,1.02]]]){
      const start=new T.Vector3(...a),end=new T.Vector3(...b),delta=end.clone().sub(start),pillar=mesh(new T.CylinderGeometry(.018,.025,delta.length(),7),black);
      pillar.position.copy(start).add(end).multiplyScalar(.5);pillar.quaternion.setFromUnitVectors(UP,delta.normalize());body.add(pillar);
    }
  }
  body.add(mesh(new T.BoxGeometry(1.49,.10,.20),black,0,.805,.65));
  const roof=mesh(new T.BoxGeometry(1.4,.065,.99),paint,0,1.395,-.06);body.add(roof);
  for(const x of [-.17,.17]){
    const hoodStripe=mesh(new T.BoxGeometry(.13,.012,1.2),stripe,x,.723,1.57);hoodStripe.rotation.x=.13;body.add(hoodStripe);
    body.add(mesh(new T.BoxGeometry(.13,.012,.97),stripe,x,1.435,-.06));
    body.add(mesh(new T.BoxGeometry(.13,.012,.9),stripe,x,.84,-1.62));
  }
  for(const side of [-1,1]){
    body.add(mesh(new T.BoxGeometry(.22,.13,.24),paint,side*.99,1.02,.59));
    const headlight=mesh(new T.BoxGeometry(.49,.09,.043),new T.MeshBasicMaterial({color:0xfff4d9}),side*.54,.58,2.19);headlight.rotation.y=side*-.13;body.add(headlight);
    body.add(mesh(new T.BoxGeometry(.46,.13,.045),black,side*.55,.42,2.195));
    body.add(mesh(new T.BoxGeometry(.38,.10,.04),chrome,side*.55,.42,-2.247));
    body.add(mesh(new T.BoxGeometry(.10,.33,.16),black,side*.68,.95,-1.91));
    body.add(mesh(new T.BoxGeometry(.06,.18,.4),paint,side*1.08,1.22,-1.91));
  }
  body.add(mesh(new T.BoxGeometry(2.16,.07,.38),black,0,1.15,-1.91));
  const brakeMaterial=new T.MeshBasicMaterial({color:0xc83226});
  for(const side of [-1,1])body.add(mesh(new T.BoxGeometry(.62,.09,.045),brakeMaterial,side*.48,.62,-2.249));
  const wheels=[];
  const tireGeom=new T.CylinderGeometry(.415,.415,.29,16),rimGeom=new T.CylinderGeometry(.265,.265,.302,12),hubGeom=new T.CylinderGeometry(.085,.085,.312,8);
  for(const side of [-1,1])for(const z of [-1.40,1.39]){
    const pivot=new T.Group();pivot.position.set(side*.99,.425,z);
    const spin=new T.Group();pivot.add(spin);
    for(const [g,m] of [[tireGeom,black],[rimGeom,chrome],[hubGeom,black]]){const part=mesh(g,m);part.rotation.z=Math.PI/2;part.castShadow=true;spin.add(part);}
    for(let i=0;i<5;i++){const spoke=mesh(new T.BoxGeometry(.316,.045,.45),black);spoke.rotation.x=i*Math.PI/5;spin.add(spoke);}
    group.add(pivot);wheels.push({pivot,spin,front:z>0});
  }
  const shadowTex=canvasTexture(64,128,(c,w,h)=>{const g=c.createRadialGradient(w/2,h/2,5,w/2,h/2,h*.52);g.addColorStop(0,'rgba(0,0,0,.75)');g.addColorStop(.5,'rgba(0,0,0,.4)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(0,0,w,h);});
  const shadow=mesh(new T.PlaneGeometry(3.7,6.4),new T.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false}),0,.048,0);shadow.rotation.x=-Math.PI/2;group.add(shadow);
  const flames=[];
  for(const side of [-1,1]){
    const flame=mesh(new T.ConeGeometry(.10,.7,7),new T.MeshBasicMaterial({color:0x90d8ff,transparent:true,opacity:.8}),side*.55,.4,-2.62);flame.rotation.x=-Math.PI/2;flame.visible=false;group.add(flame);flames.push(flame);
  }
  return {group,body,wheels,brakeMaterial,flames,id};
}

export class World {
  constructor(canvas,track,race){
    this.canvas=canvas;this.track=track;this.race=race;this.coarse=matchMedia('(any-pointer: coarse)').matches||navigator.maxTouchPoints>0;this.cameraMode=0;this.cameraReady=false;this.spin=0;this.elapsed=0;this.selectedDriver=0;this.showDriver=true;this.driverReady=false;
    this.renderer=new T.WebGLRenderer({canvas,antialias:!this.coarse,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,this.coarse?1.5:1.8));
    this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.2;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
    this.scene=new T.Scene();this.scene.background=new T.Color(0x96c6d3);this.scene.fog=new T.FogExp2(0xadc9cc,.00072);
    this.camera=new T.PerspectiveCamera(58,1,.2,6500);
    this.scene.add(new T.HemisphereLight(0xd4edff,0x697b50,2.25));
    this.sun=new T.DirectionalLight(0xffedcf,3.0);this.sun.position.set(-280,440,170);this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(this.coarse?1024:2048,this.coarse?1024:2048);Object.assign(this.sun.shadow.camera,{left:-65,right:65,top:65,bottom:-65,near:10,far:900});this.sun.shadow.bias=-.0005;this.sun.shadow.normalBias=.06;
    this.scene.add(this.sun,this.sun.target);
    this.buildSky();this.buildTerrain();this.buildTrack();this.buildScenery();
    this.cars=race.cars.map(c=>{const car=makeCar(c.color,c.id);this.scene.add(car.group);return car;});
    this.starter=makeStarter();this.scene.add(this.starter.root);this.starterRemaining=7;
    this.buildParticles();this.resize();this.render(0,'intro');
  }
  async loadDrivers(){
    this.driverAssets=await loadDriverAssets();
    this.cars.forEach((car,i)=>{
      const choices=i<2?this.driverAssets:[this.driverAssets[i%2]];
      car.drivers=choices.map(asset=>{const d=makeDriver(asset);d.group.position.set(-.37,.38,-.10);car.body.add(d.group);return d;});
    });
    this.portrait=new DriverPortrait(this.driverAssets);this.driverReady=true;this.setDriver(this.selectedDriver);
  }
  setDriver(id){
    this.selectedDriver=id;
    if(!this.driverReady)return;
    this.cars[this.race.playerId].drivers.forEach((d,i)=>{d.group.visible=i===id;});this.portrait.select(id);
  }
  setRaceDrivers(players){
    if(!this.driverReady)return;
    players.forEach((p,n)=>{if(p)this.cars[n].drivers.forEach((d,i)=>d.group.visible=i===p.driver);});
    this.portrait.select(players[this.race.playerId].driver);
  }
  buildSky(){
    const sky=new T.Mesh(new T.SphereGeometry(5500,32,16),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{top:{value:new T.Color(0x3e93b7)},horizon:{value:new T.Color(0xe5e5d3)}},vertexShader:'varying vec3 vPos; void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec3 vPos;uniform vec3 top;uniform vec3 horizon;void main(){float h=normalize(vPos).y;gl_FragColor=vec4(mix(horizon,top,pow(max(0.0,h),0.48)),1.0);}'}));this.scene.add(sky);
    const sun=mesh(new T.SphereGeometry(60,24,16),new T.MeshBasicMaterial({color:0xfff8df}),-2400,1700,1400);this.scene.add(sun);
    const waterMat=new T.ShaderMaterial({uniforms:{time:{value:0}},vertexShader:'varying vec3 vPos;void main(){vec4 p=modelMatrix*vec4(position,1.0);vPos=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}',fragmentShader:`varying vec3 vPos;uniform float time;void main(){float a=sin(vPos.x*.12+vPos.z*.23+time*.55);float b=sin(vPos.x*.36-vPos.z*.15+time*.72);float w=a*b;vec3 col=mix(vec3(.055,.29,.37),vec3(.13,.49,.55),.47+w*.14);float sparkle=pow(max(0.,sin(vPos.x*.91+time)*sin(vPos.z*.8+time*.4)),24.);col+=vec3(.18,.21,.20)*sparkle;float far=clamp(length(vPos.xz)/4200.,0.,.9);col=mix(col,vec3(.65,.78,.79),far);gl_FragColor=vec4(col,1.);}`});
    const water=mesh(new T.PlaneGeometry(14000,14000),waterMat,0,-2.4,0);water.rotation.x=-Math.PI/2;this.scene.add(water);this.waterMat=waterMat;
  }
  terrainHeight(x,z){
    const coast=-253+Math.sin(z*.009)*17+Math.sin(z*.021)*8;
    let h=3+(x+170)*.036+Math.sin(x*.015)*Math.cos(z*.01)*7;
    if(x<coast)h=-10+(x-coast)*.13;
    let closest=null,best=Infinity;
    for(let i=0;i<this.track.count;i+=7){const f=this.track.frames[i],d=(x-f.x)**2+(z-f.z)**2;if(d<best){best=d;closest=f;}}
    const d=Math.sqrt(best),blend=1-clamp((d-13)/40,0,1);
    h=h*(1-blend)+(closest.y-.6)*blend;
    return h;
  }
  buildTerrain(){
    const geo=new T.PlaneGeometry(1900,1850,105,103);geo.rotateX(-Math.PI/2);geo.translate(540,0,-80);
    const pos=geo.attributes.position,colors=[],random=rng(992),c=new T.Color();
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),z=pos.getZ(i),h=this.terrainHeight(x,z);pos.setY(i,h);
      if(x<-205&&h<4)c.set(0xb2a787);else c.setHSL(.19+random()*.027,.19+random()*.13,.30+random()*.10);
      colors.push(c.r,c.g,c.b);
    }
    geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
    const land=mesh(geo,new T.MeshStandardMaterial({vertexColors:true,roughness:1}));land.receiveShadow=true;this.scene.add(land);
    const randomMountain=rng(778);const rock=material(0x7c8c7b),far=material(0x869c95);
    for(let i=0;i<40;i++){
      const z=-1200+i*65,x=670+randomMountain()*470,r=105+randomMountain()*190;
      const g=new T.IcosahedronGeometry(r,1);const mountain=mesh(g,i%3?rock:far,x,2,z);mountain.scale.set(1,1+randomMountain()*.9,1.3);mountain.rotation.y=randomMountain()*6.28;this.scene.add(mountain);
    }
    for(let i=0;i<10;i++){
      const island=mesh(new T.IcosahedronGeometry(140+randomMountain()*100,1),far,-1300-randomMountain()*1000,-80,-1000+i*300);island.scale.set(2,.5,1);this.scene.add(island);
    }
  }
  buildTrack(){
    const asphalt=material(0x535d61);asphalt.map=asphaltTexture();
    this.scene.add(strip(this.track,-ROAD_HALF-4.8,ROAD_HALF+4.8,material(0x98988a),-.03,3));
    this.scene.add(strip(this.track,-ROAD_HALF,ROAD_HALF,asphalt,.03,2));
    const line=material(0xe6e9da),red=material(0xbe614c),curb=material(0xe4dfcc);
    for(const sign of [-1,1]){
      const a=sign*(ROAD_HALF-.30),b=sign*(ROAD_HALF-.15);this.scene.add(strip(this.track,Math.min(a,b),Math.max(a,b),line,.047));
      const c=sign*ROAD_HALF,d=sign*(ROAD_HALF+.65);this.scene.add(strip(this.track,Math.min(c,d),Math.max(c,d),curb,.055));this.scene.add(strip(this.track,Math.min(c,d),Math.max(c,d),red,.059,2.5,s=>Math.floor(s/2.5)%2===0));
    }
    this.scene.add(strip(this.track,-.055,.055,line,.047,2,s=>Math.floor(s/2)%7<3));
    const segments=Math.ceil(this.track.length/6)*2,guard=new T.InstancedMesh(new T.BoxGeometry(.14,.38,6.15),material(0xa9b6b5,.44,.6),segments),posts=new T.InstancedMesh(new T.BoxGeometry(.16,.95,.18),material(0x707a77,.5,.5),segments),dummy=new T.Object3D();
    let n=0;
    for(let s=0;s<this.track.length;s+=6)for(const side of [-1,1]){
      const f=this.track.at(s),offset=side*(ROAD_HALF+5.2);dummy.position.set(f.x+f.nx*offset,f.y+.82,f.z+f.nz*offset);dummy.rotation.set(0,Math.atan2(f.tx,f.tz),0);dummy.updateMatrix();guard.setMatrixAt(n,dummy.matrix);
      dummy.position.y=f.y+.43;dummy.updateMatrix();posts.setMatrixAt(n++,dummy.matrix);
    }
    guard.count=posts.count=n;guard.receiveShadow=true;this.scene.add(guard,posts);
    const finish=canvasTexture(256,64,(c,w,h)=>{c.fillStyle='#f2f0e5';c.fillRect(0,0,w,h);c.fillStyle='#242d31';for(let y=0;y<4;y++)for(let x=0;x<16;x++)if((x+y)%2===0)c.fillRect(x*16,y*16,16,16);});
    const f=this.track.at(0),lineMesh=mesh(new T.PlaneGeometry(ROAD_HALF*2,3.5),new T.MeshStandardMaterial({map:finish,roughness:1}),f.x,f.y+.065,f.z);lineMesh.rotation.set(-Math.PI/2,0,-Math.atan2(f.tx,f.tz));this.scene.add(lineMesh);
    const arch=new T.Group();arch.position.set(f.x,f.y,f.z);arch.rotation.y=Math.atan2(f.tx,f.tz);
    const frame=material(0x273c45,.65,.3);
    for(const x of [-9,9])arch.add(mesh(new T.BoxGeometry(.65,8,.65),frame,x,4,0));
    arch.add(mesh(new T.BoxGeometry(18.8,2,.8),frame,0,7.9,0));
    const bannerTex=canvasTexture(1024,128,(c,w,h)=>{c.fillStyle='#21323a';c.fillRect(0,0,w,h);c.fillStyle='#ffbd59';c.fillRect(0,0,12,h);c.font='italic 900 66px Arial';c.textAlign='center';c.fillStyle='#f0f2e8';c.fillText('APEX  /  COASTLINE',w/2,88);});
    for(const side of [-1,1]){const banner=mesh(new T.PlaneGeometry(17.7,1.8),new T.MeshBasicMaterial({map:bannerTex}),0,7.9,side*.411);if(side<0)banner.rotation.y=Math.PI;arch.add(banner);}
    this.scene.add(arch);
    const signTexture=canvasTexture(512,128,(c,w,h)=>{c.fillStyle='#f2eedd';c.fillRect(0,0,w,h);c.fillStyle='#1f343d';c.font='bold 62px Arial';c.textAlign='center';c.fillText('COASTLINE',w/2,86);});
    const boardMat=new T.MeshStandardMaterial({map:signTexture,roughness:.8});
    for(const distance of [150,460,800,1150,1500,1850]){
      const p=this.track.at(distance),sign=mesh(new T.BoxGeometry(6,1.6,.18),boardMat,p.x+p.nx*15,p.y+1.65,p.z+p.nz*15);sign.rotation.y=Math.atan2(p.nx,p.nz);this.scene.add(sign);
    }
    const arrowTex=canvasTexture(128,128,(c,w,h)=>{c.fillStyle='#f2c574';c.fillRect(0,0,w,h);c.strokeStyle='#28353a';c.lineWidth=18;c.beginPath();c.moveTo(42,19);c.lineTo(82,64);c.lineTo(42,109);c.stroke();});
    const arrowMat=new T.MeshStandardMaterial({map:arrowTex});
    for(let s=0;s<this.track.length;s+=24){
      const p=this.track.at(s);if(Math.abs(p.curvature)<.012)continue;
      const outside=-Math.sign(p.curvature),sign=mesh(new T.BoxGeometry(1.8,1.7,.14),arrowMat,p.x+p.nx*outside*13,p.y+1.7,p.z+p.nz*outside*13);sign.rotation.y=Math.atan2(p.tx,p.tz)+Math.PI;this.scene.add(sign);
    }
  }
  buildScenery(){
    const random=rng(732),trunkMat=material(0x625b42),leafMat=material(0x3b5940),bright=material(0x526848),dummy=new T.Object3D();
    const trees=[];
    for(let n=0;n<1200&&trees.length<360;n++){
      const x=-220+random()*960,z=-660+random()*1250,f=this.track.nearest(x,z);
      if(f.distanceSq<23**2||x<-219)continue;
      const y=this.terrainHeight(x,z);if(y<-.5)continue;
      trees.push({x,y,z,h:5+random()*8,r:1+random()*1.8,type:random()});
    }
    const trunks=new T.InstancedMesh(new T.CylinderGeometry(.17,.26,1,6),trunkMat,trees.length),leaves=new T.InstancedMesh(new T.ConeGeometry(1,1,7),leafMat,trees.length*2),olives=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),bright,trees.length);
    let li=0,oi=0;
    trees.forEach((p,i)=>{
      dummy.rotation.set(0,0,0);dummy.position.set(p.x,p.y+p.h*.24,p.z);dummy.scale.set(1,p.h*.48,1);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);
      if(p.type>.3)for(let j=0;j<2;j++){dummy.position.y=p.y+p.h*(.48+j*.2);dummy.scale.set(p.r*(1-j*.28),p.h*.7,p.r*(1-j*.28));dummy.updateMatrix();leaves.setMatrixAt(li++,dummy.matrix);}
      else{dummy.position.y=p.y+p.h*.55;dummy.scale.set(p.r*1.8,p.h*.37,p.r*1.6);dummy.rotation.y=random()*6.28;dummy.updateMatrix();olives.setMatrixAt(oi++,dummy.matrix);}
    });
    leaves.count=li;olives.count=oi;trunks.castShadow=leaves.castShadow=olives.castShadow=true;this.scene.add(trunks,leaves,olives);
    // Small coastal buildings and a lighthouse place the circuit in a seaside landscape.
    const wall=material(0xe0d8bc),roof=material(0x9d6650),window=material(0x3e6574,.3,.3);
    for(let i=0;i<18;i++){
      const s=280+i*13,p=this.track.at(s),side=i%2?1:-1,offset=38+(i%3)*10;
      const x=p.x+p.nx*side*offset,z=p.z+p.nz*side*offset,y=this.terrainHeight(x,z);
      if(y<0)continue;
      const building=new T.Group();building.position.set(x,y,z);building.rotation.y=Math.atan2(p.tx,p.tz);const h=5+i%3*2;
      const house=mesh(new T.BoxGeometry(8,h,7),wall,0,h/2,0);house.castShadow=true;building.add(house);
      const top=mesh(new T.ConeGeometry(6.2,2,4),roof,0,h+1,0);top.rotation.y=Math.PI/4;top.scale.z=.88;building.add(top);
      for(const xx of [-2.4,0,2.4])building.add(mesh(new T.PlaneGeometry(1.05,1.65),window,xx,h*.57,3.51));
      this.scene.add(building);
    }
    const lighthouse=new T.Group();lighthouse.position.set(-227,this.terrainHeight(-227,85),85);
    lighthouse.add(mesh(new T.CylinderGeometry(2.2,3.6,24,14),wall,0,12,0));lighthouse.add(mesh(new T.CylinderGeometry(2.34,2.46,4,14),material(0xa65340),0,17,0));lighthouse.add(mesh(new T.CylinderGeometry(3.1,3.1,.6,14),wall,0,24,0));lighthouse.add(mesh(new T.CylinderGeometry(2.0,2.0,3.4,10),window,0,26,0));lighthouse.add(mesh(new T.ConeGeometry(3.1,2.0,12),roof,0,28.5,0));this.scene.add(lighthouse);
    const boatMat=material(0xe8e6d8),sail=new T.MeshBasicMaterial({color:0xfff4dc,side:T.DoubleSide});
    for(const [x,z] of [[-630,-45],[-820,340],[-470,-640]]){
      const boat=new T.Group();boat.position.set(x,-1.7,z);boat.rotation.y=.7;boat.add(mesh(new T.BoxGeometry(3,1.2,10),boatMat));boat.add(mesh(new T.CylinderGeometry(.08,.08,15,5),boatMat,0,7,0));
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([0,1,0,0,14,0,0,1,6],3));g.computeVertexNormals();boat.add(mesh(g,sail));this.scene.add(boat);
    }
  }
  buildParticles(){
    this.particleData=Array.from({length:65},()=>({life:0,x:0,y:-100,z:0,vx:0,vz:0}));const positions=new Float32Array(65*3);positions.fill(-100);
    const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(positions,3));
    const map=canvasTexture(32,32,(c,w,h)=>{const grad=c.createRadialGradient(16,16,0,16,16,16);grad.addColorStop(0,'rgba(255,255,255,.65)');grad.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=grad;c.fillRect(0,0,w,h);});
    this.particles=new T.Points(g,new T.PointsMaterial({size:1.5,map,color:0xc7c5af,transparent:true,depthWrite:false,opacity:.36}));this.particles.frustumCulled=false;this.scene.add(this.particles);this.particleIndex=0;
  }
  resize(){const w=this.canvas.clientWidth,h=this.canvas.clientHeight;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
  render(dt,state){
    const marshalIntro=state==='countdown'&&this.race.time<.05;
    if(state!=='paused')updateStarter(this.starter,this.track,this.starterRemaining,this.race.time,marshalIntro,this.elapsed);
    if(this.wasMarshalIntro&&!marshalIntro)this.cameraReady=false;this.wasMarshalIntro=marshalIntro;
    this.elapsed+=dt;this.waterMat.uniforms.time.value=this.elapsed;
    for(let i=0;i<this.race.cars.length;i++){
      const data=this.race.cars[i],car=this.cars[i],f=data.frame;
      if(this.race.multiplayer&&state==='racing')car.group.position.lerp(new T.Vector3(data.x,data.y+.06,data.z),1-Math.exp(-18*dt));else car.group.position.set(data.x,data.y+.06,data.z);car.group.rotation.y=data.heading;
      const ahead=this.track.at(f.s+2),behind=this.track.at(f.s-2);car.group.rotation.x=-Math.atan2(ahead.y-behind.y,4);
      car.body.rotation.z+=(clamp(data.yaw*data.speed*.0015,-.08,.08)-car.body.rotation.z)*(1-Math.exp(-8*dt));
      for(const w of car.wheels){w.pivot.rotation.y=w.front?data.steer*.35:0;w.spin.rotation.x+=data.speed*dt/.415;}
      car.brakeMaterial.color.set(data.braking?0xff5540:0x9a201b);
      for(const flame of car.flames){flame.visible=data.boosting;flame.scale.y=.7+Math.random()*.7;}
      for(const driver of car.drivers||[])if(driver.group.visible)animateDriver(driver,data.steer,this.elapsed,Math.abs(data.speed));
    }
    const p=this.race.player,forward=new T.Vector3(Math.sin(p.heading),0,Math.cos(p.heading));
    let desired,look,fov;
    if(marshalIntro){
      const f=this.track.at(60),n=this.starter.root.position;
      const portrait=this.starterRemaining<3.6&&this.starterRemaining>1.05;
      const distance=portrait?1.35:4.3,side=portrait?.15:1.5;
      desired=new T.Vector3(n.x-f.tx*distance+f.nx*side,n.y+(portrait?1.62:1.7),n.z-f.tz*distance+f.nz*side);
      look=new T.Vector3(n.x,n.y+(portrait?1.56:1.05),n.z);fov=portrait?31:38;
    }else if(state==='intro'||state==='select'){
      const f=this.track.at(p.progress),side=new T.Vector3(f.nx,0,f.nz);
      desired=new T.Vector3(p.x,p.y,p.z).addScaledVector(forward,-10.3).addScaledVector(side,5.6);desired.y+=4.4;
      look=new T.Vector3(p.x,p.y+1.5,p.z).addScaledVector(forward,24).addScaledVector(side,-1);fov=55;
    }else if(this.cameraMode===2){
      desired=new T.Vector3(p.x,p.y+1.48,p.z).addScaledVector(forward,.75);
      look=new T.Vector3(p.x,p.y+1.4,p.z).addScaledVector(forward,35);fov=72+(p.boosting?6:0);
    }else{
      const close=this.cameraMode===1,distance=close?6.3:9.6+Math.abs(p.speed)*.035;
      desired=new T.Vector3(p.x,p.y+(close?2.7:4.9),p.z).addScaledVector(forward,-distance);
      look=new T.Vector3(p.x,p.y+(close?1.1:1.3),p.z).addScaledVector(forward,12+Math.abs(p.speed)*.08);fov=59+Math.abs(p.speed)*.095+(p.boosting?7:0);
    }
    if(!this.cameraReady||this.cameraMode===2){this.camera.position.copy(desired);this.cameraLook=look.clone();this.cameraReady=true;}else{this.camera.position.lerp(desired,1-Math.exp(-5*dt));this.cameraLook.lerp(look,1-Math.exp(-7*dt));}
    this.camera.lookAt(this.cameraLook);this.camera.fov+=(fov-this.camera.fov)*(1-Math.exp(-4*dt));this.camera.updateProjectionMatrix();
    this.cars.forEach(c=>c.group.visible=true);this.cars[this.race.playerId].group.visible=!(this.cameraMode===2&&state!=='intro'&&state!=='select');
    this.sun.position.set(p.x-280,p.y+440,p.z+170);this.sun.target.position.set(p.x,p.y,p.z);
    const emit=state==='racing'&&(p.offroad||p.slip>4)&&Math.abs(p.speed)>10;
    if(emit)for(let j=0;j<2;j++){
      const particle=this.particleData[this.particleIndex++%this.particleData.length];
      Object.assign(particle,{life:.9,x:p.x-forward.x*1.5+(Math.random()-.5)*1.8,y:p.y+.3,z:p.z-forward.z*1.5+(Math.random()-.5)*1.8,vx:-forward.x*2,vz:-forward.z*2});
    }
    const pa=this.particles.geometry.attributes.position;
    this.particleData.forEach((a,i)=>{a.life-=dt;if(a.life>0){a.x+=a.vx*dt;a.z+=a.vz*dt;a.y+=.65*dt;pa.setXYZ(i,a.x,a.y,a.z);}else pa.setXYZ(i,0,-100,0);});pa.needsUpdate=true;
    const width=this.canvas.clientWidth,height=this.canvas.clientHeight;
    this.renderer.setScissorTest(false);this.renderer.setViewport(0,0,width,height);this.renderer.render(this.scene,this.camera);
    if(this.driverReady&&(state==='select'||(this.showDriver&&['racing','countdown','paused'].includes(state)))){
      const element=document.getElementById(state==='select'?'driver-orbit':'driver-inset');
      if(element&&!element.classList.contains('hidden')){
        const r=element.getBoundingClientRect(),base=this.canvas.getBoundingClientRect();
        this.portrait.render(this.renderer,{x:r.left-base.left,y:r.top-base.top,width:r.width,height:r.height},height,state==='select'?'selection':'race',state==='select'?Math.sin(this.elapsed*.6)*.16:p.steer,this.elapsed,Math.abs(p.speed));
      }
    }
  }
}
