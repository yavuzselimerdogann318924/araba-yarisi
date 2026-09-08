import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeStarter,updateStarter,starterPose} from '../dist/starter.js';
import {Circuit,ROAD_HALF} from '../dist/simulation.js';
test('marshal is textured-photo-free 3D geometry with articulated walking and flag',()=>{
 const npc=makeStarter(),track=new Circuit();let vertices=0;
 npc.root.traverse(obj=>{if(obj.isMesh){assert(!obj.material.map);const p=obj.geometry.attributes.position;vertices+=p.count;assert([...p.array].every(Number.isFinite));}});
 assert(vertices>1000);assert.equal(npc.legs.length,2);assert.equal(npc.arms.length,2);
 updateStarter(npc,track,6,0,true,1);const walkAngle=npc.legs[0].hip.rotation.x;assert.notEqual(walkAngle,0);
 updateStarter(npc,track,1,0,true,6);assert(Math.abs(npc.legs[0].hip.rotation.x)<1e-9);assert(npc.arms[1].shoulder.rotation.z<-2);
 for(const remaining of [7,5,3,1,0]){updateStarter(npc,track,remaining,0,true,7-remaining);const pose=starterPose(remaining,0,true),f=track.at(pose.s);const lateral=(npc.root.position.x-f.x)*f.nx+(npc.root.position.z-f.z)*f.nz;assert(lateral>ROAD_HALF+1);}
 assert(starterPose(0,0,true).signal>.99);assert.equal(starterPose(0,5,false).walking,false);
});
