import {DRIVER_PROFILES} from './drivers.js?v=lidya-8';
import {MarshalSpeech} from './marshal-speech.js?v=lidya-8';
import { Circuit, Race, TOTAL_LAPS, clamp, angleDelta } from './simulation.js';
import { OnlineRoom } from './online.js?v=lidya-8';
import { World } from './world.js?v=lidya-8';

const $=id=>document.getElementById(id);
const track=new Circuit();
const race=new Race(track);
const world=new World($('world'),track,race);
const coarse=matchMedia('(any-pointer: coarse)').matches||navigator.maxTouchPoints>0;
document.documentElement.classList.toggle('touch-device',coarse);
let state='intro',beforePause='racing',countdownTime=0,lastCountdown='',lastNow=0,accumulator=0,hudTimer=0,messageUntil=0,lastWrongWay=0;
const keys=new Set(),touches=new Map();
const input={throttle:0,brake:0,steer:0,boost:false,handbrake:false};
const fmt=t=>{const ms=Math.floor(Math.max(0,t)*1000);return `${String(Math.floor(ms/60000)).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;};

class EngineAudio {
  constructor(){this.context=null;this.enabled=true;}
  start(){
    try{
      if(!this.context){
        const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
        const ctx=this.context=new Audio();
        this.master=ctx.createGain();this.master.gain.value=0;this.master.connect(ctx.destination);
        this.engineFilter=ctx.createBiquadFilter();this.engineFilter.type='lowpass';this.engineFilter.frequency.value=700;this.engineFilter.Q.value=.65;this.engineFilter.connect(this.master);
        this.oscillators=[1,2,3].map((ratio,i)=>{const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=i===1?'triangle':'sawtooth';gain.gain.value=[.36,.32,.10][i];osc.connect(gain);gain.connect(this.engineFilter);osc.frequency.value=38*ratio;osc.start();return {osc,ratio};});
        const buffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),data=buffer.getChannelData(0);
        for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1);
        const noise=ctx.createBufferSource();noise.buffer=buffer;noise.loop=true;
        const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1100;
        this.noiseGain=ctx.createGain();this.noiseGain.gain.value=0;noise.connect(filter);filter.connect(this.noiseGain);this.noiseGain.connect(ctx.destination);noise.start();
      }
      if(this.context.state==='suspended')this.context.resume().catch(()=>{});
    }catch(e){console.warn('Audio unavailable',e);}
  }
  update(player,active){
    if(!this.context)return;
    const time=this.context.currentTime,speed=Math.abs(player.speed),gear=Math.min(6,Math.max(1,Math.floor(speed/12)+1));
    const rpm=1800+(speed%12)*320+(input.throttle?800:0);
    for(const {osc,ratio}of this.oscillators)osc.frequency.setTargetAtTime((rpm/60)*ratio,time,.075);
    this.engineFilter.frequency.setTargetAtTime(500+rpm*.12+(player.boosting?400:0),time,.1);
    this.master.gain.setTargetAtTime(this.enabled&&active?.085+(input.throttle?.028:0):0,time,.09);
    this.noiseGain.gain.setTargetAtTime(this.enabled&&active?speed*.00033+(player.boosting?.035:0)+(player.slip>4?.025:0):0,time,.1);
  }
  beep(frequency,duration=.14){
    if(!this.context||!this.enabled)return;
    const ctx=this.context,o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=frequency;o.connect(g);g.connect(ctx.destination);g.gain.setValueAtTime(.1,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+duration);o.start();o.stop(ctx.currentTime+duration);
  }
  hit(force){if(force>2)this.beep(70+Math.min(force,30),.075);}
}
const engine=new EngineAudio();
const marshalSpeech=new MarshalSpeech();

function show(id,yes=true){$(id).classList.toggle('hidden',!yes);}
function clearInput(){keys.clear();touches.clear();for(const el of document.querySelectorAll('[data-control]'))el.classList.remove('pressed');Object.assign(input,{throttle:0,brake:0,steer:0,boost:false,handbrake:false});}
function getInput(){
  const held=name=>[...touches.values()].includes(name);
  input.throttle=(keys.has('KeyW')||keys.has('ArrowUp')||held('throttle'))?1:0;
  input.brake=(keys.has('KeyS')||keys.has('ArrowDown')||held('brake'))?1:0;
  input.steer=((keys.has('KeyD')||keys.has('ArrowRight')||held('right'))?1:0)-((keys.has('KeyA')||keys.has('ArrowLeft')||held('left'))?1:0);
  input.boost=keys.has('ShiftLeft')||keys.has('ShiftRight')||held('boost');
  input.handbrake=keys.has('Space')||held('handbrake');
}
function announce(text,duration=2400){$('announcement').textContent=text;show('announcement');messageUntil=performance.now()+duration;}

function startRace(){
  if(!world.driverReady)return;
  online.close();race.playerId=0;race.multiplayer=false;show('online-lobby',false);show('online-status',false);
  marshalSpeech.reset();engine.start();race.reset();world.setDriver(world.selectedDriver);clearInput();world.cameraReady=false;state='countdown';countdownTime=7;lastCountdown='';accumulator=0;lastWrongWay=0;
  for(const id of ['intro','circuit-card','intro-footer','results','pause-screen','announcement','driver-select'])show(id,false);
  for(const id of ['hud','pause','countdown','touch-controls'])show(id);
  show('driver-inset',world.showDriver);
  document.body.classList.add('racing');document.body.classList.remove('boosting');
  $('pause').focus({preventScroll:true});updateHud();
}
function chooseDriver(){
  online.close();show('online-lobby',false);show('online-status',false);race.playerId=0;race.multiplayer=false;race.reset();world.setDriver(world.selectedDriver);
  marshalSpeech.reset();engine.start();clearInput();state='select';world.cameraReady=false;world.cameraMode=0;
  for(const id of ['intro','circuit-card','intro-footer','results','pause-screen','announcement','hud','touch-controls','pause','countdown'])show(id,false);
  show('driver-select');document.body.classList.remove('racing','boosting');
  document.querySelector(`input[name="driver"][value="${world.selectedDriver}"]`).focus({preventScroll:true});
}
function selectDriver(id){
  world.setDriver(id);$('selected-driver-name').textContent=DRIVER_PROFILES[id].name;$('driver-inset-name').textContent=DRIVER_PROFILES[id].name;
}
function pauseRace(){
  if(state!=='racing'&&state!=='countdown')return;
  if(online.active){clearInput();onlineAction('pause');return;}
  beforePause=state;state='paused';clearInput();show('pause-screen');show('touch-controls',false);show('countdown',false);$('resume').focus({preventScroll:true});
}
function resumeRace(){
  if(state!=='paused')return;
  if(online.active){engine.start();onlineAction('resume');return;}
  state=beforePause;engine.start();show('pause-screen',false);show('touch-controls');if(state==='countdown')show('countdown');$('pause').focus({preventScroll:true});accumulator=0;
}
function finishRace(){
  state='finished';clearInput();show('touch-controls',false);show('pause',false);show('announcement',false);show('results');
  const place=race.finishPlace;$('finish-place').textContent=place;$('finish-suffix').textContent=['','ST','ND','RD','TH','TH','TH'][place];
  $('result-title').textContent=place===1?'You took the coast.':place<=3?'On the podium.':'Race complete.';
  $('finish-message').textContent=place===1?'Clean lines. Full commitment. First place.':place<=3?'A strong drive. First place is within reach.':'Brake before the bends. Boost on the straights.';
  $('finish-time').textContent=fmt(race.player.finishTime);$('finish-best').textContent=fmt(Math.min(...race.lapTimes));
  $('race-again').focus({preventScroll:true});engine.beep(880,.35);document.body.classList.remove('boosting');updateHud();
}

const online=new OnlineRoom({onRoom:applyOnlineRoom,onError:(e,fatal)=>{roomError(e.message);if(fatal){chooseDriver();announce(e.message,6000);}},getInput:()=>state==='racing'?{...input}:{throttle:0,brake:0,steer:0}});
function roomError(message){$('room-error').textContent=message;show('room-error');if(state!=='lobby')announce(message,3000);}
async function onlineAction(action){try{await online.action(action);}catch(e){roomError(e.message);}}
function applyOnlineRoom(room){
  race.playerId=room.slot;race.multiplayer=true;race.hydrate(room.race);world.setRaceDrivers(room.players);
  $('online-status').textContent=`ODA ${room.code} · ${online.latency} ms`;show('online-status');
  $('room-code').textContent=room.code;show('room-entry',false);show('room-waiting');
  room.players.forEach((p,i)=>{$(`room-player-${i}`).textContent=p?DRIVER_PROFILES[p.driver].name:'Oyuncu bekleniyor';$(`room-state-${i}`).textContent=p?(p.connected?'Bağlı':'Bağlantı bekleniyor'):'Oda kodunu paylaş';});
  $('room-status').textContent=room.reason;$('room-start').disabled=room.slot!==0||!room.players.every(p=>p?.connected);
  if(room.phase==='lobby')return;
  if(room.phase==='closed'){chooseDriver();announce('Diğer oyuncu odadan ayrıldı.',5000);return;}
  for(const id of ['online-lobby','driver-select','intro','circuit-card','intro-footer'])show(id,false);
  show('hud');document.body.classList.add('racing');show('driver-inset',world.showDriver);
  if(race.player.finished){if(state!=='finished')finishRace();return;}
  if(room.phase==='paused'){state='paused';clearInput();show('pause-screen');show('touch-controls',false);show('countdown',false);return;}
  show('pause-screen',false);show('pause');show('touch-controls');show('results',false);
  if(state==='lobby')world.cameraReady=false;
  state=room.phase==='countdown'?'countdown':'racing';show('countdown',state==='countdown');
}
$('online-play').addEventListener('click',()=>{state='lobby';marshalSpeech.reset();clearInput();show('driver-select',false);show('online-lobby');show('room-entry');show('room-waiting',false);show('room-error',false);$('create-room').focus();});
async function enterRoom(code){
  $('create-room').disabled=true;$('join-room').disabled=true;show('room-error',false);engine.start();
  try{await online.enter(world.selectedDriver,code);}catch(e){roomError(e.message);}finally{$('create-room').disabled=false;$('join-room').disabled=false;}
}
$('create-room').addEventListener('click',()=>enterRoom());
$('room-code-input').addEventListener('input',e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z2-9]/g,'');});
$('join-room-form').addEventListener('submit',e=>{e.preventDefault();enterRoom($('room-code-input').value.trim());});
$('room-start').addEventListener('click',()=>onlineAction('start'));
$('leave-room').addEventListener('click',chooseDriver);
$('copy-room').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(online.code);$('copy-room').textContent='Kopyalandı';}catch{roomError('Kodu seçip arkadaşına iletebilirsin.');}});
window.addEventListener('pagehide',()=>online.close());

const mapFrames=track.frames.filter((_,i)=>i%5===0);
const bounds=mapFrames.reduce((b,p)=>({minX:Math.min(b.minX,p.x),maxX:Math.max(b.maxX,p.x),minZ:Math.min(b.minZ,p.z),maxZ:Math.max(b.maxZ,p.z)}),{minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity});
function drawMap(canvas,live){
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);
  const scale=Math.min((w-38)/(bounds.maxX-bounds.minX),(h-28)/(bounds.maxZ-bounds.minZ));
  const ox=(w-(bounds.maxX-bounds.minX)*scale)/2,oy=(h-(bounds.maxZ-bounds.minZ)*scale)/2;
  const xy=p=>[ox+(p.x-bounds.minX)*scale,h-oy-(p.z-bounds.minZ)*scale];
  ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();mapFrames.forEach((p,i)=>{const [x,y]=xy(p);if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.closePath();
  ctx.strokeStyle='rgba(0,0,0,.2)';ctx.lineWidth=live?8:9;ctx.stroke();ctx.strokeStyle=live?'rgba(244,248,245,.75)':'#b9c9cc';ctx.lineWidth=live?3.5:4;ctx.stroke();
  const f=track.at(0),[sx,sy]=xy(f);ctx.fillStyle='#ffbd59';ctx.fillRect(sx-4,sy-4,8,8);
  if(!live){ctx.font='11px Arial';ctx.fillStyle='#b8cbd1';ctx.fillText('START',sx-43,sy+5);}
  if(live)for(const car of [...race.cars].reverse()){
    const [x,y]=xy(car),radius=car.id===race.playerId?5:3;ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fillStyle=car.id===race.playerId?'#ffbd59':`#${car.color.toString(16).padStart(6,'0')}`;ctx.fill();ctx.strokeStyle=car.id===race.playerId?'#fff':'#273941';ctx.lineWidth=car.id===race.playerId?1.5:1;ctx.stroke();
  }
}
function updateHud(){
  const p=race.player,kmh=Math.round(Math.abs(p.speed)*3.6),gear=p.speed<-1?'R':p.speed<1?'N':Math.min(6,Math.floor(Math.abs(p.speed)/12)+1);
  $('speed').textContent=String(kmh).padStart(3,'0');$('gear').textContent=gear;
  $('position').textContent=race.done?race.finishPlace:race.position;$('lap').textContent=p.lap;$('time').textContent=fmt(race.time);
  $('best-lap').textContent=`BEST LAP ${race.lapTimes.length?fmt(Math.min(...race.lapTimes)):'—'}`;
  $('revs').style.width=`${Math.min(100,24+(Math.abs(p.speed)%12)*6)}%`;$('boost-fill').style.width=`${p.boost}%`;
  document.body.classList.toggle('boosting',p.boosting&&state==='racing');drawMap($('minimap'),true);
}

