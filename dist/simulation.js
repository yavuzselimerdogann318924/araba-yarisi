import { CatmullRomCurve3, Vector3 } from './vendor/three.core.js';

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const mod = (v, n) => ((v % n) + n) % n;
export const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
export const TOTAL_LAPS = 3;
export const ROAD_HALF = 7.2;
export const CAR_COLORS = [0xf16b30, 0xdde8df, 0x5da7bd, 0xe5bd59, 0x263a49, 0xbd464d];

export class Circuit {
  constructor() {
    const points = [[-180,2,-260],[-175,3,-115],[-80,5,15],[35,8,168],[200,10,260],[340,13,185],[365,16,42],[270,18,-40],[256,21,-160],[350,22,-250],[303,16,-380],[115,9,-435],[-65,4,-400]];
    this.curve = new CatmullRomCurve3(points.map(p => new Vector3(...p)), true, 'centripetal', .5);
    this.curve.arcLengthDivisions = 6000;
    this.length = this.curve.getLength();
    this.count = 1600;
    this.step = this.length / this.count;
    this.frames = Array.from({length:this.count}, (_,i) => {
      const t=i/this.count, p=this.curve.getPointAt(t), dir=this.curve.getTangentAt(t);
      const mag=Math.hypot(dir.x,dir.z);
      return {x:p.x,y:p.y,z:p.z,tx:dir.x/mag,tz:dir.z/mag,nx:dir.z/mag,nz:-dir.x/mag,s:i*this.step,index:i};
    });
    this.frames.forEach((f,i) => {
      const a=this.frames[mod(i-4,this.count)], b=this.frames[(i+4)%this.count];
      f.curvature=angleDelta(Math.atan2(b.tx,b.tz),Math.atan2(a.tx,a.tz))/(8*this.step);
    });
  }
  at(distance) {
    const u=mod(distance,this.length)/this.step, i=Math.floor(u), t=u-i;
    const a=this.frames[i], b=this.frames[(i+1)%this.count];
    let tx=a.tx+(b.tx-a.tx)*t, tz=a.tz+(b.tz-a.tz)*t;
    const mag=Math.hypot(tx,tz);tx/=mag;tz/=mag;
    return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t,tx,tz,nx:tz,nz:-tx,curvature:a.curvature+(b.curvature-a.curvature)*t,s:mod(distance,this.length),index:i};
  }
  nearest(x,z,hint=null) {
    let best=Infinity,index=0;
    const search=i=>{const p=this.frames[mod(i,this.count)], d=(x-p.x)**2+(z-p.z)**2;if(d<best){best=d;index=mod(i,this.count);}};
    if(hint!==null) for(let d=-55;d<=55;d++)search(hint+d);
    if(hint===null||best>75**2)for(let i=0;i<this.count;i+=3)search(i);
    for(let d=-3;d<=3;d++) search(index+d);
    let result=null;
    for(let off=-1;off<=0;off++){
      const i=mod(index+off,this.count), a=this.frames[i],b=this.frames[(i+1)%this.count];
      const dx=b.x-a.x,dz=b.z-a.z;
      const t=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1);
      const px=a.x+dx*t,pz=a.z+dz*t,d=(x-px)**2+(z-pz)**2;
      if(!result||d<result.distanceSq){
        const f=this.at((i+t)*this.step);
        result={...f,lateral:(x-px)*f.nx+(z-pz)*f.nz,distanceSq:d};
      }
    }
    return result;
  }
}

