// Original procedural score. No remote audio, samples, or copyrighted music.
let ctx, fxBus, musicBus, master, timer, step=0, next=0, enabled=true, wanted=false, scene='home';
let volumes={master:.7,music:.36,fx:.64};
try{volumes={...volumes,...JSON.parse(localStorage.getItem('hs-volumes')||'{}')}}catch{}
const midi=n=>440*2**((n-69)/12);
function init(){
 if(ctx)return ctx;
 const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;
 ctx=new AC();master=ctx.createGain();master.gain.value=volumes.master;
 const comp=ctx.createDynamicsCompressor();comp.threshold.value=-18;comp.ratio.value=4;master.connect(comp);comp.connect(ctx.destination);
 fxBus=ctx.createGain();musicBus=ctx.createGain();fxBus.gain.value=volumes.fx;musicBus.gain.value=volumes.music;fxBus.connect(master);musicBus.connect(master);
 const delay=ctx.createDelay(2),feedback=ctx.createGain(),wet=ctx.createGain();delay.delayTime.value=.375;feedback.gain.value=.29;wet.gain.value=.21;musicBus.connect(delay);delay.connect(feedback);feedback.connect(delay);delay.connect(wet);wet.connect(master);
 return ctx;
}
export function unlockAudio(){try{let c=init();if(!c)return false;if(c.state==='suspended')c.resume().catch(()=>{});if(wanted&&!timer)start();return true}catch{return false}}
function tone(freq,time,duration,volume=.1,type='sine',bus=fxBus,pan=0){
 const o=ctx.createOscillator(),g=ctx.createGain(),p=ctx.createStereoPanner();o.type=type;o.frequency.value=freq;p.pan.value=pan;
 g.gain.setValueAtTime(.00001,time);g.gain.exponentialRampToValueAtTime(Math.max(.0001,volume),time+.018);g.gain.exponentialRampToValueAtTime(.00001,time+duration);
 o.connect(g);g.connect(p);p.connect(bus);o.start(time);o.stop(time+duration+.02);o.onended=()=>{o.disconnect();g.disconnect();p.disconnect()};return o;
}
function sweep(time,duration=.16,volume=.08){let len=Math.ceil(ctx.sampleRate*duration),b=ctx.createBuffer(1,len,ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len)**2;let src=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();src.buffer=b;f.type='bandpass';f.frequency.setValueAtTime(3200,time);f.frequency.exponentialRampToValueAtTime(350,time+duration);g.gain.value=volume;src.connect(f);f.connect(g);g.connect(fxBus);src.start(time);src.onended=()=>{src.disconnect();f.disconnect();g.disconnect()}}
export function sound(name='click'){
 if(!enabled||!unlockAudio())return;
 const t=ctx.currentTime;
 const sequences={click:[76],hover:[81],draw:[57,64,69],select:[69,76],up:[60,64,69,76],down:[81,76,69,64],collect:[72,76,79,84],attack:[50,49,38],pass:[60,55],error:[50,49],win:[60,64,67,72,76,79,84],turn:[69,76],ready:[67,74,79]};
 const notes=sequences[name]||sequences.click,win=name==='win';
 notes.forEach((n,i)=>{tone(midi(n),t+i*(win?.12:.047),win?1.1:name==='hover'?.07:.3,name==='click'?.075:name==='hover'?.025:.11,name==='attack'?'triangle':'sine',fxBus,(i%2?1:-1)*.22);if(name==='collect'||win)tone(midi(n+12),t+i*(win?.12:.047)+.012,.55,.025,'sine')});
 if(['draw','up','down','attack'].includes(name))sweep(t,.22,.13);
}
const chords=[[45,52,57,60,64,71],[41,48,53,57,60,64],[48,55,60,64,67,74],[43,50,55,59,62,69]];
function schedule(){
 if(!ctx||ctx.state!=='running'||!wanted)return;
 const beat=scene==='game'?.375:.46;
 while(next<ctx.currentTime+.16){
  const bar=Math.floor(step/16)%4,c=chords[bar],i=step%16;
  if(i===0){c.slice(1,5).forEach((n,j)=>{tone(midi(n),next,beat*15,.025,'sine',musicBus,(j-1.5)*.35);tone(midi(n+.07),next+.035,beat*13,.012,'triangle',musicBus,-(j-1.5)*.3)});tone(midi(c[0]),next,beat*8,.16,'sine',musicBus)}
  if(i===8)tone(midi(c[0]+12),next,beat*5,.065,'sine',musicBus);
  const pattern=[2,4,3,5,3,4,2,5,2,3,4,5,4,3,5,4];
  if(i%2===0||scene==='game')tone(midi(c[pattern[i]]+12),next,beat*2,.044,'sine',musicBus,(i%4-1.5)*.3);
  if(scene==='game'&&i%4===0)tone(65,next,.14,.055,'sine',musicBus);
  next+=beat;step++;
 }
}
function start(){if(!ctx||timer)return;next=ctx.currentTime+.06;step=0;musicBus.gain.setTargetAtTime(volumes.music,ctx.currentTime,.2);timer=setInterval(schedule,70);schedule()}
export function setMusic(v){wanted=!!v;if(!v){clearInterval(timer);timer=null;if(ctx)musicBus.gain.setTargetAtTime(.00001,ctx.currentTime,.15)}else if(ctx?.state==='running')start()}
export function setScene(v){scene=v}
export function setFX(v){enabled=!!v}
export function getVolumes(){return {...volumes}}
export function setVolume(key,value){if(!(key in volumes))return;volumes[key]=Math.max(0,Math.min(1,Number(value)||0));localStorage.setItem('hs-volumes',JSON.stringify(volumes));if(ctx){const g=key==='master'?master:key==='fx'?fxBus:musicBus;g.gain.setTargetAtTime(key==='music'&&!wanted?0:volumes[key],ctx.currentTime,.04)}}
export function speak(str,lang){if(!('speechSynthesis'in window))return;const u=new SpeechSynthesisUtterance(str);u.lang={ko:'ko-KR',en:'en-US',ja:'ja-JP',zh:'zh-CN'}[lang]||'ko-KR';u.rate=.96;window.speechSynthesis.cancel();window.speechSynthesis.speak(u)}
document.addEventListener('visibilitychange',()=>{if(!ctx)return;if(document.hidden){clearInterval(timer);timer=null;ctx.suspend().catch(()=>{})}else{ctx.resume().then(()=>{if(wanted)start()}).catch(()=>{})}});