$('start').addEventListener('click',chooseDriver);$('restart').addEventListener('click',()=>online.active?chooseDriver():startRace());$('race-again').addEventListener('click',()=>online.active?chooseDriver():startRace());
$('confirm-driver').addEventListener('click',startRace);$('change-driver').addEventListener('click',chooseDriver);
$('back-to-intro').addEventListener('click',()=>{state='intro';show('driver-select',false);for(const id of ['intro','circuit-card','intro-footer'])show(id);$('start').focus({preventScroll:true});world.cameraReady=false;});
for(const radio of document.querySelectorAll('input[name="driver"]'))radio.addEventListener('change',()=>selectDriver(Number(radio.value)));
$('driver-view').setAttribute('aria-pressed','true');
$('driver-view').addEventListener('click',()=>{world.showDriver=!world.showDriver;show('driver-inset',world.showDriver);$('driver-view').setAttribute('aria-pressed',String(world.showDriver));});
let orbitPointer=null,orbitX=0;
$('driver-orbit').addEventListener('pointerdown',e=>{orbitPointer=e.pointerId;orbitX=e.clientX;e.currentTarget.setPointerCapture(e.pointerId);});
$('driver-orbit').addEventListener('pointermove',e=>{if(e.pointerId!==orbitPointer||!world.portrait)return;world.portrait.yaw=clamp(world.portrait.yaw+(e.clientX-orbitX)*.008,-.85,.85);orbitX=e.clientX;});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('driver-orbit').addEventListener(event,()=>{orbitPointer=null;});
$('pause').addEventListener('click',pauseRace);$('resume').addEventListener('click',resumeRace);
$('camera').addEventListener('click',()=>{world.cameraMode=(world.cameraMode+1)%3;world.cameraReady=false;announce(['CHASE CAMERA','LOW CAMERA','DRIVER CAMERA'][world.cameraMode],1400);});
$('reset').addEventListener('click',()=>{if(state==='racing'){if(online.active)online.resetRequested=true;else race.resetPlayer();world.cameraReady=false;}});
$('sound').addEventListener('click',()=>{engine.enabled=!engine.enabled;if(engine.enabled)engine.start();$('sound').setAttribute('aria-pressed',String(engine.enabled));$('sound').setAttribute('aria-label',engine.enabled?'Mute engine sound':'Enable engine sound');});
if(!document.documentElement.requestFullscreen&&!document.documentElement.webkitRequestFullscreen)show('fullscreen',false);
$('fullscreen').addEventListener('click',async()=>{
  try{if(document.fullscreenElement||document.webkitFullscreenElement){await (document.exitFullscreen?.()??document.webkitExitFullscreen?.());}else{const element=document.documentElement;await (element.requestFullscreen?.()??element.webkitRequestFullscreen?.());}}catch{announce('Fullscreen is unavailable in this browser.',2300);}
});
document.addEventListener('fullscreenchange',()=>{$('fullscreen').setAttribute('aria-label',document.fullscreenElement?'Exit fullscreen':'Enter fullscreen');world.resize();});
window.addEventListener('resize',()=>world.resize());
window.visualViewport?.addEventListener('resize',()=>world.resize());