export class Race {
  constructor(track,{playerId=0,multiplayer=false}={}) {this.track=track;this.playerId=playerId;this.multiplayer=multiplayer;this.reset();}
  reset() {
    this.missiles=[];this.explosions=[];this.nextMissileId=1;this.time=0;this.lapStart=0;this.lapTimes=[];this.done=false;this.finishPlace=0;this.events=[];
    this.cars=CAR_COLORS.map((color,i)=>{
      const s=12+(i?Math.ceil(i/2)*11:0),lane=i===0?-2.8:(i%2?2.8:-2.8),f=this.track.at(s);
      return {respawnAt:0,shieldUntil:0,fireAt:0,id:i,color,x:f.x+f.nx*lane,z:f.z+f.nz*lane,y:f.y,heading:Math.atan2(f.tx,f.tz),vx:0,vz:0,speed:0,yaw:0,steer:0,progress:s,lastS:s,frame:f,lane,boost:100,boosting:false,slip:0,lap:1,nextGate:this.track.length/4,finished:false,finishTime:Infinity,collisionCooldown:0,offroad:false,braking:false,lapStart:0,lapTimes:[]};
    });
    this.player=this.cars[this.playerId];this.lapTimes=this.player.lapTimes;
  }
  placeOf(player){return 1+this.cars.filter(c=>c!==player&&(c.finished?(!player.finished||c.finishTime<player.finishTime):!player.finished&&c.progress>player.progress)).length;}
  get position(){return this.placeOf(this.player);}
  resetPlayer(p=this.player) {
    if(p.respawnAt>0||p.finished)return;
    const f=this.track.at(p.progress);
    Object.assign(p,{x:f.x,z:f.z,y:f.y,heading:Math.atan2(f.tx,f.tz),vx:0,vz:0,speed:0,yaw:0,steer:0,frame:f,lastS:f.s,slip:0});
    p.boosting=false;
    if(p.id===this.playerId)this.events.push({type:'reset'});
  }
  drive(car,input,dt) {
    if(car.respawnAt>0||car.finished)return;
    const f=car.frame, off=Math.abs(f.lateral||0)>ROAD_HALF+.3;
    const frontX=Math.sin(car.heading),frontZ=Math.cos(car.heading),rightX=frontZ,rightZ=-frontX;
    let forward=car.vx*frontX+car.vz*frontZ,lateral=car.vx*rightX+car.vz*rightZ;
    const throttle=clamp(input.throttle||0,0,1),brake=clamp(input.brake||0,0,1),handbrake=!!input.handbrake;
    car.boosting=!!input.boost&&car.boost>.5&&throttle>0&&forward>5&&!off;
    if(car.boosting)car.boost=Math.max(0,car.boost-26*dt);else car.boost=Math.min(100,car.boost+7.2*dt);
    const acceleration=throttle*(12.8*Math.max(.26,1-Math.max(0,forward)/94)+(car.boosting?12:0));
    const resist=.0043*forward*Math.abs(forward)+.018*forward;
    forward+=(acceleration-resist)*dt;
    if(brake){if(forward>0)forward=Math.max(0,forward-25*brake*dt);else forward=Math.max(-9,forward-4.5*brake*dt);}
    if(!throttle&&!brake&&Math.abs(forward)<.15)forward=0;
    if(handbrake)forward*=Math.exp(-.32*dt);
    if(off)forward*=Math.exp(-.85*dt);
    forward=clamp(forward,-9,car.boosting?83:69);
    const targetSteer=clamp(input.steer||0,-1,1);
    car.steer+=(targetSteer-car.steer)*(1-Math.exp(-9*dt));
    const steeringAngle=car.steer*(.5/(1+Math.abs(forward)/21));
    const idealYaw=forward/2.8*Math.tan(steeringAngle);
    const yawLimit=(handbrake?1.5:1.04)*(off?.72:1);
    car.yaw+=(clamp(idealYaw,-yawLimit,yawLimit)*(handbrake?1.3:1)-car.yaw)*(1-Math.exp(-(handbrake?3.2:6.5)*dt));
    car.heading+=car.yaw*dt;
    lateral-=car.yaw*forward*dt;
    lateral*=Math.exp(-(handbrake?1.25:off?2.8:8.8)*dt);
    const fx=Math.sin(car.heading),fz=Math.cos(car.heading);
    car.vx=fx*forward+fz*lateral;car.vz=fz*forward-fx*lateral;
    car.x+=car.vx*dt;car.z+=car.vz*dt;
    car.speed=forward;car.slip=Math.abs(lateral);car.offroad=off;car.braking=brake>.1||handbrake;
    car.frame=this.track.nearest(car.x,car.z,f.index);
    car.y=car.frame.y;
    const edge=ROAD_HALF+4.2;
    if(Math.abs(car.frame.lateral)>edge){
      const side=Math.sign(car.frame.lateral),correction=car.frame.lateral-side*edge;
      car.x-=car.frame.nx*correction;car.z-=car.frame.nz*correction;
      const vn=car.vx*car.frame.nx+car.vz*car.frame.nz;
      if(vn*side>0){car.vx-=car.frame.nx*vn*1.13;car.vz-=car.frame.nz*vn*1.13;car.vx*=.74;car.vz*=.74;car.speed*=.74;}
      if(car.id===0&&car.collisionCooldown<=0){this.events.push({type:'hit',force:Math.abs(vn)});car.collisionCooldown=1;}
    }
    car.collisionCooldown=Math.max(0,car.collisionCooldown-dt);
  }
  targetFor(car) {
    if(car.finished||car.respawnAt>0)return null;
    const fx=Math.sin(car.heading),fz=Math.cos(car.heading);
    return this.cars.filter(c=>{
      const dx=c.x-car.x,dz=c.z-car.z,d=Math.hypot(dx,dz);
      return c!==car&&!c.finished&&!c.respawnAt&&c.shieldUntil<=this.time&&d>3&&d<100&&(dx*fx+dz*fz)/d>.86;
    }).sort((a,b)=>Math.hypot(a.x-car.x,a.z-car.z)-Math.hypot(b.x-car.x,b.z-car.z))[0]||null;
  }
  fire(car) {
    if(car.finished||car.respawnAt>0||this.time<car.fireAt)return false;
    const target=this.targetFor(car);if(!target)return false;
    const heading=car.heading;
    this.missiles.push({id:this.nextMissileId++,owner:car.id,target:target.id,x:car.x+Math.sin(heading)*3,y:car.y+1,z:car.z+Math.cos(heading)*3,heading,expires:this.time+3});
    car.fireAt=this.time+3;return true;
  }
  updateCombat(dt) {
    this.explosions=this.explosions.filter(e=>this.time-e.at<1);
    this.missiles=this.missiles.filter(m=>{
      if(this.time>=m.expires)return false;
      const target=this.cars[m.target];
      if(target&&!target.finished&&!target.respawnAt){
        const desired=Math.atan2(target.x-m.x,target.z-m.z);
        m.heading+=clamp(angleDelta(desired,m.heading),-3*dt,3*dt);
        m.y+=(target.y+1-m.y)*Math.min(1,8*dt);
      }
      const dx=Math.sin(m.heading)*115*dt,dz=Math.cos(m.heading)*115*dt;
      // Sweep the entire movement segment so fast missiles cannot tunnel through cars.
      let hit=null,nearest=Infinity;
      for(const c of this.cars){
        if(c.id===m.owner||c.finished||c.respawnAt||c.shieldUntil>this.time||Math.abs(c.y+1-m.y)>2.5)continue;
        const t=clamp(((c.x-m.x)*dx+(c.z-m.z)*dz)/(dx*dx+dz*dz||1),0,1);
        if(Math.hypot(c.x-m.x-dx*t,c.z-m.z-dz*t)<1.7&&t<nearest){hit=c;nearest=t;}
      }
      m.x+=dx;m.z+=dz;
      if(!hit)return true;
      hit.respawnAt=this.time+2;
      Object.assign(hit,{vx:0,vz:0,speed:0,yaw:0,steer:0,boosting:false,slip:0,braking:false});
      this.explosions.push({id:m.id,x:hit.x,y:hit.y+1,z:hit.z,at:this.time});
      return false;
    });
  }
  aiInput(car) {
    const speed=Math.abs(car.speed),look=12+speed*.53;
    let lane=car.lane;
    for(const other of this.cars){
      if(other===car)continue;
      const delta=other.progress-car.progress;
      if(delta>0&&delta<30&&Math.abs((other.frame.lateral||0)-lane)<2.8)lane=(other.frame.lateral||0)>0?-3.5:3.5;
    }
    const goal=this.track.at(car.progress+look),gx=goal.x+goal.nx*lane,gz=goal.z+goal.nz*lane;
    const err=angleDelta(Math.atan2(gx-car.x,gz-car.z),car.heading);
    const steeringAngle=.5/(1+speed/21);
    const steer=clamp(Math.atan2(2*2.8*Math.sin(err),look)/steeringAngle*1.16,-1,1);
    let curve=0;
    for(let j=0;j<6;j++)curve=Math.max(curve,Math.abs(this.track.at(car.progress+j*16).curvature));
    const target=clamp(Math.sqrt(10.7/Math.max(.001,curve)),22,54+car.id*.8);
    return {steer,throttle:car.speed<target?1:.14,brake:clamp((car.speed-target)/9,0,1),boost:false,fire:this.time>5&&this.time>=car.fireAt};
  }
  updateProgress(car,dt) {
    const s=car.frame.s,L=this.track.length;
    let delta=s-car.lastS;if(delta>L/2)delta-=L;if(delta<-L/2)delta+=L;
    // Physical movement bounds progress; every quarter-circuit must be crossed in order.
    if(Math.abs(delta)<Math.max(5,Math.hypot(car.vx,car.vz)*dt*2.5))car.progress+=delta;
    car.lastS=s;
    while(!car.finished&&car.progress>=car.nextGate){
      const gate=Math.round(car.nextGate/(L/4));
      if(gate%4===0){
        const completed=gate/4;
        car.lap=Math.min(TOTAL_LAPS,completed+1);
        car.lapTimes.push(this.time-car.lapStart);car.lapStart=this.time;
        if(car.id===this.playerId){this.lapStart=this.time;this.events.push({type:'lap',lap:car.lap,time:car.lapTimes.at(-1)});}
        if(completed===TOTAL_LAPS){car.finished=true;car.finishTime=this.time;if(car.id===this.playerId){if(!this.multiplayer)this.done=true;this.finishPlace=this.position;this.events.push({type:'finish'});}}
      }
      car.nextGate+=L/4;
    }
  }
  serialize(){return {missiles:this.missiles.map(m=>({...m})),explosions:this.explosions.map(e=>({...e})),nextMissileId:this.nextMissileId,time:this.time,done:this.done,cars:this.cars.map(c=>({...c,finishTime:Number.isFinite(c.finishTime)?c.finishTime:null}))};}
  hydrate(snapshot){
    this.missiles=(snapshot.missiles||[]).map(m=>({...m}));this.explosions=(snapshot.explosions||[]).map(e=>({...e}));this.nextMissileId=snapshot.nextMissileId||1;
    this.time=snapshot.time;this.done=snapshot.done;this.cars=snapshot.cars.map(c=>({...c,finishTime:c.finishTime===null?Infinity:c.finishTime,lapTimes:[...c.lapTimes]}));this.player=this.cars[this.playerId];this.lapTimes=this.player.lapTimes;this.lapStart=this.player.lapStart;this.finishPlace=this.placeOf(this.player);this.events=[];
  }
  update(dt,input,secondInput=null) {
    if(this.done)return;
    this.time+=dt;
    for(const car of this.cars){
      if(car.respawnAt>0&&this.time+1e-9>=car.respawnAt){
        car.respawnAt=0;this.resetPlayer(car);car.shieldUntil=this.time+1;
      }
      if(car.finished||car.respawnAt>0)continue;
      const control=car.id===0?(input||{}):this.multiplayer&&car.id===1?(secondInput||{}):this.aiInput(car);
      this.drive(car,control,dt);if(control.fire)this.fire(car);
    }
    this.updateCombat(dt);
    for(let i=0;i<this.cars.length;i++)for(let j=i+1;j<this.cars.length;j++){
      const a=this.cars[i],b=this.cars[j];if(a.finished||b.finished||a.respawnAt||b.respawnAt||a.shieldUntil>this.time||b.shieldUntil>this.time)continue;
      const dx=a.x-b.x,dz=a.z-b.z,d=Math.hypot(dx,dz);
      if(d<2.25&&d>.001){
        const nx=dx/d,nz=dz/d,push=(2.25-d)*.5;
        a.x+=nx*push;a.z+=nz*push;b.x-=nx*push;b.z-=nz*push;
        const relative=(a.vx-b.vx)*nx+(a.vz-b.vz)*nz;
        if(relative<0){const impulse=-relative*.58;a.vx+=nx*impulse;a.vz+=nz*impulse;b.vx-=nx*impulse;b.vz-=nz*impulse;}
        if(i===0&&a.collisionCooldown<=0){this.events.push({type:'hit',force:Math.abs(relative)});a.collisionCooldown=.8;}
      }
    }
    for(const car of this.cars)if(!car.finished&&!car.respawnAt)this.updateProgress(car,dt);
    if(this.multiplayer)this.done=this.cars[0].finished&&this.cars[1].finished;
  }
}
