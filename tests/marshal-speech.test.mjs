import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MarshalSpeech} from '../dist/marshal-speech.js';
import {makeStarter} from '../dist/starter.js';
import {animateFittedFace} from '../dist/fitted-head.js';
test('speech uses requested phrase once and cancels on pause',()=>{
 const lines=[];let cancelled=0;
 globalThis.speechSynthesis={getVoices:()=>[],speak:u=>lines.push(u),cancel:()=>cancelled++};globalThis.SpeechSynthesisUtterance=class {constructor(text){this.text=text;}};
 try{const speech=new MarshalSpeech();speech.play();speech.play();assert.deepEqual(lines.map(l=>l.text),['kıh kıh kıh','let’s start']);lines[0].onstart();assert(speech.speaking);speech.stop();assert.equal(cancelled,1);assert(!speech.speaking);lines[1].onstart();assert(!speech.speaking);}finally{delete globalThis.speechSynthesis;delete globalThis.SpeechSynthesisUtterance;}
});
test('speaking deforms the 3D mouth and restores neutral geometry',()=>{
 const npc=makeStarter(),face=npc.head.getObjectByName('reference-fitted-face'),p=face.geometry.attributes.position;const rest=Array.from(p.array);
 animateFittedFace(npc.head,.1,true);assert(rest.some((v,i)=>Math.abs(v-p.array[i])>1e-5));animateFittedFace(npc.head,.2,false);assert.deepEqual(Array.from(p.array),rest);
});