const gameKeys=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight','KeyC','KeyR','KeyP','Escape']);
window.addEventListener('keydown',e=>{
  if(e.target.matches('input,textarea')||state==='lobby')return;
  if(gameKeys.has(e.code)&&['racing','countdown','paused'].includes(state))e.preventDefault();
  if(e.repeat)return;
  if(e.code==='KeyP'||e.code==='Escape'){if(state==='paused')resumeRace();else if(state==='select'&&e.code==='Escape')$('back-to-intro').click();else pauseRace();return;}
  if(['intro','select','finished'].includes(state)&&e.code==='Enter'){e.preventDefault();if(state==='intro')chooseDriver();else startRace();return;}
  if(state==='select')return;
  if(state!=='racing'&&state!=='countdown')return;
  if(e.code==='KeyC'){$('camera').click();return;}
  if(e.code==='KeyR'){$('reset').click();return;}
  keys.add(e.code);
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{clearInput();pauseRace();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();pauseRace();}});
for(const button of document.querySelectorAll('[data-control]')){
  button.addEventListener('pointerdown',e=>{e.preventDefault();if(state!=='racing'&&state!=='countdown')return;button.setPointerCapture(e.pointerId);touches.set(e.pointerId,button.dataset.control);button.classList.add('pressed');});
  const release=e=>{touches.delete(e.pointerId);if(![...touches.values()].includes(button.dataset.control))button.classList.remove('pressed');};
  button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
  button.addEventListener('contextmenu',e=>e.preventDefault());
}
document.addEventListener('keydown',e=>{
  if(e.code!=='Tab'||!['paused','finished','select'].includes(state))return;
  const modal=$(state==='paused'?'pause-screen':state==='select'?'driver-select':'results'),buttons=[...modal.querySelectorAll('input:checked,button:not([disabled])')],first=buttons[0],last=buttons.at(-1);
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
});
$('world').addEventListener('webglcontextlost',e=>{e.preventDefault();pauseRace();$('error-message').textContent='The graphics connection was interrupted. Reload the game to get back on track.';show('error');});

