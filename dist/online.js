export function socketURL(){const url=new URL(globalThis.RACING_SERVER_URL||'/online',location.origin);if(url.protocol==='https:')url.protocol='wss:';if(url.protocol==='http:')url.protocol='ws:';return url.href;}
export class OnlineRoom {
 constructor({onRoom,onError,getInput}){Object.assign(this,{onRoom,onError,getInput,active:false,generation:0,seq:0,offset:0,latency:0,revision:-1,lastSuccess:0});}
 async enter(driver,code=null){
  this.close();const generation=this.generation;
  await new Promise((resolve,reject)=>{
   const socket=this.socket=new WebSocket(socketURL());let joined=false;
   const timeout=setTimeout(()=>{reject(new Error('Yarış sunucusuna bağlanılamadı.'));socket.close();},10000);
   socket.onopen=()=>{this.send({type:code?'join':'create',driver,code});this.ping();};
   socket.onmessage=event=>{
    if(generation!==this.generation)return;
    let data;try{data=JSON.parse(event.data);}catch{return;}
    if(data.type==='pong'){this.latency=Date.now()-data.sentAt;this.offset=data.serverNow-(data.sentAt+Date.now())/2;this.lastSuccess=Date.now();return;}
    if(data.type==='error'){const error=new Error(data.message);if(!joined){clearTimeout(timeout);reject(error);socket.close();}else this.onError(error,false);return;}
    if(data.type!=='room')return;const room=data.room;
    if(!joined){joined=true;clearTimeout(timeout);this.active=true;this.code=room.code;this.slot=room.slot;this.offset=room.serverNow-Date.now();resolve();
     this.timer=setInterval(()=>{this.send({type:'input',seq:this.seq++,input:this.getInput(),reset:this.resetRequested===true});this.resetRequested=false;},50);
     this.heartbeat=setInterval(()=>{this.ping();if(Date.now()-this.lastSuccess>3000)this.onError(new Error('Bağlantı bekleniyor…'),false);},1000);
    }
    if(room.revision<this.revision)return;this.lastSuccess=Date.now();this.revision=room.revision;this.room=room;this.onRoom(room);
   };
   socket.onerror=()=>{if(!joined){clearTimeout(timeout);reject(new Error('Yarış sunucusuna bağlanılamadı.'));}};
   socket.onclose=()=>{clearTimeout(timeout);if(generation!==this.generation)return;const wasActive=this.active;this.close(false);if(!joined)reject(new Error('Yarış sunucusuna bağlanılamadı.'));else if(wasActive)this.onError(new Error('Bağlantı kesildi. Yeni bir oda oluşturun.'),true);};
  });
 }
 send(data){if(this.socket?.readyState===WebSocket.OPEN&&this.socket.bufferedAmount<16000)this.socket.send(JSON.stringify(data));}
 ping(){this.send({type:'ping',sentAt:Date.now()});}
 async action(type){if(!this.active)throw new Error('Odaya bağlı değilsin.');this.send({type});}
 close(notify=true){this.generation++;clearInterval(this.timer);clearInterval(this.heartbeat);if(notify)this.send({type:'leave'});this.socket?.close();this.socket=null;this.active=false;this.room=null;this.revision=-1;this.seq=0;this.resetRequested=false;}
 get serverNow(){return Date.now()+this.offset;}
}
