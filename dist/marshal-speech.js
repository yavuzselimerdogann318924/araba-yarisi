export class MarshalSpeech {
 constructor(){this.spoken=false;this.speaking=false;this.queued=false;this.generation=0;}
 stop(){this.generation++;if(this.queued&&globalThis.speechSynthesis)globalThis.speechSynthesis.cancel();this.speaking=false;this.queued=false;}
 reset(){this.stop();this.spoken=false;}
 play(enabled=true){
  if(this.spoken)return;this.spoken=true;
  if(!enabled||!globalThis.speechSynthesis||!globalThis.SpeechSynthesisUtterance)return;
  this.queued=true;const generation=++this.generation,voices=speechSynthesis.getVoices();
  const parts=[['kıh kıh kıh','tr-TR'],["let’s start",'en-US']];
  for(const [text,lang] of parts){const line=new SpeechSynthesisUtterance(text);line.lang=lang;line.rate=.95;line.pitch=1.1;const voice=voices.find(v=>v.lang.toLowerCase().startsWith(lang.slice(0,2)));if(voice)line.voice=voice;
   line.onstart=()=>{if(generation===this.generation)this.speaking=true;};
   line.onend=line.onerror=()=>{if(generation===this.generation){this.speaking=false;if(lang==='en-US')this.queued=false;}};
   speechSynthesis.speak(line);
  }
 }
}
