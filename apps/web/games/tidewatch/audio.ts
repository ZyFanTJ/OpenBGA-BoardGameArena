/** Original synthesized cues; no remote audio, autoplay, timers or sample downloads. */
export class TideAudio {
 context:AudioContext|null=null;enabled=false;last=new Map<string,number>();
 toggle(){this.enabled=!this.enabled;if(this.enabled){this.context??=new AudioContext();void this.context.resume();this.play('build');}return this.enabled;}
 play(kind:string){if(!this.enabled||!this.context||this.context.state!=='running')return;const ctx=this.context,now=ctx.currentTime;if(now-(this.last.get(kind)??-10)<(kind==='build'?.1:.15))return;this.last.set(kind,now);
  const notes:Record<string,number[]>={arrow:[520,260],mortar:[120,42],frost:[780,420],storm:[230,850],beacon:[880,660],build:[660,990],skill:[140,560]};const [a,b]=notes[kind]??[400,250],osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=kind==='mortar'?'triangle':'sine';osc.frequency.setValueAtTime(a,now);osc.frequency.exponentialRampToValueAtTime(b,now+.12);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.035,now+.01);gain.gain.exponentialRampToValueAtTime(.0001,now+.17);osc.connect(gain);gain.connect(ctx.destination);osc.start(now);osc.stop(now+.18);osc.onended=()=>{osc.disconnect();gain.disconnect();};
 }
 dispose(){void this.context?.close();this.context=null;this.enabled=false;}
}