function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min((now-(lastNow||now))/1000,.06);lastNow=now;getInput();
  if(state==='countdown'){
    if(online.active)countdownTime=Math.max(.01,(online.room.startAt-online.serverNow)/1000);else countdownTime-=dt;
    const text=countdownTime>3?'':countdownTime>0?String(Math.ceil(Math.min(3,countdownTime))):'GO';
    if(text!==lastCountdown){$('countdown').textContent=text;lastCountdown=text;if(text)engine.beep(text==='GO'?880:440,text==='GO'?.3:.12);}
    if(countdownTime<=0){state='racing';accumulator=0;announce('BRAKE BEFORE BENDS · BOOST ON STRAIGHTS',3200);}
  }
  if(state==='racing'){
    accumulator+=dt;
    while(accumulator>=1/60&&!race.done){if(online.active){if(Date.now()-online.lastSuccess<500&&!race.player.finished)race.drive(race.player,input,1/60);}else race.update(1/60,input);accumulator-=1/60;}
    for(const event of race.events.splice(0)){
      if(event.type==='hit')engine.hit(event.force);
      if(event.type==='reset')announce('BACK ON TRACK',1400);
      if(event.type==='lap'&&!race.done){announce(event.lap===TOTAL_LAPS?'FINAL LAP':`LAP ${event.lap} / ${TOTAL_LAPS} · ${fmt(event.time)}`,2700);engine.beep(660,.2);}
      if(event.type==='finish')finishRace();
    }
    if(race.time>.65)show('countdown',false);
    const p=race.player,roadHeading=Math.atan2(p.frame.tx,p.frame.tz);
    if(Math.abs(angleDelta(p.heading,roadHeading))>Math.PI*.58&&Math.abs(p.speed)>3){lastWrongWay+=dt;if(lastWrongWay>1.4){announce('WRONG WAY · USE RESET TO REJOIN',1200);lastWrongWay=0;}}else lastWrongWay=0;
  }
  if(now>messageUntil)show('announcement',false);
  engine.update(race.player,state==='racing'||state==='countdown');
  hudTimer+=dt;if(hudTimer>.06){updateHud();hudTimer=0;}
  if(state==='countdown'&&race.time<.05&&countdownTime<3.8&&!marshalSpeech.spoken){announce("Kıh kıh kıh… Let’s start!",3500);marshalSpeech.play(engine.enabled);}
  if(state==='paused'||!engine.enabled)marshalSpeech.stop();
  world.starter.speaking=marshalSpeech.speaking;
  world.starterRemaining=countdownTime;
  world.render(state==='paused'?0:dt,state);
}

$('track-length').textContent=(track.length/1000).toFixed(1);drawMap($('preview-map'),false);
$('start').disabled=false;$('start-label').textContent='KARAKTER SEÇ';
$('start-hint').textContent=coarse?'Tablette dokunarak oyna · Yatay ekran önerilir.':'Choose your driver · WASD or arrow keys to drive';
$('driver-control-hint').textContent=coarse?'Solda yön, sağda gaz ve fren. Birden fazla düğmeye birlikte basabilirsin.':'WASD / Arrows · Drive   Shift · Boost   Space · Handbrake';
world.loadDrivers().then(()=>{$('online-play').disabled=false;$('confirm-driver').disabled=false;$('confirm-driver').innerHTML='YARIŞA BAŞLA <span>→</span>';}).catch(error=>{console.error(error);$('confirm-driver').disabled=false;$('confirm-driver').textContent='YÜZLER YÜKLENEMEDİ · YENİLE';$('confirm-driver').onclick=()=>location.reload();});
requestAnimationFrame(frame);
