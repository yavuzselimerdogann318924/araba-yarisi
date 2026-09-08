import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {createGameServer} from '../server/index.mjs';
const waitMessage=(socket,predicate)=>new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{socket.off('message',receive);reject(Error('Message timeout'));},3000);function receive(bytes){const data=JSON.parse(bytes.toString());if(predicate(data)){clearTimeout(timeout);socket.off('message',receive);resolve(data);}}socket.on('message',receive);});
test('real sockets: two drivers, full-speed clock independent of packet rate, shared pause',async()=>{
 let now=100000;const app=createGameServer({clock:()=>now,autoTick:false});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
 const address='ws://127.0.0.1:'+app.server.address().port+'/online';const clients=[];
 try{
  for(let i=0;i<3;i++){const ws=new WebSocket(address);clients.push(ws);await once(ws,'open');}
  const [a,b,c]=clients;
  const first=waitMessage(a,d=>d.type==='room');a.send(JSON.stringify({type:'create',driver:0}));const {room}=await first;
  const joined=waitMessage(b,d=>d.type==='room');b.send(JSON.stringify({type:'join',code:room.code,driver:1}));assert.equal((await joined).room.slot,1);
  const rejected=waitMessage(c,d=>d.type==='error');c.send(JSON.stringify({type:'join',code:room.code,driver:1}));assert.match((await rejected).message,/dolu/);
  const forbidden=waitMessage(b,d=>d.type==='error');b.send(JSON.stringify({type:'start'}));assert.match((await forbidden).message,/sahibi/);
  const starting=waitMessage(a,d=>d.room?.phase==='countdown');a.send(JSON.stringify({type:'start'}));const start=(await starting).room.startAt;
  now=start;
  for(const ws of [a,b]){ws.send(JSON.stringify({type:'input',seq:1,input:{throttle:1}}));const pong=waitMessage(ws,d=>d.type==='pong');ws.send(JSON.stringify({type:'ping',sentAt:now}));await pong;}
  app.tick();now+=1000;app.tick();const game=app.rooms.get(room.code).game;
  assert(Math.abs(game.time-1)<.02,`1 wall-clock second advanced ${game.time}s`);
  assert(game.cars[0].speed>10);assert(game.cars[1].speed>10);
  const paused=waitMessage(a,d=>d.room?.phase==='paused');b.send(JSON.stringify({type:'pause'}));await paused;const time=game.time;now+=1000;app.tick();assert.equal(game.time,time);
  const ended=waitMessage(b,d=>d.room?.phase==='closed');a.close();await ended;assert.equal(app.rooms.size,0);
 }finally{clients.forEach(c=>c.terminate());await app.close();}
});
test('same-domain hosting serves config and blocks private build files',async()=>{
 const app=createGameServer();app.server.listen(0,'127.0.0.1');await once(app.server,'listening');const base='http://127.0.0.1:'+app.server.address().port;
 try{assert.equal((await fetch(base+'/')).status,200);assert.equal((await fetch(base+'/server-config.js')).status,200);assert.equal((await fetch(base+'/.openai/hosting.json')).status,404);assert.equal((await fetch(base+'/server/index.js')).status,404);}finally{await app.close();}
});
test('game client creates and joins using the new transport',async()=>{
 const app=createGameServer();app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
 globalThis.location={origin:'http://127.0.0.1:'+app.server.address().port};globalThis.WebSocket=WebSocket;
 const {OnlineRoom}=await import('../dist/online.js');const errors=[];const options={onRoom:()=>{},onError:e=>errors.push(e.message),getInput:()=>({throttle:1})};const host=new OnlineRoom(options),guest=new OnlineRoom(options);
 try{await host.enter(0);await guest.enter(1,host.code);assert(host.active&&guest.active);assert.equal(guest.slot,1);assert.equal(host.code,guest.code);await host.action('start');await new Promise(resolve=>setTimeout(resolve,100));assert.equal(guest.room.phase,'countdown');assert.equal(errors.length,0);}finally{host.close(false);guest.close(false);await app.close();delete globalThis.location;}
});
