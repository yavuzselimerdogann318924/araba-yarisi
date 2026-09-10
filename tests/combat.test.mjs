import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Circuit,Race} from '../dist/simulation.js';
import {CombatVisuals} from '../dist/combat-visuals.js';
import {Scene} from '../dist/vendor/three.module.js';
const track=new Circuit();
function setup(){const r=new Race(track,{multiplayer:true});r.cars.slice(2).forEach(c=>c.finished=true);for(const [id,s] of [[0,100],[1,120]]){const c=r.cars[id],f=track.at(s);Object.assign(c,{progress:s,lastS:s,frame:f,x:f.x,z:f.z,y:f.y,heading:Math.atan2(f.tx,f.tz)});}return r;}
test('front targeting, cooldown, swept hit, two-second respawn and protection',()=>{
 const r=setup(),[a,b]=r.cars;assert.equal(r.targetFor(a),b);assert.equal(r.targetFor(b),null);assert(r.fire(a));assert.equal(r.fire(a),false);
 for(let i=0;i<120&&!b.respawnAt;i++)r.update(1/60,{},{});
 assert(b.respawnAt>0);const at=r.time,progress=b.progress,gate=b.nextGate;
 assert.equal(b.respawnAt-at,2);const x=b.x,z=b.z;r.resetPlayer(b);r.drive(b,{throttle:1},1);assert.equal(b.x,x);assert.equal(b.z,z);assert.equal(r.fire(b),false);
 for(let i=0;i<119;i++)r.update(1/60,{},{});
 assert(b.respawnAt>0);assert.equal(b.progress,progress);assert.equal(b.nextGate,gate);
 r.update(1/60,{},{});assert.equal(b.respawnAt,0);assert(b.shieldUntil>r.time);assert.equal(b.speed,0);assert.equal(r.targetFor(a),null);
});
test('snapshot preserves combat for both players and visual pools render it',()=>{
 const host=setup();host.fire(host.cars[0]);const guest=new Race(track,{playerId:1,multiplayer:true});guest.hydrate(JSON.parse(JSON.stringify(host.serialize())));
 assert.deepEqual(guest.missiles,host.missiles);assert.notEqual(guest.missiles[0],host.missiles[0]);
 const visuals=new CombatVisuals(new Scene());visuals.update(guest);assert.equal(visuals.missiles[0].visible,true);
 for(let i=0;i<40;i++)host.update(1/60,{},{});guest.hydrate(JSON.parse(JSON.stringify(host.serialize())));visuals.update(guest);
 assert.equal(guest.player.respawnAt,host.cars[1].respawnAt);assert.equal(visuals.missiles[0].visible,false);assert.equal(visuals.explosions[0].visible,true);
 host.reset();assert.equal(host.missiles.length,0);assert.equal(host.explosions.length,0);
});
test('either human slot fires; finished cars cannot attack or be targeted',()=>{
 const r=setup();r.cars[1].heading+=Math.PI;assert(r.fire(r.cars[1]));assert.equal(r.missiles[0].owner,1);
 r.cars[0].finished=true;assert.equal(r.targetFor(r.cars[1]),null);assert.equal(r.fire(r.cars[0]),false);
});
