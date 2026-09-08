import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {WebSocketServer,WebSocket} from 'ws';
import {Circuit,Race} from '../dist/simulation.js';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const zero=()=>({throttle:0,brake:0,steer:0,boost:false,handbrake:false});
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code=()=>Array.from(randomBytes(6),b=>alphabet[b%alphabet.length]).join('');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.jpeg':'image/jpeg','.svg':'image/svg+xml'};
function controls(value={}){if(!value||typeof value!=='object')throw Error('Geçersiz kontrol.');const result=zero();for(const key of ['throttle','brake','steer']){const n=value[key]??0;if(!Number.isFinite(n)||n>(1)||n<(key==='steer'?-1:0))throw Error('Geçersiz kontrol.');result[key]=n;}result.boost=value.boost===true;result.handbrake=value.handbrake===true;return result;}
export function createGameServer({clock=()=>Date.now(),autoTick=true,allowedOrigins=(process.env.ALLOWED_ORIGINS||'').split(',').filter(Boolean)}={}){
 const rooms=new Map(),track=new Circuit();
 const send=(socket,data)=>{if(socket.readyState===WebSocket.OPEN&&socket.bufferedAmount<128000)socket.send(JSON.stringify(data));};
 const snapshot=(room,slot)=>({code:room.code,slot,phase:room.phase,startAt:room.startAt,serverNow:clock(),reason:room.reason,revision:room.revision,players:room.players.map(p=>p?{driver:p.driver,connected:p.socket.readyState===WebSocket.OPEN}:null),race:room.game.serialize()});
 function broadcast(room){room.revision++;room.players.forEach((p,slot)=>{if(p)send(p.socket,{type:'room',room:snapshot(room,slot)});});}
 function closeRoom(room,reason){room.phase='closed';room.reason=reason;broadcast(room);rooms.delete(room.code);room.players.forEach(p=>{if(p){p.socket.room=null;p.socket.close(1000,'Room closed');}});}
 const server=createServer(async(req,res)=>{
  try{
   const path=decodeURIComponent(new URL(req.url,'http://local').pathname);
   if(path==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,transport:'websocket'}));return;}
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
   const parts=path.split('/');if(parts.some(p=>p.startsWith('.')||p==='server'))throw Error();
   const file=resolve(root,'.'+(path==='/'?'/index.html':path));if(!file.startsWith(root))throw Error();
   const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);
  }catch{res.writeHead(404);res.end('Not found');}
 });
 const sockets=new WebSocketServer({noServer:true,maxPayload:4096,perMessageDeflate:false});
 server.on('upgrade',(req,socket,head)=>{
  const origin=req.headers.origin;
  let validOrigin=!origin;try{validOrigin=validOrigin||new URL(origin).host===req.headers.host||allowedOrigins.includes(origin);}catch{}
  if(req.url!=='/online'||!validOrigin||sockets.clients.size>=400){socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');socket.destroy();return;}
  sockets.handleUpgrade(req,socket,head,ws=>sockets.emit('connection',ws,req));
 });
 sockets.on('connection',socket=>{
  socket.seen=clock();socket.window=clock();socket.count=0;
  socket.on('error',()=>{});
  socket.on('message',bytes=>{
   let message;
   try{
    message=JSON.parse(bytes.toString());if(!message||typeof message!=='object')throw Error('Geçersiz istek.');
    if(clock()-socket.window>1000){socket.window=clock();socket.count=0;}if(++socket.count>100)throw Error('Çok fazla istek.');
    socket.seen=clock();
    if(message.type==='ping'){send(socket,{type:'pong',sentAt:message.sentAt,serverNow:clock()});return;}
    if(message.type==='create'||message.type==='join'){
     if(socket.room)throw Error('Zaten bir odadasın.');if(message.driver!==0&&message.driver!==1)throw Error('Karakter seç.');
     let room;
     if(message.type==='create'){
      if(rooms.size>=200)throw Error('Sunucu dolu. Daha sonra dene.');
      let id;do{id=code();}while(rooms.has(id));
      const game=new Race(track,{multiplayer:true}),f=track.at(12);Object.assign(game.cars[1],{x:f.x+f.nx*2.8,z:f.z+f.nz*2.8,y:f.y,heading:Math.atan2(f.tx,f.tz),progress:12,lastS:12,frame:f});
      room={code:id,game,players:[null,null],phase:'lobby',reason:'Arkadaşın bekleniyor.',startAt:0,revision:0,stepAt:clock(),created:clock()};rooms.set(id,room);socket.slot=0;
     }else{room=rooms.get(String(message.code).toUpperCase());if(!room)throw Error('Oda bulunamadı.');if(room.phase!=='lobby'||room.players[1])throw Error('Bu oda dolu veya yarış başlamış.');socket.slot=1;room.reason='İki oyuncu hazır. Oda sahibi yarışı başlatabilir.';}
     socket.room=room;room.players[socket.slot]={socket,driver:message.driver,input:zero(),seq:-1,resetAt:-Infinity};broadcast(room);return;
    }
    const room=socket.room;if(!room)throw Error('Önce bir odaya katıl.');const p=room.players[socket.slot];
    if(message.type==='input'){
     if(!Number.isSafeInteger(message.seq)||message.seq<=p.seq)return;
     p.input=controls(message.input);p.seq=message.seq;
     if(message.reset&&room.phase==='racing'&&clock()-p.resetAt>1500){room.game.resetPlayer(room.game.cars[socket.slot]);p.resetAt=clock();}return;
    }
    if(message.type==='start'){
     if(socket.slot!==0)throw Error('Yarışı oda sahibi başlatır.');if(room.phase!=='lobby'||!room.players[1])throw Error('İkinci oyuncuyu bekle.');
     room.phase='countdown';room.startAt=clock()+3000;room.stepAt=room.startAt;room.reason='Yarış başlıyor.';
    }else if(message.type==='pause'){
     if(['racing','countdown'].includes(room.phase)){room.phase='paused';room.reason='Oyunculardan biri yarışı duraklattı.';room.players.forEach(p=>p.input=zero());}
    }else if(message.type==='resume'){
     if(room.phase!=='paused'||room.players.some(p=>!p||clock()-p.socket.seen>3000))throw Error('İki oyuncunun da bağlı olması gerekiyor.');room.phase='countdown';room.startAt=clock()+3000;room.stepAt=room.startAt;
    }else if(message.type==='leave'){closeRoom(room,'Bir oyuncu odadan ayrıldı.');return;}else throw Error('Geçersiz işlem.');
    broadcast(room);
   }catch(e){send(socket,{type:'error',message:e.message});}
  });
  socket.on('close',()=>{if(socket.room)closeRoom(socket.room,'Diğer oyuncunun bağlantısı kesildi. Yeni oda oluşturun.');});
 });
 function tick(){const now=clock();
  for(const room of rooms.values()){
   if(now-room.created>30*60*1000){closeRoom(room,'Odanın süresi doldu.');continue;}
   if(room.phase==='countdown'&&now>=room.startAt){room.phase='racing';room.stepAt=room.startAt;}
   if(room.phase!=='racing')continue;
   if(room.players.some(p=>now-p.socket.seen>3000)||now-room.stepAt>3000){room.phase='paused';room.reason='Bağlantı kesintisi. İki oyuncu da bağlıyken devam edin.';broadcast(room);continue;}
   // Advance independently of network messages, retaining the fractional step.
   while(now-room.stepAt>=1000/60&&!room.game.done){room.game.update(1/60,...room.players.map(p=>p.input));room.stepAt+=1000/60;}
   if(room.game.done){room.phase='finished';room.reason='Yarış tamamlandı.';broadcast(room);}
  }
  for(const socket of sockets.clients)if(now-socket.seen>15000)socket.terminate();
 }
 const timer=autoTick?setInterval(tick,1000/60):null;
 const snapshots=autoTick?setInterval(()=>rooms.forEach(broadcast),50):null;
 return {server,rooms,tick,broadcast,async close(){clearInterval(timer);clearInterval(snapshots);for(const socket of sockets.clients)socket.terminate();await new Promise(r=>sockets.close(r));await new Promise(r=>server.close(r));}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const app=createGameServer();app.server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Racing server ready'));}
