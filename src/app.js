(() => {
'use strict';
const $ = id => document.getElementById(id);
/* ------------------------------------------------------------------ *
 * SFX — self-contained WebAudio synth. No asset files; every sound is
 * generated from oscillators + filtered noise so the whole café feels
 * alive (bead clicks, pours, drawer slides, footsteps, iron sizzle) on
 * top of a soft looping music track. Lazily unlocked on first gesture.
 * ------------------------------------------------------------------ */
const SFX=(()=>{
 let ctx=null,master=null,enabled=true,ambientAudio=null,noiseCache=null,lastStep=0;
 try{enabled=localStorage.getItem('bead-house.sound')!=='off';}catch(_e){}
 function ensure(){
  if(ctx)return ctx;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;
  try{ctx=new AC();}catch(_e){return null;}
  master=ctx.createGain();master.gain.value=enabled?.9:0;
  const comp=ctx.createDynamicsCompressor();comp.threshold.value=-18;comp.ratio.value=4;
  master.connect(comp);comp.connect(ctx.destination);return ctx;
 }
 function noiseBuf(dur){if(!noiseCache||noiseCache.duration<dur){const n=Math.floor(ctx.sampleRate*Math.max(dur,2));const b=ctx.createBuffer(1,n,ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;noiseCache=b;}return noiseCache;}
 function tone(o){if(!enabled||!ensure())return;const t=ctx.currentTime,osc=ctx.createOscillator(),g=ctx.createGain(),dur=o.dur||.12;osc.type=o.type||'sine';osc.frequency.setValueAtTime(o.freq,t);if(o.bend)osc.frequency.exponentialRampToValueAtTime(Math.max(1,o.freq*o.bend),t+dur);const peak=o.gain==null?.2:o.gain;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(peak,t+(o.attack||.004));g.gain.exponentialRampToValueAtTime(.0001,t+dur);osc.connect(g);g.connect(o.dest||master);osc.start(t);osc.stop(t+dur+.03);}
 function noise(o){if(!enabled||!ensure())return;const t=ctx.currentTime,src=ctx.createBufferSource();src.buffer=noiseBuf(o.dur||.2);const f=ctx.createBiquadFilter();f.type=o.filter||'lowpass';f.frequency.setValueAtTime(o.cutoff||1200,t);if(o.q)f.Q.value=o.q;if(o.sweep)f.frequency.exponentialRampToValueAtTime(o.sweep,t+(o.dur||.2));const g=ctx.createGain(),peak=o.gain==null?.2:o.gain,dur=o.dur||.2;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(peak,t+(o.attack||.005));g.gain.exponentialRampToValueAtTime(.0001,t+dur);src.connect(f);f.connect(g);g.connect(o.dest||master);src.start(t);src.stop(t+dur+.03);}
 function startAmbient(){
  if(!ambientAudio){
   ambientAudio=new Audio('/assets/warm-drone.m4a');
   ambientAudio.loop=true;ambientAudio.preload='auto';ambientAudio.volume=.28;
  }
  if(!enabled)return;
  const playback=ambientAudio.play();
  if(playback&&typeof playback.catch==='function')playback.catch(()=>{});
 }
 const api={
  get enabled(){return enabled;},
  unlock(){if(!ensure())return;if(ctx.state==='suspended')ctx.resume();startAmbient();},
  toggle(){enabled=!enabled;try{localStorage.setItem('bead-house.sound',enabled?'on':'off');}catch(_e){}if(ensure()){master.gain.setTargetAtTime(enabled?.9:0,ctx.currentTime,.05);if(enabled)startAmbient();else ambientAudio?.pause();}return enabled;},
  place(){noise({dur:.05,filter:'bandpass',cutoff:2500+Math.random()*500,q:5,gain:.11});tone({freq:480+Math.random()*140,type:'triangle',dur:.075,gain:.08,bend:.55});},
  pick(){tone({freq:900+Math.random()*180,type:'sine',dur:.05,gain:.05,bend:1.25});},
  erase(){noise({dur:.08,filter:'lowpass',cutoff:1400,gain:.07,sweep:500});},
  pour(){noise({dur:.5,filter:'bandpass',cutoff:2200,q:1.2,gain:.08,sweep:900});for(let i=0;i<16;i++)setTimeout(()=>noise({dur:.035,filter:'bandpass',cutoff:2400+Math.random()*1600,q:7,gain:.05}),i*28+Math.random()*20);},
  shake(){for(let i=0;i<7;i++)setTimeout(()=>noise({dur:.04,filter:'bandpass',cutoff:2800+Math.random()*1800,q:8,gain:.06}),i*55+Math.random()*25);},
  drawer(){noise({dur:.36,filter:'lowpass',cutoff:360,gain:.1,sweep:820,attack:.02});},
  step(){const t=ensure()?ctx.currentTime:0;if(t&&t-lastStep<.18)return;lastStep=t;noise({dur:.1,filter:'lowpass',cutoff:260+Math.random()*80,gain:.045});},
  iron(){noise({dur:2.4,filter:'lowpass',cutoff:1700,gain:.06,attack:.6});},
  steam(){noise({dur:.7,filter:'highpass',cutoff:1800,gain:.03,attack:.25});},
  ui(){tone({freq:620,type:'sine',dur:.06,gain:.05,bend:1.2});},
  close(){tone({freq:360,type:'sine',dur:.08,gain:.05,bend:.7});},
  sip(){noise({dur:.28,filter:'lowpass',cutoff:700,gain:.05,sweep:300});},
  chime(){[523,659,784,1047].forEach((f,i)=>setTimeout(()=>tone({freq:f,type:'triangle',dur:.5,gain:.09,attack:.01}),i*110));}
 };
 const unlock=()=>api.unlock();
 window.addEventListener('pointerdown',unlock,{passive:true});
 window.addEventListener('keydown',unlock);
 return api;
})();
const scene = $('scene');
const gl = scene.getContext('webgl', { antialias:true, alpha:false, preserveDrawingBuffer:false }); // MSAA on the low-res buffer kills distant edge shimmer; nearest upscale still keeps crisp pixels
const ROOM = { minX:-16.4, maxX:16.4, minZ:-18.3, maxZ:20.4 };
const names = Array.from({length:12},(_,i)=>String.fromCharCode(65+i));
// Craft nooks, L-shaped groups and shared worktables are scattered naturally like a real handmade shop.
const positions=[[-10.05,-10.00],[-7.06,-9.60],[-9.54,-6.78],[-6.38,-6.46],
 [-2.60,-5.52],[0.39,-4.96],[-1.84,-2.26],
 [3.82,-4.38],[6.83,-3.92],[5.18,-.78],
 [2.03,4.51],[5.03,4.86]]
 .map(([x,z],i)=>({id:names[i],x,z}));
// finish: solid 实色 · jelly 透明果冻 · glow 夜光 · metal 金属珠光 · glitter 闪粉
// NOTE: the first 24 entries must stay in order — saved boards/gallery reference them by index.
const baseSwatches = [
 ['C-01','奶油白','#FDF6E8'],['C-02','米杏色','#EFD9B8'],['C-03','焦糖色','#D4A87F'],['C-04','深栗棕','#7D563D'],
 ['C-05','可可黑','#423A38'],['C-06','奶茶棕','#B98559'],['C-07','樱花粉','#F2AEB7'],['C-08','莓果红','#D76872'],
 ['C-09','番茄红','#E97967'],['C-10','橘子汽水','#F1AC68'],['C-11','柠檬黄','#F6D777'],['C-12','香草黄','#FFF0B1'],
 ['C-13','青柠绿','#A9CA8D'],['C-14','鼠尾草绿','#7FA48A'],['C-15','松树绿','#4D8179'],['C-16','天空蓝','#B2D7E7'],
 ['C-17','湖水蓝','#7CB5D3'],['C-18','海军蓝','#567CA4'],['C-19','薰衣草','#BEACD4'],['C-20','葡萄紫','#9A88BC'],
 ['C-21','蜜桃粉','#F6C9B6'],['C-22','胭脂红','#B87983'],['C-23','灰雾色','#B5AAA3'],['C-24','麦芽色','#CEBC92'],
 // extended solids
 ['C-25','玫红','#E85A8A'],['C-26','珊瑚橙','#F28A6B'],['C-27','芥末黄','#D9A52E'],['C-28','薄荷绿','#9BD8C0'],
 ['C-29','孔雀蓝','#2E8FA6'],['C-30','宝蓝','#3A5CC0'],['C-31','深紫','#6E4C9E'],['C-32','石墨灰','#5A5651'],
 ['C-33','纯白','#FFFFFF'],['C-34','纯黑','#2A2622'],
 // jelly 透明果冻
 ['C-35','果冻红','#F0576B','jelly'],['C-36','果冻橙','#F7A24C','jelly'],['C-37','果冻黄','#F6E05E','jelly'],
 ['C-38','果冻绿','#8FD672','jelly'],['C-39','果冻蓝','#6CC4E8','jelly'],['C-40','果冻紫','#B98BE0','jelly'],
 // glow 夜光
 ['C-41','夜光绿','#C9F27A','glow'],['C-42','夜光蓝','#A9E8F0','glow'],
 // metal 金属珠光
 ['C-43','珠光金','#D9BE7A','metal'],['C-44','珠光银','#C7CDD4','metal'],['C-45','珠光粉','#E9B9C9','metal'],
 // glitter 闪粉
 ['C-46','闪粉白','#F3EEE6','glitter'],['C-47','闪粉粉','#F2A8C4','glitter'],['C-48','闪粉蓝','#9FB8E6','glitter'],
 // more solids
 ['C-49','珊瑚红','#E8604E'],['C-50','青瓷绿','#7FB8A4'],['C-51','藏青','#2D3E6B'],['C-52','绛紫','#7A3E6B'],
 ['C-53','砖红','#A8503C'],['C-54','橄榄绿','#6E7A3C'],
 // more jelly / glow / metal / glitter
 ['C-55','果冻青','#5FD6C4','jelly'],['C-56','果冻粉','#F58FB5','jelly'],
 ['C-57','夜光粉','#F7C9E0','glow'],['C-58','珠光蓝','#AFC4E0','metal'],
 ['C-59','闪粉金','#E8CE8A','glitter'],['C-60','闪粉紫','#C4A8E0','glitter'],
 // extended palette — more solids across every family
 ['C-61','西瓜红','#F2556B'],['C-62','蜜桃橙','#FBA876'],['C-63','柠檬绿','#C6D870'],['C-64','嫩芽绿','#A7D98C'],
 ['C-65','晴空蓝','#6FB7E8'],['C-66','丁香紫','#C9A8DE'],['C-67','玫瑰粉','#ECA3BE'],['C-68','奶黄','#F5E1A0'],
 ['C-69','豆沙绿','#9AAE7A'],['C-70','雾霾蓝','#8FA6B8'],['C-71','可可棕','#6B4A33'],['C-72','浅灰','#CFC9BE'],
 ['C-73','深灰','#4A463F'],['C-74','象牙白','#F6F1E3'],['C-75','赤陶橙','#D97B46'],['C-76','墨绿','#37584A'],
 ['C-77','深海蓝','#1F2E52'],['C-78','酒红','#8B3A4A'],['C-79','芋泥紫','#9D8BA6'],['C-80','卡其','#B7A277'],
 // a few more finish beads
 ['C-81','果冻橙红','#F4705A','jelly'],['C-82','夜光黄','#EFF08C','glow'],['C-83','珠光薰紫','#C7B8DE','metal'],['C-84','闪粉青','#9EDBCD','glitter']
];
const swatches=baseSwatches.map(([id,name,hex,finish])=>({id,name,hex,finish:finish||'solid'}));
const colorLookup=Object.fromEntries(swatches.map(s=>[s.id,s.hex]));
const finishLookup=Object.fromEntries(swatches.map(s=>[s.id,s.finish]));
const FINISH_META={solid:{label:'实色',tag:''},jelly:{label:'透明果冻',tag:'果冻'},glow:{label:'夜光',tag:'夜光'},metal:{label:'金属珠光',tag:'珠光'},glitter:{label:'闪粉',tag:'闪粉'}};
function finishOf(id){return finishLookup[id]||'solid';}
function mixHex(hex,tr,t){const a=parseInt(hex.slice(1),16),b=parseInt(tr.slice(1),16);const r=Math.round(((a>>16)&255)*(1-t)+((b>>16)&255)*t),g=Math.round(((a>>8)&255)*(1-t)+((b>>8)&255)*t),bl=Math.round((a&255)*(1-t)+(b&255)*t);return '#'+((1<<24)+(r<<16)+(g<<8)+bl).toString(16).slice(1);}
// Finish-adjusted hex for 3D beads so special beads read differently under the shop lights.
function glHex(id){const f=finishOf(id),h=colorLookup[id]||'#ccc';if(f==='jelly')return mixHex(h,'#ffffff',.26);if(f==='glow')return mixHex(h,'#eaffb0',.35);if(f==='metal')return mixHex(h,'#f3f6ff',.28);if(f==='glitter')return mixHex(h,'#ffffff',.14);return h;}
// HSL + a rainbow-gradient comparator so the table boxes read left→right as a smooth colour wheel.
function hexToHsl(hex){const n=parseInt(hex.slice(1),16),r=((n>>16)&255)/255,g=((n>>8)&255)/255,b=(n&255)/255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2;let h=0,s=0;if(mx!==mn){const d=mx-mn;s=l>.5?d/(2-mx-mn):d/(mx+mn);if(mx===r)h=(g-b)/d+(g<b?6:0);else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;h/=6;}return[h*360,s,l];}
function gradientRank(a,b){const A=hexToHsl(a.hex),B=hexToHsl(b.hex),na=A[1]<.12,nb=B[1]<.12;
 if(na!==nb)return na?1:-1;            // neutrals (white→grey→black) collected after the chromatic arc
 if(na&&nb)return B[2]-A[2];           // neutrals ordered light→dark
 if(Math.abs(A[0]-B[0])>.5)return A[0]-B[0]; // chromatic ordered by hue (red→orange→…→violet)
 return B[2]-A[2];}                    // same hue: lighter tint first
// 62-char alphabet (A-X unchanged → old saves still decode); supports up to 62 colours.
// 62 base chars (A-X unchanged → old saves still decode) + safe punctuation for more colours.
const COLOR_CHARS='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&*+-:;=?@^_~<>()[]{}';
const sizeOptions=[16,29,32,48,52,58,64,78,87,96,104,116,128,156,208,256];
const tableBoards={};
let gallery=[];
let activeTable='A',paintColor='C-06',tool='paint',undo=[],redo=[];
let painting=false,movedStroke=false,rightErase=false,panGesture=null,strokeLast=-1;
let zoom=1,panX=0,panY=0;
let beadBack=document.createElement('canvas'),beadBackCtx=beadBack.getContext('2d',{alpha:false});
let boardRaf=0;
let activeModal=null,toastTimer=null,ironFinished=false,ironBusy=false,ironJobId=0;
let ironAnimRaf=0,ironSteam=[];
const input={w:false,a:false,s:false,d:false};
const player={x:1.6,z:7.35,walk:0,target:null,route:[]};
const camera={angle:Math.PI,pitch:.94,distance:33,lookX:0,lookZ:0,aTarget:Math.PI,pTarget:.94,dTarget:33,sway:0,fpLook:-.10,fpLookT:-.10,fov:Math.PI/3,fovTarget:Math.PI/3};
let firstPerson=true;   // roam the shop in first person (eye-level); seated/wall views keep their own camera
let fpSavedYaw=Math.PI; // remember first-person facing across sitting at a table
const layout={width:1,height:1,aspect:1};
// Pixel size in whole DEVICE pixels per render pixel. Integer → every pixel upscales to a
// uniform N×N block (no "tilted/blurry" uneven pixels). Smaller = sharper/higher clarity.
const PIXEL_DIV=1.0;
try{scene.style.imageRendering='pixelated';}catch(_e){} // guarantee crisp nearest-neighbour upscale (not blurry)
let renderScale=1;      // low-res buffer px per CSS px, shared by the 2D fallback
let last=performance.now(),firstFrame=false,glStatic=null,glPlayer=null,staticVertexCount=0;
let drawMatrix=null,camPos=[0,0,0],camForward=[0,0,0],camRight=[0,0,0],camUp=[0,0,0];
let fallback2d=false,ctx2d=null,lastFallbackPaint=0;
let program=null,loc={},pendingTable=null,pendingStation=false,pendingBeadStation=false;
let shadowProg=null,shadowLoc={},glShadowStatic=null,glShadowPlayer=null,shadowStaticCount=0;
let partProg=null,partLoc={},glParts=null,particles=[],partSpawn={coffee:0,iron:0,dust:0,drink:0};
let pickedBin='C-06',pickupTool='tweezers',tray={};
const drinks=[
 {id:'latte',name:'拿铁',label:'奶香浓郁',cup:'#f3dcc0',drink:'#bf8450',foam:'#efe2cc',hot:true,icon:'☕'},
 {id:'cappuccino',name:'卡布奇诺',label:'绵密奶泡',cup:'#f1dabd',drink:'#b17a4f',foam:'#f3e8d4',hot:true,icon:'☕'},
 {id:'mocha',name:'摩卡',label:'巧克力咖啡',cup:'#e9d4b8',drink:'#6f4a32',foam:'#d6b088',hot:true,icon:'🍫'},
 {id:'americano',name:'美式',label:'清爽黑咖',cup:'#e6ddce',drink:'#523a2b',hot:true,icon:'☕'},
 {id:'matcha',name:'抹茶拿铁',label:'清香回甘',cup:'#e8efd4',drink:'#8aa857',foam:'#e6eecb',hot:true,icon:'🍵'},
 {id:'cocoa',name:'热可可',label:'香甜暖心',cup:'#efd7bc',drink:'#784a33',foam:'#e6c6a2',hot:true,icon:'🍫'},
 {id:'fruit',name:'柚子果茶',label:'果香酸甜',cup:'#f7df9a',drink:'#e7a94e',icon:'🍊'},
 {id:'soda',name:'柠檬气泡',label:'轻盈气泡',cup:'#dff2de',drink:'#cbe79f',fizz:true,icon:'🍋'}
];
let chosenDrink='latte', heldDrink=null, heldOpt=null, coffeeSips=0, heldDrinkSource='self', pendingCoffee=false;
let carriedBoard=null; // table id: a finished pegboard occupies both hands until the product is completed
let carriedProduct=null; // ironed product held in hand until the player hangs it on the gallery wall
let boardCarryMotion={shake:0,risk:0,dirX:0,dirZ:0,moving:false,state:'stable'};
let coffeeOpt={milk:false,sugar:false,ice:false,whip:false,size:'M'}, coffeeMode='self', coffeeMade=false, coffeeBusy=false, coffeeRaf=0, coffeeJob=0;
let coffeeSteps=[], coffeeStepIdx=0, coffeeFill=0, coffeeFoam=0, coffeeGrind=0, coffeeCloudProgress=0, coffeeCloudBucket=-1; // hands-on make-your-own state
const tableDrinks={};
const COFFEE_POS={x:10.3,z:-10.55};
function drinkById(id){return drinks.find(d=>d.id===id)||drinks[0];}
function currentDrink(){return heldDrink?drinkById(heldDrink):null;}
function sizeSips(s){return s==='S'?3:s==='L'?8:5;}
function carryMoveFactor(){return heldDrink ? .68 : 1;} // a board no longer forces an automatic slow walk
function boardCarryAssessment(){
 if(boardCarryMotion.risk>.62||boardCarryMotion.shake>.86)return{state:'danger',label:'危险 · 拼豆可能晃掉'};
 if(boardCarryMotion.risk>.22||boardCarryMotion.shake>.48)return{state:'warning',label:'有些晃 · 稳住再转向'};
 return{state:'stable',label:'平稳 · 拼豆安全'};
}
function resetBoardCarryMotion(){boardCarryMotion={shake:0,risk:0,dirX:0,dirZ:0,moving:false,state:'stable'};}
function dropCarriedBoardBeads(){
 if(!carriedBoard)return 0;const work=tableBoards[carriedBoard],loose=[];for(let i=0;i<work.cells.length;i++)if(work.cells[i])loose.push(i);
 if(loose.length<=1)return 0;const count=Math.min(loose.length-1,1+Math.floor(Math.random()*Math.min(3,loose.length-1)));
 for(let n=0;n<count;n++){const pick=Math.floor(Math.random()*loose.length),idx=loose.splice(pick,1)[0];work.cells[idx]=null;}
 try{localStorage.setItem('bead-house.v5.table'+carriedBoard,JSON.stringify({size:work.size,pixels:packCells(work.cells)}));}catch(_e){}
 try{netSend({t:'board',table:carriedBoard,cells:packCells(work.cells),size:work.size});}catch(_e){}
 updateStatic();return count;
}
function updateBoardCarryMotion(dt,vx,vz,moving){
 if(!carriedBoard)return;const speed=Math.hypot(vx,vz),m=boardCarryMotion,wasMoving=m.moving,nx=speed>.03?vx/speed:0,nz=speed>.03?vz/speed:0;
 const turn=moving&&wasMoving?Math.max(0,1-(nx*m.dirX+nz*m.dirZ)):0;
 const target=moving?Math.min(1.3,.20+Math.max(0,speed-2.4)*.18+turn*1.05):0;
 const response=1-Math.exp(-dt*(target>m.shake?10:4.5));m.shake+=(target-m.shake)*response;
 m.shake=Math.min(1.3,m.shake+Math.min(.42,turn*.22));
 if(moving&&!wasMoving)m.shake=Math.min(1.3,m.shake+.14);else if(!moving&&wasMoving)m.shake=Math.min(1.3,m.shake+.18);
 if(moving){m.dirX=nx;m.dirZ=nz;}m.moving=moving;
 const excess=Math.max(0,m.shake-.60);m.risk=Math.max(0,Math.min(1.05,m.risk+(excess>0?excess*dt*1.45:-dt*.34)));
 const assessment=boardCarryAssessment();if(assessment.state!==m.state){m.state=assessment.state;updateCarryBoardStatus();if(assessment.state==='danger')toast('画面晃得太厉害，拼豆快掉了！先直走或停一下稳住。');}
 if(m.risk>=1){const dropped=dropCarriedBoardBeads();m.risk=.28;m.shake=.46;m.state='warning';updateCarryBoardStatus();if(dropped){phNudge();SFX.pick();toast(`板子猛烈颠簸，晃掉了 ${dropped} 颗拼豆！`);}}
}
function updateDrinkStatus(){const tag=$('heldDrink');if(!tag)return;const d=currentDrink();
 tag.classList.toggle('hidden',!d);tag.textContent=d?d.icon:'☕';tag.setAttribute('aria-label',d?`喝一口${d.name}`:'领取饮料');
 seatHudSig='';if(PH?.active)updateSeatHud();}
function updateCarryBoardStatus(){const tag=$('carryBoard');if(!tag)return;tag.classList.toggle('hidden',!carriedBoard);
 const assessment=boardCarryAssessment();tag.classList.toggle('is-warning',!!carriedBoard&&assessment.state==='warning');tag.classList.toggle('is-danger',!!carriedBoard&&assessment.state==='danger');
 if(carriedBoard){$('carryBoardName').textContent=`${carriedBoard} 号桌 · 拼好的底板`;const state=$('carryBoardState');if(state)state.textContent=assessment.label;}
 seatHudSig='';if(PH?.active)updateSeatHud();}
function updateCarryProductStatus(){const tag=$('carryProduct');if(!tag)return;tag.classList.toggle('hidden',!carriedProduct);
 if(carriedProduct)$('carryProductName').textContent=`${PRODUCT_META[carriedProduct.mount]?.label||'拼豆成品'} · ${carriedProduct.name}`;
 const wallLabel=document.querySelector('.wall-label');if(wallLabel){const text=wallLabel.querySelector('span:last-child');if(text)text.textContent=carriedProduct?'挂上':'赏画';wallLabel.setAttribute('aria-label',carriedProduct?'把手里的成品挂到任意墙面':'赏画');}}
function drinkSnapshot(){return heldDrink?{id:heldDrink,opt:{...(heldOpt||{})},sips:coffeeSips,source:heldDrinkSource}:null;}
function syncTableDrink(table){if(!names.includes(table))return;netSend({t:'table:drink',table,item:tableDrinks[table]?{...tableDrinks[table],opt:{...(tableDrinks[table].opt||{})}}:null});markCloudProgress();}
function addDrinkCup(m,x,y,z,item,scale=1){if(!item)return;const d=drinkById(item.id),o=item.opt||{},cup=d.cup||'#f4eee4';
 m.box(x,y,z,.24*scale,.28*scale,.24*scale,cup);m.box(x,y+.15*scale,z,.27*scale,.035*scale,.27*scale,'#fff9ed');m.box(x,y+.17*scale,z,.20*scale,.018*scale,.20*scale,d.drink);
 if((o.whip)||(d.foam&&o.milk))m.box(x,y+.205*scale,z,.18*scale,.045*scale,.18*scale,d.foam||'#fff7ee');
 if(o.ice||!d.hot)m.box(x+.08*scale,y+.34*scale,z,.025*scale,.36*scale,.025*scale,'#d9ece6');}
function drawCarriedProduct(c,w,h){const item=carriedProduct;if(!item)return;const work={size:item.size,cells:item.cells||unpackCells(item.pixels,item.size)||[]},cx=w/2,art=154,x=cx-art/2,y=48,meta=PRODUCT_META[item.mount]||PRODUCT_META.frame;
 c.fillStyle='#5137202b';c.beginPath();c.ellipse(cx,226,126,16,0,0,6.2832);c.fill();
 if(item.mount==='frame'){c.fillStyle='#946e50';c.fillRect(cx-104,31,208,194);c.fillStyle='#fff8e9';c.fillRect(cx-86,43,172,170);}
 else if(item.mount==='badge'){c.fillStyle='#d8b394';c.beginPath();c.arc(cx,127,91,0,6.2832);c.fill();}
 else{c.fillStyle=item.mount==='magnet'?'#d9c7b4':'#f2dfc4';roundRect(c,cx-88,39,176,180,18);c.fill();}
 if(item.mount==='keychain'){c.strokeStyle='#b48255';c.lineWidth=8;c.beginPath();c.arc(cx,34,18,0,6.2832);c.stroke();c.fillStyle='#b48255';c.fillRect(cx-5,45,10,18);}
 if(item.mount==='stand'){c.fillStyle='#a87958';c.fillRect(cx-106,211,212,15);c.fillRect(cx-75,201,150,13);}
 const step=art/18;for(let py=0;py<18;py++)for(let px=0;px<18;px++){const id=sampledColor(work,px,py,18);if(!id)continue;let color=colorLookup[id]||'#ccc';if(item.technique==='crystal')color=mixHex(color,'#efffff',.22);else if(item.technique==='towel')color=mixHex(color,'#fff0dc',.12);const bx=x+px*step+step/2,by=y+py*step+step/2;c.fillStyle=color;if(item.level==='flat'){c.fillRect(bx-step*.48,by-step*.48,step*.96,step*.96);}else{c.beginPath();c.arc(bx,by,step*(item.level==='light'?.38:.44),0,6.2832);c.fill();if(item.level==='light'){c.fillStyle='#f8ead7';c.beginPath();c.arc(bx,by,step*.12,0,6.2832);c.fill();}}
  if(item.technique==='glitter'&&(px*7+py*11)%13===0){c.fillStyle='#fff9df';c.fillRect(bx-1.5,by-1.5,3,3);}}
 c.fillStyle='#f2cfad';c.beginPath();c.ellipse(cx-92,205,46,30,.34,0,6.2832);c.ellipse(cx+92,205,46,30,-.34,0,6.2832);c.fill();
 c.font='700 15px sans-serif';c.textAlign='center';c.fillStyle='#6f533d';c.fillText(`${meta.label} · 走近任意墙面挂上`,cx,20);
}
function drawCarryView(){const cv=$('carryView');if(!cv)return;const show=firstPerson&&!PH.active&&!PH.wall&&!activeModal&&(carriedBoard||heldDrink||carriedProduct),cupHit=$('carryCupHit'),showCup=show&&!!heldDrink&&!carriedBoard&&!carriedProduct;cv.classList.toggle('hidden',!show);if(cupHit){cupHit.classList.toggle('hidden',!showCup);cupHit.setAttribute('aria-label',showCup?`点击手里的${currentDrink()?.name||'饮料'}喝一口`:'点击手里的杯子喝一口');}if(!show)return;
 const c=cv.getContext('2d'),w=cv.width,h=cv.height,t=performance.now()/1000,walking=player.walk>.08,boardHeld=!!carriedBoard,productHeld=!!carriedProduct;
 c.clearRect(0,0,w,h);c.save();const amp=boardHeld?(walking ? .7 : 0)+boardCarryMotion.shake*6.2:productHeld?(walking?1.15:0):(walking?1.8:0);c.translate(Math.sin(t*7)*amp,Math.abs(Math.cos(t*7))*amp*.45);if(boardHeld)c.rotate(Math.sin(t*6.1)*boardCarryMotion.shake*.012);
 if(boardHeld){const work=tableBoards[carriedBoard],tl=[105,42],tr=[455,42],br=[530,222],bl=[30,222];
  c.fillStyle='#8b684f55';c.beginPath();c.ellipse(w/2,226,236,18,0,0,6.2832);c.fill();
  c.beginPath();c.moveTo(...tl);c.lineTo(...tr);c.lineTo(...br);c.lineTo(...bl);c.closePath();c.fillStyle='#eed9ba';c.fill();c.lineWidth=9;c.strokeStyle='#b98c66';c.stroke();
  for(let py=0;py<12;py++)for(let px=0;px<18;px++){const sx=Math.min(work.size-1,Math.floor((px+.5)*work.size/18)),sy=Math.min(work.size-1,Math.floor((py+.5)*work.size/12)),id=work.cells[sy*work.size+sx];if(!id)continue;const u=(px+.5)/18,v=(py+.5)/12,topX=tl[0]+(tr[0]-tl[0])*u,bottomX=bl[0]+(br[0]-bl[0])*u,x=topX+(bottomX-topX)*v,y=tl[1]+(bl[1]-tl[1])*v;c.fillStyle=colorLookup[id];c.beginPath();c.arc(x,y,4.2+v*2.8,0,6.2832);c.fill();}
  c.fillStyle='#f2cfad';c.beginPath();c.ellipse(46,210,39,28,-.18,0,6.2832);c.ellipse(514,210,39,28,.18,0,6.2832);c.fill();
  const assessment=boardCarryAssessment();c.font='700 15px sans-serif';c.textAlign='center';c.fillStyle=assessment.state==='danger'?'#a84235':assessment.state==='warning'?'#a06c2d':'#6f533d';c.fillText(assessment.label,w/2,24);
 }else if(productHeld){drawCarriedProduct(c,w,h);
 }else{const d=currentDrink(),o=heldOpt||{},cx=w/2,top=42,cupW=132,cupH=168;
  c.fillStyle='#6c513739';c.beginPath();c.ellipse(cx,226,116,18,0,0,6.2832);c.fill();
  c.beginPath();c.moveTo(cx-cupW/2,top);c.lineTo(cx+cupW/2,top);c.lineTo(cx+cupW*.38,top+cupH);c.lineTo(cx-cupW*.38,top+cupH);c.closePath();c.fillStyle=d?.cup||'#f5eee3';c.fill();c.lineWidth=7;c.strokeStyle='#fffaf1';c.stroke();
  c.save();c.beginPath();c.moveTo(cx-cupW/2+6,top+8);c.lineTo(cx+cupW/2-6,top+8);c.lineTo(cx+cupW*.34,top+cupH-8);c.lineTo(cx-cupW*.34,top+cupH-8);c.closePath();c.clip();c.fillStyle=d?.drink||'#a77954';c.fillRect(cx-cupW/2,top+48,cupW,cupH);if(o.ice){c.fillStyle='#ffffff77';for(let i=0;i<5;i++)c.fillRect(cx-45+i*22,top+62+(i%2)*24,16,16);}if(o.whip){c.fillStyle='#fff7ee';c.beginPath();c.arc(cx,top+45,47,Math.PI,0);c.fill();}c.restore();
  c.fillStyle='#f2cfad';c.beginPath();c.ellipse(cx+85,178,51,34,-.5,0,6.2832);c.fill();c.fillStyle='#d6eee8';c.fillRect(cx+37,16,8,100);
 }
 c.restore();}
function placeOrTakeTableDrink(){if(carriedBoard){toast('双手正端着底板，不能再拿饮料。请先送到熨烫间。');return;}if(carriedProduct){toast('手里拿着烫好的成品，请先把它挂到展示墙。');return;}if(!PH.active)return;const placed=tableDrinks[activeTable];
 if(heldDrink){if(placed){toast('桌上已经有一杯饮料了，先把它拿起来或喝完。');return;}tableDrinks[activeTable]=drinkSnapshot();heldDrink=null;heldOpt=null;coffeeSips=0;heldDrinkSource='self';syncTableDrink(activeTable);updateDrinkStatus();updateStatic();SFX.ui();toast('把饮料放在拼豆桌边了。');return;}
 if(!placed){toast('桌上还没有饮料。');return;}heldDrink=placed.id;heldOpt={...(placed.opt||{})};coffeeSips=placed.sips;heldDrinkSource=placed.source||'self';delete tableDrinks[activeTable];syncTableDrink(activeTable);updateDrinkStatus();updateStatic();SFX.ui();toast(`从桌上拿起${drinkById(heldDrink).name}。`);}
// ---------- Café: choose · customise · brew (animated) · take & drink ----------
function buildDrinkGrid(){const root=$('drinkGrid');if(!root)return;root.textContent='';for(const d of drinks){const b=document.createElement('button');b.type='button';b.className='drink-choice'+(d.id===chosenDrink?' selected':'');b.dataset.drink=d.id;b.innerHTML=`<span class="drink-icon">${d.icon}</span><strong>${d.name}</strong><small>${d.label}</small>`;b.onclick=()=>selectDrink(d.id);root.appendChild(b);}}
function selectDrink(id){if(!drinks.some(d=>d.id===id))return;chosenDrink=id;if(coffeeMode==='ready')coffeeOpt.ice=!drinkById(id).hot;document.querySelectorAll('#drinkGrid [data-drink]').forEach(b=>b.classList.toggle('selected',b.dataset.drink===id));syncCoffeeControls();resetBrewUI();drawCoffeeScene(0,false);markCloudProgress();SFX.ui();}
function roundRect(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
function cupPath(c,cx,top,hh,tw,bw){c.beginPath();c.moveTo(cx-tw/2,top);c.lineTo(cx+tw/2,top);c.lineTo(cx+bw/2,top+hh);c.lineTo(cx-bw/2,top+hh);c.closePath();}
// stage: 'idle'|'grind'|'extract'|'mix'|'steam'|'done' ; prog 0..1 for the active step
function drawCoffeeScene(stage,prog){
 stage=stage||'idle';prog=prog||0;
 const cv=$('coffeeCanvas');if(!cv)return;const c=cv.getContext('2d'),w=cv.width,h=cv.height,d=drinkById(chosenDrink),o=coffeeOpt,cx=w/2;
 c.clearRect(0,0,w,h);const bg=c.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#f4ecdd');bg.addColorStop(1,'#e9ddc9');c.fillStyle=bg;c.fillRect(0,0,w,h);
 c.fillStyle='#d6c09d';c.fillRect(0,314,w,h-314);c.fillStyle='#cbb389';c.fillRect(0,314,w,5);
 // the tool for the current step, drawn above the cup
 if(stage==='grind'){
   // bean grinder: hopper with beans, a crank, grounds building up
   c.fillStyle='#6a5240';roundRect(c,cx-54,26,108,70,12);c.fill();c.fillStyle='#4a3a2d';c.fillRect(cx-40,34,80,20);
   for(let i=0;i<7;i++){const a=i*1.3+prog*7,bx=cx-30+((i*17)%60),by=40+Math.sin(a)*4;c.fillStyle='#4a2f1d';c.beginPath();c.ellipse(bx,by,5,7,a,0,6.3);c.fill();}
   c.fillStyle='#8a6b52';c.fillRect(cx-7,96,14,26);          // chute
   c.fillStyle='#caa98c';roundRect(c,cx-30,120,60,16,5);c.fill(); // grounds tray
   c.fillStyle='#6f5138';for(let i=0;i<Math.round(prog*22);i++){c.fillRect(cx-26+((i*9)%52),122+((i*5)%10),5,5);} // ground coffee piling up
 }else if(stage==='steam'){
   // milk pitcher under a steam wand; foam frothing up
   c.fillStyle='#3c4746';c.fillRect(cx-6,20,12,70);c.fillStyle='#333d3c';c.fillRect(cx-9,88,18,10);
   c.fillStyle='#e9eef0';roundRect(c,cx-42,104,84,66,8);c.fill();c.fillStyle='#d4dde0';c.fillRect(cx+40,120,16,10); // pitcher + spout
   c.fillStyle='#fbf7ef';c.fillRect(cx-36,108+(1-prog)*48,72,prog*54);           // milk/foam rising
   c.fillStyle='#ffffffaa';for(let i=0;i<10;i++){const t=(performance.now()/500+i)%1;c.beginPath();c.arc(cx-28+((i*13)%56),150-t*44,2+t*2,0,6.3);c.fill();}
 }else{
   // espresso machine head
   c.fillStyle='#616f6e';roundRect(c,96,24,168,78,12);c.fill();c.fillStyle='#51bdb5';c.fillRect(116,38,52,28);c.fillStyle='#3c4746';c.fillRect(184,38,64,12);c.fillRect(184,54,44,10);
   c.fillStyle='#3c4746';c.fillRect(cx-30,102,60,14);c.fillStyle='#333d3c';c.fillRect(cx-5,116,10,24);
 }
 // cup with its current contents
 const cupTop=190,cupH=118,tw=o.size==='S'?96:o.size==='L'?138:118,bw=tw*0.8;
 const innerTop=cupTop+8,innerH=cupH-16;
 let fill=coffeeFill,foam=coffeeFoam;
 if(stage==='extract'||stage==='mix')fill=prog; if(stage==='steam')foam=prog;
 const liqTop=innerTop+(1-fill)*innerH;
 c.save();cupPath(c,cx,cupTop,cupH,tw,bw);c.fillStyle='#fbf6ee';c.fill();c.clip();
 if(fill>0){c.fillStyle=d.drink;c.fillRect(cx-tw/2,liqTop,tw,cupTop+cupH-liqTop);}
 if(o.ice&&fill>.1){c.fillStyle='#ffffff66';for(let i=0;i<4;i++){c.save();c.translate(cx-28+i*20,liqTop+16+(i%2)*20);c.rotate(.4+i);c.fillRect(-8,-8,16,16);c.restore();}}
 if(foam>0&&d.foam){c.fillStyle=d.foam;c.fillRect(cx-tw/2,liqTop-foam*13,tw,foam*14+1);}   // milk foam layer
 if(o.whip&&coffeeMade){c.fillStyle='#fff7ee';c.beginPath();c.arc(cx,liqTop-6,tw*0.33,Math.PI,0);c.fill();c.beginPath();c.arc(cx-tw*0.15,liqTop-14,tw*0.14,Math.PI,0);c.fill();c.beginPath();c.arc(cx+tw*0.15,liqTop-14,tw*0.14,Math.PI,0);c.fill();}
 if(d.fizz&&fill>.2){c.fillStyle='#ffffff8a';for(let i=0;i<10;i++){const bx=cx-tw/2+6+Math.abs(Math.sin(i*2.3))*(tw-12),by=liqTop+6+((i*19)%Math.max(8,cupTop+cupH-liqTop-8));c.beginPath();c.arc(bx,by,1.7,0,6.3);c.fill();}}
 c.restore();
 c.lineWidth=3;c.strokeStyle='#ffffff';cupPath(c,cx,cupTop,cupH,tw,bw);c.stroke();
 c.lineWidth=7;c.strokeStyle='#fbf6ee';c.beginPath();c.arc(cx+tw/2+3,cupTop+cupH*0.42,19,-1.1,1.1);c.stroke();
 if(stage==='extract'||stage==='mix'){c.fillStyle=d.drink;c.fillRect(cx-4,140,8,Math.max(0,liqTop-140));} // pour stream
 if(d.hot&&!o.ice&&fill>.25){c.save();for(let i=0;i<3;i++){const t=(performance.now()/700+i*0.5)%1;c.globalAlpha=(1-t)*0.3;c.fillStyle='#fff';c.beginPath();c.arc(cx-20+i*20+Math.sin(t*6+i)*6,liqTop-18-t*54,7-t*3,0,6.3);c.fill();}c.restore();}
 if(coffeeMode==='self'&&!coffeeMade&&!coffeeBusy&&coffeeSteps[coffeeStepIdx]){
  const label=coffeeSteps[coffeeStepIdx].label.replace(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*/,''),text=`点击设备 · ${label}`;
  c.font='700 14px sans-serif';const width=Math.min(w-28,c.measureText(text).width+32);roundRect(c,(w-width)/2,h-49,width,34,17);c.fillStyle='#5e4a3fe8';c.fill();c.fillStyle='#fffaf1';c.textAlign='center';c.textBaseline='middle';c.fillText(text,w/2,h-32);
 }
}
// What hands-on steps this drink needs.
function drinkSteps(d){if(!d.hot)return[{k:'mix',label:'调制饮品 🥤',sfx:'pour',line:'把果汁和气泡水调在一起…'}];
 const s=[{k:'grind',label:'① 磨咖啡豆 ⚙️',sfx:'shake',line:'正在研磨咖啡豆…'},{k:'extract',label:'② 萃取浓缩 ☕',sfx:'pour',line:'浓缩液正在滴落…'}];
 if(d.foam)s.push({k:'steam',label:'③ 打奶泡 🥛',sfx:'steam',line:'蒸汽棒打奶泡中…'});
 return s;}
function renderCoffeeStepGuide(){const root=$('coffeeStepGuide'),cv=$('coffeeCanvas');if(!root||!cv)return;const handsOn=coffeeMode==='self'&&!coffeeMade;
 root.classList.toggle('hidden',!handsOn);root.replaceChildren();
 if(handsOn)coffeeSteps.forEach((step,i)=>{const b=document.createElement('button');b.type='button';b.className=i<coffeeStepIdx?'done':i===coffeeStepIdx?'active':'';b.textContent=(i<coffeeStepIdx?'✓ ':i===coffeeStepIdx?'▶ ':'○ ')+step.label;b.disabled=coffeeBusy||i!==coffeeStepIdx;b.onclick=brewCoffee;root.appendChild(b);});
 const actionable=handsOn&&!coffeeBusy&&!!coffeeSteps[coffeeStepIdx];cv.classList.toggle('interactive',actionable);cv.tabIndex=handsOn?0:-1;cv.setAttribute('aria-label',actionable?`自制饮料操作台，点击执行${coffeeSteps[coffeeStepIdx].label}`:'饮料制作预览');}
function optLabel(){const o=coffeeOpt,p=[];if(o.milk)p.push('加奶');if(o.sugar)p.push('加糖');if(o.ice)p.push('加冰');if(o.whip)p.push('奶油');return (p.length?' · '+p.join('/'):'')+' · '+({S:'小杯',M:'中杯',L:'大杯'}[o.size]);}
function resetBrewUI(){coffeeBusy=false;coffeeMade=false;if(coffeeRaf)cancelAnimationFrame(coffeeRaf);coffeeRaf=0;
 coffeeFill=0;coffeeFoam=0;coffeeGrind=0;coffeeCloudProgress=0;coffeeCloudBucket=-1;coffeeSteps=drinkSteps(drinkById(chosenDrink));coffeeStepIdx=0;
 const bb=$('coffeeBrewBtn');if(bb){bb.classList.remove('hidden');bb.disabled=false;bb.textContent=coffeeMode==='staff'?'请小暖做 ☕':coffeeMode==='ready'?'拿一杯现成的 🥤':coffeeSteps[0].label;}
 $('coffeeTakeBtn')?.classList.add('hidden');
  if($('baristaLine'))$('baristaLine').textContent=coffeeMode==='staff'?'店员小暖随时帮你做':coffeeMode==='ready'?'取餐架上有做好的外带饮品':'';
 if($('coffeeStatus'))$('coffeeStatus').textContent=coffeeMode==='staff'?'选好饮品，请小暖一次做好。':coffeeMode==='ready'?'选一杯现成饮品，直接从取餐架拿走。':'点击左侧设备或当前步骤，亲手完成每一步。';renderCoffeeStepGuide();}
function hasCoffeeProgress(){return coffeeMade||coffeeBusy||coffeeStepIdx>0||coffeeFill>0||coffeeFoam>0||coffeeGrind>0;}
function restoreCoffeeUI(){
 coffeeBusy=false;coffeeSteps=drinkSteps(drinkById(chosenDrink));coffeeStepIdx=Math.max(0,Math.min(coffeeStepIdx,coffeeSteps.length));
 const bb=$('coffeeBrewBtn'),take=$('coffeeTakeBtn');if(coffeeMade){bb.classList.add('hidden');take.classList.remove('hidden');$('coffeeStatus').textContent=`${drinkById(chosenDrink).name}${optLabel()} 已从云端恢复，可以端起来。`;drawCoffeeScene('done',1);}
 else{bb.classList.remove('hidden');take.classList.add('hidden');bb.disabled=false;bb.textContent=coffeeMode==='staff'?'继续请小暖制作 ☕':coffeeMode==='ready'?'继续拿取饮品 🥤':coffeeSteps[coffeeStepIdx]?.label||'完成饮品';$('coffeeStatus').textContent=coffeeCloudProgress>0?`已恢复这一步 ${Math.round(coffeeCloudProgress*100)}% 的进度，点击继续。`:coffeeStepIdx?`已恢复到第 ${coffeeStepIdx+1} 步，继续完成饮品。`:'已恢复饮料制作状态，可以继续。';const stage=coffeeMode==='self'?(coffeeSteps[coffeeStepIdx]?.k||'idle'):'extract';drawCoffeeScene(stage,coffeeCloudProgress);}
 renderCoffeeStepGuide();
}
function trackCoffeeProgress(p){coffeeCloudProgress=p;const bucket=Math.floor(p*4);if(bucket>coffeeCloudBucket){coffeeCloudBucket=bucket;try{netSavePlayer(true);}catch(_e){}}}
function brewCoffee(){if(coffeeBusy||coffeeMade)return;const resume=coffeeCloudProgress;if(coffeeMode==='staff')return brewStaff(resume);if(coffeeMode==='ready')return takeReadyDrink(resume);startStep(resume);}
function takeReadyDrink(resumeFrom=0){const d=drinkById(chosenDrink),id=++coffeeJob;coffeeBusy=true;$('coffeeBrewBtn').disabled=true;SFX.drawer();
 const resume=Math.max(0,Math.min(.98,Number(resumeFrom)||0));coffeeCloudProgress=resume;coffeeCloudBucket=Math.floor(resume*4);markCloudProgress();
 if($('coffeeStatus'))$('coffeeStatus').textContent='正在从取餐架拿下做好的饮品…';const start=performance.now(),dur=650;
 const began=start-resume*dur;const anim=now=>{if(id!==coffeeJob)return;if(activeModal!=='coffee'){coffeeRaf=0;return;}const p=Math.min(1,(now-began)/dur);trackCoffeeProgress(p);coffeeFill=p;drawCoffeeScene('mix',p);if(p<1){coffeeRaf=requestAnimationFrame(anim);return;}coffeeRaf=0;coffeeBusy=false;finishBrew('ready');if($('baristaLine'))$('baristaLine').textContent=`现成的${d.name}已经拿下来啦`;};
 coffeeRaf=requestAnimationFrame(anim);}
function startStep(resumeFrom=0){
 const step=coffeeSteps[coffeeStepIdx];if(!step)return;const id=++coffeeJob;coffeeBusy=true;$('coffeeBrewBtn').disabled=true;renderCoffeeStepGuide();(SFX[step.sfx]||SFX.pour)();
 const resume=Math.max(0,Math.min(.98,Number(resumeFrom)||0));coffeeCloudProgress=resume;coffeeCloudBucket=Math.floor(resume*4);markCloudProgress();
 if($('coffeeStatus'))$('coffeeStatus').textContent=step.line;
 const dur=step.k==='extract'?2200:step.k==='steam'?1600:step.k==='grind'?1500:1400,start=performance.now()-resume*(step.k==='extract'?2200:step.k==='steam'?1600:step.k==='grind'?1500:1400);
 if(step.k==='steam'||step.k==='grind')setTimeout(()=>{if(id===coffeeJob)(SFX[step.sfx]||SFX.steam)();},dur*.5);
 const anim=now=>{if(id!==coffeeJob)return;if(activeModal!=='coffee'){coffeeRaf=0;return;}
   const p=Math.min(1,(now-start)/dur);trackCoffeeProgress(p);drawCoffeeScene(step.k,p);
   if(p<1){coffeeRaf=requestAnimationFrame(anim);return;}
   coffeeRaf=0;coffeeBusy=false;coffeeCloudProgress=0;coffeeCloudBucket=-1;
   if(step.k==='extract'||step.k==='mix')coffeeFill=1;if(step.k==='steam')coffeeFoam=1;if(step.k==='grind')coffeeGrind=1;
   coffeeStepIdx++;
   if(coffeeStepIdx>=coffeeSteps.length){finishBrew();return;}
   const nx=coffeeSteps[coffeeStepIdx];$('coffeeBrewBtn').disabled=false;$('coffeeBrewBtn').textContent=nx.label;
   if($('coffeeStatus'))$('coffeeStatus').textContent='这一步完成！接着点击设备执行「'+nx.label+'」';renderCoffeeStepGuide();drawCoffeeScene('idle',0);markCloudProgress();SFX.ui();
 };coffeeRaf=requestAnimationFrame(anim);
}
function finishBrew(source=coffeeMode){const d=drinkById(chosenDrink);coffeeMade=true;coffeeBusy=false;coffeeCloudProgress=1;coffeeCloudBucket=4;coffeeFill=1;SFX.chime();drawCoffeeScene('done',1);
 $('coffeeBrewBtn').classList.add('hidden');$('coffeeTakeBtn').classList.remove('hidden');
 renderCoffeeStepGuide();if($('coffeeStatus'))$('coffeeStatus').textContent=source==='ready'?`现成的${d.name}已经取出，拿走吧。`:`${d.name}${optLabel()} 做好了，端起来吧。`;markCloudProgress();}
function brewStaff(resumeFrom=0){
 const d=drinkById(chosenDrink),id=++coffeeJob;coffeeBusy=true;$('coffeeBrewBtn').disabled=true;SFX.pour();
 const resume=Math.max(0,Math.min(.98,Number(resumeFrom)||0));coffeeCloudProgress=resume;coffeeCloudBucket=Math.floor(resume*4);markCloudProgress();
 if($('baristaLine'))$('baristaLine').textContent='小暖：好嘞，马上为你做！';if($('coffeeStatus'))$('coffeeStatus').textContent='小暖正在为你制作…';
 const dur=2600,start=performance.now()-resume*2600;setTimeout(()=>{if(id===coffeeJob)SFX.steam();},Math.max(0,dur*(.4-resume)));
 const anim=now=>{if(id!==coffeeJob)return;if(activeModal!=='coffee'){coffeeRaf=0;return;}
   const p=Math.min(1,(now-start)/dur);trackCoffeeProgress(p);coffeeFill=p;if(d.foam&&p>.7)coffeeFoam=(p-.7)/.3;drawCoffeeScene('extract',p);
   if(p<1){coffeeRaf=requestAnimationFrame(anim);return;}
   coffeeRaf=0;coffeeBusy=false;finishBrew();if($('baristaLine'))$('baristaLine').textContent='小暖：你的'+d.name+'好啦～';};
 coffeeRaf=requestAnimationFrame(anim);
}
function syncCoffeeControls(){document.querySelectorAll('#coffeeAddins [data-addin]').forEach(b=>{b.classList.toggle('on',!!coffeeOpt[b.dataset.addin]);b.disabled=coffeeMode==='ready';});document.querySelectorAll('#coffeeSizes [data-size]').forEach(b=>{b.classList.toggle('on',b.dataset.size===coffeeOpt.size);b.disabled=coffeeMode==='ready';});document.querySelectorAll('#coffeeMode [data-mode]').forEach(b=>b.classList.toggle('on',b.dataset.mode===coffeeMode));}
function openCoffee(){if(activeModal&&activeModal!=='coffee')closeModal();buildDrinkGrid();syncCoffeeControls();openModal('coffee');if(hasCoffeeProgress())restoreCoffeeUI();else{resetBrewUI();drawCoffeeScene(0,false);}}
function takeCoffee(){ // called on arrival at the café (open it) and by the 端起这杯 button (take the made cup)
 if(carriedBoard){toast('双手正端着拼好的底板，不能同时拿饮料。先去熨烫间完成作品。');return;}
 if(carriedProduct){toast('手里拿着烫好的成品，先去展示墙挂好再拿饮料。');return;}
 if(!coffeeMade){openCoffee();return;}
 if(heldDrink){toast('手里已经有一杯饮料了，可以先放到拼豆桌上。');return;}
 const d=drinkById(chosenDrink);heldDrink=chosenDrink;heldOpt={...coffeeOpt};coffeeSips=sizeSips(coffeeOpt.size);heldDrinkSource=coffeeMode;
 coffeeMade=false;coffeeBusy=false;coffeeFill=coffeeFoam=coffeeGrind=coffeeCloudProgress=0;coffeeCloudBucket=-1;coffeeStepIdx=0;updateDrinkStatus();updateStatic();markCloudProgress();toast(`端起一杯${d.name} ${d.icon}`);SFX.ui();closeModal();}
function sipCoffee(){if(carriedBoard){toast('端底板时不能喝饮料。');return;}const d=currentDrink();if(!d){toast('先去咖啡角做一杯饮品。');return;}
 coffeeSips=Math.max(0,coffeeSips-1);if(coffeeSips){toast(`喝了一口${d.name}，还剩 ${coffeeSips} 口。`);}else{toast(`${d.name}喝完啦，空杯已回收。`);heldDrink=null;heldOpt=null;heldDrinkSource='self';}
 SFX.sip();updateDrinkStatus();updateStatic();markCloudProgress();}
function goCoffeeStation(){if(carriedBoard){toast('双手正端着底板，不能去拿饮料。请先到熨烫间。');return;}if(carriedProduct){toast('先把手里的成品挂到展示墙，再去咖啡角。');return;}if(activeModal)closeModal();pendingCoffee=true;pendingTable=null;pendingStation=false;pendingBeadStation=false;
 // Already at the counter? open immediately. Otherwise route there (A*) and the proximity
 // check in update() opens the café the moment you're near it — no pin-point arrival needed.
 if(Math.hypot(player.x-COFFEE_POS.x,player.z-COFFEE_POS.z)<2.8){player.target=null;player.route=[];pendingCoffee=false;takeCoffee();return;}
 let r;if(player.x>9.35&&player.z>9.75){const insideDoor={x:10.75,z:14.18},outsideDoor={x:7.1,z:14.18},clearWall={x:7.1,z:8.55},tail=phRouteTo(COFFEE_POS.x,COFFEE_POS.z,clearWall.x,clearWall.z);r=[insideDoor,outsideDoor,clearWall,...tail];}
 else r=phRouteTo(COFFEE_POS.x,COFFEE_POS.z);
 player.route=r.length?r.slice(1):[];player.target=r.length?r[0]:{...COFFEE_POS};toast('正在走向店里的咖啡吧台…');}

let pickupAt='wall',pickupReturn='studio',pickupTable='A',referenceVisible=false;
const referenceByTable={};const referenceCanvases={};
const TRAY_MAX=2400, BIN_MAX=2400, RACK_STOCK_MAX=20000;
let rackStock=Object.fromEntries(swatches.map(c=>[c.id,RACK_STOCK_MAX]));
const tableStock=Object.fromEntries(names.map(id=>[id,Object.fromEntries(swatches.map(c=>[c.id,180]))]));
try {const saved=JSON.parse(localStorage.getItem('bead-house.v5.table-stock')); if(saved&&typeof saved==='object')for(const id of names)for(const c of swatches){const amount=saved[id]?.[c.id];if(Number.isFinite(amount))tableStock[id][c.id]=Math.max(0,Math.min(500,Math.floor(amount)));}}catch(_e){}
function persistTableStock(){try{localStorage.setItem('bead-house.v5.table-stock',JSON.stringify(tableStock));}catch(_e){toast('桌边豆盒库存暂时无法保存。');}try{markCloudProgress();}catch(_e){}}
function sourceStock(){return pickupAt==='table'?tableStock[pickupTable]:rackStock;}
function persistSourceStock(){if(pickupAt==='table')persistTableStock();else persistRack();}
try{const saved=JSON.parse(localStorage.getItem('bead-house.v4.rack'));if(saved&&typeof saved==='object')for(const c of swatches){if(Number.isFinite(saved[c.id]))rackStock[c.id]=Math.max(0,Math.min(RACK_STOCK_MAX,Math.floor(saved[c.id])));}}catch(_e){}
function persistRack(){try{localStorage.setItem('bead-house.v4.rack',JSON.stringify(rackStock));}catch(_e){toast('豆墙库存本地保存失败。');}try{markCloudProgress();}catch(_e){}}
// Fresh room each entry: the tray (beads in hand/at the table) is not restored —
// only the harmless tool preference carries over.
try{const saved=JSON.parse(localStorage.getItem('bead-house.v3.tray'));if(saved&&['tweezers','single','double'].includes(saved.tool))pickupTool=saved.tool;}catch(_e){}
for(const c of swatches)tray[c.id]??=0;
function trayTotal(){return swatches.reduce((n,c)=>n+(tray[c.id]||0),0)}
const toolLabels={tweezers:'尖头镊子',single:'单针拼豆笔',double:'双针拼豆笔'};
let drawerOpened=false,binAnimUntil=0;
function persistTray(){try{localStorage.setItem('bead-house.v3.tray',JSON.stringify({tray,tool:pickupTool}));}catch(_e){toast('托盘库存本地保存失败，请检查浏览器存储空间。')}try{markCloudProgress();}catch(_e){}}
const labels=[];let hoverScene={x:-999,y:-999};let activeSpatial=null;
function toast(message){if(/^(正在走向|正在从|向着北面|欢迎来到)/.test(message))return;const e=$('toast');e.textContent=message;e.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.classList.remove('show'),1900);}
function getSample(i,size=32){
 // Six recognizable bead patterns: the *same* cells are used by the album thumbnail,
 // the physical reference card and gallery samples, never as placed board beads.
 const base=[];const art=i%6;
 const paint=(x,y)=>{
  const X=x-15.5,Y=y-15.5,rx=Math.abs(X),ry=Math.abs(Y);
  if(art===0){ // Heart, with distinct upper lobes and tapered bottom.
    const crown=(Y>=-11&&Y<=1)&&(((X+5.1)**2/6.9**2+(Y+4.9)**2/7.0**2<1)||((X-5.1)**2/6.9**2+(Y+4.9)**2/7.0**2<1));
    const point=Y>-.7&&Y<12.7&&rx<Math.max(.3,12.3-(Y+1)*.92);
    if(crown||point)return (x+y)%13===0?'C-08':'C-07';
  }
  if(art===1){ // Teddy bear with 2 ears, eyes and nose.
    const ear=(((X+8)**2+(Y+8.4)**2)<5.1**2)||(((X-8)**2+(Y+8.4)**2)<5.1**2);
    const face=X*X/12.5**2+(Y+0.9)**2/11.5**2<1;
    if(ear||face){
     if((X+5.1)**2+(Y+1.5)**2<1.9**2||(X-5.1)**2+(Y+1.5)**2<1.9**2)return 'C-05';
     if(X*X/4.0**2+(Y-4.1)**2/3.2**2<1){if(rx<1.5&&Y>2.9&&Y<5)return'C-04';return 'C-02';}
     return ear&&Math.abs(X)>5&&Y<-7?'C-04':'C-06';
    }
  }
  if(art===2){ // Sunflower with petals, stem and leaf.
    if(Y>3&&Y<13&&rx<1.5)return'C-15';
    if((X+3)**2+(Y-9)**2<4.3**2||(X-3)**2+(Y-10)**2<4.3**2){if(Y>7)return'C-14';}
    const r=Math.hypot(X,Y+4);if(r<5.2)return'C-04';
    if(r<12.4&&r>5.5){const a=Math.atan2(Y+4,X);const lobes=Math.cos(8*a);if(lobes>.04)return (x+y)%7===0?'C-10':'C-11';}
  }
  if(art===3){ // Strawberry, little leafy crown and seeds.
    const fruit=Y>-7.5&&Y<12.2&&rx<Math.max(.5,11.2-(Y+5)*.54)&&((X/11.2)**2+((Y+4)/16)**2<1.18);
    const leaf=Y>-11.5&&Y<-5&&((rx<7.5&&(x+y)%3!==0)||rx<3);
    if(leaf)return 'C-14';
    if(fruit)return (x*3+y*7)%17<2?'C-12':'C-08';
  }
  if(art===4){ // Smiling sun and 8 sun rays.
    const r=Math.hypot(X,Y),a=Math.atan2(Y,X);
    if(r<8.3){if(((X+3.3)**2+(Y+1.8)**2<1.25**2)||((X-3.3)**2+(Y+1.8)**2<1.25**2))return'C-05';
     if(Y>2.2&&Y<4.2&&rx<4.4&&Y>1.5+.15*X*X)return'C-04';return'C-11';}
    if(r>9&&r<13.9&&Math.cos(8*a)>.84)return'C-10';
  }
  if(art===5){ // Blue cat, triangular ears and clean muzzle.
    const ears=(Y>-12&&Y<-1&&((X<-5&&X>-13&&Y< -12+1.35*(X+13))||(X>5&&X<13&&Y< -12+1.35*(13-X))));
    const head=X*X/12.1**2+(Y-1.2)**2/10.3**2<1;
    if(ears||head){
     if((X+5.1)**2+(Y-.5)**2<1.8**2||(X-5.1)**2+(Y-.5)**2<1.8**2)return'C-05';
     if(rx<2&&Y>4&&Y<6)return'C-22';
     if(rx<7.5&&Y>6&&Y<8&&Math.round(X)%4===0)return'C-18';
     return ears?'C-18':'C-17';
    }
  }
  return null;
 };
 const sampled=Array.from({length:32*32},(_,i)=>paint(i%32,Math.floor(i/32)));
 // Keep the line art crisp at 32x32 and scale nearest-neighbour for other pegboards.
 return Array.from({length:size*size},(_,i)=>sampled[Math.min(31,Math.floor(Math.floor(i/size)*32/size))*32+Math.min(31,Math.floor((i%size)*32/size))]);
}
function packCells(cells){return cells.map(id=>id?COLOR_CHARS[swatches.findIndex(c=>c.id===id)]||'.':'.').join('');}
function unpackCells(str,size){if(typeof str!=='string'||str.length!==size*size)return null;return Array.from(str,ch=>{const k=COLOR_CHARS.indexOf(ch);return k>=0?swatches[k]?.id||null:null;});}
function loadProject(id,index){
 // Multiplayer / shared-room model: an in-progress board is NOT private local
 // progress. Entering the game always starts from a clean board — your beads only
 // survive if they were ironed and hung on the wall (the cloud-published gallery),
 // or (once a backend exists) if they are still the room's live state and nobody
 // cleared them. So we intentionally do not restore the local board here.
 return{size:32,cells:Array(1024).fill(null)};
}
for(let i=0;i<names.length;i++)tableBoards[names[i]]=loadProject(names[i],i);
function galleryHash(value){let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}return(h>>>0).toString(36);}
function galleryClamp(value,min,max,fallback){const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
const WALL_SURFACES=[
 {id:'north',label:'北墙',axis:'z',plane:-19.15,normal:1,minU:-16.25,maxU:16.25,minY:.55,maxY:6.15,displayOffset:.66},
 {id:'south',label:'南墙',axis:'z',plane:21.44,normal:-1,minU:-16.25,maxU:16.25,minY:.55,maxY:6.15,displayOffset:.10},
 {id:'west',label:'西墙',axis:'x',plane:-16.88,normal:1,minU:-18.05,maxU:20.15,minY:.55,maxY:6.15,displayOffset:.10},
 {id:'east',label:'东墙',axis:'x',plane:16.88,normal:-1,minU:-18.05,maxU:20.15,minY:.55,maxY:6.15,displayOffset:.10},
 {id:'iron-north-main',label:'熨烫间外墙',axis:'z',plane:9.66,normal:-1,minU:9.45,maxU:16.55,minY:.55,maxY:3.35,displayOffset:.08},
 {id:'iron-north-room',label:'熨烫间内墙',axis:'z',plane:9.94,normal:1,minU:9.45,maxU:16.55,minY:.55,maxY:3.35,displayOffset:.08},
 {id:'iron-west-main-a',label:'熨烫间门边外墙',axis:'x',plane:9.11,normal:-1,minU:9.95,maxU:12.95,minY:.55,maxY:3.35,displayOffset:.08},
 {id:'iron-west-room-a',label:'熨烫间门边内墙',axis:'x',plane:9.41,normal:1,minU:9.95,maxU:12.95,minY:.55,maxY:3.35,displayOffset:.08},
 {id:'iron-west-main-b',label:'熨烫间侧外墙',axis:'x',plane:9.11,normal:-1,minU:15.45,maxU:20.15,minY:.55,maxY:3.35,displayOffset:.08},
 {id:'iron-west-room-b',label:'熨烫间侧内墙',axis:'x',plane:9.41,normal:1,minU:15.45,maxU:20.15,minY:.55,maxY:3.35,displayOffset:.08}
];
function wallSurface(id){return WALL_SURFACES.find(surface=>surface.id===id)||WALL_SURFACES[0];}
function normalizeGalleryItem(raw,index=0){
 if(!raw||!sizeOptions.includes(raw.size)||typeof raw.pixels!=='string'||raw.pixels.length!==raw.size*raw.size)return null;
 const seed=`${raw.date||''}|${raw.author||''}|${raw.name||''}|${raw.size}|${galleryHash(raw.pixels)}`;
 const col=index%12,row=Math.floor(index/12)%4,surface=wallSurface(raw.wallId),fallbackU=surface.id==='north'?(-14.5+col*2.62):(surface.minU+(surface.maxU-surface.minU)*((col+.5)/12));
 const item={id:String(raw.id||`legacy-${galleryHash(seed)}`).slice(0,96),name:String(raw.name||'拼豆心愿').slice(0,24),size:raw.size,pixels:raw.pixels,
  level:['light','medium','flat'].includes(raw.level)?raw.level:'medium',technique:['normal','towel','crystal','glitter'].includes(raw.technique)?raw.technique:'normal',
  mount:['keychain','magnet','frame','stand','badge'].includes(raw.mount)?raw.mount:'frame',sides:String(raw.sides||'single').slice(0,16),by:String(raw.by||'self').slice(0,16),author:String(raw.author||'匿名豆友').slice(0,24),date:String(raw.date||'').slice(0,40),
  wallId:surface.id,wallU:galleryClamp(raw.wallU??raw.wallX,surface.minU,surface.maxU,fallbackU),wallY:galleryClamp(raw.wallY,surface.minY,surface.maxY,.85+row*1.55),wallOrder:galleryClamp(raw.wallOrder,0,Number.MAX_SAFE_INTEGER,Date.parse(raw.date)||index)};
 if(surface.id==='north')item.wallX=item.wallU;
 return item;
}
function sortGallery(){gallery.sort((a,b)=>(a.wallOrder-b.wallOrder)||a.id.localeCompare(b.id));}
function mergeGalleryItems(items){
 const seen=new Set(gallery.map(item=>item.id));let added=0;
 for(const raw of items||[]){const item=normalizeGalleryItem(raw,gallery.length);if(!item||seen.has(item.id))continue;seen.add(item.id);gallery.push(item);added++;}
 if(added){sortGallery();storeGallery();updateStatic();updateGalleryInfo();}
 return added;
}
function putGalleryItems(items){let changed=0;for(const raw of items||[]){const item=normalizeGalleryItem(raw,gallery.length);if(!item)continue;const index=gallery.findIndex(work=>work.id===item.id);if(index>=0)gallery[index]=item;else gallery.push(item);changed++;}if(changed){sortGallery();storeGallery();updateStatic();updateGalleryInfo();}return changed;}
function replaceGalleryItems(items){const next=(items||[]).map(normalizeGalleryItem).filter(Boolean);next.sort((a,b)=>(a.wallOrder-b.wallOrder)||a.id.localeCompare(b.id));const before=JSON.stringify(gallery.map(item=>[item.id,item.wallId,item.wallU,item.wallY,item.wallOrder])),after=JSON.stringify(next.map(item=>[item.id,item.wallId,item.wallU,item.wallY,item.wallOrder]));if(before===after)return false;gallery=next;storeGallery();updateStatic();updateGalleryInfo();return true;}
function removeGalleryItem(itemId){const index=gallery.findIndex(item=>item.id===itemId);if(index<0)return null;const [item]=gallery.splice(index,1);storeGallery();updateStatic();updateGalleryInfo();return item;}
function loadGallery(){try{const data=JSON.parse(localStorage.getItem('bead-house.v2.gallery'));if(Array.isArray(data))return data.map(normalizeGalleryItem).filter(Boolean).sort((a,b)=>(a.wallOrder-b.wallOrder)||a.id.localeCompare(b.id));}catch(_e){}return[];}
gallery=loadGallery();
let nickname='游客小豆';try{nickname=localStorage.getItem('bead-house.v1.nickname')||nickname;}catch(_e){}$('displayName').textContent=nickname;
function board(){return tableBoards[activeTable];}
function current(){return board().cells;}
function storeBoard(){const b=board();try{netSendBoard();}catch(_e){}try{localStorage.setItem('bead-house.v5.table'+activeTable,JSON.stringify({size:b.size,pixels:packCells(b.cells)}));return true;}catch(_e){toast('本地空间不足，请先导出 PNG 备份。');return false;}}
function storeGallery(){try{localStorage.setItem('bead-house.v2.gallery',JSON.stringify(gallery));return true;}catch(_e){toast('展示墙本地保存失败，请尝试删除较大作品。');return false;}}
function saveNick(){try{localStorage.setItem('bead-house.v1.nickname',nickname);}catch(_e){}try{markCloudProgress();}catch(_e){}}
// Reference images belong to each desk and are never written to the physical bead board.
function persistReference(id){const ref=referenceByTable[id];try{if(ref)localStorage.setItem('bead-house.v5.reference.'+id,JSON.stringify(ref));else localStorage.removeItem('bead-house.v5.reference.'+id);return true;}catch(_e){toast('图片已加载，但浏览器存储空间不足；刷新可能丢失参考图。');return false;}}
for(const id of names){try{const v=JSON.parse(localStorage.getItem('bead-house.v5.reference.'+id));if(v&&(v.kind==='template'||(v.kind==='upload'&&typeof v.data==='string'&&v.data.startsWith('data:image/'))))referenceByTable[id]=v;}catch(_e){}}
const patterns=[
 {name:'草莓爱心',desc:'初学 · 粉红',sample:0},{name:'软萌小熊',desc:'初学 · 奶茶',sample:1},
 {name:'向日葵',desc:'中等 · 黄色',sample:2},{name:'甜甜草莓',desc:'初学 · 红绿',sample:3},
 {name:'微笑太阳',desc:'初学 · 黄色',sample:4},{name:'蓝色小猫',desc:'中等 · 蓝色',sample:5},
 {name:'双倍爱心',desc:'练习 · 粉色',sample:6},{name:'奶茶熊熊',desc:'练习 · 棕色',sample:7}
];
function samplePreview(index){const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');const tiles=getSample(index,32);ctx.fillStyle='#fff7ed';ctx.fillRect(0,0,256,256);for(let y=0;y<32;y++)for(let x=0;x<32;x++){const id=tiles[y*32+x];if(id){ctx.fillStyle=colorLookup[id];ctx.fillRect(x*8,y*8,8,8);}}return c;}
function imageForReference(ref){if(!ref)return null;if(ref.kind==='template')return samplePreview(ref.sample);const img=new Image();img.src=ref.data;img.onload=()=>{if(activeModal==='editor')drawViewport();};return img;}
function buildPatterns(){const root=$('patternGrid');root.textContent='';patterns.forEach((item,i)=>{const button=document.createElement('button');button.type='button';button.className='pattern-card';const image=samplePreview(item.sample);image.setAttribute('aria-hidden','true');const title=document.createElement('strong');title.textContent=item.name;const detail=document.createElement('small');detail.textContent=item.desc;button.append(image,title,detail);button.onclick=()=>choosePattern(item);root.appendChild(button);});}
function openPatternPicker(id){activeTable=id;const ref=referenceByTable[id];$('patternDeskLabel').textContent=`${id} 号桌 · ${board().size}×${board().size} 空白拼豆板`;
 $('patternSaved').classList.toggle('hidden',!ref);$('savedPatternName').textContent=ref?`继续参考：${ref.name||'上次选择的图片'}`:'';
 $('patternFile').value='';openModal('pattern');}
function choosePattern(item){referenceByTable[activeTable]={kind:'template',sample:item.sample,name:item.name};delete referenceCanvases[activeTable];persistReference(activeTable);openEditor(activeTable);toast(`参考图 · ${item.name}`);}
function chooseBlank(){delete referenceByTable[activeTable];delete referenceCanvases[activeTable];persistReference(activeTable);openEditor(activeTable);toast('空白画板');}
async function uploadReference(file){if(!file)return;
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)){toast('请上传 PNG、JPG 或 WebP 图片。');return;}
 if(file.size>5*1024*1024){toast('图片不能超过 5 MB。');return;}
 const tableId=activeTable;let image;
 try{image=await createImageBitmap(file);}catch(_e){toast('无法读取图片，请重新选择。');return;}
 if(image.width*image.height>16000000||image.width>4096||image.height>4096){image.close();toast('图片尺寸过大，请缩小后上传（最多 4096px）。');return;}
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const cx=canvas.getContext('2d');cx.fillStyle='#fff9ee';cx.fillRect(0,0,512,512);
 const scale=Math.min(512/image.width,512/image.height),w=image.width*scale,h=image.height*scale;cx.drawImage(image,(512-w)/2,(512-h)/2,w,h);image.close();
 let data;try{data=canvas.toDataURL('image/jpeg',.82);}catch(_e){toast('图片转换失败。');return;}
 referenceByTable[tableId]={kind:'upload',name:file.name.slice(0,52),data};delete referenceCanvases[tableId];persistReference(tableId);
 if(PH.active){PH.looking=true;updateStatic();phCloseAlbum();return;}
 if(activeModal==='pattern'&&activeTable===tableId){openEditor(tableId);toast('图片已作为参考');}
 else if(activeModal==='editor'&&activeTable===tableId){renderReferencePanel();drawViewport();toast('已更新参考图');}
}
function renderReferencePanel(){const ref=referenceByTable[activeTable];const image=$('referenceImage');const noRef=$('noReference');image.classList.toggle('hidden',!ref);noRef.classList.toggle('hidden',!!ref);
 if(ref){if(ref.kind==='template'){image.src=samplePreview(ref.sample).toDataURL('image/png');}else image.src=ref.data;image.alt=`参考图：${ref.name}`;}
 $('referenceName').textContent=ref?ref.name:'尚未选择参考图';$('referenceDetails').textContent=ref?'参考只作对照 · 不自动填豆 · 可更换':'请先在图库中选择或上传图片';
 $('overlayRef').disabled=!ref;if(!ref){$('overlayRef').checked=false;referenceVisible=false;}
}


function rgb(hex){const a=parseInt(hex.slice(1),16);return[(a>>16)/255,((a>>8)&255)/255,(a&255)/255];}
function normalize(v){const l=Math.hypot(...v)||1;return v.map(x=>x/l);}
function sub(a,b){return a.map((x,i)=>x-b[i]);}
function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function dot(a,b){return a.reduce((r,x,i)=>r+x*b[i],0);}
function perspective(fovy,aspect,near,far){let f=1/Math.tan(fovy/2),nf=1/(near-far);return[f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0];}
function lookAt(eye,center,up){let z=normalize(sub(eye,center)),x=normalize(cross(up,z)),y=cross(z,x);return[x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1];}
function mulMat(a,b){const o=Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;}
function calcCamera(){
 // Subtle idle breathing sway while roaming the shop (not while seated/at the wall).
 const sway=(!PH.active&&!PH.wall&&!activeModal)?(1-player.walk):0,s=camera.sway;
 const swayY=Math.sin(s*0.85)*0.035*sway,swayA=Math.sin(s*0.47)*0.006*sway;
 if(firstPerson&&!PH.active&&!PH.wall){
  // First person: camera sits at the player's eyes, looks along yaw (camera.angle) with a
  // gentle up/down pitch (camera.fpLook). Movement & picking all run off this.
  const bob=Math.sin(camera.sway*8.5)*.03*player.walk;   // gentle head-bob while walking (reads as footsteps)
  const eye=[player.x,1.74+swayY*.4+bob,player.z],yaw=camera.angle+swayA,look=camera.fpLook,cl=Math.cos(look);
  const center=[eye[0]+Math.sin(yaw)*cl,eye[1]+Math.sin(look),eye[2]+Math.cos(yaw)*cl];
  camPos=eye;camForward=normalize(sub(center,camPos));camRight=normalize(cross(camForward,[0,1,0]));camUp=normalize(cross(camRight,camForward));
  drawMatrix=mulMat(perspective(camera.fov,layout.aspect,.05,100),lookAt(camPos,center,[0,1,0]));
  return;
 }
 const ang=camera.angle+swayA,center=[camera.lookX,(PH.wall?3.0:(PH.active?1.31:.96))+swayY,camera.lookZ], cp=Math.cos(camera.pitch);
 camPos=[center[0]+Math.sin(ang)*cp*camera.distance, center[1]+Math.sin(camera.pitch)*camera.distance, center[2]+Math.cos(ang)*cp*camera.distance];
 camForward=normalize(sub(center,camPos));camRight=normalize(cross(camForward,[0,1,0]));camUp=normalize(cross(camRight,camForward));
 drawMatrix=mulMat(perspective(Math.PI/4.0,layout.aspect,.1,100),lookAt(camPos,center,[0,1,0]));
}
function worldToScreen(p){const m=drawMatrix,x=p[0],y=p[1],z=p[2],w=m[3]*x+m[7]*y+m[11]*z+m[15];if(w<=0)return null;return{x:(m[0]*x+m[4]*y+m[8]*z+m[12])/w*layout.width/2+layout.width/2,y:-(m[1]*x+m[5]*y+m[9]*z+m[13])/w*layout.height/2+layout.height/2,visible:true};}
function screenRay(px,py){let nx=2*px/layout.width-1,ny=1-2*py/layout.height,spread=Math.tan(Math.PI/8);return normalize([camForward[0]+camRight[0]*nx*layout.aspect*spread+camUp[0]*ny*spread,camForward[1]+camRight[1]*nx*layout.aspect*spread+camUp[1]*ny*spread,camForward[2]+camRight[2]*nx*layout.aspect*spread+camUp[2]*ny*spread]);}
function groundAt(px,py){const ray=screenRay(px,py);if(ray[1]>=-.0001)return null;const t=-camPos[1]/ray[1];return[camPos[0]+ray[0]*t,0,camPos[2]+ray[2]*t];}
// Ray vs axis-aligned box (slab test); returns the entry distance or null. Used so a tap on a
// counter/table/wall picks that OBJECT directly — robust at any camera angle (unlike projecting
// a floor point, which flies off to infinity when you tap a near-horizontal surface).
function rayAABB(o,d,mn,mx){let t0=0,t1=1e9;for(let i=0;i<3;i++){if(Math.abs(d[i])<1e-8){if(o[i]<mn[i]||o[i]>mx[i])return null;}else{let a=(mn[i]-o[i])/d[i],b=(mx[i]-o[i])/d[i];if(a>b){const s=a;a=b;b=s;}if(a>t0)t0=a;if(b<t1)t1=b;if(t0>t1)return null;}}return t0;}

class Mesh {
 constructor(){this.data=[];this.count=0;}
 tri(a,b,c,n,color){const col=rgb(color);for(const p of [a,b,c])this.data.push(...p,...n,...col);this.count+=3;}
 quad(a,b,c,d,n,color){this.tri(a,b,c,n,color);this.tri(a,c,d,n,color);}
 box(x,y,z,w,h,d,color){const X=x-w/2,Y=y-h/2,Z=z-d/2,x2=x+w/2,y2=y+h/2,z2=z+d/2;
  this.quad([X,y2,Z],[X,y2,z2],[x2,y2,z2],[x2,y2,Z],[0,1,0],color);
  this.quad([X,Y,z2],[X,Y,Z],[x2,Y,Z],[x2,Y,z2],[0,-1,0],color);
  this.quad([X,Y,z2],[x2,Y,z2],[x2,y2,z2],[X,y2,z2],[0,0,1],color);
  this.quad([x2,Y,Z],[X,Y,Z],[X,y2,Z],[x2,y2,Z],[0,0,-1],color);
  this.quad([x2,Y,z2],[x2,Y,Z],[x2,y2,Z],[x2,y2,z2],[1,0,0],color);
  this.quad([X,Y,Z],[X,Y,z2],[X,y2,z2],[X,y2,Z],[-1,0,0],color);
 }
 dot(x,y,z,s,color){const h=s/2;this.quad([x-h,y,z-h],[x-h,y,z+h],[x+h,y,z+h],[x+h,y,z-h],[0,1,0],color);} // one flat up-facing quad (cheap peg hole)
 peg(x,y,z,r,h,color){
  // SOLID short bead for a placed cell: a filled top disc + side wall. Unlike the hollow
  // bead() it has no through-hole, so at a grazing camera it reads as an upright nub
  // sitting straight in its peg instead of a see-through arch.
  const seg=12,top=y+h*.5,bot=y-h*.5;
  for(let j=0;j<seg;j++){
   const a=j/seg*2*Math.PI,b=(j+1)/seg*2*Math.PI,ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b);
   const t0=[x+r*ca,top,z+r*sa],t1=[x+r*cb,top,z+r*sb],b0=[t0[0],bot,t0[2]],b1=[t1[0],bot,t1[2]];
   this.tri([x,top,z],t1,t0,[0,1,0],color);   // top disc wound CCW-from-above so it faces up (not culled)
   this.quad(b0,b1,t1,t0,[Math.cos((a+b)/2),0,Math.sin((a+b)/2)],color);
  }
 }
 bead(x,y,z,r,h,color){
  // Hollow fuse bead, horizontal ring with cylindrical outer/inner side walls.
  const segments=12,inner=r*.43,top=y+h*.5,bottom=y-h*.5;
  for(let j=0;j<segments;j++){
   const a=j/segments*2*Math.PI,b=(j+1)/segments*2*Math.PI;
   const cs=Math.cos(a),sn=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b);
   const outer0=[x+r*cs,top,z+r*sn],outer1=[x+r*cb,top,z+r*sb];
   const inner0=[x+inner*cs,top,z+inner*sn],inner1=[x+inner*cb,top,z+inner*sb];
   const outerB0=[outer0[0],bottom,outer0[2]],outerB1=[outer1[0],bottom,outer1[2]];
   const innerB0=[inner0[0],bottom,inner0[2]],innerB1=[inner1[0],bottom,inner1[2]];
   this.quad(outer0,outer1,inner1,inner0,[0,1,0],color);
   this.quad(outerB1,outerB0,innerB0,innerB1,[0,-1,0],color);
   this.quad(outerB0,outerB1,outer1,outer0,[Math.cos((a+b)/2),0,Math.sin((a+b)/2)],color);
   this.quad(innerB1,innerB0,inner0,inner1,[-Math.cos((a+b)/2),0,-Math.sin((a+b)/2)],color);
  }
 }
 sphere(x,y,z,r,color,lat=6,lon=9){
  for(let i=0;i<lat;i++)for(let j=0;j<lon;j++){
   let a=Math.PI*i/lat,b=Math.PI*(i+1)/lat,t=2*Math.PI*j/lon,u=2*Math.PI*(j+1)/lon;
   const point=(v,h)=>[x+r*Math.sin(v)*Math.cos(h),y+r*Math.cos(v),z+r*Math.sin(v)*Math.sin(h)];
   let p0=point(a,t),p1=point(b,t),p2=point(b,u),p3=point(a,u);
   const norm=(p,q,s)=>normalize(cross(sub(q,p),sub(s,p)));
   this.tri(p0,p2,p1,norm(p0,p2,p1),color);this.tri(p0,p3,p2,norm(p0,p3,p2),color);
  }
 }
}

// Diegetic tabletop interaction: no text controls, each bin and bead is a pickable 3D body.
// Prototype physics: rigid AABBs for furniture / bin dragging; gravity, bounce and edge
// collision for loose beads. Not a full 6-DOF rigid-body solver.
const PH = {active:false, table:null, bin:null, held:null, pointer:null, cursor:null,
  beads:[], looking:false, picker:false, ironRunning:false, lastHit:null,
  cameraDistance:6.8, orbitX:0, orbitZ:0, viewAuto:true, sitting:false, toolEquipped:false, wall:false, wallOpen:-1,
  activeColor:null, lastPlacedIdx:-1, tableColors:[], grabCount:10, grabAll:false, tool:'tweezers',
  boardOut:false,drawerOpen:false,boardAnimating:0,penEquipped:false,
  loader:{open:true,color:null,loose:0,shakeLeft:0,shakeTime:0,shakeUntil:0},
  pen:{loaded:0,color:null,capacity:18}};
const PH_BIN_COLS=4, PH_BIN_ROWS=6;
const PH_STORAGE_KEY='bead-house.v7.physical';
const PH_SIZES=[29,32,52,64,128];
// Bigger physical boards on a bigger tabletop, so even the large 128 board reads clearly
// (the 256 board was dropped — its cells were too small to see).
const PH_BOARD_WIDTHS={29:1.15,32:1.30,52:1.50,64:1.64,128:1.80};
const PH_BOARD_CHOICES=[.090,.104,.130,.152,.178];
function phTable(){return positions.find(t=>t.id===activeTable)||positions[0];}
// Full-palette organiser: a dense grid of small colour wells on the right of the table.
const BIN_COLS=10;
function phBinPos(i){const t=phTable();return {x:t.x+.86+(i%BIN_COLS)*.105,z:t.z-.80+Math.floor(i/BIN_COLS)*.12,y:1.35};}
// Bead-wall drawer grid: 8 columns × 6 rows = 48 colours. One helper feeds the
// static mesh, the open-drawer highlight, the hit-test and the 2D fallback.
const WALL_COLS=8,WALL_ROWS=Math.ceil(swatches.length/WALL_COLS);
const WALL_STEPY=Math.min(.72,4.05/Math.max(5,WALL_ROWS-1)),WALL_TOP=4.38;
// Columns run along -x so that in the wall view (where screen-left is world +x)
// C-01 reads at the top-left and numbers increase left→right, top→bottom.
function wallSlot(i){const col=WALL_COLS-1-(i%WALL_COLS),row=Math.floor(i/WALL_COLS);return {x:-15.36+col*1.03,y:WALL_TOP-row*WALL_STEPY};}
// The table's organiser holds the FULL colour set — every colour is stocked here.
// You only need the bead wall to RESTOCK a colour once its count runs low.
function phComputeTableColors(){PH.tableColors=swatches.slice().sort(gradientRank);}
// Stock every colour at the table when you sit down (a fresh room); restock at the wall when one runs low.
function phStockTable(){swatches.forEach(s=>{if((tray[s.id]||0)<=0)tray[s.id]=250;});}
function phBinColor(i){return PH.tableColors[i]||swatches[i]||swatches[0];}
function phBoardBounds(){const t=phTable(),w=PH_BOARD_WIDTHS[board().size]||1.5;return {cx:t.x-.20,cz:t.z-.52,w,h:w,top:1.278};}
// A nearly vertical, straight-on desk view. The whole active work strip remains usable on
// desktop, while narrow screens pull back only as much as the current pegboard requires.
function phDefaultCameraDistance(){
 const b=phBoardBounds(),limitingShare=Math.min(.70,Math.max(.30,layout.aspect*.82));
 const boardFit=b.w/(2*Math.tan(Math.PI/8)*limitingShare);
 return Math.max(3.35,Math.min(7.2,boardFit));
}
function phResetDeskView(){
 if(!PH.active)return;const t=phTable(),narrow=layout.aspect<.72;
 PH.orbitX=narrow?-.20:.05;PH.orbitZ=-.12;PH.cameraDistance=phDefaultCameraDistance();PH.viewAuto=true;
 camera.aTarget=0;camera.pTarget=1.535;camera.lookX=t.x+PH.orbitX;camera.lookZ=t.z+PH.orbitZ;
}
function phDrawerBounds(){const t=phTable();return {cx:t.x+.99,cz:t.z+1.145,w:.97,h:.30};}
function phLoaderBounds(){const t=phTable();return {cx:t.x+.34,cz:t.z+.60,w:.36,h:.33};}
function phPenRest(){const t=phTable();return {x:t.x+.27,z:t.z+.91};}
function phBoardChoicePos(j){const t=phTable();return {x:t.x+.70+(j%3)*.27,z:t.z+1.055+Math.floor(j/3)*.165};}
function phTrayBounds(){const t=phTable();return {cx:t.x-.54,cz:t.z+.73,w:1.03,h:.51,top:1.33};}
function phTweezersRest(){const t=phTable();return {x:t.x-1.22,z:t.z+.79};}
function phIsIn(x,z,r,b){return Math.abs(x-b.cx)<=b.w/2+r && Math.abs(z-b.cz)<=b.h/2+r;}
function phOnBoard(x,z){if(!PH.boardOut||PH.boardAnimating>0)return false;const b=phBoardBounds();return Math.abs(x-b.cx)<b.w/2 && Math.abs(z-b.cz)<b.h/2;}
function phBoardIndex(x,z){const b=phBoardBounds(),n=board().size;
  const bx=Math.floor((x-(b.cx-b.w/2))/b.w*n),by=Math.floor((z-(b.cz-b.h/2))/b.h*n);
  return bx>=0&&bx<n&&by>=0&&by<n?by*n+bx:-1;
}
function phPosForIndex(i){const b=phBoardBounds(),n=board().size;return {x:b.cx+((i%n+.5)/n-.5)*b.w,z:b.cz+((Math.floor(i/n)+.5)/n-.5)*b.h};}
function phAtHeight(px,py,height=1.31){const ray=screenRay(px,py);if(Math.abs(ray[1])<.00001)return null;
  const t=(height-camPos[1])/ray[1];if(t<=0)return null;return {x:camPos[0]+ray[0]*t,z:camPos[2]+ray[2]*t};}
function phCanStep(x,z){
  const r=.26;
  const obstacles=positions.map(t=>({x:t.x,z:t.z,w:2.93+.12,h:2.28+.12}));
  obstacles.push({x:13.48,z:-10.92,w:3.36,h:7.20},{x:-12,z:16.75,w:7.5,h:2.3});
  if(x<ROOM.minX+r||x>ROOM.maxX-r||z<ROOM.minZ+r||z>ROOM.maxZ-r)return false;
  for(const o of obstacles){const cx=Math.max(o.x-o.w/2,Math.min(x,o.x+o.w/2)),cz=Math.max(o.z-o.h/2,Math.min(z,o.z+o.h/2));
    if((x-cx)**2+(z-cz)**2<r*r)return false;
  }
  return true;
}
function phWalkStep(nx,nz){
  if(!canStep(nx,nz))return false;
  // Resolve each axis independently, allowing sliding along furniture.
  const canX=phCanStep(nx,player.z),canZ=phCanStep(player.x,nz);
  if(canX)player.x=nx;if(canZ)player.z=nz;
  return canX||canZ;
}
function phRouteTo(tx,tz,fromX=player.x,fromZ=player.z){
  // A* on a lightweight grid; dynamic props use separate collision logic.
  const step=.53,X0=ROOM.minX+.27,Z0=ROOM.minZ+.27;
  const ix=x=>Math.round((x-X0)/step),iz=z=>Math.round((z-Z0)/step),sizeX=64,sizeZ=74;
  const sid=(a,b)=>a+sizeX*b;
  const sx=ix(fromX),sz=iz(fromZ),ex=ix(tx),ez=iz(tz);
  const start=sid(sx,sz),goal=sid(ex,ez),open=[{id:start,f:0}],g=new Map([[start,0]]),back=new Map(),closed=new Set();
  const coords=id=>[id%sizeX,Math.floor(id/sizeX)];
  for(let iter=0;open.length&&iter<8500;iter++){
    open.sort((a,b)=>a.f-b.f);const node=open.shift(),id=node.id;if(closed.has(id))continue;
    if(id===goal){const path=[];let p=id;while(p!==start&&back.has(p)){const [cx,cz]=coords(p);path.push({x:X0+cx*step,z:Z0+cz*step});p=back.get(p);}path.reverse();
      // Skip intermediate points if no obstacle is along the straight line.
      const simplified=[];for(let k=0;k<path.length;k++){if(!simplified.length||k===path.length-1||k%3===0)simplified.push(path[k]);}
      return simplified;
    }
    closed.add(id);const [cx,cz]=coords(id);
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=cx+dx,nz=cz+dz;if(nx<0||nz<0||nx>=sizeX||nz>=sizeZ)continue;
      const wx=X0+nx*step,wz=Z0+nz*step;if(!phCanStep(wx,wz))continue;
      const ni=sid(nx,nz),v=(g.get(id)||0)+1;if(v>=(g.get(ni)??Infinity))continue;g.set(ni,v);back.set(ni,id);
      open.push({id:ni,f:v+Math.abs(nx-ex)+Math.abs(nz-ez)});
    }
  }
  return [{x:tx,z:tz}];
}
function phWallEnter(){
 PH.wall=true;PH.wallOpen=-1;PH.active=false;drawerOpened=false;
 player.target=null;player.route=[];pendingBeadStation=false;
 camera.aTarget=Math.PI;camera.pTarget=.27;camera.dTarget=10.6;
 camera.lookX=-12;camera.lookZ=18.3;
 document.body.classList.add('wall-focused');updateStatic();
}
function phWallExit(){
 PH.wall=false;PH.wallOpen=-1;drawerOpened=false;
 document.body.classList.remove('wall-focused');camera.dTarget=29;
 updateStatic();
}
function phWallTap(px,py){
 // The large wall's six columns and four rows have real physical drawers.
 let nearest=null,min=45;
 for(let i=0;i<swatches.length;i++){
   const s=wallSlot(i);
   const screen=worldToScreen([s.x,s.y,18.95]);if(!screen)continue;
   const d=Math.hypot(screen.x-px,screen.y-py);
   if(d<min){min=d;nearest=i;}
 }
 if(nearest===null)return;
 if(PH.wallOpen!==nearest){PH.wallOpen=nearest;pickedBin=swatches[nearest].id;pickupAt='wall';drawerOpened=true;updateStatic();return;}
 const id=swatches[nearest].id,amount=Math.min(12,rackStock[id]||0,TRAY_MAX-trayTotal());
 if(amount){rackStock[id]-=amount;tray[id]+=amount;persistRack();persistTray();}
 drawerOpened=false;PH.wallOpen=-1;updateStatic();
}
function phSit(t){
  if(carriedBoard){toast('双手正端着拼好的底板，请先送到熨烫间。');return;}
  activeTable=t.id;PH.table=t;PH.active=true;PH.sitting=true;
  player.target=null;player.route=[];pendingTable=null;pendingCoffee=false;pendingStation=false;pendingBeadStation=false;
  for(const k in input)input[k]=false;
  PH.held=null;PH.bin=null;PH.pointer=null;PH.toolEquipped=false;PH.penEquipped=false;PH.boardOut=true;PH.drawerOpen=false;PH.boardAnimating=0;PH.seatIndex=null;PH.seatAt=0;PH.activeColor=null;PH.lastPlacedIdx=-1;
  PH.loader={open:true,color:null,loose:0,shakeLeft:0,shakeTime:0,shakeUntil:0};PH.pen={loaded:0,color:null,capacity:18};
  PH.viewAuto=true;
  phStockTable();phComputeTableColors();
  const saved=referenceByTable[activeTable];PH.looking=!!saved;
  fpSavedYaw=camera.angle;phResetDeskView();document.body.classList.add('desk-focused');
  phSyncBeads();updateStatic();updateSeatHud();
}
function phStand(){if(PH.wall){phWallExit();return;}if(!PH.active)return;
  if(PH.held)phReturnBead();phReturnLoader();PH.active=false;PH.table=null;PH.bin=null;PH.pointer=null;PH.toolEquipped=false;PH.penEquipped=false;
  document.body.classList.remove('desk-focused');phCloseAlbum();
  camera.dTarget=27;camera.pTarget=.91;if(firstPerson){camera.angle=camera.aTarget=fpSavedYaw;}else camera.aTarget=.41; // restore first-person facing on stand-up
  const dl=$('diegeticLabels');if(dl)dl.replaceChildren();seatLabels=null;
  updateStatic();updateSeatHud();
}
// The sorting tray starts empty — loose beads only appear when you pour a box into it.
function phSyncBeads(){PH.beads=[];}
function phPour(color,originX,originZ){
  if(!color||!tableStock[activeTable])return;
  const stock=tableStock[activeTable],qty=Math.min(12,stock[color]||0,TRAY_MAX-trayTotal());
  if(qty<=0){phNudge();return;}
  stock[color]-=qty;tray[color]+=qty;persistTableStock();persistTray();
  const b=phTrayBounds(),compartment=swatches.findIndex(s=>s.id===color)%4;const room=Math.max(0,100-PH.beads.length);
  for(let j=0;j<Math.min(room,qty);j++){
   PH.beads.push({id:color,compartment,x:b.cx-b.w*.375+compartment*b.w*.25+(Math.random()-.5)*.13,z:b.cz+(Math.random()-.5)*.22,
     y:1.75+j*.018,vx:(Math.random()-.5)*.45,vy:0,vz:(Math.random()-.5)*.35,rest:false});
  }
  PH.bin=null;PH.held=null;phComputeTableColors();updateStatic();SFX.pour();
}
function phReturnLoader(){
 // Leftover beans remain in the currently assigned table's stock when standing up.
 const l=PH.loader,pen=PH.pen;if(!PH.active||!tableStock[activeTable])return;
 if(l.color&&l.loose)tableStock[activeTable][l.color]+=l.loose;
 if(pen.color&&pen.loaded)tableStock[activeTable][pen.color]+=pen.loaded;
 l.loose=0;l.color=null;pen.loaded=0;pen.color=null;persistTableStock();
}
function phFillLoader(id){
 const l=PH.loader,pen=PH.pen,stock=tableStock[activeTable];
 if(!l.open||!id||!stock)return phNudge();
 if((l.loose&&l.color!==id)||(pen.loaded&&pen.color!==id))return phNudge();
 const qty=Math.min(24-l.loose,stock[id]||0);if(qty<1)return phNudge();
 stock[id]-=qty;l.loose+=qty;l.color=id;persistTableStock();PH.bin=null;updateStatic();SFX.pour();
}
function phToggleLid(){if(PH.loader.shakeLeft>0)return;PH.loader.open=!PH.loader.open;updateStatic();SFX.drawer();}
function phShakeLoader(){
 const l=PH.loader,pen=PH.pen;if(l.open||l.loose<1)return phNudge();
 if(pen.loaded>0&&pen.color!==l.color)return phNudge();
 if(l.shakeLeft>0)return;const qty=Math.min(6,l.loose,pen.capacity-pen.loaded);
 if(qty<1)return phNudge();l.shakeLeft=qty;l.shakeTime=0;l.shakeUntil=performance.now()+750;SFX.shake();
}
function phDispenseBead(x,z){
 if(!PH.penEquipped||PH.pen.loaded<=0||!phOnBoard(x,z))return false;
 const idx=phBoardIndex(x,z);if(idx<0||board().cells[idx])return phNudge(),false;
 const id=PH.pen.color;if(!id)return false;board().cells[idx]=id;PH.pen.loaded--;
 if(!PH.pen.loaded&&PH.loader.loose<=0){PH.pen.color=null;PH.loader.color=null;}
 phSeatBead(idx);storeBoard();updateStatic();SFX.place();return true;
}
function phNudge(){const e=$('physicalNudge');if(!e)return;e.classList.remove('nudge');void e.offsetWidth;e.classList.add('nudge');}
function phPhysics(dt){if(!PH.active)return;
 const l=PH.loader;if(l.shakeLeft>0){l.shakeTime+=dt;if(l.shakeTime>=.12){l.shakeTime-=.12;l.shakeLeft--;l.loose--;PH.pen.loaded++;PH.pen.color=l.color;if(l.shakeLeft===0&&l.loose===0)l.color=PH.pen.color;updateStatic();}}
 if(PH.boardAnimating>0){PH.boardAnimating=Math.max(0,PH.boardAnimating-dt);if(PH.boardAnimating===0)updateStatic();}
 const b=phTrayBounds();
 for(const p of PH.beads){if(p.rest)continue;
   p.vy-=9.8*dt;p.x+=p.vx*dt;p.z+=p.vz*dt;p.y+=p.vy*dt;
   const compartment=p.compartment??0,minx=b.cx-b.w/2+compartment*b.w/4+.043,maxx=minx+b.w/4-.071,minz=b.cz-b.h/2+.045,maxz=b.cz+b.h/2-.045;
   if(p.x<minx||p.x>maxx){p.x=Math.max(minx,Math.min(maxx,p.x));p.vx*=-.34;}
   if(p.z<minz||p.z>maxz){p.z=Math.max(minz,Math.min(maxz,p.z));p.vz*=-.34;}
   if(p.y<b.top+.042){p.y=b.top+.042;p.vy=Math.abs(p.vy)*.25;p.vx*=.8;p.vz*=.8;if(Math.abs(p.vy)<.14){p.vy=0;p.rest=true;}}
 }
 // Soft overlap correction for loose beads sharing a compartment.
 for(let i=0;i<PH.beads.length;i++){const a=PH.beads[i];if(a.y>b.top+.085)continue;
  for(let j=i+1;j<PH.beads.length;j++){const c=PH.beads[j];if(c.y>b.top+.085)continue;
   const dx=c.x-a.x,dz=c.z-a.z,d=Math.hypot(dx,dz),min=.072;
   if(d>0&&d<min){const v=(min-d)*.5;a.x-=dx/d*v;c.x+=dx/d*v;a.z-=dz/d*v;c.z+=dz/d*v;}
  }
 }
}
function phMeshBox(m,x,y,z,w,h,d,color){m.box(x,y,z,w,h,d,color);}
// 5x7 stroke-font embossed directly in 3D. Never screen-space labels, so camera motion
// cannot make letters slide independently from boxes.
const PH_GLYPHS={
 '0':['111','101','101','101','101','101','111'],
 '1':['010','110','010','010','010','010','111'],
 '2':['111','001','001','111','100','100','111'],
 '3':['111','001','001','111','001','001','111'],
 '4':['101','101','101','111','001','001','001'],
 '5':['111','100','100','111','001','001','111'],
 '6':['111','100','100','111','101','101','111'],
 '7':['111','001','001','001','001','001','001'],
 '8':['111','101','101','111','101','101','111'],
 '9':['111','101','101','111','001','001','111'],
 'C':['111','100','100','100','100','100','111'],
 '-':['000','000','000','111','000','000','000']
};
function phEngraveTop(m,text,cx,y,cz,w,h){
 const chars=String(text).split(''),cols=chars.length*4-1,du=w/cols,dv=h/7;
 for(let k=0;k<chars.length;k++){
  const glyph=PH_GLYPHS[chars[k]]||PH_GLYPHS['-'];
  for(let row=0;row<7;row++)for(let col=0;col<3;col++)if(glyph[row][col]==='1'){
   m.box(cx-w/2+(k*4+col+.5)*du,y,cz-h/2+(row+.5)*dv,du*.86,.0045,dv*.88,'#4d4b40');
  }
 }
}
function phEngraveWall(m,text,cx,cy,z,w,h){
 // Wall drawers are viewed looking toward +z, where screen-right is world -x, so
 // the glyph columns are laid out along -x to keep the serials reading correctly.
 const chars=String(text).split(''),cols=chars.length*4-1,du=w/cols,dv=h/7;
 for(let k=0;k<chars.length;k++){
  const glyph=PH_GLYPHS[chars[k]]||PH_GLYPHS['-'];
  for(let row=0;row<7;row++)for(let col=0;col<3;col++)if(glyph[row][col]==='1'){
   m.box(cx+w/2-(k*4+col+.5)*du,cy+h/2-(row+.5)*dv,z,du*.85,dv*.85,.0045,'#51483f');
  }
 }
}
function phReferencePlane(){const t=phTable();return {x:t.x-1.28,z:t.z-.39,w:.66,h:.92,y:1.454};}
function phCreateStatic(m){
 if(!PH.active)return;const t=phTable(),b=phBoardBounds(),tr=phTrayBounds();
 // Larger, close-up wooden tabletop in the same 3D studio, fitted over the actual table.
 m.box(t.x,1.115,t.z,4.0,.20,3.2,'#b9835d');m.box(t.x,1.237,t.z,3.9,.047,3.1,'#e7c4a1');
 if(tableDrinks[activeTable])addDrinkCup(m,t.x-1.55,1.42,t.z-.91,tableDrinks[activeTable],1.05);
 // The pegboard starts inside the side-board drawer; it only occupies the work surface after taking it out.
 if(PH.boardOut && PH.boardAnimating<=0){
  m.box(b.cx,1.277,b.cz,b.w+.078,.053,b.h+.078,'#8faaa7');m.box(b.cx,1.309,b.cz,b.w+.032,.022,b.h+.032,'#faf8f2');
  // A real pegboard: a dark hole at EVERY cell forms the grid, and beads sit over
  // their holes. One full-resolution grid, so holes and beads always line up and the
  // board always reads as a 拼豆 board (the bead's own hole reveals the board hole).
  const n=board().size,cells=board().cells,cstep=b.w/n,br=Math.max(.011,cstep*.54),hs=Math.max(.008,cstep*.34),ch=Math.max(.003,br*.34);
  // Solid squat bead whose BOTTOM sits just clear of the board surface top (≈1.320): if it
  // dips below that it z-fights the surface and darkens into a faint outline ("正片叠底").
  // A bit of height (≈ its own width) keeps it clearly visible without looking like a tube.
  const bh=Math.min(.06,Math.max(.02,br*1.5)),by=1.322+bh*.5;
  // EVERY board size gets a full peg-hole grid (cheap flat quads), so the large 128 board
  // reads and behaves just like the small one — holes everywhere, beads land on them.
  for(let i=0;i<cells.length;i++){
    const x=b.cx+((i%n+.5)/n-.5)*b.w,z=b.cz+((Math.floor(i/n)+.5)/n-.5)*b.h,id=cells[i];
    if(id){
      const gc=glHex(id);
      m.peg(x,by,z,br,bh,gc);                   // solid upright bead seated flush on its peg
      m.dot(x,by+bh*.5+.0006,z,ch,mixHex(gc,'#000000',.22)); // soft top dimple so each reads as a bead
    }
    else m.dot(x,1.321,z,hs,'#746848');        // empty peg hole, flush with the board
  }
 }else{
  // A few surface grooves indicate the sliding rails, but no instructional copy.
  for(const dx of [-.65,.65])m.box(b.cx+dx,1.276,b.cz, .022,.018,1.35,'#bf9b79');
 }
 // Transparent-look sorting tray with raised collision lips and dividers.
 m.box(tr.cx,tr.top-.064,tr.cz,tr.w+.055,.11,tr.h+.066,'#d0d9d5');
 m.box(tr.cx,tr.top-.005,tr.cz,tr.w,.012,tr.h,'#e8ede8');
 for(const iz of [-1,1])m.box(tr.cx,tr.top+.044,tr.cz+iz*tr.h/2,tr.w+.08,.083,.038,'#9aaea6');
 for(const ix of [-1,1])m.box(tr.cx+ix*tr.w/2,tr.top+.044,tr.cz,.038,.083,tr.h+.08,'#9aaea6');
 for(let i=1;i<4;i++)m.box(tr.cx-tr.w/2+tr.w*i/4,tr.top+.025,tr.cz,.025,.048,tr.h-.03,'#bed0c8');
 // Full-palette organiser case: a dense grid of small colour wells (every colour),
 // so the whole palette is on the table at a glance; tap a well to grab that colour.
 if(PH.tableColors.length){
   const cols=Math.min(BIN_COLS,PH.tableColors.length),rows=Math.ceil(PH.tableColors.length/BIN_COLS);
   const p0=phBinPos(0),cx=p0.x+(cols-1)*.105/2,cz=p0.z+(rows-1)*.12/2;
   m.box(cx,1.3,cz,cols*.105+.05,.028,rows*.12+.05,'#b89a74');     // wooden case base
 }
 for(let i=0;i<PH.tableColors.length;i++){
   if(PH.bin?.index===i)continue;const p=phBinPos(i),c=phBinColor(i),col=glHex(c.id);
   m.box(p.x,1.316,p.z,.096,.034,.11,'#efe7d7');                   // well frame
   m.box(p.x,1.336,p.z,.08,.016,.094,col);                        // the colour itself (full, flat)
 }
 // The tweezer rest is a distinct warm-slate tool dock in the foreground.
 // Tool dock: the tweezers and the shaking bead pen (摇摇笔) rest here when not in hand.
 if(!(PH.toolEquipped&&PH.tool==='tweezers')){
   const tw=phTweezersRest();
   m.box(tw.x,1.284,tw.z,.31,.034,.64,'#405a60');
   m.box(tw.x,1.306,tw.z,.283,.008,.61,'#728b8c');
   for(const dx of [-.085,.085]){
      m.box(tw.x+dx,1.345,tw.z,.045,.06,.54,'#cddbd7');
      m.box(tw.x+dx,1.383,tw.z-.18,.052,.018,.16,'#72888e');
      m.box(tw.x+dx/1.5,1.338,tw.z+.283,.026,.028,.107,'#d5d7d1');
   }
   m.box(tw.x,1.385,tw.z-.14,.22,.09,.11,'#d7e3df');
 }
 if(!(PH.toolEquipped&&PH.tool==='pen')){
   const pr=phPenRest();
   m.box(pr.x,1.292,pr.z,.20,.03,.52,'#c9b79a');            // holder tray
   m.box(pr.x,1.348,pr.z-.02,.105,.1,.44,'#4f8f8c');        // pen body (teal)
   m.box(pr.x,1.404,pr.z+.195,.074,.052,.085,'#e7b88b');    // wooden nib / tip
   m.box(pr.x,1.412,pr.z-.175,.072,.05,.07,'#f0f4f2');      // push button
   m.box(pr.x,1.404,pr.z-.02,.046,.064,.3,'#c6ece8');       // clear bead window
 }
 // Sliding pegboard rack at the right edge: six real mini pegboards with no dimension labels.
 const rack=phDrawerBounds();
 m.box(rack.cx,1.233,rack.cz,rack.w+.09,.092,rack.h+.09,'#9b6e50');
 m.box(rack.cx,1.29,rack.cz,rack.w,.036,rack.h,'#e1b796');
 m.box(rack.cx,1.306,rack.cz+rack.h*.47,.27,.034,.029,'#c39a75');
 if(PH.drawerOpen){
  m.box(rack.cx,1.293,rack.cz+.21,rack.w,.035,.49,'#d4ae89');
  for(let j=0;j<PH_SIZES.length;j++){
   const q=phBoardChoicePos(j),sizeFactor=PH_BOARD_CHOICES[j];
   m.box(q.x,1.329,q.z,sizeFactor,.035,sizeFactor,'#fff8e8');
   const dots=[3,4,5,6,7][j];
   for(let iz=0;iz<dots;iz++)for(let ix=0;ix<dots;ix++)m.box(q.x+((ix+.5)/dots-.5)*sizeFactor,1.349,q.z+((iz+.5)/dots-.5)*sizeFactor,.007,.012,.007,'#c6b59b');
  }
 }else{
  for(let j=0;j<3;j++)m.box(rack.cx-.25+j*.25,1.321,rack.cz-.02,.16,.016,.18,'#f9f1e2');
 }
 // (Removed the multi-bead shaker/pen: real bead craft just needs sorted beads,
 //  tweezers and the pegboard — the extra gadget only confused the workflow.)
 // iPad display: solid black bezel, glass screen, camera lens and a home indicator.
 const screen=phReferencePlane();
 m.box(screen.x,1.326,screen.z,screen.w+.105,.15,screen.h+.105,'#434748');
 m.box(screen.x,1.417,screen.z,screen.w+.05,.023,screen.h+.05,'#111f24');
 m.box(screen.x,1.437,screen.z,screen.w,.008,screen.h,'#f2f4ed');
 m.box(screen.x,1.449,screen.z+screen.h*.515,.16,.008,.012,'#a1b3b2');
 m.box(screen.x,1.449,screen.z-screen.h*.527,.025,.009,.025,'#667879');
}
const PH_IMAGE_CACHE=new Map();
function phImageColors(src){if(PH_IMAGE_CACHE.has(src))return PH_IMAGE_CACHE.get(src);
 const c=document.createElement('canvas');c.width=c.height=16;const ctx=c.getContext('2d',{willReadFrequently:true});
 const img=new Image();img.src=src;img.onload=()=>{ctx.fillStyle='#fff';ctx.fillRect(0,0,16,16);ctx.drawImage(img,0,0,16,16);const d=ctx.getImageData(0,0,16,16).data;
 const out=[];for(let i=0;i<256;i++){let best=swatches[0].id,bestD=1e9;for(const s of swatches){const rgbv=rgb(s.hex);const ds=(rgbv[0]*255-d[i*4])**2+(rgbv[1]*255-d[i*4+1])**2+(rgbv[2]*255-d[i*4+2])**2;if(ds<bestD){bestD=ds;best=s.id;}}out.push(best);}
 PH_IMAGE_CACHE.set(src,out);updateStatic();};return Array(256).fill(null);
}
function phCreateDynamic(m){
 if(!PH.active)return;const t=phTable();
 for(const bead of PH.beads)m.bead(bead.x,bead.y,bead.z,.041,.054,glHex(bead.id));
 if(PH.bin){const b=PH.bin,c=phBinColor(b.index),tip=phIsIn(b.x,b.z,.05,phTrayBounds());
   m.box(b.x,tip?1.60:1.66,b.z,.205,.093,.225,'#f0e9df');
   m.box(b.x,tip?1.665:1.718,b.z,.19,.042,.195,glHex(c.id));
   m.box(b.x,tip?1.72:1.758,b.z+.09,.18,.018,.05,'#fff8e8');
   phEngraveTop(m,c.id,b.x,tip?1.733:1.771,b.z+.09,.16,.040);
   if(tip)for(let j=0;j<5;j++)m.bead(b.x+(j%2)*.03,1.47+j*.06,b.z+(j%3)*.025,.025,.038,glHex(c.id));
 }
 if(PH.toolEquipped&&PH.cursor){const p=PH.cursor;
   if(PH.tool==='pen'){
     // 摇摇笔 held vertically, tip down over the pegs; the barrel glows with its inked colour.
     const ink=PH.activeColor&&(tray[PH.activeColor]||0)>0?glHex(PH.activeColor):'#cfe3e1';
     m.box(p.x,1.74,p.z,.07,.34,.07,'#4f8f8c');m.box(p.x,1.95,p.z,.085,.055,.085,'#f0f4f2');
     m.box(p.x,1.60,p.z,.044,.12,.044,ink);               // inked barrel window
     m.box(p.x,1.535,p.z,.028,.05,.028,'#e7b88b');          // tip
     if(PH.activeColor)m.bead(p.x,1.50,p.z,.03,.028,ink);  // the bead about to drop
   }else{
     if(PH.held){const hc=Math.min(phHeldCount(),4),col=glHex(PH.held.id);const off=[[0,0],[.03,.02],[-.028,.026],[.004,-.03]];for(let q=0;q<hc;q++)m.bead(p.x+off[q][0],1.53+q*.006,p.z+off[q][1],.037,.048,col);}
     // Paired metal tweezer prongs pinch together when a bead is gripped.
     const pinchP=PH.held?(PH.pinchAt?Math.min(1,(performance.now()-PH.pinchAt)/130):1):0,sep=.039-.020*pinchP;
     m.box(p.x-sep,1.75,p.z-sep*.86,.014,.36,.014,'#9eaaa9');m.box(p.x+sep,1.75,p.z+sep*.86,.014,.36,.014,'#9eaaa9');
     m.box(p.x,1.92,p.z,.076,.045,.019,'#d8dfdc');
   }
 }
 if(PH.boardAnimating>0){const d=phDrawerBounds(),b=phBoardBounds(),f=1-PH.boardAnimating/.68;
   m.box(d.cx+(b.cx-d.cx)*f,1.35,d.cz+(b.cz-d.cz)*f,b.w+.035,.055,b.h+.035,'#eee5d8');}
}
// Floating tags over each tabletop zone so the whole desk is instantly readable.
let seatLabels=null;
// No text tags on the desk — the objects are meant to be self-evident.
function phRenderLabels(){const root=$('diegeticLabels');if(root?.childElementCount)root.replaceChildren();seatLabels=null;}
function phRenderWallLabels(){const root=$('diegeticLabels');if(root?.childElementCount)root.replaceChildren();}
function phDrawFallback(box,circle){
 if(!PH.active)return;const t=phTable(),b=phBoardBounds(),tr=phTrayBounds();
 box(t.x,1.22,t.z,3.9,.09,3.1,'#ddba96');
 if(tableDrinks[activeTable]){const d=drinkById(tableDrinks[activeTable].id);box(t.x-1.55,1.42,t.z-.91,.25,.30,.25,d.cup||'#f4eee4');circle([t.x-1.55,1.59,t.z-.91],.10,d.drink);}
 if(PH.boardOut && PH.boardAnimating<=0){
  box(b.cx,1.30,b.cz,b.w+.078,.055,b.h+.078,'#8faaa7');
  const n=board().size,cells=board().cells,cstep=b.w/n,br=Math.max(.008,cstep*.46);
  for(let i=0;i<cells.length;i++){const id=cells[i];const xx=b.cx+((i%n+.5)/n-.5)*b.w,zz=b.cz+((Math.floor(i/n)+.5)/n-.5)*b.h;
   if(id){circle([xx,1.33,zz],br,colorLookup[id]);circle([xx,1.335,zz],Math.max(.004,cstep*.14),'#4a3f2d');}
   else circle([xx,1.323,zz],Math.max(.004,cstep*.22),'#746848');}
 }else for(const dx of [-.65,.65])box(b.cx+dx,1.284,b.cz,.023,.027,1.35,'#bf9b79');
 box(tr.cx,1.295,tr.cz,tr.w+.05,.08,tr.h+.07,'#a5b9ae');box(tr.cx,1.348,tr.cz,tr.w,.02,tr.h,'#e8eee9');
 for(let i=0;i<PH.tableColors.length;i++){if(PH.bin?.index===i)continue;const p=phBinPos(i),bc=phBinColor(i);
  box(p.x,1.316,p.z,.096,.034,.11,'#e8dfd1');box(p.x,1.336,p.z,.08,.016,.094,glHex(bc.id));
 }
 for(const bead of PH.beads){circle([bead.x,bead.y,bead.z],.05,colorLookup[bead.id]);circle([bead.x,bead.y+.012,bead.z],.018,'#e9eee8');}
 if(PH.bin){box(PH.bin.x,1.7,PH.bin.z,.21,.14,.22,swatches[PH.bin.index].hex);}
 if(!PH.toolEquipped){const tw=phTweezersRest();box(tw.x,1.30,tw.z,.31,.04,.64,'#405a60');box(tw.x-.085,1.35,tw.z,.045,.07,.54,'#d9e4e0');box(tw.x+.085,1.35,tw.z,.045,.07,.54,'#d9e4e0');box(tw.x,1.40,tw.z-.14,.22,.09,.11,'#b5ccc6');}
 if(PH.toolEquipped&&PH.cursor){if(PH.held)circle([PH.cursor.x,1.55,PH.cursor.z],.053,colorLookup[PH.held.id]);box(PH.cursor.x,1.76,PH.cursor.z,.08,.32,.022,'#929e9b');}
 const rack=phDrawerBounds();box(rack.cx,1.26,rack.cz,1.03,.10,.39,'#b38c6b');
 if(PH.drawerOpen){box(rack.cx,1.30,rack.cz+.21,.95,.03,.49,'#e5c19b');
  for(let j=0;j<PH_SIZES.length;j++){const q=phBoardChoicePos(j),sizeFactor=PH_BOARD_CHOICES[j];
   box(q.x,1.343,q.z,sizeFactor,.03,sizeFactor,'#fcf8e9');}}
 else for(let j=0;j<3;j++)box(rack.cx-.25+j*.25,1.31,rack.cz-.02,.16,.015,.17,'#f8f3e7');
 if(PH.boardAnimating>0){const d=phDrawerBounds(),b=phBoardBounds(),f=1-PH.boardAnimating/.68;box(d.cx+(b.cx-d.cx)*f,1.35,d.cz+(b.cz-d.cz)*f,b.w+.035,.055,b.h+.035,'#eee5d8');}
 const r=phReferencePlane();box(r.x,1.37,r.z,r.w+.11,.12,r.h+.11,'#394449');box(r.x,1.424,r.z,r.w,.012,r.h,'#edf2ed');
 phDrawFallbackReference();
}
// Reference stays on a physical board and can be swapped without touching any beads.
// Cache actual source images (never approximate an uploaded photograph to palette colors).
const PH_REF_IMAGES=new Map();
let phReferenceProgram=null,phReferenceBuffer=null,phReferenceAttrib=null;
function phReferenceImage(){
 const ref=referenceByTable[activeTable];if(!ref){
  const key='ipad-home';if(PH_REF_IMAGES.has(key))return PH_REF_IMAGES.get(key);
  const cv=document.createElement('canvas');cv.width=320;cv.height=400;const g=cv.getContext('2d');
  g.fillStyle='#f3f5f1';g.fillRect(0,0,320,400);g.fillStyle='#e1e5e2';g.fillRect(16,18,288,16);
  for(let j=0;j<6;j++){const im=samplePreview(j),x=18+(j%2)*151,y=48+Math.floor(j/2)*112;
   g.fillStyle='#ffffff';g.fillRect(x-2,y-2,137,102);g.imageSmoothingEnabled=false;g.drawImage(im,x+20,y,94,94);}
  const entry={key,image:cv,texture:null,ready:true};PH_REF_IMAGES.set(key,entry);return entry;
 }
 const key=ref.kind==='template'?'template:'+ref.sample:'upload:'+ref.data;
 if(PH_REF_IMAGES.has(key))return PH_REF_IMAGES.get(key);
 const entry={key,image:null,texture:null,ready:false};PH_REF_IMAGES.set(key,entry);
 if(ref.kind==='template'){
  entry.image=samplePreview(ref.sample);entry.ready=true;return entry;
 }
 const img=new Image();img.onload=()=>{entry.ready=true;entry.image=img;if(gl)phCreateReferenceTexture(entry);};
 img.onerror=()=>{entry.ready=false;};img.src=ref.data;return entry;
}
function phCreateReferenceTexture(e){if(!gl||!e.ready||e.texture)return;
 const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
 gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,e.image);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
 e.texture=tex;
}
function phSetupReferenceGL(){if(!gl)return;
 const v='attribute vec3 aPos;attribute vec2 aUV;uniform mat4 uMatrix;varying vec2 vUV;void main(){gl_Position=uMatrix*vec4(aPos,1.);vUV=aUV;}';
 const f='precision mediump float;varying vec2 vUV;uniform sampler2D uTex;void main(){gl_FragColor=texture2D(uTex,vUV);}';
 const prog=gl.createProgram();gl.attachShader(prog,compileShader(gl,gl.VERTEX_SHADER,v));gl.attachShader(prog,compileShader(gl,gl.FRAGMENT_SHADER,f));gl.linkProgram(prog);
 if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw Error('Reference shader: '+gl.getProgramInfoLog(prog));
 phReferenceProgram=prog;phReferenceBuffer=gl.createBuffer();
 phReferenceAttrib={p:gl.getAttribLocation(prog,'aPos'),uv:gl.getAttribLocation(prog,'aUV'),matrix:gl.getUniformLocation(prog,'uMatrix'),tex:gl.getUniformLocation(prog,'uTex')};
}
function phDrawReferenceGL(){if(!PH.active||!gl||!phReferenceProgram)return;
 const entry=phReferenceImage();if(!entry||!entry.ready)return;
 if(!entry.texture)phCreateReferenceTexture(entry);
 const r=phReferencePlane(),x=r.x,z=r.z,y=r.y,w=r.w/2,h=r.h/2;
 // Up-facing triangles, same depth testing and projection as other scene geometry.
 const v=new Float32Array([
 x-w,y,z-h, 0,1, x-w,y,z+h, 0,0, x+w,y,z+h, 1,0,
 x-w,y,z-h, 0,1, x+w,y,z+h, 1,0, x+w,y,z-h, 1,1
 ]);
 gl.disable(gl.CULL_FACE);gl.useProgram(phReferenceProgram);gl.bindBuffer(gl.ARRAY_BUFFER,phReferenceBuffer);gl.bufferData(gl.ARRAY_BUFFER,v,gl.DYNAMIC_DRAW);
 gl.enableVertexAttribArray(phReferenceAttrib.p);gl.vertexAttribPointer(phReferenceAttrib.p,3,gl.FLOAT,false,20,0);
 gl.enableVertexAttribArray(phReferenceAttrib.uv);gl.vertexAttribPointer(phReferenceAttrib.uv,2,gl.FLOAT,false,20,12);
 gl.uniformMatrix4fv(phReferenceAttrib.matrix,false,new Float32Array(drawMatrix));gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,entry.texture);
 gl.uniform1i(phReferenceAttrib.tex,0);gl.drawArrays(gl.TRIANGLES,0,6);gl.enable(gl.CULL_FACE);
}
function phDrawFallbackReference(){
 if(!ctx2d||!PH.active)return;const entry=phReferenceImage();if(!entry?.ready)return;
 const r=phReferencePlane(),xx=r.x,zz=r.z,ww=r.w/2,hh=r.h/2,yy=r.y;
 const a=worldToScreen([xx-ww,yy,zz-hh]),b=worldToScreen([xx+ww,yy,zz-hh]),c=worldToScreen([xx-ww,yy,zz+hh]);
 if(!a||!b||!c)return;
 const img=entry.image,iw=img.width,ih=img.height;
 // Affine mapped into actual 3D projected surface; same camera coordinates as the pegboard.
 ctx2d.save();ctx2d.beginPath();ctx2d.moveTo(a.x,a.y);ctx2d.lineTo(b.x,b.y);
 const d={x:b.x+c.x-a.x,y:b.y+c.y-a.y};ctx2d.lineTo(d.x,d.y);ctx2d.lineTo(c.x,c.y);ctx2d.closePath();ctx2d.clip();
 // worldToScreen returns CSS pixels, while the software canvas is deliberately rendered
 // at `renderScale` CSS pixels per backing pixel. Using devicePixelRatio here made the
 // image larger than the iPad mesh and shifted most of it toward the lower-right corner.
 const scale=renderScale;ctx2d.setTransform((b.x-a.x)/iw*scale,(b.y-a.y)/iw*scale,(c.x-a.x)/ih*scale,(c.y-a.y)/ih*scale,a.x*scale,a.y*scale);
 ctx2d.drawImage(img,0,0);ctx2d.restore();
}
function phScreenPick(px,py){
 if(!PH.active)return null;
 const p=phAtHeight(px,py,1.36);if(!p)return null;
 const t=phTable();
 const candidates=[];
 const register=(type,i,x,y,z,w,h)=>{const s=worldToScreen([x,y,z]);if(!s)return;
  const d=Math.hypot(s.x-px,s.y-py);
  // Every color bin has an explicit AABB collider in local tabletop coordinates.
  if(Math.abs(p.x-x)<w/2+.045&&Math.abs(p.z-z)<h/2+.045)candidates.push({type,i,x,z,d});
 };
 // Bins prioritize direct AABB hit rather than an invisible UI hit area.
 for(let i=0;i<PH.tableColors.length;i++){if(PH.bin?.index===i)continue;const q=phBinPos(i);register('bin',i,q.x,1.35,q.z,.1,.115);}
 const rack=phDrawerBounds();register('drawer',0,rack.cx,1.34,rack.cz,rack.w+.13,rack.h+.13);
 if(PH.drawerOpen)for(let j=0;j<PH_SIZES.length;j++){const q=phBoardChoicePos(j);register('boardChoice',PH_SIZES[j],q.x,1.35,q.z,.20,.18);}
 const ipad=phReferencePlane();register('ipad',0,ipad.x,1.46,ipad.z,ipad.w+.11,ipad.h+.10);
 for(let i=0;i<PH.beads.length;i++){const q=PH.beads[i],sp=worldToScreen([q.x,q.y,q.z]);if(!sp)continue;
  const d=Math.hypot(sp.x-px,sp.y-py);if(d<18)candidates.push({type:'bead',i,x:q.x,z:q.z,d});
 }
 // Paperboard is intentionally lower priority than loose beads.
 if(phOnBoard(p.x,p.z))candidates.push({type:'board',x:p.x,z:p.z,d:140});
 const tr=phTrayBounds();if(phIsIn(p.x,p.z,0,tr))candidates.push({type:'tray',x:p.x,z:p.z,d:120});
 {const tw=phTweezersRest(),tpos=worldToScreen([tw.x,1.35,tw.z]),active=PH.toolEquipped&&PH.tool==='tweezers';
   if(tpos && Math.hypot(tpos.x-px,tpos.y-py)<42)candidates.push({type:'tweezers',d:active?30:5});
   if(Math.abs(p.x-tw.x)<.22 && Math.abs(p.z-tw.z)<.36)candidates.push({type:'tweezers',d:active?30:5});
 }
 {const pr=phPenRest(),active=PH.toolEquipped&&PH.tool==='pen';
   if(Math.abs(p.x-pr.x)<.16 && Math.abs(p.z-pr.z)<.3)candidates.push({type:'pen',d:active?30:5});
 }
 candidates.sort((a,b)=>a.d-b.d);return candidates[0]||{type:'tabletop',x:p.x,z:p.z};
}
// ---- Real "beads in hand" model ----------------------------------------
// You pick up an exact number of beads (chosen amount, capped by what the box
// actually holds); that many leave the tray into your hand; each placement puts
// down exactly one; putting the tool down returns whatever is left to the tray.
function phHeldCount(){return PH.held?PH.held.count:0;}
function phGrabAmount(id){return PH.grabAll?(tray[id]||0):Math.min(PH.grabCount||10,tray[id]||0);}
function phGrabColor(id){
 if(!id)return false;
 if((tray[id]||0)<=0){phNudge();return false;}               // the box really is empty
 if(PH.tool==='pen'){
   // 摇摇笔: just "ink" the pen with this colour — it draws continuously from the tray.
   PH.activeColor=id;PH.held=null;PH.toolEquipped=true;PH.pinchAt=performance.now();
   if(!PH.cursor){const bb=phBoardBounds();PH.cursor={x:bb.cx,z:bb.cz};}
   updateSeatHud();SFX.pick();return true;
 }
 if(PH.held&&PH.held.id!==id){phNudge();return false;}       // one hand, one colour — put the others down first
 const amount=phGrabAmount(id);
 if(amount<=0){phNudge();return false;}
 tray[id]=(tray[id]||0)-amount;
 PH.held={id,count:(PH.held?PH.held.count:0)+amount,fromBoard:false};PH.activeColor=id;PH.pinchAt=performance.now();PH.toolEquipped=true;
 for(let k=0;k<amount;k++){const li=PH.beads.findIndex(b=>b.id===id);if(li<0)break;PH.beads.splice(li,1);}
 if(!PH.cursor){const bb=phBoardBounds();PH.cursor={x:bb.cx,z:bb.cz};}
 persistTray();updateStatic();updateSeatHud();SFX.pick();return true;
}
function phGrabBead(i){const p=PH.beads[i];if(!p)return;phGrabColor(p.id);}
// Real workflow: you first TIP a handful of beads out of the colour box into the sorting
// dish, and only then pinch them up with the tweezers. phScoopToDish does the tipping;
// phPinchFromDish lifts loose beads already in the dish into the pinch.
function phScoopToDish(id){
 if(!id||(tray[id]||0)<=0){phNudge();return false;}
 const b=phTrayBounds(),room=Math.max(0,54-PH.beads.length);
 const amount=Math.min(24,tray[id]||0,room);
 if(amount<1){phNudge();return false;}
 tray[id]-=amount;const compartment=swatches.findIndex(s=>s.id===id)%4;
 for(let j=0;j<amount;j++)PH.beads.push({id,compartment,
   x:b.cx-b.w*.375+compartment*b.w*.25+(Math.random()-.5)*.14,z:b.cz+(Math.random()-.5)*.22,
   y:1.74+j*.016,vx:(Math.random()-.5)*.5,vy:0,vz:(Math.random()-.5)*.4,rest:false});
 PH.bin=null;persistTray();updateStatic();updateSeatHud();SFX.pour();return true;
}
function phPinchFromDish(i){
 const p=PH.beads[i];if(!p)return false;const id=p.id;
 if(PH.held&&PH.held.id!==id){phNudge();return false;}        // one colour per pinch
 const want=PH.grabAll?PH.beads.length:(PH.grabCount||10);
 let taken=0;for(let k=PH.beads.length-1;k>=0&&taken<want;k--){if(PH.beads[k].id===id){PH.beads.splice(k,1);taken++;}}
 if(taken<1){phNudge();return false;}
 PH.held={id,count:(PH.held?PH.held.count:0)+taken,fromBoard:false};PH.activeColor=id;PH.pinchAt=performance.now();PH.tool='tweezers';PH.toolEquipped=true;
 if(!PH.cursor){const bb=phBoardBounds();PH.cursor={x:bb.cx,z:bb.cz};}
 updateStatic();updateSeatHud();SFX.pick();return true;
}
function phTakeBoardBead(index){const id=board().cells[index];if(!id)return;
 if(PH.held&&PH.held.id!==id){phNudge();return;}
 board().cells[index]=null;PH.held={id,count:(PH.held?PH.held.count:0)+1,fromBoard:PH.held?PH.held.fromBoard:true};PH.cursor=phPosForIndex(index);PH.pinchAt=performance.now();PH.activeColor=id;storeBoard();updateStatic();updateSeatHud();SFX.pick();}
// Tapping a peg that already has a bead lifts that bead off: tweezers lift it into
// the pinch; otherwise it goes back into its box (tray stock).
function phPickupAt(i){const id=board().cells[i];if(!id)return false;
 if(PH.tool==='tweezers'&&(!PH.held||PH.held.id===id)){PH.toolEquipped=true;phTakeBoardBead(i);}
 else{board().cells[i]=null;tray[id]=(tray[id]||0)+1;persistTray();storeBoard();updateStatic();updateSeatHud();SFX.pick();}
 return true;}
function phReturnBead(){if(!PH.held)return;
 const id=PH.held.id,n=PH.held.count,b=phTrayBounds();
 tray[id]=(tray[id]||0)+n;persistTray();
 const want=Math.min(n,Math.max(0,14-PH.beads.filter(p=>p.id===id).length));
 for(let k=0;k<want;k++){const compartment=swatches.findIndex(s=>s.id===id)%4;PH.beads.push({id,compartment,x:b.cx-b.w*.375+compartment*b.w*.25+(Math.random()-.5)*.10,z:b.cz+(Math.random()-.5)*.25,y:1.7,vx:0,vy:0,vz:0,rest:false});}
 PH.held=null;PH.cursor=null;updateStatic();updateSeatHud();
}
// Zoom the seated camera. dir<0 moves closer (down to 1.0), dir>0 pulls back.
function phZoom(dir){if(!PH.active)return;PH.viewAuto=false;const step=dir*Math.max(.16,PH.cameraDistance*.12);PH.cameraDistance=Math.max(1.0,Math.min(11,PH.cameraDistance+step));}
// One zoom command shared by mobile buttons, pinch gestures and the mouse wheel.
// amount>0 zooms in; amount<0 zooms out in every camera mode.
function adjustViewZoom(amount){
 if(PH.active){phZoom(amount>0?-1:1);return;}
 if(firstPerson&&!PH.wall){camera.fovTarget=Math.max(.52,Math.min(1.35,camera.fovTarget-amount*.11));return;}
 const min=PH.wall?5.2:16,max=PH.wall?18:53;camera.dTarget=Math.max(min,Math.min(max,camera.dTarget-amount*(PH.wall?1.15:1.8)));
}
// Always-available way to set a tool/beads back down, so you can never get stuck holding one.
function phPutDownTool(){if(PH.held)phReturnBead();PH.toolEquipped=false;PH.penEquipped=false;PH.cursor=null;updateStatic();updateSeatHud();SFX.ui();}
// Diegetic clear: press-and-hold the board with an EMPTY hand to tip it and pour every bead
// off into the sorting dish. No text button — you physically grab the board and dump it.
function phDumpBoard(){
 if(!PH.active)return;const cells=board().cells,filled=cells.filter(Boolean),n=filled.length;
 if(n===0){phNudge();return;}
 const b=phTrayBounds(),room=Math.max(0,54-PH.beads.length),spill=Math.min(room,n,40);
 for(let j=0;j<spill;j++){const id=filled[(j*7)%filled.length],compartment=swatches.findIndex(s=>s.id===id)%4;
   PH.beads.push({id,compartment,x:b.cx-b.w*.375+compartment*b.w*.25+(Math.random()-.5)*.16,z:b.cz+(Math.random()-.5)*.24,y:1.92+j*.01,vx:(Math.random()-.5)*.75,vy:0,vz:(Math.random()-.5)*.6,rest:false});}
 board().cells=cells.map(()=>null);PH.seatIndex=null;PH.lastPlacedIdx=-1;
 storeBoard();updateStatic();updateSeatHud();SFX.pour();toast(`哗啦——把 ${n} 颗豆都倒进分装盒了，板子清空。`);}
let seatHudSig='';
function updateSeatHud(){
 const hud=$('seatHud');if(!hud)return;
 if(!PH.active){if(!hud.classList.contains('hidden'))hud.classList.add('hidden');seatHudSig='';return;}
 const isPen=PH.toolEquipped&&PH.tool==='pen';
 const inkId=isPen?PH.activeColor:(PH.held?PH.held.id:null);
 const cnt=isPen?(inkId?(tray[inkId]||0):0):(PH.held?PH.held.count:0);
 const gsel=PH.grabAll?'all':String(PH.grabCount);
 const deskDrink=tableDrinks[activeTable],drinkSig=heldDrink?`hand:${heldDrink}:${coffeeSips}`:deskDrink?`desk:${deskDrink.id}:${deskDrink.sips}`:'',hasWork=board().cells.some(Boolean);
 const sig=(PH.toolEquipped?PH.tool:'')+'|'+inkId+'|'+cnt+'|'+gsel+'|'+(PH.beads.length>0)+'|'+drinkSig+'|'+hasWork;
 if(sig===seatHudSig)return;seatHudSig=sig;hud.classList.remove('hidden');
 document.querySelectorAll('#seatHud [data-grab]').forEach(b=>{b.classList.toggle('on',b.dataset.grab===gsel);b.style.opacity=isPen?'.4':'';});
 $('seatToolIco').textContent=PH.toolEquipped?(PH.tool==='pen'?'✎':'⌁'):'✋';
 $('seatToolName').textContent=PH.toolEquipped?(PH.tool==='pen'?'摇摇笔':'镊子'):'空手';
 const nm=id=>{const s=swatches.find(x=>x.id===id),ft=FINISH_META[finishOf(id)]?.tag;return `${id} ${s?s.name:''}${ft?'（'+ft+'）':''}`;};
 if(isPen){$('seatHeldLine').innerHTML=inkId?`上色 ${nm(inkId)} · 托盘 <b>${cnt}</b> 颗 — 点/拖连续摆`:'点色盒给摇摇笔上色';}
 else if(PH.held){$('seatHeldLine').innerHTML=`手里 <b>${cnt}</b> 颗 · ${nm(inkId)}`;}
 else $('seatHeldLine').textContent=PH.beads.length>0?'点分装盒里的豆夹起来':'点色盒把豆倒进分装盒';
 $('seatPutDown').disabled=!PH.toolEquipped;
 $('seatReturn').disabled=!PH.held;
 const drinkAction=$('seatDrinkAction');if(drinkAction){drinkAction.classList.toggle('hidden',!heldDrink&&!deskDrink);drinkAction.disabled=!!heldDrink&&!!deskDrink;
  drinkAction.textContent=heldDrink?'饮料放桌上':deskDrink?'拿起桌上饮料':'饮料';}
 const boardAction=$('seatBoardAction');if(boardAction){boardAction.classList.toggle('hidden',!hasWork);boardAction.textContent=heldDrink?'先把饮料放桌上':'拿起拼好的底板';}
}
// Tactile seat: a freshly-placed bead is skipped in the static bake and drawn in
// the per-frame dynamic buffer so it visibly descends onto the peg, squashes and
// settles with a click — then re-baked into the static mesh once it comes to rest.
const PH_SEAT_MS=230;
function phSeatBead(i){PH.seatIndex=i;PH.seatAt=performance.now();}
function phSeatT(){if(PH.seatIndex==null||!PH.seatAt)return 1;return Math.min(1,(performance.now()-PH.seatAt)/PH_SEAT_MS);}
function phSeatDraw(m){
 if(PH.seatIndex==null)return;const t=phSeatT();if(t>=1)return;
 const n=board().size,id=board().cells[PH.seatIndex];if(!id)return;
 const b=phBoardBounds(),cstep=b.w/n,br=Math.max(.011,cstep*.54),bh=Math.min(.06,Math.max(.02,br*1.5)),q=phPosForIndex(PH.seatIndex);
 const e=1-Math.pow(1-t,3);                               // ease-out descent
 const yUp=(1-e)*0.085;                                   // drop onto the peg
 const dip=Math.sin(Math.min(1,t)*Math.PI)*0.010*(1-t);   // tiny settle
 const sq=1+Math.sin(t*Math.PI)*0.18;                     // squash then relax
 m.peg(q.x,1.322+bh*.5+yUp-dip,q.z,br*sq,bh/Math.max(.55,sq),glHex(id));
}
// Put one bead onto an empty peg. Tweezers spend from the pinch in your hand; the
// bead pen draws straight from the tray stock of its inked colour (continuous).
function phPlaceHeldAt(i){
 if(i<0||i>=board().cells.length||board().cells[i])return false;
 if(PH.tool==='pen'){
   const id=PH.activeColor;if(!id||(tray[id]||0)<=0)return false;
   board().cells[i]=id;tray[id]--;const li=PH.beads.findIndex(b=>b.id===id);if(li>=0)PH.beads.splice(li,1);
   persistTray();
 }else{
   if(!PH.held||PH.held.count<=0)return false;
   board().cells[i]=PH.held.id;PH.held.count--;if(PH.held.count<=0)PH.held=null;
 }
 PH.lastPlacedIdx=i;PH.cursor=phPosForIndex(i);
 storeBoard();updateStatic();updateSeatHud();SFX.place();return true;
}
function phDropBead(x,z){
 if(!PH.toolEquipped)return false;
 if(phOnBoard(x,z)){const i=phBoardIndex(x,z);if(i>=0)return phPlaceHeldAt(i);}
 return false;
}
// Dragging a tool across the pegboard lays a line of beads from your hand.
function phStrokePlace(px,pz){
 if(!phOnBoard(px,pz))return false;const i=phBoardIndex(px,pz);
 if(i<0||i===PH.lastPlacedIdx)return false;
 if(board().cells[i]){PH.lastPlacedIdx=i;return false;}
 let ok=false;
 if(PH.penEquipped)ok=phDispenseBead(px,pz);
 else if(PH.toolEquipped)ok=phPlaceHeldAt(i);
 if(ok)PH.lastPlacedIdx=i;
 return ok;
}
function phBeginPointer(e,px,py){
 const hit=phScreenPick(px,py);PH.lastHit=hit;
 PH.pointer={id:e.pointerId,px,py,started:performance.now(),moved:false,hit,wasHolding:!!PH.held,wasBin:!!PH.bin};
 PH.lastPlacedIdx=-1;
 if(PH.bin)return;
 if(PH.held){PH.cursor=phAtHeight(px,py,1.43)||PH.cursor;return;}
 if(hit?.type==='bin'){
   PH.toolEquipped=false;PH.penEquipped=false;
   const p=phBinPos(hit.i);PH.bin={index:hit.i,x:p.x,z:p.z,startX:p.x,startZ:p.z};
   updateStatic();return;
 }
 if(hit?.type==='bead'){if(PH.tool==='pen')phNudge();else phPinchFromDish(hit.i);}
 else if(hit?.type==='board'){
   const index=phBoardIndex(hit.x,hit.z);if(PH.toolEquipped&&index>=0)phTakeBoardBead(index);
 }
 // Empty-handed press on the board = grab it; holding for a moment tips it and pours the beads
 // off into the dish (set after any pickup above, so it only arms when nothing was picked up).
 if((hit?.type==='board'||hit?.type==='tabletop')&&!PH.held&&!PH.bin&&!PH.penEquipped&&phOnBoard(hit.x,hit.z))PH.pointer.holdBoard=performance.now();
}
function phMovePointer(e,px,py){
 if(!PH.pointer)return;
 const p=phAtHeight(px,py,1.43);if(!p)return;
 if(Math.hypot(px-PH.pointer.px,py-PH.pointer.py)>13)PH.pointer.moved=true;
 if(PH.pointer.hit?.type==='tabletop'&&PH.pointer.moved&&!PH.bin&&!PH.held){
   PH.orbitX=Math.max(-1.0,Math.min(1.0,PH.orbitX-(px-PH.pointer.px)*.005));
   PH.orbitZ=Math.max(-.85,Math.min(.85,PH.orbitZ-(py-PH.pointer.py)*.003));PH.viewAuto=false;
   PH.pointer.px=px;PH.pointer.py=py;return;
 }
 if(PH.bin){
   const t=phTable(),x=Math.max(t.x-1.25,Math.min(t.x+1.3,p.x)),z=Math.max(t.z-.97,Math.min(t.z+1,p.z));
   // Held above the pegboard: the box collides with the table boundaries,
   // not with pegs below its lifting height. On release it must land in the tray.
   PH.bin.x=x;PH.bin.z=z;
 }else if(PH.toolEquipped||PH.penEquipped){PH.cursor=p;if(PH.pointer.moved)phStrokePlace(p.x,p.z);}
}
function phEndPointer(px,py){
 if(!PH.pointer)return;const hit=PH.pointer.hit;
 const moved=PH.pointer.moved,dumped=PH.pointer.dumped;PH.pointer=null;
 if(dumped)return;   // the board was tipped empty on this hold — don't also run a tap action
 const p=phAtHeight(px,py,1.36);
 if(PH.bin){
   const bin=PH.bin,b=phTrayBounds();
   if(p&&phIsIn(p.x,p.z,.13,b)&& (moved?phIsIn(bin.x,bin.z,.25,b):true)){
     phScoopToDish(phBinColor(bin.index).id);return;    // drag a box over the dish to tip beads in
   }
   if(!moved){
     const id=phBinColor(bin.index).id;PH.bin=null;
     // 摇摇笔 inks straight from the box; tweezers tip a handful into the sorting dish
     // first (then you pinch from the dish) — matching real bead-craft.
     if(PH.tool==='pen'){PH.toolEquipped=true;phGrabColor(id);}
     else phScoopToDish(id);
     updateStatic();updateSeatHud();return;
   }
   PH.bin=null;updateStatic();return;
 }
 // Tapping a peg that already holds a bead lifts it off (pick it up), never stacks another.
 if(!moved&&p&&phOnBoard(p.x,p.z)){const i=phBoardIndex(p.x,p.z);if(i>=0&&board().cells[i]){phPickupAt(i);return;}}
 if(PH.held){   // tweezers holding a pinch
   if(!moved&&p&&(hit?.type==='board'||phOnBoard(p.x,p.z))){phDropBead(p.x,p.z);updateSeatHud();return;}
   if(!moved&&(hit?.type==='tray'||hit?.type==='tabletop')){phReturnBead();updateStatic();updateSeatHud();return;}
   if(moved){updateSeatHud();return;}   // a drag already streamed beads along the path
   // otherwise (tapped a tool or box) fall through to the handlers below
 }
 if(hit?.type==='tweezers'||hit?.type==='pen'){
   const which=hit.type;
   if(PH.toolEquipped&&PH.tool===which){phPutDownTool();return;}   // tapping the held tool puts it back
   if(PH.held)phReturnBead();                                      // switching tools returns any pinch in hand
   PH.tool=which;PH.toolEquipped=true;PH.cursor=phAtHeight(px,py,1.43)||(which==='pen'?phPenRest():phTweezersRest());
   updateStatic();updateSeatHud();SFX.ui();return;
 }
 if(hit?.type==='drawer'){PH.drawerOpen=!PH.drawerOpen;updateStatic();return;}
 if(hit?.type==='boardChoice'){PH.boardOut=true;PH.drawerOpen=false;PH.boardAnimating=.68;phResize(hit.i);updateStatic();return;}
 if(hit?.type==='ipad'){setTimeout(()=>{if(PH.active)phOpenAlbum();},55);return;}
 // 摇摇笔: tap an empty peg to lay one bead straight from the inked colour's tray stock.
 if(PH.toolEquipped&&PH.tool==='pen'&&!moved&&p&&phOnBoard(p.x,p.z)){phDropBead(p.x,p.z);return;}   // empty peg → lay one (occupied was already handled above)
}
function phTapIfHolding(px,py){const p=phAtHeight(px,py,1.43);if(!p)return;
 if(PH.bin){if(phIsIn(p.x,p.z,.13,phLoaderBounds()))phFillLoader(swatches[PH.bin.index].id);else if(phIsIn(p.x,p.z,.12,phTrayBounds()))phPour(swatches[PH.bin.index].id,PH.bin.x,PH.bin.z);else{PH.bin=null;updateStatic();}return;}
 if(PH.held){if(phOnBoard(p.x,p.z))phDropBead(p.x,p.z);else phReturnBead();}
}
function phResize(n){if(!PH_SIZES.includes(n))return;const old=board();if(n===old.size)return;
 const next=Array(n*n).fill(null),o=Math.floor((n-old.size)/2);
 for(let y=0;y<old.size;y++)for(let x=0;x<old.size;x++){
 const nx=x+o,ny=y+o,id=old.cells[y*old.size+x];if(nx>=0&&nx<n&&ny>=0&&ny<n)next[ny*n+nx]=id;
 else if(id)tray[id]=(tray[id]||0)+1;
 }
 tableBoards[activeTable]={size:n,cells:next};if(PH.viewAuto)PH.cameraDistance=phDefaultCameraDistance();persistTray();storeBoard();updateStatic();
}
function phOpenAlbum(){if(!PH.active)return;
 PH.picker=true;$('physicalAlbum').classList.remove('hidden');
 const root=$('physicalAlbumGrid');if(root.childElementCount===0){
  for(let i=0;i<6;i++){
   const b=document.createElement('button');b.type='button';b.className='ph-album-card';b.setAttribute('aria-label','参考图 '+(i+1));
   const c=document.createElement('canvas');c.width=c.height=80;const ctx=c.getContext('2d');const s=getSample(i,32),k=80/32;
   ctx.fillStyle='#fff8ed';ctx.fillRect(0,0,80,80);for(let p=0;p<s.length;p++)if(s[p]){ctx.fillStyle=colorLookup[s[p]];ctx.fillRect((p%32)*k,Math.floor(p/32)*k,k,k);}
   b.appendChild(c);b.onclick=()=>{referenceByTable[activeTable]={kind:'template',sample:i,name:patterns[i].name};PH.looking=true;delete referenceCanvases[activeTable];persistReference(activeTable);phCloseAlbum();updateStatic();};root.appendChild(b);
  }
 }
}
function phCloseAlbum(){PH.picker=false;$('physicalAlbum')?.classList.add('hidden');}
function phWireAlbum(){
 $('physicalAlbumClose').onclick=phCloseAlbum;
 $('physicalAlbumBlank').onclick=()=>{delete referenceByTable[activeTable];delete referenceCanvases[activeTable];persistReference(activeTable);phCloseAlbum();updateStatic();};
 $('physicalAlbumUpload').onchange=async e=>{if(!e.target.files[0])return;const f=e.target.files[0];phCloseAlbum();await uploadReference(f);e.target.value='';};
 $('physicalStand').onclick=phStand;
}
function carryBoardForIron(){
 if(carriedBoard){toast('已经端着一块底板了，请直接前往熨烫间。');return;}
 if(carriedProduct){toast('手里已经拿着烫好的成品，请先挂到展示墙。');return;}
 const n=board().cells.reduce((sum,x)=>sum+(x?1:0),0);if(n<=0){phNudge();toast('底板上还没有拼豆，先完成作品再拿起来。');return;}
 if(heldDrink){toast('拿底板需要双手，请先把饮料放在桌上或喝完。');return;}
 const tableId=activeTable;carriedBoard=tableId;PH.boardOut=false;
 if(PH.active)phStand();else{if(activeModal)closeModal();updateStatic();}
 resetBoardCarryMotion();updateCarryBoardStatus();markCloudProgress();SFX.pick();toast(`已端起 ${tableId} 号桌底板。移动不会自动减速，急转或反复晃动会掉豆。`);
}
function phAutoIron(){
 if(carriedProduct){toast('这件成品已经烫好了，请拿到展示墙亲自挂上。');return;}
 if(!carriedBoard){phNudge();toast('不能空手熨烫：请先回拼豆桌拿起拼好的底板。');return;}
 activeTable=carriedBoard;const n=board().cells.reduce((sum,x)=>sum+(x?1:0),0);if(n<=0){phNudge();toast('手里的底板没有拼豆，无法熨烫。');return;}
 openIron();
}

function leaf(mesh,x,y,z,scale){mesh.box(x,y,z,.09*scale,.95*scale,.08*scale,'#688a72');for(let k=0;k<5;k++){const a=k*2.399,h=y+.3*scale+(k%3)*.22*scale;mesh.sphere(x+Math.cos(a)*.25*scale,h,z+Math.sin(a)*.26*scale,.26*scale,k%2?'#96ad87':'#779b76',5,7);}}
function pottedPlant(mesh,x,z,size=1){mesh.box(x,.23*size,z,.42*size,.44*size,.42*size,'#bd8663');mesh.box(x,.46*size,z,.46*size,.08*size,.46*size,'#d8ad8a');leaf(mesh,x,.6*size,z,size);}
function galleryArtworks(){
 const samples=['樱桃心愿','森林小熊','午后向日葵','草莓奶昔','星星好心情'];
 return samples.map((name,i)=>({name,size:32,cells:getSample(i)}));
}
function galleryWishItems(){return gallery.map(item=>({...item,cells:unpackCells(item.pixels,item.size)||[]}));}
function galleryWishShape(item){
 if(item.mount==='frame')return{w:1.68,h:1.68,back:'#947052',mat:'#fff7e9'};
 if(item.mount==='stand')return{w:1.22,h:1.22,back:'#d7b994',mat:'#f8ead5'};
 if(item.mount==='keychain')return{w:.92,h:.92,back:'#e8c99f',mat:'#fff0d8'};
 if(item.mount==='badge')return{w:1.04,h:1.04,back:'#d4ad8c',mat:'#f7e1c8'};
 return{w:1.08,h:1.08,back:'#c4d1ca',mat:'#edf2ec'};
}
function sampledColor(work,x,y,outSize){
 const n=work.size,cells=work.cells,a=Math.floor(x*n/outSize),b=Math.min(n,Math.max(a+1,Math.ceil((x+1)*n/outSize))),c=Math.floor(y*n/outSize),d=Math.min(n,Math.max(c+1,Math.ceil((y+1)*n/outSize)));
 const mid=cells[Math.min(n-1,Math.floor((c+d)/2))*n+Math.min(n-1,Math.floor((a+b)/2))];if(mid)return mid;
 for(let py=c;py<d;py++)for(let px=a;px<b;px++)if(cells[py*n+px])return cells[py*n+px];
 return null;
}
// A real craft-shop style "mixed finish" display: shadow boxes, a textured
// towel-iron sample, a cork keychain board, magnetic samples and shelf standees.
// Finished beadwork is visibly rendered in-world from the player's actual grid.
function wallPixelPiece(m,work,x,y,z,w,h,style='standard',side=18){
 const step=Math.min(w/side,h/side),n=side;
 for(let py=0;py<n;py++)for(let px=0;px<n;px++){
  const id=sampledColor(work,px,py,n);if(!id)continue;
  const xx=x+(px-(n-1)/2)*step,yy=y+((n-1)/2-py)*step;
  const flat=style==='flat',towel=style==='towel',glitter=style==='glitter',crystal=style==='crystal';
  const relief=towel?(.045+((px*7+py*11)%4)*.012):.032;
  m.box(xx,yy,z+relief/2,step*(flat?1.005:.90),step*(flat?1.005:.90),relief,crystal?mixHex(colorLookup[id],'#eaffff',.24):colorLookup[id]);
  if(towel&&((px*7+py)%3===0))m.box(xx-step*.09,yy+step*.13,z+relief+.009,step*.36,step*.23,.012,'#fff0d9');
  if(glitter&&((px*13+py*5)%11===0))m.box(xx+step*.12,yy+step*.13,z+relief+.015,step*.17,step*.16,.012,'#fff9e9');
  if(crystal&&((px*5+py*3)%7===0))m.box(xx-step*.12,yy+step*.14,z+relief+.014,step*.30,step*.10,.011,'#f5ffff');
  if(style==='standard'&&step>.12)m.box(xx,yy,z+relief+.004,step*.18,step*.18,.007,'#dec8a9');
 }
}
function wallWorldPoint(surface,u,y,out=0){return surface.axis==='z'?[u,y,surface.plane+surface.normal*out]:[surface.plane+surface.normal*out,y,u];}
function wallMeshBox(m,surface,u,y,out,w,h,depth,color){if(surface.axis==='z')m.box(u,y,surface.plane+surface.normal*(out+depth/2),w,h,depth,color);else m.box(surface.plane+surface.normal*(out+depth/2),y,u,depth,h,w,color);}
function wallPixelPieceOnSurface(m,work,surface,u,y,out,w,h,style='standard',side=18){
 const step=Math.min(w/side,h/side),n=side;
 for(let py=0;py<n;py++)for(let px=0;px<n;px++){
  const id=sampledColor(work,px,py,n);if(!id)continue;
  const uu=u+(px-(n-1)/2)*step,yy=y+((n-1)/2-py)*step,flat=style==='flat',towel=style==='towel',glitter=style==='glitter',crystal=style==='crystal',relief=towel?(.045+((px*7+py*11)%4)*.012):.032;
  wallMeshBox(m,surface,uu,yy,out,step*(flat?1.005:.90),step*(flat?1.005:.90),relief,crystal?mixHex(colorLookup[id],'#eaffff',.24):colorLookup[id]);
  if(towel&&((px*7+py)%3===0))wallMeshBox(m,surface,uu-step*.09,yy+step*.13,out+relief,step*.36,step*.23,.012,'#fff0d9');
  if(glitter&&((px*13+py*5)%11===0))wallMeshBox(m,surface,uu+step*.12,yy+step*.13,out+relief,step*.17,step*.16,.012,'#fff9e9');
  if(crystal&&((px*5+py*3)%7===0))wallMeshBox(m,surface,uu-step*.12,yy+step*.14,out+relief,step*.30,step*.10,.011,'#f5ffff');
  if(style==='standard'&&step>.12)wallMeshBox(m,surface,uu,yy,out+relief,step*.18,step*.18,.007,'#dec8a9');
 }
}
function displayGalleryItems(m){galleryWishItems().forEach((item,index)=>{
 const surface=wallSurface(item.wallId),shape=galleryWishShape(item),u=item.wallU,y=item.wallY,out=surface.displayOffset+Math.min(index,1000)*.001,style=item.technique==='normal'?(item.level==='flat'?'flat':'standard'):item.technique;
 wallMeshBox(m,surface,u,y,out,shape.w,shape.h,.105,shape.back);wallMeshBox(m,surface,u,y,out+.068,shape.w-.16,shape.h-.16,.035,shape.mat);
 if(item.mount==='keychain'){const p=wallWorldPoint(surface,u,y+shape.h/2+.16,out+.14);m.sphere(p[0],p[1],p[2],.13,'#d9d5c7',7,10);wallMeshBox(m,surface,u,y+shape.h/2+.04,out+.12,.025,.22,.025,'#8d7a67');}
 if(item.mount==='stand')wallMeshBox(m,surface,u,y-shape.h/2-.10,out+.08,shape.w+.16,.16,.30,'#a97e5c');
 wallPixelPieceOnSurface(m,item,surface,u,y,out+.11,shape.w-.22,shape.h-.22,style,12);
 });}
function displayWall(m){
 const arts=galleryArtworks();
 // Warm floral linen wallpaper and varied walnut plinths instead of five identical frames.
 m.box(0,3.35,-19.50,34.2,6.46,.07,'#f4eade');
 m.box(0,1.05,-19.39,34.2,2.05,.12,'#e1cbb2');
 for(let x=-16;x<17;x+=1.07){m.box(x,1.03,-19.30,.032,1.94,.024,'#f1dfc8');}
 m.box(0,2.08,-19.31,34.1,.085,.14,'#b59072');
 // Wall panels add softness and visually anchor each product group.
 m.box(-9.0,4.02,-19.34,15.0,4.72,.14,'#e8d8c5');
 m.box(2.2,3.68,-19.31,6.12,5.3,.11,'#e2bda0');
 m.box(8.2,3.58,-19.32,5.05,5.2,.12,'#c6d0c7');
 m.box(13.3,3.37,-19.32,5.06,5.2,.12,'#dfc4aa');
 // Two professional frame/mat styles and a textured "towel iron" wall hanging.
 const frameConfigs=[
  {x:-13.1,y:4.02,w:4.44,h:4.42,work:arts[0],finish:arts[0].technique==='normal'?(arts[0].level==='flat'?'flat':'standard'):arts[0].technique,outer:'#906e55',mount:'#fff9ef'},
  {x:-8.25,y:3.67,w:3.95,h:4.13,work:arts[1],finish:arts[1].technique||'glitter',outer:'#bda583',mount:'#f9f0e2'},
  {x:-3.62,y:4.0,w:4.14,h:4.30,work:arts[2],finish:arts[2].technique||'towel',outer:'#a87867',mount:'#e7d0ba'}
 ];
 frameConfigs.forEach((f,i)=>{
  const z=-19.18;
  m.box(f.x,f.y,z,f.w,f.h,.24,f.outer);m.box(f.x,f.y,z+.15,f.w-.25,f.h-.26,.065,f.mount);
  m.box(f.x,f.y,z+.19,f.w-.51,f.h-.52,.026,i===2?'#faead5':'#fff8ed');
  if(i===2){ // a textile-mounted towel-finish swatch
   m.box(f.x,f.y,z+.22,f.w-.73,f.h-.77,.017,'#d4bea4');
   for(let j=0;j<3;j++)m.box(f.x-(f.w-.85)/2+j*.13,f.y+(f.h-.75)/2,z+.24,.07,.09,.033,'#f2ddba');
  }
  wallPixelPiece(m,f.work,f.x,f.y,z+.26,f.w-.76,f.h-.78,f.finish,21);
  // Lamps are real meshes that make artworks visible at a distance.
  m.box(f.x,f.y+f.h/2+.36,-18.93,.73,.11,.36,'#9d836d');
  m.box(f.x,f.y+f.h/2+.25,-18.66,.90,.085,.25,'#f7eacb');
 });
 // Corkboard — dense, playful display of hanging keychains rather than a classroom grid.
 m.box(2.2,3.56,-19.12,5.72,4.74,.25,'#a88062');
 m.box(2.2,3.56,-18.97,5.37,4.38,.14,'#cda985');
 for(let row=0;row<3;row++)for(let col=0;col<4;col++){
  const x=.28+col*1.26+(row%2)*.10,y=5.11-row*1.30+((col+row)%2)*.08;
  m.sphere(x,y+.39,-18.73,.077,'#dccbb9',6,8);
  m.box(x,y+.23,-18.73,.019,.34,.020,'#8a7868');
  // Keyring loop and miniature finished bead charm.
  m.sphere(x,y+.04,-18.70,.092,'#deded0',6,10);
  const art=arts[(col+row+2)%arts.length];
  wallPixelPiece(m,art,x,y-.39,-18.68,.91,.91,row===1?'towel':'standard',11);
 }
 // Magnetic wall — each piece is a cutout with a visible coloured backing.
 m.box(8.18,3.61,-19.06,4.70,4.57,.22,'#9baaa8');
 m.box(8.18,3.61,-18.92,4.45,4.30,.052,'#dbe4e1');
 for(let row=0;row<2;row++)for(let col=0;col<3;col++){
  const x=6.89+col*1.29,y=4.52-row*1.77+(col%2)*.14;
  m.box(x,y,-18.83,1.13,1.24,.095,row===0?'#f8ead5':'#eee7df');
  wallPixelPiece(m,arts[(row*3+col)%arts.length],x,y,-18.76,.98,1.04,row===0?'standard':'flat',13);
  m.sphere(x,y+.66,-18.69,.07,'#9aaca4',6,8);
 }
 // Walnut shelves for 3D standees, table frames and small gift products.
 for(let k=0;k<3;k++){
  const y=2.44+k*1.47;
  m.box(13.25,y,-18.94,4.80,.16,.56,'#936c52');
  m.box(10.96,y-.26,-18.93,.13,.59,.36,'#be987b');m.box(15.54,y-.26,-18.93,.13,.59,.36,'#be987b');
  for(let i=0;i<3;i++){
   const x=11.96+i*1.22;
   m.box(x,y+.16,-18.77,.95,.24,.31,'#d7bda1');
   wallPixelPiece(m,arts[(k+i+1)%arts.length],x,y+.62,-18.72,.91,.87,k===2?'glitter':'standard',12);
   m.box(x,y+.61,-18.76,.99,.99,.025,k===1?'#ecdfce':'#efdfca');
   // Accent corner pin, not a text instruction.
   m.sphere(x,y+1.11,-18.64,.067,k===0?'#a8bda7':'#f1d3a0',6,7);
  }
 }
 // Soft décor resembling an actual craft boutique wall display.
 for(let j=0;j<15;j++){
  const x=-16.3+j*2.28;
  m.box(x,6.37,-19.13,.035,.48,.035,'#819c85');
  m.sphere(x-.10,6.04,-19.11,.13,j%2?'#91ab8a':'#b7cda1',5,6);
 }
}
function stageSign(m,x,z,titleColor='#a77b5c'){
 m.box(x,3.4,z,4.8,.44,.22,titleColor);m.box(x,3.39,z+.15,4.45,.15,.04,'#f8e3c2');
}
function buildStatic(){
 const m=new Mesh();
 // Warm small-business retail studio, with a dense communal working area.
 m.box(0,-.24,1,34.7,.42,41.5,'#c2a886');
 // Wide, flat, low-contrast floor planks: thin high-contrast ridges shimmer into noise at
 // low pixel resolution, so keep the floor simple and clean (Stardew-style crisp pixels).
 for(let i=0;i<20;i++)m.box(-16.3+i*1.72,-.02,1,1.72,.012,41.3,i%2?'#c9b190':'#c3a884');
 if(!PH.active)m.box(0,6.72,1,34.7,.30,41.5,'#f0e8dc');   // ceiling — hidden while seated so it never blocks the board view
 m.box(0,3.36,-19.72,34.6,6.8,.30,'#e9ddca');
 m.box(0,3.36,21.6,34.6,6.8,.30,'#e4d7c1');   // south wall — was an open white void behind the player
 m.box(-17.04,3.3,1,.30,6.75,41.5,'#e7dbc7');
 m.box(17.04,3.3,1,.30,6.75,41.5,'#e2d5bf');
 // ---- Cozy wall decor: wainscoting, framed pastel prints, a flag garland, a plant shelf ----
 for(const [cx,cz,w,d] of [[0,21.52,34.6,.1],[-16.9,1,.1,41.5],[16.9,1,.1,41.5]]){m.box(cx,1.1,cz,w,.85,d,'#dcc7aa');m.box(cx,1.56,cz,w+.02,.06,d+.02,'#c7a983');}
 for(let i=0;i<4;i++){const x=-6.6+i*4.4,fc=['#e7b7bd','#bcd3c2','#e6d2a6','#c7c0e0'][i],ac=['#d98d94','#8fb89e','#d8be7f','#a79cd0'][i];
  m.box(x,3.8,21.42,2.4,2.3,.1,'#f3e7d6');m.box(x,3.8,21.36,2.0,1.9,.06,fc);m.box(x,3.8,21.33,1.45,1.35,.04,ac);}
 for(let i=0;i<14;i++){const z=-14+i*2.1,col=['#e7a7a0','#9fc3a6','#e6c58a','#a9b9e0','#caa7d6'][i%5];m.box(-16.8,5.0,z,.04,.025,2.0,'#b79a7e');m.tri([-16.74,5.0,z-.26],[-16.74,5.0,z+.26],[-16.74,4.55,z],[1,0,0],col);}
 for(let k=0;k<2;k++){const y=2.3+k*1.5;m.box(16.74,y,5.6,.4,.08,4.2,'#c6a883');for(let j=0;j<3;j++){const z=3.9+j*1.4;m.box(16.76,y+.22,z,.32,.32,.32,['#cf9f7e','#9bb59a','#d7b58b'][j]);m.sphere(16.76,y+.52,z,.25,'#86a98d',6,7);}}
 m.box(0,.16,-19.56,34.4,.3,.32,'#c8a079');m.box(0,6.59,-19.56,34.4,.20,.34,'#dac0a4');
 // Artwork is visible directly across the shop, with mixed finish and mounts.
 displayWall(m);
 // Shop windows, storage shelves, cups, decorative gift corner and everyday objects.
 for(const z of [-12.8,-1.5,10.5]){m.box(-16.73,3.68,z,.20,2.8,3.72,'#ba9377');m.box(-16.56,3.68,z,.12,2.56,3.43,'#b7d0cc');m.box(-16.46,3.68,z,.12,2.56,.09,'#fffaec');}
 for(const z of [-15,-1,7]){m.box(-15.7,.72,z,1.35,1.2,3.4,'#a47b5f');m.box(-15.7,1.4,z,1.5,.11,3.5,'#e0c2a0');for(let k=0;k<7;k++)m.box(-15.15,1.54,z-1.45+k*.46,.34,.22,.32,swatches[(k+2+z+20)%24|0].hex);}
 m.box(-11.4,.87,12,6.7,1.58,2.2,'#bb8c68');m.box(-11.4,1.73,12,6.9,.14,2.3,'#ebcfaf');
 // Accessible full-size rear rack and tools checkout (adapts to the colour count).
 const wallDH=WALL_STEPY*.82,wallLO=wallDH*.36;
 m.box(-11.95,2.42,19.77,9.15,5.0,.52,'#af896a');m.box(-11.95,WALL_TOP+wallDH*.7,19.55,9.15,.23,.83,'#88644e');
 for(let j=0;j<swatches.length;j++){const s=wallSlot(j),xx=s.x,yy=s.y;
   m.box(xx,yy,19.31,.95,wallDH,.56,'#f1dfc8');m.box(xx,yy+wallDH*.12,18.96,.82,wallDH*.55,.13,glHex(swatches[j].id));m.box(xx,yy-wallLO,18.93,.82,wallDH*.22,.14,'#f9f2e6');
   phEngraveWall(m,swatches[j].id,xx,yy-wallLO,18.843,.24,wallDH*.12);
 }
 if(drawerOpened&&pickupAt==='wall'){const i=swatches.findIndex(x=>x.id===pickedBin);if(i>=0){const s=wallSlot(i),x=s.x,y=s.y;
  m.box(x,y-wallDH*.14,18.43,.88,wallDH*.72,.83,'#f5e7d6');m.box(x,y+wallDH*.18,18.40,.80,.09,.76,'#fbf5e8');for(let j=0;j<12;j++)m.sphere(x-.3+(j%4)*.19,y+wallDH*.28,18.25+Math.floor(j/4)*.18,.065,glHex(swatches[i].id),5,6);}}
 m.box(-12.3,.66,16.75,7.3,1.10,2.15,'#ae8061');m.box(-12.3,1.28,16.75,7.5,.16,2.32,'#e5c09e');
 for(const [x,z,c] of [[-14.8,16.65,'#f8ebd9'],[-13.9,16.65,'#ddd3c6'],[-12.3,16.6,'#c2c3ad'],[-10.8,16.65,'#e7b67f'],[-9.8,16.65,'#a9bcb7']])m.box(x,1.48,z,.42,.23,.57,c);
 // Handmade rugs and slightly overlapping work corners replace classroom-like parallel rows.
 for(const [x,z,w,d,color] of [[-8.2,-8.26,7.9,6.65,'#c2c8b5'],[-1.1,-4.0,7.6,5.5,'#d1bcaa'],[5.25,-2.55,7.6,5.25,'#c8c9b2'],[3.55,4.65,7.65,3.6,'#e0c7b7']]){
  m.box(x,.017,z,w,.029,d,color);
  m.box(x,.035,z,w-.22,.02,d-.23,'#e5d7c4');
 }
 // Display supplies and inspiration prints among the craft spaces.
 for(const [x,z,w] of [[-11.6,-3.0,2.4],[.7,8.7,3.0],[-3.0,1.3,2.6]]){
  m.box(x,.65,z,w,1.15,.64,'#b89371');m.box(x,1.30,z,w+.10,.11,.72,'#e8cfad');
  for(let j=0;j<5;j++)m.box(x-w*.35+j*w*.175,1.43,z,.2,.13,.26,swatches[(j+8)%24].hex);
 }

 positions.forEach((t,i)=>{
  const stripe=i<6?'#b7875f':'#bd8d63';
  for(const dx of [-1.05,1.05])for(const dz of [-.73,.73])m.box(t.x+dx,.44,t.z+dz,.13,.75,.13,'#906745');
  m.box(t.x,.82,t.z,2.82,.20,2.18,stripe);m.box(t.x,.935,t.z,2.93,.055,2.28,'#e0b990');
  // The actual pegboard leaves the table when the player carries it to the ironing room.
  if(carriedBoard!==t.id){m.box(t.x-.22,1.008,t.z,1.48,.052,1.53,'#e8d8bd');m.box(t.x-.22,1.040,t.z,1.40,.015,1.43,'#fff1dc');}
  // A portable clear-lidded 24-color compartment organizer on EVERY table.
  m.box(t.x+1.02,1.015,t.z-.05,.56,.13,1.45,'#f5ecdd');
  for(let q=0;q<12;q++){const zz=t.z-.66+(q%6)*.235,xx=t.x+.89+Math.floor(q/6)*.23;
    m.box(xx,1.1,zz,.19,.045,.19,swatches[(q+i*2)%24].hex);}
  m.box(t.x+1.04,1.14,t.z+.67,.56,.075,.15,'#fffaf1');
  // Small scoop, cup, and single tool holder.
  m.box(t.x-1.22,1.045,t.z-.70,.23,.09,.29,'#f1e6da');m.sphere(t.x-1.22,1.10,t.z-.70,.10,'#dc968f',5,6);
  m.box(t.x+1.08,1.16,t.z+.75,.11,.16,.10,'#d3ac86');
  // Stools are slightly staggered instead of being in perfect showroom rows.
  const seatZ=t.z+(i%2===0?1.48:-1.47);
  if(i%4===0){ // casual upholstered armchair
   m.box(t.x-.15,.44,seatZ,1.05,.20,.82,'#acac99');m.box(t.x-.15,.85,seatZ+Math.sign(seatZ-t.z)*.40,1.04,.88,.16,'#8f9e8f');
  }else{m.box(t.x-.15,.42,seatZ,.87,.16,.64,i%3===0?'#a8ac99':'#a97650');m.box(t.x-.15,.85,seatZ+Math.sign(seatZ-t.z)*.40,.87,.82,.11,i%3===0?'#8d9d8b':'#a77855');}
  // A customer's drink replaces the decorative sample cup and remains on this table.
  if(tableDrinks[t.id])addDrinkCup(m,t.x-1.03,1.17,t.z+.61,tableDrinks[t.id],.82);
  else if(i%3!==0){m.box(t.x-.90,1.08,t.z+.58,.24,.18,.24,'#f1e8dc');m.box(t.x-.90,1.19,t.z+.58,.25,.035,.25,'#c1d5c1');}
  if(i%4===1){m.box(t.x+.27,1.045,t.z-.83,.4,.02,.28,'#f8f2e7');m.box(t.x+.27,1.062,t.z-.84,.32,.008,.08,'#c5a0a0');}
  // Existing user-created work only; sample patterns are never pre-filled at desks.
  const work=tableBoards[t.id];if(carriedBoard!==t.id&&work.cells.some(Boolean))for(let py=0;py<20;py++)for(let px=0;px<20;px++){const id=sampledColor(work,px,py,20);if(id)m.box(t.x-.22+(px-9.5)*.064,1.079,t.z+(py-9.5)*.067,.060,.025,.060,colorLookup[id]);}
 });
 // Extra occupied corners and less rigid visual rhythm.
 m.box(-12.4,.57,3.1,3.1,1.03,1.2,'#b88762');m.box(-12.4,1.14,3.1,3.3,.12,1.4,'#e4c7a4');
 m.box(12.55,.60,-5.0,3.7,1.08,1.35,'#bb9878');m.box(12.55,1.18,-5.0,3.9,.12,1.5,'#e8d1b2');
 m.box(-2.0,.46,15.7,2.4,.8,1.0,'#c5a48a');m.box(1.4,.47,16.25,2.1,.84,1.0,'#d0b197');
 m.box(0,.034,18.6,5.8,.03,2.1,'#bbcfbe');
 for(const [x,z,size] of [[-15.35,-16,1.05],[15.2,-15.8,1.05],[-14,7,1.1],[13,-.5,1],[7.9,11,1],[2.4,-16,.88],[-8,-15,.9]])pottedPlant(m,x,z,size);
 // Separate ironing ROOM (open top for readability). Doorway is on the western wall.
 m.box(13.1,1.83,9.8,7.7,3.65,.24,'#ead7c1');
 m.box(9.26,1.83,11.5,.26,3.65,3.4,'#e5ceb4');
 m.box(9.26,1.83,17.95,.26,3.65,4.7,'#e5ceb4');
 m.box(9.26,3.22,14.15,.28,.85,2.3,'#b98f70');
 m.box(9.28,.10,14.15,.33,.05,2.35,'#a57e5a');
 m.box(13.08,.025,15.0,7.5,.043,10.0,'#d6c1a8');
 // Dedicated safe ironing table and staff NPC within the room.
 m.box(13.30,.63,17.20,4.75,1.13,2.10,'#a77354');m.box(13.30,1.26,17.2,5.02,.16,2.32,'#ead0af');
 m.box(13.1,1.40,17.13,2.17,.11,1.27,'#f9ebd8');
 m.box(12.65,1.55,17.14,.88,.16,.55,'#abbab6');m.box(12.65,1.74,16.93,.60,.22,.14,'#c2c2b8');
 m.box(15.2,1.49,17.06,.67,.19,.69,'#e7bda6');
 // Ironing-room staff NPC — also a full ~1.8m figure.
 {const sx=12.0,sz=13.8,sskin='#ebcbae',shair='#745143';  // stand in the open floor in front of the ironing table (was embedded in the table)
  m.box(sx,.66,sz,.48,1.32,.40,'#b7c4bd');
  m.sphere(sx-.25,.9,sz-.17,.08,sskin,5,7);m.sphere(sx-.25,.9,sz+.17,.08,sskin,5,7);
  m.sphere(sx,1.36,sz,.19,sskin,6,8);
  m.sphere(sx,1.58,sz,.29,sskin,9,12);m.sphere(sx,1.63,sz-.02,.285,shair,9,11);
  m.sphere(sx-.25,1.55,sz-.1,.032,'#3b2f28',5,6);m.sphere(sx-.25,1.55,sz+.1,.032,'#3b2f28',5,6);
  m.sphere(sx-.22,1.50,sz-.18,.03,'#f2a98d',4,5);m.sphere(sx-.22,1.50,sz+.18,.03,'#f2a98d',4,5);}
 m.box(10.4,1.5,11.3,1.38,2.6,.44,'#ccaf90');m.box(10.2,2.90,11.3,1.4,.18,.59,'#edd7ba');
 if(!PH.active)for(const x of [-6,-1,4,8]){m.box(x,5.5,-3.4,.06,.85,.06,'#b59c83');m.sphere(x,5.05,-3.4,.35,'#ffebc7',5,7);} // overhead lamps hidden while seated

 // Café corner in the quieter east side: compact bar counter, espresso machine, chalk menu,
 // pastry display, drink fridge, barista, sofa & bistro seats. Everything is part of the walkable shop.
 m.box(12.88,.026,-11.30,7.60,.047,11.95,'#bcaa91');
 m.box(12.88,.046,-11.30,7.29,.023,11.58,'#ede1c9');
 // Café timber slat wall, colorful backsplash, floating shelving.
 m.box(16.52,2.82,-11.35,.37,4.85,10.2,'#a68267');
 for(let z=-15.6;z<=-7;z+=.46)m.box(16.28,2.92,z,.06,3.76,.12,'#caa585');
 for(let y of [2.22,3.26])m.box(15.8,y,-11.2,1.10,.11,6.10,'#dfbe99');
 for(let i=0;i<7;i++){let zz=-14.2+i*.88;m.box(15.5,3.48,zz,.27,.31,.30,i%2?'#f4ead8':'#9da991');}
 // L-shaped serving bar and wood-lined counter front.
 m.box(13.55,.76,-10.92,3.08,1.43,6.82,'#9d7257');
 m.box(13.48,1.54,-10.92,3.36,.14,7.20,'#f0ddc3');
 m.box(12.03,.86,-13.26,1.34,1.42,1.42,'#ac8160');
 m.box(12.03,1.61,-13.26,1.40,.12,1.55,'#e9d5bb');
 for(let z=-13.75;z<=-8.4;z+=.55)m.box(12.02,.80,z,.06,.99,.12,'#cda783');
 // Espresso machine, grinder, bottled drinks.
 m.box(13.83,1.91,-12.76,1.17,.66,.94,'#4c5554');m.box(13.84,2.31,-12.76,1.27,.12,.98,'#85918a');
 m.box(13.40,1.73,-12.56,.22,.11,.27,'#c5d3c9');m.box(14.11,1.71,-12.55,.22,.11,.27,'#c5d3c9');
 m.box(14.62,1.93,-10.71,.40,.62,.46,'#6b6055');m.box(14.62,2.30,-10.71,.34,.20,.36,'#d1b38d');
 m.box(15.08,.99,-8.25,1.25,1.84,1.12,'#bdc9c1');m.box(15.06,1.08,-7.64,1.12,1.61,.12,'#a0c0b5');
 for(let j=0;j<6;j++)m.box(14.7+(j%2)*.42,1.42-Math.floor(j/2)*.34,-7.55,.21,.25,.18,swatches[(j+12)%24].hex);
 // Pastries in case, mugs / takeaway drinks on counter.
 for(let j=0;j<5;j++){m.sphere(11.77+(j%3)*.22,1.74,-13.70+Math.floor(j/3)*.28,.13,j%2?'#c78a5f':'#e1b174',5,8);}
 for(let j=0;j<6;j++){const cx=13.19+j*.42;m.box(cx,1.73,-9.42,.18,.22,.18,j%2?'#e8e9d7':'#f9e4cb');m.box(cx,1.87,-9.42,.20,.04,.20,'#f9f5eb');}
 // Barista NPC "小暖" — a full ~1.8m figure so she stands clearly above the counter and is easy to spot.
 {const bx=11.4,bz=-8.3,bskin='#f6d6b4',bhair='#4a352c';  // greet from the open front corner of the counter — full body visible & tappable
  m.box(bx,.66,bz,.52,1.32,.42,'#d98f86');                                   // torso+legs 0→1.32 (rose shirt, pops against the wood)
  m.box(bx-.08,.52,bz,.54,.92,.44,'#f3e7d6');                                // cream apron over the front (faces the room, -x)
  m.sphere(bx-.26,.9,bz-.19,.085,bskin,5,7);m.sphere(bx-.26,.9,bz+.19,.085,bskin,5,7);  // hands
  m.sphere(bx,1.36,bz,.19,bskin,6,8);                                        // neck/shoulders (connects torso to head — no floating gap)
  m.sphere(bx,1.58,bz,.29,bskin,9,13);m.sphere(bx,1.63,bz-.02,.285,bhair,9,12);          // head (top ≈1.87) + hair
  m.sphere(bx-.26,1.55,bz-.10,.032,'#3b2f28',5,6);m.sphere(bx-.26,1.55,bz+.10,.032,'#3b2f28',5,6); // eyes (facing the room)
  m.sphere(bx-.23,1.50,bz-.19,.03,'#f2a98d',4,5);m.sphere(bx-.23,1.50,bz+.19,.03,'#f2a98d',4,5);}  // rosy cheeks
 // Warm café pendant lights with slender cords.
 if(!PH.active)for(const [x,z] of [[12.5,-13.9],[12.5,-11.15],[12.5,-8.35]]){m.box(x,5.24,z,.035,2.12,.035,'#9d806b');m.box(x,4.05,z,.70,.30,.70,'#d6a77c');m.sphere(x,3.87,z,.22,'#fff0c9',5,8);}
 // Chalkboard with menu strokes above coffee counter.
 m.box(15.91,3.99,-11.68,.18,1.44,2.58,'#423e39');
 for(let j=0;j<4;j++)m.box(15.80,4.27-j*.28,-11.75,.04,.07,1.72-j*.20,j%2?'#efcdac':'#e6e3cc');
 // Lounge seating and low tea table, as in a real craft café.
 m.box(10.65,.08,-15.7,3.30,.045,3.80,'#b5b4a1');
 m.box(10.35,.48,-16.45,2.58,.35,.76,'#9ba995');m.box(10.35,.92,-16.87,2.58,.78,.16,'#8d9d8e');
 m.box(10.46,.37,-14.95,1.25,.06,1.18,'#ddc6ab');m.box(10.46,.18,-14.95,.18,.29,.18,'#9d7c63');
 m.box(10.30,.45,-13.98,.76,.18,.62,'#c1a38b');
 m.box(10.46,.44,-14.95,.16,.20,.16,'#f5e5d1');
 pottedPlant(m,9.13,-16.3,.83);pottedPlant(m,15.93,-16.3,.82);
 // Cozy browsing nook between the craft groups and reception. Informal shop furniture, not classroom desks.
 m.box(-5.0,.029,10.2,6.9,.045,5.1,'#d2c6b1');m.box(-5.0,.050,10.2,6.6,.020,4.8,'#e5d9c6');
 m.box(-6.5,.49,10.65,2.28,.34,.96,'#a2aa94');m.box(-6.5,.96,11.05,2.28,.82,.17,'#839789');
 m.box(-5.67,.69,10.65,.28,.25,.21,'#edc7a4');m.box(-7.15,.69,10.65,.28,.25,.21,'#e8d6b5');
 m.box(-3.75,.32,9.80,1.64,.11,1.04,'#bc9274');m.box(-3.75,.19,9.80,.16,.22,.16,'#91674d');
 m.box(-3.65,.43,9.83,.26,.13,.27,'#f9eade');m.box(-3.36,.39,9.67,.52,.03,.40,'#fff9ed');
 m.box(-2.35,.68,11.52,1.20,1.18,.59,'#af9177');m.box(-2.35,1.30,11.52,1.32,.10,.67,'#ecd6b8');
 for(let j=0;j<4;j++)m.box(-2.76+j*.28,1.45,11.52,.20,.17,.22,['#edb0a1','#b8c9b1','#d2b39c','#e5cba4'][j]);
 // Small basket and sample-board displays; a hand-made store feels stocked, not institutional.
 for(const [x,z] of [[-13.9,-8.4],[-12.7,4.9],[-1.2,6.6],[8.15,7.9]]){
  m.box(x,.36,z,.72,.55,.68,'#be9a7c');m.box(x,.70,z,.78,.12,.74,'#a78265');
  for(let j=0;j<3;j++)m.sphere(x-.18+j*.18,.79,z,.11,['#e8ac9c','#f3d9a5','#a4baa0'][j],5,7);
 }
 // User pieces are rendered last so every outer and ironing-room wall can act
 // as a persistent shared display surface without being hidden by wall décor.
 displayGalleryItems(m);
 // Customer’s selected takeaway cup can be seen in avatar’s hand in buildPlayer().
 phCreateStatic(m);
 return m;
}
function buildPlayer(){
 if(PH.active||firstPerson)return new Mesh();const m=new Mesh(),bobAmp=carriedBoard ? .003 : carriedProduct ? .006 : heldDrink ? .008 : .02,bob=Math.sin(performance.now()/160)*Math.min(player.walk,bobAmp),x=player.x,z=player.z;
 const outfit='#8fc3a6',skin='#f3d3b2',hair='#7a5742';
 m.box(x,.03,z,.60,.02,.46,'#b7a083');                                                     // soft shadow
 m.sphere(x,.34+bob,z,.25,outfit,7,11);m.box(x,.30+bob,z,.34,.22,.30,outfit);              // short round chibi body
 m.sphere(x-.20,.33+bob,z,.085,skin,5,8);m.sphere(x+.20,.33+bob,z,.085,skin,5,8);          // stubby arms
 m.sphere(x-.11,.12+bob,z,.105,'#8a6a56',5,8);m.sphere(x+.11,.12+bob,z,.105,'#8a6a56',5,8);// little feet
 m.sphere(x,.78+bob,z,.36,skin,9,13);m.sphere(x,.83+bob,z-.07,.35,hair,9,12);              // BIG head + hair
 m.sphere(x,.66+bob,z+.22,.265,'#f8e2c9',8,11);                                            // face
 m.sphere(x-.115,.72+bob,z+.33,.043,'#3b2f28',6,8);m.sphere(x+.115,.72+bob,z+.33,.043,'#3b2f28',6,8); // big cute eyes
 m.sphere(x-.205,.665+bob,z+.265,.036,'#f2a98d',5,6);m.sphere(x+.205,.665+bob,z+.265,.036,'#f2a98d',5,6); // rosy cheeks
 if(carriedBoard){const work=tableBoards[carriedBoard];m.box(x,.43+bob,z+.38,1.05,.055,.72,'#f2dfc4');
  for(let py=0;py<8;py++)for(let px=0;px<10;px++){const sx=Math.min(work.size-1,Math.floor((px+.5)*work.size/10)),sy=Math.min(work.size-1,Math.floor((py+.5)*work.size/8)),id=work.cells[sy*work.size+sx];if(id)m.box(x+(px-4.5)*.088,.48+bob,z+.38+(py-3.5)*.075,.078,.035,.065,colorLookup[id]);}
 }else if(carriedProduct){const work={size:carriedProduct.size,cells:carriedProduct.cells||unpackCells(carriedProduct.pixels,carriedProduct.size)};m.box(x,.46+bob,z+.38,.62,.05,.62,carriedProduct.mount==='frame'?'#946e50':'#f2dfc4');
  for(let py=0;py<7;py++)for(let px=0;px<7;px++){const id=sampledColor(work,px,py,7);if(id)m.box(x+(px-3)*.075,.49+bob,z+.38+(py-3)*.075,.068,.025,.068,colorLookup[id]);}
 }else{const d=currentDrink();if(d){m.box(x+.40,.42+bob,z+.26,.22,.26,.21,'#fbf7ee');m.box(x+.40,.52+bob,z+.26,.19,.02,.18,d.drink);if((heldOpt&&heldOpt.whip)||d.foam&&heldOpt&&heldOpt.milk)m.box(x+.40,.55+bob,z+.26,.18,.03,.17,d.foam||'#fff7ee');m.box(x+.50,.42+bob,z+.27,.028,.16,.028,'#e2d9c0');}}
 return m;
}
// ---------- Multiplayer: WebSocket for the fast path, plus Vercel Runtime Cache polling so
// players still share a room when their sockets land on different Function instances. ----------
function persistentPlayerId(){
 let id=null;try{id=localStorage.getItem('bead-house.cloud-player');}catch(_e){}
 if(!/^p[a-z0-9_-]{8,64}$/i.test(id||'')){id='p'+(globalThis.crypto?.randomUUID?.().replace(/-/g,'')||Math.random().toString(36).slice(2)+Date.now().toString(36)).slice(0,24);try{localStorage.setItem('bead-house.cloud-player',id);}catch(_e){}}
 return id;
}
function cloudCopyProduct(item){if(!item)return null;const {cells,...copy}=item;return copy;}
function cloudIronSnapshot(){if(!carriedBoard)return null;const value=id=>$(id)?.value;
 return{table:carriedBoard,finished:!!ironFinished,busy:!!ironBusy,progress:Math.round(Math.max(ironProgressValue,ironManual?.progress||0)*1000)/1000,
  technique:value('ironTechnique')||restoredIronState?.technique||'normal',level:value('ironLevel')||restoredIronState?.level||'medium',sides:value('ironSides')||restoredIronState?.sides||'single',service:value('ironService')||restoredIronState?.service||'self',
  product:selectedIronProduct||restoredIronState?.product||'keychain',name:(value('ironName')||restoredIronState?.name||'').slice(0,24),manualCells:Array.from(ironManual?.cells||[]).map(v=>Math.round(v*1000)/1000)};
}
function cloudPlayerSnapshot(){
 const cleanTableStock={};for(const table of names)cleanTableStock[table]={...tableStock[table]};
 return{version:1,nickname:String(nickname||'游客小豆').slice(0,24),position:{x:Math.round(player.x*20)/20,z:Math.round(player.z*20)/20,yaw:Math.round(camera.angle*100)/100},
  hand:{drink:drinkSnapshot(),board:carriedBoard||null,product:cloudCopyProduct(carriedProduct)},
  coffee:{drink:chosenDrink,opt:{...coffeeOpt},mode:coffeeMode,made:!!coffeeMade,busy:!!coffeeBusy,step:coffeeStepIdx,fill:coffeeFill,foam:coffeeFoam,grind:coffeeGrind,progress:coffeeCloudProgress},
  iron:cloudIronSnapshot(),inventory:{tray:{...tray},tool:pickupTool,rack:{...rackStock},tables:cleanTableStock}};
}
function cloudAmount(value,max){const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(max,Math.floor(n))):0;}
function applyCloudPlayer(state){
 if(!state||typeof state!=='object')return false;
 if(typeof state.nickname==='string'&&state.nickname.trim()){nickname=state.nickname.trim().slice(0,24);$('displayName').textContent=nickname;saveNick();}
 const pos=state.position;if(pos&&Number.isFinite(pos.x)&&Number.isFinite(pos.z)){player.x=Math.max(ROOM.minX+.3,Math.min(ROOM.maxX-.3,pos.x));player.z=Math.max(ROOM.minZ+.3,Math.min(ROOM.maxZ-.3,pos.z));if(Number.isFinite(pos.yaw))camera.angle=camera.aTarget=pos.yaw;}
 const inv=state.inventory;if(inv&&typeof inv==='object'){
  if(inv.tray)for(const s of swatches)tray[s.id]=cloudAmount(inv.tray[s.id],TRAY_MAX);
  if(toolLabels[inv.tool])pickupTool=inv.tool;
  if(inv.rack)for(const s of swatches)rackStock[s.id]=cloudAmount(inv.rack[s.id],RACK_STOCK_MAX);
  if(inv.tables)for(const table of names)for(const s of swatches)if(inv.tables[table])tableStock[table][s.id]=cloudAmount(inv.tables[table][s.id],500);
  persistTray();persistRack();persistTableStock();
 }
 const coffee=state.coffee;if(coffee&&drinks.some(d=>d.id===coffee.drink)){
  chosenDrink=coffee.drink;coffeeMode=['self','staff','ready'].includes(coffee.mode)?coffee.mode:'self';coffeeOpt={milk:!!coffee.opt?.milk,sugar:!!coffee.opt?.sugar,ice:!!coffee.opt?.ice,whip:!!coffee.opt?.whip,size:['S','M','L'].includes(coffee.opt?.size)?coffee.opt.size:'M'};
  coffeeSteps=drinkSteps(drinkById(chosenDrink));coffeeStepIdx=Math.max(0,Math.min(coffeeSteps.length,cloudAmount(coffee.step,coffeeSteps.length)));coffeeMade=!!coffee.made;coffeeBusy=false;coffeeFill=Math.max(0,Math.min(1,Number(coffee.fill)||0));coffeeFoam=Math.max(0,Math.min(1,Number(coffee.foam)||0));coffeeGrind=Math.max(0,Math.min(1,Number(coffee.grind)||0));coffeeCloudProgress=Math.max(0,Math.min(1,Number(coffee.progress)||0));coffeeCloudBucket=Math.floor(coffeeCloudProgress*4);
 }
 let restoredDrink=null;const hand=state.hand||{};if(hand.drink&&drinks.some(d=>d.id===hand.drink.id)){restoredDrink=hand.drink;}
 carriedProduct=null;carriedBoard=null;
 const product=hand.product;if(product&&sizeOptions.includes(product.size)&&typeof product.pixels==='string'&&product.pixels.length===product.size*product.size){carriedProduct={...product,cells:unpackCells(product.pixels,product.size)||[]};}
 else if(names.includes(hand.board)&&tableBoards[hand.board]?.cells.some(Boolean)){carriedBoard=hand.board;activeTable=hand.board;PH.boardOut=false;}
 else if(restoredDrink){heldDrink=restoredDrink.id;heldOpt={...(restoredDrink.opt||{})};coffeeSips=cloudAmount(restoredDrink.sips,20);heldDrinkSource=['self','staff','ready'].includes(restoredDrink.source)?restoredDrink.source:'self';}
 if(carriedBoard&&state.iron&&state.iron.table===carriedBoard){restoredIronState={...state.iron};ironFinished=!!state.iron.finished;ironProgressValue=Math.max(0,Math.min(1,Number(state.iron.progress)||0));selectedIronProduct=PRODUCT_META[state.iron.product]?state.iron.product:'keychain';}
 updateDrinkStatus();updateCarryBoardStatus();updateCarryProductStatus();updatePaletteQuantity();updateStatic();return true;
}
const NET={id:persistentPlayerId(),peers:new Map(),chan:null,ws:null,url:null,roomUrl:null,retry:null,retryMs:800,stopped:false,last:0,lastBoard:0,lastHttpState:0,lastPlayerSave:0,lastPlayerSig:'',saveTimer:null,on:false,pollTimer:null,pollBusy:false,pollCount:0,mid:0,seen:new Set(),restoring:true,restored:false,durable:false};
function netColor(id){let n=0;for(const c of id||'')n=(n+c.charCodeAt(0))%997;return ['#e39a93','#9fc3a6','#a9b9e0','#e6c58a','#caa7d6','#8fd0c6','#e0a878','#bdd08f'][n%8];}
function netConnectWs(){if(!NET.url||NET.stopped)return;clearTimeout(NET.retry);try{const ws=new WebSocket(NET.url);NET.ws=ws;NET.on=true;
 ws.onopen=()=>{NET.retryMs=800;netSend({t:'hi',id:NET.id});};
 ws.onmessage=e=>{try{const msg=JSON.parse(e.data);if(!netRemember(msg.mid))netRecv(msg);}catch(_e){}};
 ws.onclose=()=>{if(NET.ws===ws)NET.ws=null;if(!NET.stopped){NET.retry=setTimeout(netConnectWs,NET.retryMs);NET.retryMs=Math.min(8000,Math.round(NET.retryMs*1.7));}};
 ws.onerror=()=>{};
 }catch(_e){NET.retry=setTimeout(netConnectWs,NET.retryMs);}}
function netStart(){
 try{const saved=(()=>{try{return localStorage.getItem('bead.net.url');}catch(_e){return null;}})(),sameOrigin=location.protocol==='https:'?`wss://${location.host}/api/ws`:null;NET.url=saved||window.BEAD_NET_URL||sameOrigin;NET.roomUrl=location.protocol==='https:'?'/api/room':null;
  if(NET.url)netConnectWs();
  else if('BroadcastChannel' in window){NET.chan=new BroadcastChannel('bead-house-room-v1');NET.chan.onmessage=e=>netRecv(e.data);NET.on=true;netSend({t:'hi',id:NET.id});}
  if(NET.roomUrl){NET.on=true;netPoll();netSend({t:'hi',id:NET.id});}else{NET.restoring=false;NET.restored=true;}
 }catch(_e){NET.on=false;}
 try{window.addEventListener('beforeunload',()=>{netSavePlayer(true);netSend({t:'bye',id:NET.id});NET.stopped=true;clearTimeout(NET.retry);clearTimeout(NET.pollTimer);clearTimeout(NET.saveTimer);});}catch(_e){}
}
function netRemember(mid){if(!mid)return false;if(NET.seen.has(mid))return true;NET.seen.add(mid);if(NET.seen.size>1800)NET.seen=new Set([...NET.seen].slice(-900));return false;}
function netPost(packet){if(!NET.roomUrl)return;const now=performance.now();if(packet.t==='state'){if(now-NET.lastHttpState<420)return;NET.lastHttpState=now;}
 const retryable=['board','gallery:add','gallery:put','gallery:remove','table:drink','player:save'].includes(packet.t);
 try{fetch(NET.roomUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(packet),keepalive:retryable||packet.t==='bye'}).then(response=>{if(!response.ok&&retryable&&!NET.stopped)setTimeout(()=>netPost(packet),1200);}).catch(()=>{if(retryable&&!NET.stopped)setTimeout(()=>netPost(packet),1200);});}catch(_e){}
}
async function netPoll(){if(NET.stopped||!NET.roomUrl)return;if(NET.pollBusy){NET.pollTimer=setTimeout(netPoll,450);return;}NET.pollBusy=true;
 try{const count=NET.pollCount++,params=new URLSearchParams();if(count%3===0){params.set('boards','1');params.set('drinks','1');}if(count%24===0)params.set('gallery','1');if(!NET.restored)params.set('player',NET.id);const response=await fetch(`${NET.roomUrl}?${params}`,{cache:'no-store'});if(response.ok){const data=await response.json();for(const msg of data.events||[])if(!netRemember(msg.mid))netRecv(msg);for(const msg of data.boards||[])netRecv(msg);for(const msg of data.tableDrinks||[])netRecv(msg);if(Array.isArray(data.gallery))replaceGalleryItems(data.gallery);NET.durable=!!data.durable;if(!NET.restored){applyCloudPlayer(data.player);NET.restoring=false;NET.restored=true;NET.lastPlayerSig=JSON.stringify(cloudPlayerSnapshot());}NET.on=true;}}
 catch(_e){}finally{NET.pollBusy=false;NET.pollTimer=setTimeout(netPoll,document.hidden?1200:450);}
}
function netSend(msg){const packet={...msg,id:msg.id||NET.id,mid:msg.mid||`${NET.id}-${Date.now().toString(36)}-${(++NET.mid).toString(36)}`};if(packet.t!=='player:save'){try{if(NET.ws&&NET.ws.readyState===1)NET.ws.send(JSON.stringify(packet));else if(NET.chan)NET.chan.postMessage(packet);}catch(_e){}}netPost(packet);}
function netRecv(msg){
 if(!msg||(msg.id===NET.id&&!['board','table:drink'].includes(msg.t)))return;
 if(msg.t==='state'){const p=NET.peers.get(msg.id)||{};Object.assign(p,msg);p.last=performance.now();NET.peers.set(msg.id,p);}
 else if(msg.t==='bye')NET.peers.delete(msg.id);
 else if(msg.t==='hi'){netBroadcastSelf(true);if(PH.active&&activeTable)netSend({t:'board',table:activeTable,cells:packCells(board().cells),size:board().size});if(!NET.roomUrl)for(const item of gallery)netSend({t:'gallery:add',id:NET.id,item,sync:true});}
 else if(msg.t==='board'&&names.includes(msg.table)&&sizeOptions.includes(msg.size)){const cells=unpackCells(msg.cells,msg.size);if(cells){tableBoards[msg.table]={size:msg.size,cells};if(PH.active&&activeTable===msg.table){try{rebuildBoardRaster();updateCount();}catch(_e){}}try{updateStatic();}catch(_e){}}}
 else if(msg.t==='gallery:add'){const added=mergeGalleryItems([msg.item]);if(added&&!msg.sync)toast(`${msg.item?.author||'一位豆友'}在多人心愿墙挂上了新作品。`);}
 else if(msg.t==='gallery:put'){const changed=putGalleryItems([msg.item]);if(changed&&!msg.sync)toast(`${msg.item?.author||'一位豆友'}在${wallSurface(msg.item?.wallId).label}挂上了作品。`);}
 else if(msg.t==='gallery:remove'){const removed=removeGalleryItem(msg.itemId);if(removed&&!msg.sync)toast(`${msg.id===NET.id?'你':'一位豆友'}取下了墙上的${PRODUCT_META[removed.mount]?.label||'作品'}。`);}
 else if(msg.t==='table:drink'&&names.includes(msg.table)){if(msg.item&&drinks.some(d=>d.id===msg.item.id))tableDrinks[msg.table]={...msg.item,opt:{...(msg.item.opt||{})}};else delete tableDrinks[msg.table];try{updateStatic();if(PH.active&&activeTable===msg.table)updateSeatHud();}catch(_e){}}
}
function netSavePlayer(force=false){if(!NET.roomUrl||NET.restoring||NET.stopped)return;const now=performance.now();if(!force&&now-NET.lastPlayerSave<8000)return;const state=cloudPlayerSnapshot(),signature=JSON.stringify(state);if(!force&&signature===NET.lastPlayerSig)return;NET.lastPlayerSave=now;NET.lastPlayerSig=signature;netSend({t:'player:save',state});}
function markCloudProgress(){if(!NET?.roomUrl||NET.restoring)return;clearTimeout(NET.saveTimer);NET.saveTimer=setTimeout(()=>netSavePlayer(true),550);}
function netBroadcastSelf(force){
 if(!NET.on)return;const now=performance.now();if(!force&&now-NET.last<120)return;NET.last=now;
 netSend({t:'state',id:NET.id,nick:(typeof nickname!=='undefined'?nickname:'游客'),x:Math.round(player.x*100)/100,z:Math.round(player.z*100)/100,yaw:Math.round(camera.angle*100)/100,seat:(PH.active?activeTable:null),walk:player.walk>.3?1:0});
 netSavePlayer(false);
}
function netPrune(){const now=performance.now();for(const [id,p] of NET.peers)if(now-p.last>3500)NET.peers.delete(id);}
function netTableOwner(tableId){for(const [,p] of NET.peers)if(p.seat===tableId)return p;return null;}
function netSendBoard(force=false,tableId=activeTable){if(!NET.on||!tableBoards[tableId])return;const now=performance.now();if(!force&&now-NET.lastBoard<220)return;NET.lastBoard=now;const work=tableBoards[tableId];netSend({t:'board',table:tableId,cells:packCells(work.cells),size:work.size});}
// A standing ~1.8m figure facing `yaw`, for remote players.
function addFigure(m,x,z,yaw,shirt,bob){bob=bob||0;const skin='#f3d3b2',hair='#5c4638';
 const fx=Math.sin(yaw),fz=Math.cos(yaw),rx=Math.cos(yaw),rz=-Math.sin(yaw);
 m.box(x,.66+bob,z,.5,1.32,.4,shirt);                                                   // torso+legs
 m.sphere(x,1.36+bob,z,.19,skin,6,8);                                                   // neck
 m.sphere(x,1.58+bob,z,.29,skin,9,12);m.sphere(x-fx*.05,1.63+bob,z-fz*.05,.285,hair,9,11); // head + hair
 m.sphere(x+fx*.25-rx*.1,1.55+bob,z+fz*.25-rz*.1,.032,'#3b2f28',5,6);m.sphere(x+fx*.25+rx*.1,1.55+bob,z+fz*.25+rz*.1,.032,'#3b2f28',5,6); // eyes
 m.sphere(x+fx*.2-rx*.19,1.5+bob,z+fz*.2-rz*.19,.03,'#f2a98d',4,5);m.sphere(x+fx*.2+rx*.19,1.5+bob,z+fz*.2+rz*.19,.03,'#f2a98d',4,5); // cheeks
}
function buildPeers(m){for(const [id,p] of NET.peers){if(p.x==null)continue;const bob=p.walk?Math.sin(performance.now()/160)*.03:0;addFigure(m,p.x,p.z,p.yaw||0,netColor(id),bob);}}
let peerTagEls=new Map(),peerTagRoot=null;
function renderPeerTags(){
 if(!peerTagRoot){peerTagRoot=document.createElement('div');peerTagRoot.id='peerTags';peerTagRoot.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:6;overflow:hidden';(document.querySelector('.app')||document.body).appendChild(peerTagRoot);}
 const seen=new Set();
 for(const [id,p] of NET.peers){if(p.x==null)continue;seen.add(id);const sp=worldToScreen([p.x,1.98,p.z]);let el=peerTagEls.get(id);
  if(!sp){if(el)el.style.display='none';continue;}
  if(!el){el=document.createElement('div');el.className='peer-tag';peerTagRoot.appendChild(el);peerTagEls.set(id,el);}
  el.textContent=(p.nick||'玩家')+(p.seat?' · 拼豆中':'');el.style.display='';el.style.left=sp.x+'px';el.style.top=sp.y+'px';el.style.borderColor=netColor(id);
 }
 for(const [id,el] of peerTagEls)if(!seen.has(id)){el.remove();peerTagEls.delete(id);}
}
function compileShader(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
function prepareGL(){
 // Studio lighting: warm key + cool fill + hemisphere ambient, a soft broad
 // specular and a rim term for form separation, then a gentle tone/fog pass.
 const vert='attribute vec3 aPos;attribute vec3 aNormal;attribute vec3 aColor;uniform mat4 uMatrix;uniform vec3 uCam;varying vec3 vColor;varying float vDepth;'
  +'void main(){vec3 N=normalize(aNormal);vec3 V=normalize(uCam-aPos);'
  +'vec3 Lk=normalize(vec3(.42,.95,.52));vec3 Lf=normalize(vec3(-.55,.38,-.6));'
  +'float kd=max(dot(N,Lk),0.);float fd=max(dot(N,Lf),0.);'
  +'float hemi=.5+.5*N.y;vec3 amb=mix(vec3(.57,.54,.49),vec3(.76,.74,.69),hemi);' // soft neutral-warm hemisphere ambient (less yellow)
  +'vec3 warm=vec3(1.,.96,.88);vec3 cool=vec3(.90,.93,.98);'                        // gentle warm key + light cool fill to balance
  +'vec3 lit=amb+warm*kd*.34+cool*fd*.12;'
  +'vec3 H=normalize(Lk+V);float spec=pow(max(dot(N,H),0.),16.)*.15;'
  +'float rim=pow(1.-max(dot(N,V),0.),3.)*.10;'
  +'vColor=aColor*lit+vec3(spec)+vec3(1.,.96,.88)*rim;'
  +'vec4 p=uMatrix*vec4(aPos,1.);gl_Position=p;vDepth=p.w;}';
 const frag='precision mediump float;varying vec3 vColor;varying float vDepth;'
  +'void main(){vec3 c=vColor;c=c/(c*0.17+0.9);'          // soft shoulder, keeps pastels
  +'float l=dot(c,vec3(.299,.587,.114));c=mix(vec3(l),c,1.10);' // modest saturation for a cute-but-clean look
  +'c*=vec3(1.015,1.0,0.965);'                              // very gentle warm grade (no longer too yellow)
  +'vec3 fog=vec3(.92,.91,.89);float f=clamp((vDepth-46.)/90.,0.,.16);c=mix(c,fog,f);'
  +'gl_FragColor=vec4(c,1.);}';
 program=gl.createProgram();gl.attachShader(program,compileShader(gl,gl.VERTEX_SHADER,vert));gl.attachShader(program,compileShader(gl,gl.FRAGMENT_SHADER,frag));gl.linkProgram(program);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
 loc={p:gl.getAttribLocation(program,'aPos'),n:gl.getAttribLocation(program,'aNormal'),c:gl.getAttribLocation(program,'aColor'),m:gl.getUniformLocation(program,'uMatrix'),cam:gl.getUniformLocation(program,'uCam')};
 // Separate soft-shadow program: flat black discs with per-vertex alpha, blended onto the floor.
 const sv='attribute vec3 aPos;attribute float aA;uniform mat4 uMatrix;varying float vA;void main(){gl_Position=uMatrix*vec4(aPos,1.);vA=aA;}';
 const sf='precision mediump float;varying float vA;void main(){gl_FragColor=vec4(0.,0.,0.,vA);}';
 shadowProg=gl.createProgram();gl.attachShader(shadowProg,compileShader(gl,gl.VERTEX_SHADER,sv));gl.attachShader(shadowProg,compileShader(gl,gl.FRAGMENT_SHADER,sf));gl.linkProgram(shadowProg);
 shadowLoc={p:gl.getAttribLocation(shadowProg,'aPos'),a:gl.getAttribLocation(shadowProg,'aA'),m:gl.getUniformLocation(shadowProg,'uMatrix')};
 // Particle program: soft camera-facing discs with per-vertex RGBA (steam, dust).
 const pv='attribute vec3 aPos;attribute vec4 aCol;uniform mat4 uMatrix;varying vec4 vCol;void main(){gl_Position=uMatrix*vec4(aPos,1.);vCol=aCol;}';
 const pf='precision mediump float;varying vec4 vCol;void main(){gl_FragColor=vec4(vCol.rgb*vCol.a,vCol.a);}';
 partProg=gl.createProgram();gl.attachShader(partProg,compileShader(gl,gl.VERTEX_SHADER,pv));gl.attachShader(partProg,compileShader(gl,gl.FRAGMENT_SHADER,pf));gl.linkProgram(partProg);
 partLoc={p:gl.getAttribLocation(partProg,'aPos'),c:gl.getAttribLocation(partProg,'aCol'),m:gl.getUniformLocation(partProg,'uMatrix')};
 glParts=gl.createBuffer();
 gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(.925,.915,.90,1);
 glStatic=gl.createBuffer();glPlayer=gl.createBuffer();glShadowStatic=gl.createBuffer();glShadowPlayer=gl.createBuffer();
 phSetupReferenceGL();updateStatic();updateStaticShadows();
}
// Build a filled soft-shadow disc (triangle fan as triangles) into arr at ground level.
function pushShadowDisc(arr,x,z,r,strength,squashZ){
 const seg=18,y=0.014,sz=squashZ||1;
 for(let k=0;k<seg;k++){const a0=k/seg*Math.PI*2,a1=(k+1)/seg*Math.PI*2;
  arr.push(x,y,z,strength, x+Math.cos(a0)*r,y,z+Math.sin(a0)*r*sz,0, x+Math.cos(a1)*r,y,z+Math.sin(a1)*r*sz,0);}
}
function buildStaticShadows(){
 const a=[];
 for(const t of positions)pushShadowDisc(a,t.x,t.z,2.15,.2,.72);      // worktables
 pushShadowDisc(a,-12,17.6,3.1,.17,.5);                              // bead wall base
 pushShadowDisc(a,12.15,-10.93,2.3,.18,.7);                         // café counter
 pushShadowDisc(a,12.6,16.4,1.9,.18,.8);                           // ironing station
 return a;
}
function updateStaticShadows(){if(!gl||!glShadowStatic)return;const a=buildStaticShadows();gl.bindBuffer(gl.ARRAY_BUFFER,glShadowStatic);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(a),gl.STATIC_DRAW);shadowStaticCount=a.length/4;}
function drawShadows(){
 if(!shadowProg)return;
 gl.useProgram(shadowProg);gl.uniformMatrix4fv(shadowLoc.m,false,new Float32Array(drawMatrix));
 gl.enable(gl.BLEND);gl.depthMask(false);gl.disable(gl.CULL_FACE);
 const bind=(buf,count)=>{gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.vertexAttribPointer(shadowLoc.p,3,gl.FLOAT,false,16,0);gl.vertexAttribPointer(shadowLoc.a,1,gl.FLOAT,false,16,12);gl.enableVertexAttribArray(shadowLoc.p);gl.enableVertexAttribArray(shadowLoc.a);gl.drawArrays(gl.TRIANGLES,0,count);};
 if(!PH.active&&!PH.wall&&shadowStaticCount)bind(glShadowStatic,shadowStaticCount);
 // moving player shadow
 if(!PH.active&&!PH.wall&&!firstPerson){const pa=[];pushShadowDisc(pa,player.x,player.z,.62+player.walk*.05,.26,.78);gl.bindBuffer(gl.ARRAY_BUFFER,glShadowPlayer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(pa),gl.DYNAMIC_DRAW);bind(glShadowPlayer,pa.length/4);}
 gl.depthMask(true);gl.disable(gl.BLEND);gl.enable(gl.CULL_FACE);gl.useProgram(program);
}
// Ambient particle life: café steam, iron steam, held-drink steam, drifting dust motes.
function stepParticles(dt){
 if(!partProg)return;dt=Math.min(dt,.05);
 if(!PH.active&&!PH.wall&&!activeModal){
  partSpawn.coffee+=dt;if(partSpawn.coffee>.17){partSpawn.coffee=0;particles.push({x:COFFEE_POS.x+(Math.random()-.5)*.35,y:2.3,z:COFFEE_POS.z+(Math.random()-.5)*.35,vx:(Math.random()-.5)*.07,vy:.42+Math.random()*.2,vz:(Math.random()-.5)*.07,life:0,max:2.3+Math.random(),size:.13,r:1,g:.98,b:.93,aMul:.2});}
  partSpawn.iron+=dt;if(partSpawn.iron>.6){partSpawn.iron=0;particles.push({x:12.6+(Math.random()-.5)*.5,y:1.95,z:16.2+(Math.random()-.5)*.35,vx:0,vy:.3+Math.random()*.15,vz:0,life:0,max:2.6,size:.12,r:1,g:1,b:1,aMul:.1});}
  partSpawn.dust+=dt;if(partSpawn.dust>.42&&particles.length<120){partSpawn.dust=0;particles.push({x:ROOM.minX+Math.random()*(ROOM.maxX-ROOM.minX),y:1+Math.random()*3.3,z:ROOM.minZ+Math.random()*(ROOM.maxZ-ROOM.minZ),vx:(Math.random()-.5)*.05,vy:.02+Math.random()*.03,vz:(Math.random()-.5)*.05,life:0,max:5+Math.random()*4,size:.03,r:1,g:.95,b:.84,aMul:.42,dust:true});}
  if(heldDrink&&drinkById(heldDrink).hot&&!(heldOpt&&heldOpt.ice)){partSpawn.drink+=dt;if(partSpawn.drink>.32){partSpawn.drink=0;particles.push({x:player.x+.22,y:1.72,z:player.z+.22,vx:0,vy:.34,vz:0,life:0,max:1.4,size:.055,r:1,g:1,b:.97,aMul:.15});}}
 }
 for(const p of particles){p.life+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vy*=(1-dt*.12);if(!p.dust)p.size+=dt*.06;}
 if(particles.length>160)particles.splice(0,particles.length-160);
 particles=particles.filter(p=>p.life<p.max);
}
function buildParticlesMesh(){
 const arr=[],R=camRight,U=camUp,seg=7;
 for(const p of particles){
  const k=Math.min(1,p.life/p.max),fade=Math.sin(k*Math.PI);
  let a=p.aMul*fade;if(p.dust)a*= .5+.5*Math.sin(p.life*5.5);
  if(a<=.003)continue;const s=p.size,cx=p.x,cy=p.y,cz=p.z;
  for(let j=0;j<seg;j++){
   const a0=j/seg*6.2832,a1=(j+1)/seg*6.2832;
   const o0x=(Math.cos(a0)*R[0]+Math.sin(a0)*U[0])*s,o0y=(Math.cos(a0)*R[1]+Math.sin(a0)*U[1])*s,o0z=(Math.cos(a0)*R[2]+Math.sin(a0)*U[2])*s;
   const o1x=(Math.cos(a1)*R[0]+Math.sin(a1)*U[0])*s,o1y=(Math.cos(a1)*R[1]+Math.sin(a1)*U[1])*s,o1z=(Math.cos(a1)*R[2]+Math.sin(a1)*U[2])*s;
   arr.push(cx,cy,cz,p.r,p.g,p.b,a, cx+o0x,cy+o0y,cz+o0z,p.r,p.g,p.b,0, cx+o1x,cy+o1y,cz+o1z,p.r,p.g,p.b,0);
  }
 }
 return arr;
}
function drawParticles(){
 if(!partProg||!particles.length)return;const arr=buildParticlesMesh();if(!arr.length)return;
 gl.useProgram(partProg);gl.uniformMatrix4fv(partLoc.m,false,new Float32Array(drawMatrix));
 gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.disable(gl.CULL_FACE);
 gl.bindBuffer(gl.ARRAY_BUFFER,glParts);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(arr),gl.DYNAMIC_DRAW);
 gl.vertexAttribPointer(partLoc.p,3,gl.FLOAT,false,28,0);gl.vertexAttribPointer(partLoc.c,4,gl.FLOAT,false,28,12);
 gl.enableVertexAttribArray(partLoc.p);gl.enableVertexAttribArray(partLoc.c);
 gl.drawArrays(gl.TRIANGLES,0,arr.length/7);
 gl.depthMask(true);gl.enable(gl.CULL_FACE);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.disable(gl.BLEND);gl.useProgram(program);
}
function updateStatic(){if(!gl)return;const m=buildStatic();gl.bindBuffer(gl.ARRAY_BUFFER,glStatic);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(m.data),gl.STATIC_DRAW);staticVertexCount=m.count;}
function drawMesh(buffer,count){gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.vertexAttribPointer(loc.p,3,gl.FLOAT,false,36,0);gl.vertexAttribPointer(loc.n,3,gl.FLOAT,false,36,12);gl.vertexAttribPointer(loc.c,3,gl.FLOAT,false,36,24);gl.enableVertexAttribArray(loc.p);gl.enableVertexAttribArray(loc.n);gl.enableVertexAttribArray(loc.c);gl.drawArrays(gl.TRIANGLES,0,count);}
function resize(){const oldAspect=layout.aspect;layout.width=scene.clientWidth;layout.height=scene.clientHeight;layout.aspect=layout.width/Math.max(1,layout.height);
 if(PH.active&&PH.viewAuto&&Math.abs(layout.aspect-oldAspect)>.02)phResetDeskView();
 // Crisp pixel art via INTEGER scaling: render at (device resolution ÷ N), N a whole number of
 // device pixels per render pixel, then CSS upscales ×N nearest-neighbour. A fractional factor
 // is what makes pixels look uneven/tilted/blurry, so we round N to an integer.
 const dpr=devicePixelRatio||1,N=Math.max(2,Math.round(PIXEL_DIV*dpr));
 const w=Math.max(1,Math.round(layout.width*dpr/N)),h=Math.max(1,Math.round(layout.height*dpr/N));
 renderScale=w/Math.max(1,layout.width);
 if(scene.width!==w||scene.height!==h){scene.width=w;scene.height=h;if(gl)gl.viewport(0,0,w,h);}}
function spatialInfo(kind,t){
 if(kind==='desk')return {pos:[t.x,1.7,t.z],point:[t.x,t.z],radius:3.65};
 if(kind==='tablebin')return {pos:[t.x+1.04,1.30,t.z-.2],point:[t.x,t.z],radius:3.65};
 if(kind==='rack')return {pos:[-12,3.5,18.8],point:[-12,16.3],radius:4.5};
 if(kind==='coffee')return {pos:[12.15,2.65,-10.93],point:[12.15,-10.93],radius:4.3};
 if(kind==='station')return {pos:[9.3,2.8,14.18],point:[11.4,15.5],radius:4.4};
 if(kind==='wall')return {pos:[0,5.6,-19.2],point:[0,-15.7],radius:3.8};
 return null;
}
function updateLabels(){
 if(PH.active){phRenderLabels();return;}
 if(PH.wall){phRenderWallLabels();return;}
 document.getElementById("sceneLabels").style.display="none";
 let best=null,hovered=null;
 const candidateKinds=new Set(['desk','rack','coffee','station','wall']);
 for(const l of labels){
  l.el.style.display='none';
  if(!candidateKinds.has(l.kind))continue;
  const info=spatialInfo(l.kind,l.t);if(!info)continue;
  const p=worldToScreen(info.pos);if(!p)continue;
  const dist=Math.hypot(player.x-info.point[0],player.z-info.point[1]);
  if(dist<info.radius){const score=dist/info.radius;if(!best||score<best.score)best={l,score};}
  const gap=Math.hypot(hoverScene.x-p.x,hoverScene.y-p.y);
  if(gap<66&&(!hovered||gap<hovered.gap))hovered={l,gap};
 }
 const focus=hovered?.l||best?.l||null;
 activeSpatial=focus;
 if(!focus||activeModal)return;
 const chosen=[focus];
 if(focus.kind==='desk'&&Math.hypot(player.x-focus.t.x,player.z-focus.t.z)<4){
  const bin=labels.find(l=>l.kind==='tablebin'&&l.t?.id===focus.t.id);if(bin)chosen.push(bin);
 }
 for(const l of chosen){const info=spatialInfo(l.kind,l.t),p=worldToScreen(info.pos);if(!p||p.x<16||p.x>layout.width-16||p.y<48||p.y>layout.height-16)continue;
  l.el.style.left=p.x+'px';l.el.style.top=p.y+'px';l.el.style.display='flex';
 }
}
function createLabels(){
 const root=$('sceneLabels');
 for(const t of positions){
  const b=document.createElement('button');b.className='desk-label spatial-label';b.innerHTML='<span class="spatial-icon">✳</span><span>拼豆</span>';b.title=`拼豆桌 ${t.id}`;b.setAttribute('aria-label',`前往拼豆桌 ${t.id}`);b.onclick=()=>approach(t);root.appendChild(b);labels.push({el:b,t,kind:'desk'});
  const small=document.createElement('button');small.className='desk-label spatial-label table-bin-label';small.innerHTML='<span class="spatial-icon">◉</span><span>取豆</span>';small.title=`${t.id} 桌边取豆`;small.setAttribute('aria-label',`${t.id} 号桌取豆`);
  small.onclick=()=>{activeTable=t.id;pickupAt='table';pickupTable=t.id;pickupReturn='pattern';openTablePickup();};root.appendChild(small);labels.push({el:small,t,kind:'tablebin'});
 }
 const defs=[['wall','▧','赏画',goGallery],['station','♨','熨烫',goIronStation],['coffee','☕','咖啡',goCoffeeStation]];
 for(const [kind,icon,label,action] of defs){const b=document.createElement('button');b.className=`desk-label spatial-label ${kind}-label`;b.innerHTML=`<span class="spatial-icon">${icon}</span><span>${label}</span>`;b.setAttribute('aria-label',label);b.onclick=action;root.appendChild(b);labels.push({el:b,kind});}
}
function nearestDesk(){let best=null,dist=Infinity;for(const t of positions){const d=Math.hypot(player.x-t.x,player.z-(t.z+1.3));if(d<dist){dist=d;best=t;}}return{t:best,dist};}
function approach(t){
 if(carriedBoard){toast('双手正端着底板，不能坐下拼豆。请先送到熨烫间。');return;}
 if(carriedProduct){toast('手里拿着烫好的成品，请先到展示墙挂上。');return;}
 pendingStation=false;pendingBeadStation=false;pendingCoffee=false;
 // One seat per table: if another player is already working here, walk over to WATCH (their
 // beads sync onto this table live) instead of sitting.
 const owner=netTableOwner(t.id);
 if(owner){pendingTable=null;const c=[{x:t.x,z:t.z+1.62},{x:t.x,z:t.z-1.62},{x:t.x+1.95,z:t.z},{x:t.x-1.95,z:t.z}].filter(p=>phCanStep(p.x,p.z)).sort((a,b)=>Math.hypot(player.x-a.x,player.z-a.z)-Math.hypot(player.x-b.x,player.z-b.z))[0];if(c){const r=phRouteTo(c.x,c.z);player.target=r.length?r.shift():c;player.route=r.length?r:[];}toast(`${owner.nick||'有人'} 正在用这张桌子，你在旁边看看～`);return;}
 pendingTable=t;
 // Already standing next to the table? Sit immediately.
 if(Math.hypot(player.x-t.x,player.z-t.z)<2.05){pendingTable=null;player.target=null;player.route=[];phSit(t);return;}
 // Otherwise head for whichever side of the table is NEAREST and actually walkable (not the
 // old fixed side, which could route you around to the wrong spot or get boxed in).
 const cands=[{x:t.x,z:t.z+1.62},{x:t.x,z:t.z-1.62},{x:t.x+1.95,z:t.z},{x:t.x-1.95,z:t.z}];
 let best=null,bd=1e9;
 for(const c of cands){if(!phCanStep(c.x,c.z))continue;const d=Math.hypot(player.x-c.x,player.z-c.z);if(d<bd){bd=d;best=c;}}
 if(!best)best=cands[0];
 const route=phRouteTo(best.x,best.z);
 if(route.length){player.target=route.shift();player.route=route;}else player.target=best;
}
function goGallery(){const nearest=nearestWallSurface();if(carriedProduct&&nearest.surface&&nearest.dist<4.2){hangCarriedProductAt(nearest.surface.id,wallPlayerU(nearest.surface),3.55);return;}const north=wallSurface('north');walkToWallSurface(north,0);toast(carriedProduct?'把成品拿到任意墙面前，点击想挂的位置；按 E 可挂在面前。':'正在前往北墙；所有墙面都能挂作品，空手点击作品可以取下。');}
function goIronStation(){if(carriedProduct){toast('这件成品已经烫好了，请拿到展示墙亲自挂上。');return;}if(!carriedBoard){toast('请先在拼豆桌拿起拼好的底板，再前往熨烫间。');return;}pendingStation=true;pendingTable=null;pendingBeadStation=false;pendingCoffee=false;
 // Walk through the west-side door into the actual separate ironing room.
 if(player.x<9.35||player.z<9.75){player.route=[{x:7.1,z:14.18},{x:10.75,z:14.18},{x:12.6,z:16.0}];}
 else player.route=[{x:12.6,z:16.0}];
 player.target=player.route.shift();toast('正在从侧面入口前往独立熨烫间…');}

function goBeadStation(id){if(carriedProduct){toast('先把手里的成品挂到展示墙，再去取豆。');return;}if(id)pickedBin=id;if(activeModal)closeModal();pickupAt='wall';pickupReturn='studio';player.target={x:-12,z:14.7};player.route=[];pendingBeadStation=true;pendingStation=false;pendingTable=null;pendingCoffee=false;toast('正在走向大豆墙取豆…');}
function openTablePickup(){pickupAt='table';pickupTable=activeTable;if(activeModal==='editor')pickupReturn='editor';drawerOpened=false;openModal('pickup');renderPickup();}

function canStep(x,z){
 // The ironing room has solid partitions and only one doorway near z=14.2.
 const old=player;
 if((old.x-9.27)*(x-9.27)<0){const crossingZ=old.z+(z-old.z)*(9.27-old.x)/(x-old.x);if(crossingZ>9.65&&crossingZ<20.4&&(crossingZ<13.1||crossingZ>15.42))return false;}
 if((old.z-9.8)*(z-9.8)<0){const crossingX=old.x+(x-old.x)*(9.8-old.z)/(z-old.z);if(crossingX>9.24&&crossingX<17.1)return false;}
 return true;
}
function update(dt){
 // Global eased camera orientation — every mode sets targets, the camera glides.
 camera.sway+=dt;const eo=Math.min(1,dt*7);
 camera.angle+=(camera.aTarget-camera.angle)*eo;
 camera.pitch+=(camera.pTarget-camera.pitch)*eo;
 camera.distance+=(camera.dTarget-camera.distance)*eo;
 camera.fpLook+=(camera.fpLookT-camera.fpLook)*Math.min(1,dt*12);
 camera.fov+=(camera.fovTarget-camera.fov)*Math.min(1,dt*10);
 netBroadcastSelf();netPrune();   // multiplayer presence (runs in every mode)
 if(PH.wall){
    camera.lookX+=(-12-camera.lookX)*Math.min(1,dt*12);
    camera.lookZ+=(18.3-camera.lookZ)*Math.min(1,dt*12);return;
 }
 if(PH.active){
    phPhysics(dt);
    if(PH.pointer&&PH.pointer.holdBoard&&!PH.pointer.moved&&!PH.held&&!PH.bin&&performance.now()-PH.pointer.holdBoard>550){PH.pointer.holdBoard=0;PH.pointer.dumped=true;phDumpBoard();} // hold the board to tip it empty
    camera.lookX+=(phTable().x+PH.orbitX-camera.lookX)*Math.min(1,dt*12);
    camera.lookZ+=(phTable().z+PH.orbitZ-camera.lookZ)*Math.min(1,dt*12);
    camera.dTarget=PH.cameraDistance;
    return;
 }
 if(activeModal)return;const carryStartX=player.x,carryStartZ=player.z;let dx=Number(input.d)-Number(input.a),dz=Number(input.s)-Number(input.w),moving=false;
 // Robust sit: the instant you're beside the table you walked up to, sit down — no need to
 // land exactly on a seat point (which could leave you a step short, stuck, or on the wrong side).
 if(pendingTable&&Math.hypot(player.x-pendingTable.x,player.z-pendingTable.z)<2.05){const t=pendingTable;pendingTable=null;player.target=null;player.route=[];if(netTableOwner(t.id))toast(`有人刚坐下了，你在旁边看看～`);else phSit(t);return;}
 if(pendingCoffee&&Math.hypot(player.x-COFFEE_POS.x,player.z-COFFEE_POS.z)<2.8){pendingCoffee=false;player.target=null;player.route=[];takeCoffee();return;} // open the café as soon as you reach the counter
 if(pendingBeadStation&&Math.hypot(player.x+12,player.z-14.7)<2.8){pendingBeadStation=false;player.target=null;player.route=[];phWallEnter();return;} // open the bead wall on arrival
 if(pendingStation&&Math.hypot(player.x-12.6,player.z-16)<2.8){pendingStation=false;player.target=null;player.route=[];phAutoIron();return;} // open the ironing station on arrival
 if(dx||dz){const speed=2.7*carryMoveFactor()*dt;let mx,mz;   // drinks remain careful; boards keep normal walking speed and use shake risk instead
   if(firstPerson){const y=camera.angle;mx=Math.sin(y)*(-dz)-Math.cos(y)*dx;mz=Math.cos(y)*(-dz)+Math.sin(y)*dx;} // W = forward, D = right (camera-relative)
   else{mx=dx;mz=dz;}
   const len=Math.hypot(mx,mz)||1,nx=player.x+mx/len*speed,nz=player.z+mz/len*speed;phWalkStep(nx,nz);player.target=null;player.route=[];pendingTable=null;pendingStation=false;pendingBeadStation=false;pendingCoffee=false;moving=true;}
 else if(player.target){const ddx=player.target.x-player.x,ddz=player.target.z-player.z,d=Math.hypot(ddx,ddz);if(d>.09){const s=Math.min(d,3.4*carryMoveFactor()*dt);const nx=player.x+ddx/d*s,nz=player.z+ddz/d*s;if(phWalkStep(nx,nz)){moving=true;}else{player.target=null;player.route=[];pendingTable=null;pendingBeadStation=false;pendingCoffee=false;if(pendingStation){pendingStation=false;toast('请从熨烫间门口进入。');}}}else{player.target=null;if(player.route.length){player.target=player.route.shift();}else if(pendingTable){const t=pendingTable;pendingTable=null;phSit(t);}else if(pendingStation){pendingStation=false;phAutoIron();}else if(pendingBeadStation){pendingBeadStation=false;phWallEnter();}else if(pendingCoffee){pendingCoffee=false;takeCoffee();}}}
 player.x=Math.max(ROOM.minX,Math.min(ROOM.maxX,player.x));player.z=Math.max(ROOM.minZ,Math.min(ROOM.maxZ,player.z));player.walk=moving?Math.min(1,player.walk+.15):Math.max(0,player.walk-.09);
 const carryVx=(player.x-carryStartX)/Math.max(.001,dt),carryVz=(player.z-carryStartZ)/Math.max(.001,dt);updateBoardCarryMotion(dt,carryVx,carryVz,Math.hypot(carryVx,carryVz)>.04);
 if(moving){player.stride=(player.stride||0)+dt;const stepGap=heldDrink ? .48 : .34;if(player.stride>stepGap){player.stride=0;SFX.step();}}else player.stride=0;
 // Follow the player in BOTH axes so walking into a corner room (café, ironing room,
// bead wall) actually pans that room into view — the old heavy Z damping kept the camera
// centred, so the far rooms slid off-screen and felt impossible to enter.
 camera.lookX+=(player.x-camera.lookX)*Math.min(1,dt*2.4);camera.lookZ+=(player.z*.80-1.6-camera.lookZ)*Math.min(1,dt*1.5);
}
function frame(now){resize();const dt=Math.min((now-last)/1000,.06);last=now;update(dt);stepParticles(dt);if(PH.active)updateSeatHud();calcCamera();drawCarryView();
 if(gl&&program){gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);gl.uniformMatrix4fv(loc.m,false,new Float32Array(drawMatrix));if(loc.cam)gl.uniform3fv(loc.cam,new Float32Array(camPos));drawMesh(glStatic,staticVertexCount);drawShadows();const actor=buildPlayer();buildPeers(actor);phCreateDynamic(actor);gl.bindBuffer(gl.ARRAY_BUFFER,glPlayer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(actor.data),gl.DYNAMIC_DRAW);drawMesh(glPlayer,actor.count);phDrawReferenceGL();drawParticles();}
 if(fallback2d&&now-lastFallbackPaint>115){lastFallbackPaint=now;drawFallback();}
 updateLabels();renderPeerTags();if(!firstFrame){firstFrame=true;document.body.dataset.rendered='1';}requestAnimationFrame(frame);
}
function openModal(id){if(activeModal)$(activeModal).classList.add('hidden');activeModal=id;$('modalBack').classList.remove('hidden');$(id).classList.remove('hidden');$('soundToggle')?.classList.add('hidden');$('carryCupHit')?.classList.add('hidden');$('carryBoard')?.classList.add('modal-hidden');$('carryProduct')?.classList.add('modal-hidden');SFX.ui();}
function closeModal(){if(!activeModal)return;const closing=activeModal;$(activeModal).classList.add('hidden');$('modalBack').classList.add('hidden');activeModal=null;$('soundToggle')?.classList.remove('hidden');$('carryBoard')?.classList.remove('modal-hidden');$('carryProduct')?.classList.remove('modal-hidden');if(closing==='coffee'||closing==='iron')try{markCloudProgress();}catch(_e){}SFX.close();}
function setTool(name){tool=name;document.querySelectorAll('.tool[data-tool]').forEach(b=>b.classList.toggle('selected',b.dataset.tool===name));$('beadCanvas').style.cursor=name==='pan'?'grab':'crosshair';}
function selectColor(id){paintColor=id;const s=swatches.find(c=>c.id===id);$('colorSwatch').style.backgroundColor=s.hex;$('colorSwatch').dataset.finish=s.finish;$('colorName').textContent=s.name;const ft=FINISH_META[s.finish]?.tag;$('colorCode').textContent=`${s.id}${ft?' · '+FINISH_META[s.finish].label:''} · 托盘剩余 ${tray[id]||0} 颗`;document.querySelectorAll('.bead-option').forEach(b=>b.classList.toggle('active',b.dataset.color===id));updatePaletteQuantity();}
function buildPalette(){const root=$('palette');root.innerHTML='';for(const s of swatches){const b=document.createElement('button');b.type='button';b.className='bead-option';b.dataset.color=s.id;b.dataset.finish=s.finish;b.style.background=s.hex;const ft=FINISH_META[s.finish]?.tag;b.title=`${s.name} · ${s.id}${ft?' · '+FINISH_META[s.finish].label:''} · 托盘 ${tray[s.id]||0} 颗`;b.setAttribute('aria-label',`${s.name} ${s.id}`);if(ft){const badge=document.createElement('em');badge.className='finish-badge';badge.textContent=ft[0];b.appendChild(badge);}b.onclick=()=>{selectColor(s.id);setTool('paint');};root.appendChild(b);}selectColor(paintColor);}
function updatePaletteQuantity(){document.querySelectorAll('.bead-option').forEach(b=>{b.dataset.qty=String(tray[b.dataset.color]||0);b.title=`${b.dataset.color} · 托盘剩余 ${tray[b.dataset.color]||0} 颗`;});}
const CELL=10;
function drawBeadCell(i){const n=board().size,x=i%n,y=Math.floor(i/n),cx=x*CELL+5,cy=y*CELL+5,c=beadBackCtx,id=current()[i];
 c.fillStyle='#f6ead7';c.fillRect(x*CELL,y*CELL,CELL,CELL);
 c.beginPath();c.arc(cx,cy,4.08,0,Math.PI*2);c.fillStyle=id?colorLookup[id]:'#e5d5bd';c.fill();
 c.lineWidth=.5;c.strokeStyle=id?'#6b544533':'#c2a98b';c.stroke();
 if(id){
  const fin=finishOf(id);
  if(fin==='glow'){c.strokeStyle='#d8ff8e7a';c.lineWidth=1.4;c.beginPath();c.arc(cx,cy,4.4,0,Math.PI*2);c.stroke();} // luminous halo
  c.fillStyle='#00000016';c.beginPath();c.arc(cx,cy,fin==='jelly'?1.25:.98,0,Math.PI*2);c.fill(); // fuse-bead hole (wider when jelly/translucent)
  c.strokeStyle='#5b43301c';c.lineWidth=.8;c.beginPath();c.arc(cx+.4,cy+.5,3.8,.25,1.75);c.stroke(); // lower contact shade
  if(fin==='metal'){const g=c.createLinearGradient(cx-4,cy-4,cx+4,cy+4);g.addColorStop(0,'#ffffff7a');g.addColorStop(.5,'#ffffff12');g.addColorStop(1,'#5b5b6b33');c.fillStyle=g;c.beginPath();c.arc(cx,cy,3.9,0,Math.PI*2);c.fill();} // pearl sheen
  if(fin==='glitter'){c.fillStyle='#ffffffcc';for(let s=0;s<4;s++){const a=s*1.9+(x+y),rr=2.6;c.beginPath();c.arc(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr,.42,0,Math.PI*2);c.fill();}} // sparkle flecks
  c.fillStyle=fin==='jelly'?'#ffffffa6':'#ffffff62';c.beginPath();c.arc(cx-1.2,cy-1.5,fin==='jelly'?1.5:1.2,0,Math.PI*2);c.fill(); // glossy/glass highlight
 }else{c.beginPath();c.arc(cx,cy,.92,0,Math.PI*2);c.fillStyle='#faf0e0';c.fill();}
}
function rebuildBoardRaster(){const n=board().size;beadBack.width=n*CELL;beadBack.height=n*CELL;beadBackCtx=beadBack.getContext('2d',{alpha:false});for(let i=0;i<n*n;i++)drawBeadCell(i);drawViewport();}
function cropInfo(){const n=board().size,visible=n/zoom,maxPan=(n-visible)/2;panX=Math.max(-maxPan,Math.min(maxPan,panX));panY=Math.max(-maxPan,Math.min(maxPan,panY));return{visible,sx:(n-visible)/2+panX,sy:(n-visible)/2+panY};}
function drawViewport(){const canvas=$('beadCanvas'),c=canvas.getContext('2d',{alpha:false}),s=cropInfo();c.imageSmoothingEnabled=zoom<=1.05;c.fillStyle='#f6ead7';c.fillRect(0,0,800,800);c.drawImage(beadBack,s.sx*CELL,s.sy*CELL,s.visible*CELL,s.visible*CELL,0,0,800,800);
 if(referenceVisible&&referenceByTable[activeTable]){
  let img=referenceCanvases[activeTable];if(!img){img=imageForReference(referenceByTable[activeTable]);referenceCanvases[activeTable]=img;}
  if(img&&img.width&&img.height){c.globalAlpha=Number($('refAlpha').value)/100;c.drawImage(img,(s.sx/board().size)*img.width,(s.sy/board().size)*img.height,(s.visible/board().size)*img.width,(s.visible/board().size)*img.height,0,0,800,800);c.globalAlpha=1;}
 }
 $('zoomLabel').textContent=Math.round(zoom*100)+'%';}
function requestViewport(){if(boardRaf)return;boardRaf=requestAnimationFrame(()=>{boardRaf=0;drawViewport();});}
function updateCount(){const n=board().size,count=current().reduce((sum,c)=>sum+(c?1:0),0);if($('traySummary'))$('traySummary').textContent=`已取 ${trayTotal()} 颗 · ${pickupTool==='tweezers'?'镊子':pickupTool==='single'?'单针豆笔':'双针豆笔'}`;if($('colorCode'))$('colorCode').textContent=`${paintColor} · 托盘剩余 ${tray[paintColor]||0} 颗（内部编号）`;$('pieceCount').textContent=`已放置 ${count.toLocaleString('zh-CN')} / ${(n*n).toLocaleString('zh-CN')} 颗`;
 $('toolEquipped').textContent=`当前工具：${toolLabels[pickupTool]} · ${pickupTool==='tweezers'?'点一颗、拖一排连续摆豆':pickupTool==='single'?'可拖动连续摆豆':'每次并排放两颗'}`;
 const std=Math.ceil(n/29)**2,mini=Math.ceil(n/52)**2;
 $('boardInfo').textContent=`${n}×${n} · 5mm 29格底板约 ${std} 块 / 迷你52格约 ${mini} 块`;
}
function openEditor(id){activeTable=id;undo=[];redo=[];painting=false;panGesture=null;zoom=1;panX=0;panY=0;setTool('paint');$('editorTitle').textContent=`拼豆桌 ${id} · 自由创作`;
 $('editorSub').textContent='';$('boardSize').value=String(board().size);openModal('editor');renderReferencePanel();rebuildBoardRaster();updateCount();}
function resizeBoard(n){if(!sizeOptions.includes(n))return;const old=board();if(n===old.size)return;
 const hasBeads=old.cells.some(Boolean);if(hasBeads&&!confirm(`把 ${old.size}×${old.size} 改为 ${n}×${n}？\n已拼的豆子会居中保留；超出新画板的部分会被裁掉。`)){$('boardSize').value=String(old.size);return;}
 const next=Array(n*n).fill(null),offset=Math.floor((n-old.size)/2);
 for(let y=0;y<old.size;y++)for(let x=0;x<old.size;x++){const nx=x+offset,ny=y+offset;if(nx>=0&&ny>=0&&nx<n&&ny<n)next[ny*n+nx]=old.cells[y*old.size+x];}
 const kept=new Map();for(const id of next)if(id)kept.set(id,(kept.get(id)||0)+1);
 const originally=new Map();for(const id of old.cells)if(id)originally.set(id,(originally.get(id)||0)+1);
 for(const [id,count] of originally){const cut=count-(kept.get(id)||0);if(cut>0)tray[id]=(tray[id]||0)+cut;}
 persistTray();
 tableBoards[activeTable]={size:n,cells:next};undo=[];redo=[];zoom=1;panX=panY=0;$('editorSub').textContent=`可选尺寸 · 当前 ${n} × ${n} · 熨烫挂墙才会长期留存`;
 rebuildBoardRaster();updateCount();storeBoard();updateStatic();toast(`画板已切换到 ${n} × ${n}`);
}
function setZoom(v){zoom=Math.max(1,Math.min(16,v));cropInfo();drawViewport();}
function pointerIndex(e){const box=$('beadCanvas').getBoundingClientRect(),s=cropInfo(),n=board().size;
 const x=Math.floor(s.sx+(e.clientX-box.left)/box.width*s.visible),y=Math.floor(s.sy+(e.clientY-box.top)/box.height*s.visible);
 return x>=0&&y>=0&&x<n&&y<n?y*n+x:-1;
}
function applyIndex(i){if(i<0)return;const id=(rightErase||tool==='erase')?null:paintColor,cells=current();const old=cells[i];if(old===id)return;
 if(id&&(tray[id]||0)<=0){if(!window._outOfBeadsNotice||Date.now()-window._outOfBeadsNotice>1500){window._outOfBeadsNotice=Date.now();toast(`${id} 豆盒未取或托盘已空，先去取豆区补豆。`);}return;}
 if(old)tray[old]=(tray[old]||0)+1;if(id)tray[id]--;cells[i]=id;movedStroke=true;drawBeadCell(i);requestViewport();updateCount();updatePaletteQuantity();
 if(!window._beadSndAt||performance.now()-window._beadSndAt>45){window._beadSndAt=performance.now();id?SFX.place():SFX.erase();}}
function applyWithTool(i){if(i<0)return;const n=board().size;if(pickupTool==='double'&&tool==='paint'&&!rightErase){const next=i%n<n-1?i+1:i-1;const needed=[i,next].filter(index=>current()[index]!==paintColor).length;if(needed>(tray[paintColor]||0)){toast('双针豆笔需要至少 '+needed+' 颗同色豆，请去豆墙补充。');return;}applyIndex(i);if(next!==i)applyIndex(next);}else applyIndex(i);}
function lineToCell(from,to){const n=board().size,x0=from%n,y0=Math.floor(from/n),x1=to%n,y1=Math.floor(to/n),steps=Math.max(Math.abs(x1-x0),Math.abs(y1-y0));for(let k=0;k<=steps;k++){const x=Math.round(x0+(x1-x0)*k/Math.max(1,steps)),y=Math.round(y0+(y1-y0)*k/Math.max(1,steps));applyWithTool(y*n+x);}}
function floodFill(start,replacement){
 if(start<0)return;const n=board().size,cells=current(),target=cells[start];
 if(target===replacement)return;
 const region=[],seen=new Uint8Array(n*n),stack=[start];seen[start]=1;
 while(stack.length){const i=stack.pop();if(cells[i]!==target)continue;region.push(i);
  const x=i%n,y=(i/n)|0;
  if(x>0&&!seen[i-1]){seen[i-1]=1;stack.push(i-1);}
  if(x<n-1&&!seen[i+1]){seen[i+1]=1;stack.push(i+1);}
  if(y>0&&!seen[i-n]){seen[i-n]=1;stack.push(i-n);}
  if(y<n-1&&!seen[i+n]){seen[i+n]=1;stack.push(i+n);}
 }
 if(!region.length)return;
 if(replacement&&(tray[replacement]||0)<=0){toast(`${replacement} 托盘为空，先去取豆。`);return;}
 undo.push([...cells]);if(undo.length>(n>=128?12:24))undo.shift();redo=[];
 let filled=0;
 for(const i of region){
  if(replacement&&(tray[replacement]||0)<=0)break;
  const old=cells[i];if(old)tray[old]=(tray[old]||0)+1;
  if(replacement)tray[replacement]=Math.max(0,(tray[replacement]||0)-1);
  cells[i]=replacement;drawBeadCell(i);filled++;
 }
 if(!filled){undo.pop();return;}
 requestViewport();updateCount();updatePaletteQuantity();storeBoard();persistTray();updateStatic();
 toast(replacement?(filled<region.length?`填充 ${filled} 颗 · ${replacement} 不够，还差 ${region.length-filled} 颗`:`一键填充 ${filled} 颗`):`清除 ${filled} 颗`);
 SFX.pour();
}
function beginStroke(e){if(e.button!==0&&e.button!==2&&e.button!==1)return;
 if(tool==='pan'||e.button===1||e.shiftKey){panGesture={x:e.clientX,y:e.clientY,panX,panY};$('beadCanvas').style.cursor='grabbing';$('beadCanvas').setPointerCapture(e.pointerId);return;}
 if(tool==='fill'){floodFill(pointerIndex(e),e.button===2?null:paintColor);return;}
 painting=true;movedStroke=false;rightErase=e.button===2;strokeLast=-1;undo.push([...current()]);if(undo.length>(board().size>=128?12:24))undo.shift();redo=[];
 $('beadCanvas').setPointerCapture(e.pointerId);const i=pointerIndex(e);applyWithTool(i);strokeLast=i;
}
function moveStroke(e){if(panGesture){const r=$('beadCanvas').getBoundingClientRect(),visible=board().size/zoom;panX=panGesture.panX-(e.clientX-panGesture.x)/r.width*visible;panY=panGesture.panY-(e.clientY-panGesture.y)/r.height*visible;drawViewport();return;}
 if(!painting)return;const i=pointerIndex(e);if(i<0)return;if(strokeLast>=0&&strokeLast!==i)lineToCell(strokeLast,i);else applyWithTool(i);strokeLast=i;
}
function endStroke(){if(panGesture){panGesture=null;$('beadCanvas').style.cursor=tool==='pan'?'grab':'crosshair';return;}
 if(!painting)return;painting=false;strokeLast=-1;if(movedStroke){storeBoard();persistTray();updateStatic();}else undo.pop();}
function reconcileInventory(before,after){for(let i=0;i<before.length;i++){if(before[i]===after[i])continue;if(before[i])tray[before[i]]=(tray[before[i]]||0)+1;if(after[i])tray[after[i]]=Math.max(0,(tray[after[i]]||0)-1);}}
function history(action){let next;if(action==='undo'&&undo.length){redo.push([...current()]);next=undo.pop();}
 else if(action==='redo'&&redo.length){undo.push([...current()]);next=redo.pop();}else return;
 reconcileInventory(current(),next);board().cells=next;rebuildBoardRaster();updateCount();updatePaletteQuantity();storeBoard();persistTray();updateStatic();}
function askClear(){if(!current().some(Boolean))return;if(!confirm(`确认清空拼豆桌 ${activeTable} 的全部拼豆？可撤销。`))return;undo.push([...current()]);if(undo.length>16)undo.shift();redo=[];board().cells=Array(board().size**2).fill(null);for(const c of undo[undo.length-1])if(c)tray[c]=(tray[c]||0)+1;rebuildBoardRaster();updateCount();updatePaletteQuantity();storeBoard();persistTray();updateStatic();}
function exportPng(){const n=board().size,out=Math.min(3072,Math.max(768,n*12)),step=out/n,c=document.createElement('canvas');c.width=c.height=out;const g=c.getContext('2d');g.fillStyle='#fcf5e7';g.fillRect(0,0,out,out);
 const cells=current();for(let i=0;i<cells.length;i++){const id=cells[i];if(!id)continue;const x=i%n,y=Math.floor(i/n);g.fillStyle=colorLookup[id];g.beginPath();g.arc((x+.5)*step,(y+.5)*step,step*.43,0,Math.PI*2);g.fill();}
 const link=document.createElement('a');link.download=`拼豆小屋-${activeTable}-${n}x${n}.png`;link.href=c.toDataURL('image/png');document.body.appendChild(link);link.click();link.remove();toast(`已导出 ${n}×${n} PNG。`);
}
const IRON_TECHNIQUES={
 normal:{label:'普通烫',short:'经典豆感'},towel:{label:'毛巾烫',short:'柔软绒面'},crystal:{label:'水晶烫',short:'通透亮面'},glitter:{label:'闪粉烫',short:'细闪亮片'}
};
const PRODUCT_META={keychain:{label:'钥匙扣'},magnet:{label:'冰箱贴'},frame:{label:'画框'},stand:{label:'桌面摆件'},badge:{label:'胸针'}};
let selectedIronProduct='keychain';
const IRON_MANUAL_GRID=8;
let ironManual={active:false,down:false,cells:new Float32Array(IRON_MANUAL_GRID**2),point:null,last:null,progress:0};
let ironProgressValue=0,restoredIronState=null;
function paintIronCell(c,x,y,step,id,technique,level,melt,bg){const cx=(x+.5)*step,cy=(y+.5)*step,hex=colorLookup[id],r=step*(.42+.11*melt);
 if(technique==='crystal'){
  c.save();c.globalAlpha=.72+.28*melt;c.fillStyle=mixHex(hex,'#e9ffff',.20);c.beginPath();c.moveTo(cx,cy-r);c.lineTo(cx+r,cy);c.lineTo(cx,cy+r);c.lineTo(cx-r,cy);c.closePath();c.fill();
  c.strokeStyle='rgba(255,255,255,.62)';c.lineWidth=Math.max(.45,step*.055);c.beginPath();c.moveTo(cx-r*.68,cy);c.lineTo(cx,cy-r*.68);c.lineTo(cx+r*.35,cy);c.stroke();c.restore();return;
 }
 if(technique==='towel'){
  c.fillStyle=ironShade(hex,melt*.82);c.beginPath();c.arc(cx,cy,r*1.03,0,6.2832);c.fill();c.strokeStyle='rgba(255,245,226,.46)';c.lineWidth=Math.max(.35,step*.05);
  for(let k=0;k<3;k++){const a=((x*17+y*29+k*41)%100)/100*Math.PI*2,rr=r*(.25+k*.17);c.beginPath();c.moveTo(cx+Math.cos(a)*rr*.25,cy+Math.sin(a)*rr*.25);c.lineTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr);c.stroke();}
  return;
 }
 c.fillStyle=ironShade(hex,melt);
 if(level==='flat'&&melt>.82)c.fillRect(x*step-.2,y*step-.2,step+.5,step+.5);
 else{c.beginPath();c.arc(cx,cy,r,0,6.2832);c.fill();const hole=step*(level==='light'?.16:level==='medium'?.065:0)*(1-melt*.72);if(hole>.35){c.fillStyle=bg;c.beginPath();c.arc(cx,cy,hole,0,6.2832);c.fill();}}
 if(technique==='glitter'&&((x*13+y*7)%9<3)){const sr=Math.max(1,step*.16);c.strokeStyle='rgba(255,255,246,.92)';c.lineWidth=Math.max(.45,step*.055);c.beginPath();c.moveTo(cx-sr,cy);c.lineTo(cx+sr,cy);c.moveTo(cx,cy-sr);c.lineTo(cx,cy+sr);c.stroke();}
}
function drawProductOverlay(c,w,product){c.save();
 if(product==='frame'){c.strokeStyle='#9b7355';c.lineWidth=22;c.strokeRect(11,11,w-22,w-22);c.strokeStyle='#ead3b5';c.lineWidth=7;c.strokeRect(24,24,w-48,w-48);}
 else if(product==='keychain'){c.strokeStyle='#c8c9c5';c.lineWidth=7;c.beginPath();c.arc(w/2,23,17,0,6.2832);c.stroke();c.lineWidth=5;c.beginPath();c.moveTo(w/2,40);c.lineTo(w/2,62);c.stroke();}
 else if(product==='stand'){c.fillStyle='rgba(213,232,231,.88)';c.fillRect(w*.24,w-25,w*.52,16);c.fillStyle='rgba(255,255,255,.66)';c.fillRect(w*.31,w-20,w*.38,4);}
 else if(product==='magnet'){c.fillStyle='#aeb8b4';c.beginPath();c.arc(w-24,24,13,0,6.2832);c.fill();c.fillStyle='#e7ece8';c.beginPath();c.arc(w-24,24,6,0,6.2832);c.fill();}
 else if(product==='badge'){c.strokeStyle='#c5c7c3';c.lineWidth=5;c.beginPath();c.moveTo(w*.31,21);c.lineTo(w*.69,21);c.stroke();c.fillStyle='#e7e7e2';c.beginPath();c.arc(w*.31,21,7,0,6.2832);c.fill();}
 c.restore();}
function ironLabel(){const technique=$('ironTechnique').value,level=$('ironLevel').value,base=`${IRON_TECHNIQUES[technique].label} · ${{light:'留孔',medium:'半熔',flat:'无孔'}[level]} · ${$('ironSides').value==='single'?'单面':'双面'}`;return ironFinished?`${base} · ${PRODUCT_META[selectedIronProduct].label}`:base;}
function drawIronPreview(){const cv=$('ironCanvas'),c=cv.getContext('2d'),w=cv.width,n=board().size,subdiv=Math.min(n,72),step=w/subdiv,level=$('ironLevel').value,technique=$('ironTechnique').value,bg='#f9eedf';
 c.fillStyle=bg;c.fillRect(0,0,w,w);let has=false,melt={light:.38,medium:.68,flat:1}[level];
 for(let y=0;y<subdiv;y++)for(let x=0;x<subdiv;x++){const id=sampledColor(board(),x,y,subdiv);if(!id)continue;has=true;paintIronCell(c,x,y,step,id,technique,level,melt,bg);}
 if(ironFinished)drawProductOverlay(c,w,selectedIronProduct);
 if(!has){c.font='bold 17px sans-serif';c.textAlign='center';c.fillStyle='#a28974';c.fillText('先去拼几颗豆子吧',w/2,w/2);}
 $('ironPreviewLabel').textContent=ironLabel();
}
// Deepen & slightly darken a color as plastic beads fuse and gloss over.
function ironShade(hex,melt){const a=parseInt(hex.slice(1),16);const f=1-.13*melt;const r=((a>>16)&255)*f,g=((a>>8)&255)*f,b=(a&255)*f;return `rgb(${r|0},${g|0},${b|0})`;}
function drawSteam(c,w,p){
 const active=p>.04&&p<.9;
 if(active&&ironSteam.length<30&&Math.random()<.65)ironSteam.push({x:Math.random()*w,y:w*.62+Math.random()*w*.3,vy:-.5-Math.random()*.8,r:7+Math.random()*15,life:0,max:55+Math.random()*45});
 for(const s of ironSteam){s.life++;s.y+=s.vy;s.x+=Math.sin(s.life*.07)*.5;const k=s.life/s.max,al=Math.sin(Math.min(1,k)*Math.PI)*.16;c.fillStyle='rgba(255,255,255,'+al.toFixed(3)+')';c.beginPath();c.arc(s.x,s.y,s.r*(.7+k*.9),0,6.2832);c.fill();}
 ironSteam=ironSteam.filter(s=>s.life<s.max&&s.y>-24);
}
function drawManualIronTool(c){if(!ironManual.active||!ironManual.point)return;const {x,y}=ironManual.point;c.save();c.translate(x,y);c.rotate(-.12);c.shadowColor='#563d2f55';c.shadowBlur=12;c.shadowOffsetY=8;
 c.fillStyle='#e7ddd0';c.beginPath();c.ellipse(0,12,42,27,0,0,6.2832);c.fill();c.strokeStyle='#927761';c.lineWidth=4;c.stroke();c.shadowColor='transparent';
 c.fillStyle='#ba715c';c.beginPath();c.moveTo(-25,2);c.quadraticCurveTo(-21,-35,7,-38);c.quadraticCurveTo(37,-38,34,-5);c.lineTo(19,2);c.quadraticCurveTo(20,-18,5,-19);c.quadraticCurveTo(-10,-19,-10,2);c.closePath();c.fill();
 c.fillStyle='#fff4e5';c.beginPath();c.arc(24,-6,5,0,6.2832);c.fill();c.restore();}
// A real fuse animation: holes close, beads swell & merge, a gloss sweep appears,
// colors deepen, steam rises while hot, then it cools to a hardened sheen.
function drawIronFrame(p){
 const cv=$('ironCanvas'),c=cv.getContext('2d'),w=cv.width,n=board().size,subdiv=Math.min(n,72),step=w/subdiv,level=$('ironLevel').value,technique=$('ironTechnique').value,bg='#f9eedf';
 c.fillStyle=bg;c.fillRect(0,0,w,w);
 const ceil=level==='flat'?1:level==='medium'?.82:.5;
 const melt=Math.min(1,p/.85)*ceil,cool=Math.max(0,(p-.85)/.15);
 let has=false;
 for(let y=0;y<subdiv;y++)for(let x=0;x<subdiv;x++){const id=sampledColor(board(),x,y,subdiv);if(!id)continue;has=true;
  paintIronCell(c,x,y,step,id,technique,level,melt,bg);
  if(technique==='normal'){const cx=(x+.5)*step,cy=(y+.5)*step,r=step*(.38+.11*melt);c.fillStyle='rgba(255,255,255,'+(.08+.20*melt).toFixed(3)+')';c.beginPath();c.arc(cx-r*.3,cy-r*.34,r*.26,0,6.2832);c.fill();}
 }
 if(p<.95){c.fillStyle='rgba(255,243,222,'+(.14*(1-cool)).toFixed(3)+')';c.fillRect(0,0,w,w);}   // hot parchment tint
 if(melt>.3){const a=(.1*melt).toFixed(3),g=c.createLinearGradient(0,0,w,w);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.46,'rgba(255,255,255,'+a+')');g.addColorStop(.56,'rgba(255,255,255,'+a+')');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,w,w);} // gloss sweep
 drawSteam(c,w,p);
 drawManualIronTool(c);
 if(p>=1&&ironFinished)drawProductOverlay(c,w,selectedIronProduct);
 if(!has){c.font='bold 17px sans-serif';c.textAlign='center';c.fillStyle='#a28974';c.fillText('先去拼几颗豆子吧',w/2,w/2);}
 $('ironPreviewLabel').textContent=(p>=1?'已定型 · ':'')+ironLabel();
}
function resetManualIron(){ironManual={active:false,down:false,cells:new Float32Array(IRON_MANUAL_GRID**2),point:null,last:null,progress:0};$('ironCanvas')?.classList.remove('manual-ironing');$('ironManualHint')?.classList.add('hidden');}
function syncIronServiceUI(){const staff=$('ironService').value==='staff';$('staffStatus').textContent=staff?'NPC 代烫：交给小暖后会自动完成，你可以等待结果。':'自己动手：开始后请按住左侧作品，亲手移动熨斗覆盖全部区域。';$('ironStart').textContent=staff?'请小暖代烫 ♨':'拿起熨斗，自己操作 ♨';}
function completeIronRun(){resetManualIron();ironAnimRaf=0;ironBusy=false;ironFinished=true;ironProgressValue=1;$('ironStart').textContent='熨烫完成 ✓';$('ironStart').classList.add('hidden');$('ironProductPanel').classList.remove('hidden');$('hangBtn').classList.remove('hidden');$('ironProgressBar').style.width='100%';$('ironProgressText').textContent='熨烫定型完成，请选择成品配件！';selectIronProduct(selectedIronProduct);markCloudProgress();SFX.chime();toast('熨烫定型完成，请选择钥匙扣、冰箱贴、画框等成品形式。');}
function openIron(){
 if(!carriedBoard){toast('请先从拼豆桌拿起拼好的底板，再进入熨烫流程。');return;}activeTable=carriedBoard;if(activeModal)closeModal();
 const saved=restoredIronState?.table===carriedBoard?restoredIronState:null;restoredIronState=null;ironFinished=!!saved?.finished;ironBusy=false;ironJobId++;selectedIronProduct=PRODUCT_META[saved?.product]?saved.product:'keychain';ironProgressValue=Math.max(0,Math.min(1,Number(saved?.progress)||0));
 if(ironAnimRaf)cancelAnimationFrame(ironAnimRaf);ironSteam=[];resetManualIron();
 const valid={technique:['normal','towel','crystal','glitter'],level:['light','medium','flat'],sides:['single','double'],service:['self','staff']};
 $('ironTechnique').value=valid.technique.includes(saved?.technique)?saved.technique:'normal';$('ironLevel').value=valid.level.includes(saved?.level)?saved.level:'medium';$('ironSides').value=valid.sides.includes(saved?.sides)?saved.sides:'single';$('ironService').value=valid.service.includes(saved?.service)?saved.service:'self';$('ironName').value=(saved?.name||`${nickname}的拼豆作品`).slice(0,24);
 $('ironProgress').classList.add('hidden');$('ironProgressBar').style.width='0%';$('ironProductPanel').classList.add('hidden');$('hangBtn').classList.add('hidden');$('ironStart').disabled=false;$('ironStart').classList.remove('hidden');
 ['ironTechnique','ironLevel','ironSides','ironService'].forEach(k=>$(k).disabled=false);document.querySelectorAll('#ironProductGrid [data-product]').forEach(b=>b.classList.toggle('on',b.dataset.product===selectedIronProduct));syncIronServiceUI();openModal('iron');
 if(ironFinished){$('ironStart').classList.add('hidden');$('ironProgress').classList.remove('hidden');$('ironProductPanel').classList.remove('hidden');$('hangBtn').classList.remove('hidden');$('ironProgressBar').style.width='100%';$('ironProgressText').textContent='已从云端恢复熨烫完成的作品，请选择成品配件。';drawIronFrame(1);return;}
 if(saved?.service==='self'&&ironProgressValue>0&&Array.isArray(saved.manualCells)&&saved.manualCells.length===IRON_MANUAL_GRID**2){ironManual.cells=Float32Array.from(saved.manualCells,v=>Math.max(0,Math.min(1,Number(v)||0)));ironManual.progress=ironProgressValue;ironManual.active=true;$('ironStart').classList.add('hidden');$('ironProgress').classList.remove('hidden');$('ironManualHint').classList.remove('hidden');$('ironCanvas').classList.add('manual-ironing');['ironTechnique','ironLevel','ironSides','ironService'].forEach(k=>$(k).disabled=true);$('ironManualPercent').textContent=Math.round(ironProgressValue*100)+'%';$('ironProgressBar').style.width=Math.round(ironProgressValue*100)+'%';$('ironProgressText').textContent='已恢复上次自助熨烫进度，请继续移动熨斗。';drawIronFrame(ironProgressValue*.84);return;}
 drawIronPreview();if(saved?.service==='staff'&&ironProgressValue>0)setTimeout(()=>startIron(ironProgressValue),0);
}
function updateManualIronProgress(){const total=ironManual.cells.reduce((sum,v)=>sum+Math.min(1,v),0),p=Math.min(1,total/ironManual.cells.length);ironManual.progress=p;ironProgressValue=p;$('ironManualPercent').textContent=Math.round(p*100)+'%';$('ironProgressBar').style.width=Math.round(p*100)+'%';$('ironProgressText').textContent=p<.35?'按住熨斗，先覆盖作品边缘…':p<.72?'继续缓慢来回移动，均匀受热…':'快完成了，补齐还没覆盖的位置…';drawIronFrame(p*.84);markCloudProgress();if(p>=.965)finishManualIron();}
function markManualIron(x,y){if(!ironManual.active)return;const cv=$('ironCanvas'),last=ironManual.last||{x,y},distance=Math.hypot(x-last.x,y-last.y),steps=Math.max(1,Math.ceil(distance/11));
 for(let s=1;s<=steps;s++){const px=last.x+(x-last.x)*s/steps,py=last.y+(y-last.y)*s/steps,gx=Math.max(0,Math.min(IRON_MANUAL_GRID-1,Math.floor(px/cv.width*IRON_MANUAL_GRID))),gy=Math.max(0,Math.min(IRON_MANUAL_GRID-1,Math.floor(py/cv.height*IRON_MANUAL_GRID)));
  for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){const xx=gx+ox,yy=gy+oy;if(xx<0||yy<0||xx>=IRON_MANUAL_GRID||yy>=IRON_MANUAL_GRID)continue;const add=(ox===0&&oy===0) ? .34 : (ox===0||oy===0) ? .17 : .09,idx=yy*IRON_MANUAL_GRID+xx;ironManual.cells[idx]=Math.min(1,ironManual.cells[idx]+add);}}
 ironManual.last={x,y};ironManual.point={x,y};updateManualIronProgress();}
function manualIronPointer(e,phase){if(!ironManual.active)return;const cv=$('ironCanvas'),r=cv.getBoundingClientRect(),x=Math.max(0,Math.min(cv.width,(e.clientX-r.left)/r.width*cv.width)),y=Math.max(0,Math.min(cv.height,(e.clientY-r.top)/r.height*cv.height));
 if(phase==='down'){e.preventDefault();ironManual.down=true;ironManual.last=null;try{cv.setPointerCapture(e.pointerId);}catch(_e){}markManualIron(x,y);SFX.iron();}
 else if(phase==='move'&&ironManual.down){e.preventDefault();markManualIron(x,y);}else if(phase==='up'){ironManual.down=false;ironManual.last=null;}}
function beginManualIron(){++ironJobId;ironBusy=true;ironFinished=false;ironProgressValue=0;ironSteam=[];resetManualIron();ironManual.active=true;$('ironStart').disabled=true;$('ironStart').classList.add('hidden');$('hangBtn').classList.add('hidden');$('ironProgress').classList.remove('hidden');$('ironManualHint').classList.remove('hidden');$('ironCanvas').classList.add('manual-ironing');
 ['ironTechnique','ironLevel','ironSides','ironService'].forEach(k=>$(k).disabled=true);$('staffStatus').textContent='自助熨烫中：你正在亲手操作，NPC 不会代替完成。';$('ironProgressText').textContent='按住左侧作品，缓慢来回移动熨斗。';$('ironProgressBar').style.width='0%';$('ironManualPercent').textContent='0%';drawIronFrame(0);markCloudProgress();}
function finishManualIron(){if(!ironManual.active)return;const id=ironJobId;ironManual.active=false;ironManual.down=false;$('ironCanvas').classList.remove('manual-ironing');$('ironManualPercent').textContent='100%';$('ironProgressText').textContent='覆盖完成，正在平压冷却定型…';SFX.steam();const start=performance.now();
 markCloudProgress();const cool=now=>{if(id!==ironJobId)return;if(activeModal!=='iron'){ironAnimRaf=0;markCloudProgress();return;}const p=Math.min(1,(now-start)/1200);ironProgressValue=.965+p*.035;drawIronFrame(.85+p*.15);$('ironProgressBar').style.width=(96+p*4)+'%';if(p<1)ironAnimRaf=requestAnimationFrame(cool);else completeIronRun();};ironAnimRaf=requestAnimationFrame(cool);}
function startIron(resumeFrom=0){if(ironBusy)return;if(!current().some(Boolean)){toast('画板还没有拼豆，请先去工作台创作。');return;}if($('ironService').value==='self'){beginManualIron();return;}
 const id=++ironJobId;ironBusy=true;ironFinished=false;$('ironStart').disabled=true;$('hangBtn').classList.add('hidden');$('ironProgress').classList.remove('hidden');
 ['ironTechnique','ironLevel','ironSides','ironService'].forEach(k=>$(k).disabled=true);
 const technique=IRON_TECHNIQUES[$('ironTechnique').value],special={normal:'覆盖专用熨烫纸',towel:'铺好毛巾纹理层',crystal:'覆盖水晶亮面层',glitter:'均匀铺开细闪层'}[$('ironTechnique').value];
 const stages=[`工作人员小暖已接单：${technique.label}`,`小暖正在${special}…`,'小暖正在分区虚拟熨烫…','正在用玻璃板平压冷却…','代烫完成，请选择成品配件！'];
 $('staffStatus').textContent='NPC 代烫中：由小暖自动操作，你不需要移动熨斗。';
 const dur=stages.length*680;ironSteam=[];ironProgressValue=Math.max(0,Math.min(.98,Number(resumeFrom)||0));markCloudProgress();SFX.iron();const start=performance.now()-ironProgressValue*dur;setTimeout(()=>{if(id===ironJobId)SFX.steam();},dur*.28);
 const anim=now=>{if(id!==ironJobId)return;if(activeModal!=='iron'){ironAnimRaf=0;markCloudProgress();return;}const p=Math.min(1,(now-start)/dur);ironProgressValue=p;drawIronFrame(p);const st=Math.min(stages.length-1,Math.floor(p*stages.length));$('ironProgressText').textContent=stages[st];$('ironProgressBar').style.width=((st+1)/stages.length*100)+'%';if(p<1)ironAnimRaf=requestAnimationFrame(anim);else completeIronRun();};ironAnimRaf=requestAnimationFrame(anim);
}
function selectIronProduct(product){if(!PRODUCT_META[product])return;selectedIronProduct=product;document.querySelectorAll('#ironProductGrid [data-product]').forEach(b=>b.classList.toggle('on',b.dataset.product===product));if(ironFinished)drawIronFrame(1);markCloudProgress();SFX.ui();}
function takeFinishedProduct(){if(!ironFinished){toast('请先完成虚拟熨烫。');return;}if(!carriedBoard){toast('手里没有可制作成品的底板。');return;}if(carriedProduct){toast('手里已经拿着一件成品。');return;}activeTable=carriedBoard;const suggested=`${nickname}的拼豆作品`,name=($('ironName').value.trim()||suggested).slice(0,24),finishedCells=[...current()],finishedSize=board().size;
 carriedProduct={name,size:finishedSize,pixels:packCells(finishedCells),cells:finishedCells,level:$('ironLevel').value,technique:$('ironTechnique').value,mount:selectedIronProduct,sides:$('ironSides').value,by:$('ironService').value,author:nickname,date:new Date().toISOString()};
 board().cells=Array(finishedSize*finishedSize).fill(null);storeBoard();netSendBoard(true,activeTable);rebuildBoardRaster();updateCount();ironFinished=false;ironBusy=false;ironProgressValue=0;restoredIronState=null;carriedBoard=null;resetBoardCarryMotion();PH.boardOut=true;updateCarryBoardStatus();updateCarryProductStatus();updateStatic();closeModal();markCloudProgress();toast(`已拿起${PRODUCT_META[carriedProduct.mount].label}，可以亲自挂到任意墙面。`);player.target=null;player.route=[];pendingTable=null;pendingStation=false;pendingCoffee=false;
}
function wallPlayerU(surface){return surface.axis==='z'?player.x:player.z;}
function wallPlayerAxis(surface){return surface.axis==='z'?player.z:player.x;}
function wallSurfaceDistance(surface){const signed=(wallPlayerAxis(surface)-surface.plane)*surface.normal;if(signed<-.18)return Infinity;const u=wallPlayerU(surface),overflow=u<surface.minU?surface.minU-u:u>surface.maxU?u-surface.maxU:0;return Math.hypot(signed,overflow);}
function nearestWallSurface(){let best=null,dist=Infinity;for(const surface of WALL_SURFACES){const d=wallSurfaceDistance(surface);if(d<dist){dist=d;best=surface;}}return{surface:best,dist};}
function nearWallSurface(surface,max=4.2){return wallSurfaceDistance(surface)<=max;}
function walkToWallSurface(surface,u){u=galleryClamp(u,surface.minU,surface.maxU,(surface.minU+surface.maxU)/2);const p=surface.axis==='z'?{x:u,z:surface.plane+surface.normal*1.55}:{x:surface.plane+surface.normal*1.55,z:u},route=phRouteTo(p.x,p.z);player.target=route.length?route.shift():p;player.route=route;pendingTable=null;pendingStation=false;pendingBeadStation=false;pendingCoffee=false;}
function wallRayHit(ray){let best=null;for(const surface of WALL_SURFACES){const axis=surface.axis==='z'?2:0,denom=ray[axis];if(Math.abs(denom)<1e-6)continue;const cameraSide=(camPos[axis]-surface.plane)*surface.normal;if(cameraSide<-.08)continue;const t=(surface.plane-camPos[axis])/denom;if(t<=0||(best&&t>=best.t))continue;const u=surface.axis==='z'?camPos[0]+ray[0]*t:camPos[2]+ray[2]*t,y=camPos[1]+ray[1]*t;if(u<surface.minU||u>surface.maxU||y<surface.minY||y>surface.maxY)continue;best={surface,t,u,y};}return best;}
function galleryItemAtWallHit(hit){for(let i=gallery.length-1;i>=0;i--){const item=gallery[i];if(item.wallId!==hit.surface.id)continue;const shape=galleryWishShape(item);if(Math.abs(item.wallU-hit.u)<=shape.w/2&&Math.abs(item.wallY-hit.y)<=shape.h/2)return item;}return null;}
function takeGalleryItem(item){if(!item)return;if(carriedBoard){toast('双手正端着底板，不能再拿墙上的成品。');return;}if(heldDrink){toast('请先把饮料放到桌上或喝完，再取墙上的成品。');return;}if(carriedProduct){toast('手里已经拿着一件成品，请先挂好。');return;}const surface=wallSurface(item.wallId);if(!nearWallSurface(surface)){walkToWallSurface(surface,item.wallU);toast(`正在靠近${surface.label}，走近后再点击作品取下。`);return;}const removed=removeGalleryItem(item.id);if(!removed)return;const {wallId,wallU,wallX,wallY,wallOrder,...product}=removed;carriedProduct={...product,id:removed.id,cells:unpackCells(removed.pixels,removed.size)||[]};netSend({t:'gallery:remove',id:NET.id,itemId:removed.id,state:cloudPlayerSnapshot()});updateCarryProductStatus();markCloudProgress();SFX.ui();toast(`已从${surface.label}取下${PRODUCT_META[removed.mount]?.label||'拼豆成品'}，可以拿到任意墙面重新挂上。`);}
function hangCarriedProductAt(surfaceId='north',wallU=player.x,wallY=3.55){if(!carriedProduct){toast('手里没有可以挂上的成品。');return;}const surface=wallSurface(surfaceId);if(!nearWallSurface(surface)){walkToWallSurface(surface,wallU);toast(`正在靠近${surface.label}，走近后再点击想挂的位置。`);return;}
 const {cells,...finished}=carriedProduct,now=Date.now(),id=String(finished.id||`${NET.id}-${now.toString(36)}-${Math.random().toString(36).slice(2,8)}`).slice(0,96);
 const item=normalizeGalleryItem({...finished,id,wallId:surface.id,wallU,wallY,wallOrder:now+Math.random()},gallery.length);
 if(!item){toast('这件成品的数据不完整，暂时无法挂上。');return;}
 putGalleryItems([item]);const persisted=storeGallery(),label=PRODUCT_META[item.mount]?.label||'拼豆成品';carriedProduct=null;netSend({t:'gallery:put',id:NET.id,item,state:cloudPlayerSnapshot()});updateCarryProductStatus();updateStatic();updateGalleryInfo();markCloudProgress();SFX.chime();toast(persisted?`你把${label}挂到了${surface.label}；位置已保存到云端。`:`${label}已经挂上；浏览器禁止本地存储，刷新后可能丢失。`);
}
function hangCarriedProduct(){const nearest=nearestWallSurface();if(!nearest.surface||nearest.dist>4.2){toast('请先走近任意一面墙。');return;}hangCarriedProductAt(nearest.surface.id,wallPlayerU(nearest.surface),3.55);}
function updateGalleryInfo(){$('galleryCount').textContent=`所有墙面目前共保留 ${gallery.length} 件作品 · 点击作品可取下，再换位置挂上。`;}

// Physical station: 24 individually-labelled sliding drawers, finite supplies,
// scoops that fill a portable divided tray, and three placing tools.
function buildBins(){
 const root=$('binGrid');root.textContent='';const source=sourceStock();
 for(const item of swatches){
  const btn=document.createElement('button');btn.type='button';btn.className='bin-button';btn.dataset.bin=item.id;
  btn.dataset.finish=item.finish;
  const lid=document.createElement('span');lid.className='lid';lid.style.backgroundColor=item.hex;
  const code=document.createElement('b');code.textContent=item.id;
  const label=document.createElement('small');label.textContent=item.name;
  const ft=FINISH_META[item.finish]?.tag;
  const stock=document.createElement('small');stock.className='stock';stock.textContent=`盒内 ${(source[item.id]||0).toLocaleString('zh-CN')} 颗`;
  btn.append(lid,code,label,stock);if(ft){const badge=document.createElement('em');badge.className='finish-badge';badge.textContent=ft;lid.appendChild(badge);}btn.title=`${item.id} ${item.name}${ft?' · '+FINISH_META[item.finish].label:''}，点击拉开抽屉`;
  btn.onclick=()=>{pickedBin=item.id;drawerOpened=true;renderPickup();updateStatic();toast(`${item.id} · ${item.name}`);};root.appendChild(btn);
 }
}
function renderPickup(){
 const source=sourceStock(),item=swatches.find(s=>s.id===pickedBin)||swatches[0],count=source[item.id]||0;
 $('pickupTitle').textContent=pickupAt==='table'?`${pickupTable} 桌 · 取豆`:'取豆';
 $('pickupSubtitle').textContent=pickupAt==='table'?`你坐在 ${pickupTable} 号桌旁，打开桌面的透明分类豆盒，取豆后直接继续拼。不必来回走动。`:`店内整面 ${swatches.length} 色豆墙（含果冻/夜光/珠光/闪粉），取豆、领取工具，带回任意工作台。`;
 $('pickupRackLabel').firstChild.textContent=pickupAt==='table'?`桌面便携分类盒 `:`实体大豆墙 · ${swatches.length} 色透明抽屉 `;
 $('returnDeskBtn').textContent=pickupAt==='table'?'继续拼豆 →':'返回工作室 →';
 $('pickedBinColor').style.backgroundColor=item.hex;
 $('pickedBinName').textContent=`${item.id} · ${item.name}`;
 $('pickedBinCaption').textContent=`${drawerOpened?'抽屉已拉开':'抽屉未打开'} · 豆盒剩余 ${count.toLocaleString('zh-CN')} 颗（试玩库存） · 单色托盘 ${tray[item.id]||0} 颗`;
 $('drawerVisual').style.setProperty('--drawer-color',item.hex);
 $('drawerVisual').classList.toggle('open',drawerOpened);
 $('drawerLabel').textContent=item.id;
 $('drawerStatus').textContent=drawerOpened?'透明抽屉已拉开，可使用取豆器':'抽屉关闭，先点击拉开';
 $('drawerToggle').textContent=drawerOpened?'推回抽屉':'拉开抽屉';
 const beads=$('drawerBeads');beads.textContent='';
 for(let i=0;i<(count?16:0);i++){const el=document.createElement('i');el.style.setProperty('--bead',item.hex);beads.appendChild(el);}
 document.querySelectorAll('.bin-button').forEach(b=>{
  b.classList.toggle('active',b.dataset.bin===pickedBin);
  const label=b.querySelector('small.stock');if(label)label.textContent=`盒内 ${(source[b.dataset.bin]||0).toLocaleString('zh-CN')} 颗`;
 });
 document.querySelectorAll('[data-take]').forEach(b=>b.disabled=!drawerOpened||count<1||trayTotal()>=TRAY_MAX);
 document.querySelectorAll('[data-pick-tool]').forEach(b=>b.classList.toggle('selected',b.dataset.pickTool===pickupTool));
 $('basketReadout').textContent=`随身托盘：${trayTotal().toLocaleString('zh-CN')} / ${TRAY_MAX.toLocaleString('zh-CN')} 颗 · 已领取 ${toolLabels[pickupTool]}`;
 const chips=$('trayChips');chips.textContent='';
 const stored=swatches.filter(s=>tray[s.id]>0);
 for(const s of stored){const chip=document.createElement('span');chip.className='tray-chip';const col=document.createElement('i');col.style.background=s.hex;const txt=document.createElement('span');txt.textContent=`${s.id} ×${tray[s.id]}`;chip.append(col,txt);chips.appendChild(chip);}
 if(!stored.length)chips.textContent='托盘是空的，需要先取豆。';
 const compartments=$('compartmentTray');compartments.textContent='';
 for(let i=0;i<6;i++){
  const s=stored[i],slot=document.createElement('div');slot.className='tray-comp'+(s?'':' empty');
  if(s){for(let j=0;j<Math.min(14,Math.max(1,Math.round(Math.sqrt(tray[s.id])*1.4)));j++){const bead=document.createElement('i');bead.style.setProperty('--bead',s.hex);slot.appendChild(bead);}
  const cap=document.createElement('b');cap.textContent=`${s.id} ×${tray[s.id]}`;slot.appendChild(cap);}
  compartments.appendChild(slot);
 }
 $('returnBeadsBtn').disabled=!(tray[item.id]>0);
 updatePaletteQuantity();
}
function openBeadStation(){if(activeModal)closeModal();pickupAt='wall';pickupReturn='studio';drawerOpened=false;openModal('pickup');renderPickup();}
function toggleDrawer(){drawerOpened=!drawerOpened;renderPickup();if(pickupAt==='wall')updateStatic();SFX.drawer();}
function takeBeads(amount){
 if(!drawerOpened){toast('先点击标有色号的透明豆盒，把抽屉拉开。');return;}
 const stock=sourceStock();const available=Math.min(stock[pickedBin]||0,TRAY_MAX-trayTotal(),BIN_MAX-(tray[pickedBin]||0));
 const moved=Math.min(amount,Math.max(0,available));
 if(!moved){toast('托盘已经装满，或这个颜色豆盒已空。');return;}
 tray[pickedBin]=(tray[pickedBin]||0)+moved;
 stock[pickedBin]-=moved;
 paintColor=pickedBin;
 persistTray();persistSourceStock();if(PH.active)phComputeTableColors();renderPickup();selectColor(paintColor);updateCount();
 const sw=swatches.find(s=>s.id===pickedBin),fb=$('takeFeedback');
 if(fb){fb.innerHTML=`<b>+${moved}</b> 颗 · ${pickedBin} ${sw?sw.name:''} · 该色托盘已有 <b>${(tray[pickedBin]||0).toLocaleString('zh-CN')}</b> 颗`;fb.classList.remove('pop');void fb.offsetWidth;fb.classList.add('pop');}
 SFX.pour();toast(`${pickedBin} +${moved}`);
}
function returnBeads(){if(!drawerOpened){toast('请先打开要退豆的抽屉。');return;}
 const stock=sourceStock(),stockCap=pickupAt==='table'?500:RACK_STOCK_MAX;const count=Math.min(tray[pickedBin]||0,stockCap-stock[pickedBin]);
 if(!count)return;
 tray[pickedBin]-=count;stock[pickedBin]+=count;
 persistTray();persistSourceStock();renderPickup();updateCount();toast(`${count} 颗 ${pickedBin} 已从托盘退回对应豆盒。`);
}
function equipTool(name){if(!toolLabels[name])return;pickupTool=name;persistTray();renderPickup();updateCount();toast(toolLabels[name]);}
function goBackToDesk(){closeModal();drawerOpened=false;updateStatic();if(pickupReturn==='editor')openEditor(activeTable);else if(pickupReturn==='pattern')openPatternPicker(activeTable);else approach(positions.find(t=>t.id===activeTable)||positions[0]);}

function renderCursor(e){
 const ghost=$('cursorGhost');if(!ghost)return;
 if(!e||!$('editor')||$('editor').classList.contains('hidden')||tool==='pan'){ghost.style.display='none';return;}
 const rect=$('beadCanvas').getBoundingClientRect(),i=pointerIndex(e);
 if(i<0||e.clientX<rect.left||e.clientY<rect.top){ghost.style.display='none';return;}
 ghost.style.display='flex';const host=document.querySelector('.board-surface').getBoundingClientRect();ghost.style.left=(e.clientX-host.left+12)+'px';ghost.style.top=(e.clientY-host.top-25)+'px';
 ghost.style.backgroundColor=colorLookup[paintColor];
 ghost.title=`${toolLabels[pickupTool]} · ${paintColor} 托盘 ${tray[paintColor]||0} 颗`;
}
function wire(){
 $('wallBtn').onclick=goGallery;
 $('ironStationBtn').onclick=goIronStation;
 $('coffeeStationBtn').onclick=goCoffeeStation;
 $('coffeeClose').onclick=()=>{if(coffeeRaf)cancelAnimationFrame(coffeeRaf);coffeeRaf=0;coffeeBusy=false;markCloudProgress();closeModal();};
 $('coffeeBrewBtn').onclick=brewCoffee;$('coffeeTakeBtn').onclick=takeCoffee;
 $('heldDrink').onclick=sipCoffee;$('carryCupHit').onclick=sipCoffee;
 const coffeeCanvas=$('coffeeCanvas'),useCoffeeEquipment=()=>{if(activeModal==='coffee'&&coffeeMode==='self'&&!coffeeBusy&&!coffeeMade)brewCoffee();};
 coffeeCanvas.addEventListener('click',useCoffeeEquipment);coffeeCanvas.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();useCoffeeEquipment();}});
 document.querySelectorAll('#coffeeAddins [data-addin]').forEach(b=>b.onclick=()=>{coffeeOpt[b.dataset.addin]=!coffeeOpt[b.dataset.addin];syncCoffeeControls();resetBrewUI();drawCoffeeScene(0,false);markCloudProgress();SFX.ui();});
 document.querySelectorAll('#coffeeSizes [data-size]').forEach(b=>b.onclick=()=>{coffeeOpt.size=b.dataset.size;syncCoffeeControls();resetBrewUI();drawCoffeeScene(0,false);markCloudProgress();SFX.ui();});
 document.querySelectorAll('#coffeeMode [data-mode]').forEach(b=>b.onclick=()=>{coffeeMode=b.dataset.mode;if(coffeeMode==='ready'){coffeeOpt={milk:false,sugar:false,ice:!drinkById(chosenDrink).hot,whip:false,size:'M'};}syncCoffeeControls();resetBrewUI();drawCoffeeScene(0,false);markCloudProgress();SFX.ui();});
 $('beadStationBtn').onclick=()=>goBeadStation();
 $('restockBtn').onclick=openTablePickup;
 $('restockWallBtn').onclick=()=>goBeadStation();
 $('returnDeskBtn').onclick=goBackToDesk;
 $('patternClose').onclick=closeModal;
 $('patternBlank').onclick=chooseBlank;
 $('patternContinue').onclick=()=>openEditor(activeTable);
 $('patternFile').onchange=e=>uploadReference(e.target.files?.[0]);
 $('changeReference').onclick=()=>openPatternPicker(activeTable);
 $('referenceLarge').onclick=()=>{const ref=referenceByTable[activeTable];if(!ref){openPatternPicker(activeTable);return;}const image=$('referenceImage');const pop=window.open('', '_blank');if(pop){pop.document.write('<!doctype html><title>拼豆参考图</title><style>body{margin:0;background:#e7d5c0;min-height:100vh;display:grid;place-items:center}img{max-width:92vw;max-height:92vh;image-rendering:pixelated;box-shadow:0 20px 65px #0002;background:white}</style><img alt="拼豆参考图" src="'+image.src+'">');pop.document.close();}else toast('浏览器拦截了新窗口，请允许打开参考图片。');};
 $('overlayRef').onchange=e=>{referenceVisible=e.target.checked;drawViewport();};
 $('refAlpha').oninput=drawViewport;
 $('drawerToggle').onclick=toggleDrawer;
 $('returnBeadsBtn').onclick=returnBeads;
 document.querySelectorAll('[data-take]').forEach(b=>b.onclick=()=>takeBeads(Number(b.dataset.take)));
 document.querySelectorAll('[data-pick-tool]').forEach(b=>b.onclick=()=>equipTool(b.dataset.pickTool));
 $('infoOkay').onclick=closeModal;$('infoClose').onclick=closeModal;
 $('editorClose').onclick=closeModal;$('pickupClose').onclick=closeModal;$('ironClose').onclick=closeModal;
 $('helpBtn').onclick=()=>openModal('help');$('helpClose').onclick=closeModal;$('helpOkay').onclick=closeModal;
 $('nameBtn').onclick=()=>{$('nameInput').value=nickname;openModal('nameModal');};
 $('nameClose').onclick=closeModal;
 $('nameSave').onclick=()=>{const value=$('nameInput').value.trim();if(!value){toast('请输入昵称。');return;}nickname=value.slice(0,16);saveNick();$('displayName').textContent=nickname;closeModal();toast(`欢迎，${nickname}`);};
 $('modalBack').onclick=closeModal;
 $('boardSize').onchange=e=>resizeBoard(Number(e.target.value));
 $('zoomIn').onclick=()=>setZoom(zoom*1.5);$('zoomOut').onclick=()=>setZoom(zoom/1.5);
 $('fitBtn').onclick=()=>{panX=panY=0;setZoom(1);};
 $('undoBtn').onclick=()=>history('undo');$('redoBtn').onclick=()=>history('redo');
 $('saveBtn').onclick=()=>{storeBoard();persistTray();toast('作品留在桌上（除非有人清空）。想长期保存请熨烫后挂到展示墙。');};
 $('clearBtn').onclick=askClear;$('exportBtn').onclick=exportPng;
 $('ironBtn').onclick=carryBoardForIron;
 $('ironTechnique').onchange=()=>{drawIronPreview();markCloudProgress();};$('ironLevel').onchange=()=>{drawIronPreview();markCloudProgress();};$('ironSides').onchange=()=>{drawIronPreview();markCloudProgress();};
 $('ironService').onchange=()=>{syncIronServiceUI();markCloudProgress();};$('ironName').oninput=markCloudProgress;
 $('ironStart').onclick=startIron;$('hangBtn').onclick=takeFinishedProduct;
 document.querySelectorAll('#ironProductGrid [data-product]').forEach(b=>b.onclick=()=>selectIronProduct(b.dataset.product));
 const ironCv=$('ironCanvas');ironCv.addEventListener('pointerdown',e=>manualIronPointer(e,'down'));ironCv.addEventListener('pointermove',e=>manualIronPointer(e,'move'));
 for(const evt of ['pointerup','pointercancel','lostpointercapture'])ironCv.addEventListener(evt,e=>manualIronPointer(e,'up'));
 document.querySelectorAll('.tool[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
 const cv=$('beadCanvas');
 const boardWrap=document.querySelector('.board-surface');
 if(!boardWrap.querySelector('#cursorGhost')){const ghost=document.createElement('span');ghost.id='cursorGhost';ghost.className='cursor-ghost';ghost.setAttribute('aria-hidden','true');boardWrap.appendChild(ghost);}
 cv.addEventListener('contextmenu',e=>e.preventDefault());
 cv.addEventListener('pointerdown',e=>{e.preventDefault();beginStroke(e);renderCursor(e);});
 cv.addEventListener('pointermove',e=>{renderCursor(e);moveStroke(e);});
 cv.addEventListener('pointerup',endStroke);cv.addEventListener('pointercancel',endStroke);cv.addEventListener('lostpointercapture',endStroke);
 cv.addEventListener('pointerleave',()=>{$('cursorGhost').style.display='none';});
 cv.addEventListener('wheel',e=>{e.preventDefault();setZoom(zoom*(e.deltaY>0?.83:1.2));},{passive:false});
 window.addEventListener('keydown',e=>{
  if(e.key==='Escape'){if(PH.picker){phCloseAlbum();return;}if(PH.active||PH.wall){phStand();return;}closeModal();return;}
  const k=e.key.toLowerCase();
  if((e.ctrlKey||e.metaKey)&&(k==='z'||k==='y')){if(activeModal==='editor'){e.preventDefault();history((k==='y'||e.shiftKey)?'redo':'undo');}return;}
  if(activeModal)return;
  if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','e'].includes(k))e.preventDefault();
  const normalized={arrowup:'w',arrowdown:'s',arrowleft:'a',arrowright:'d'}[k]||k;
  if(['w','a','s','d'].includes(normalized))input[normalized]=true;
  if(k==='e'){
   if(PH.active||PH.wall){phStand();return;}
   const rackDist=Math.hypot(player.x+12,player.z-15.9),ironDist=Math.hypot(player.x-11.9,player.z-17.1),near=nearestDesk(),nearWall=nearestWallSurface();
   if(rackDist<5){if(carriedProduct)toast('先把手里的成品挂到展示墙，再去取豆。');else phWallEnter();}else if(ironDist<4)phAutoIron();else if(Math.hypot(player.x-COFFEE_POS.x,player.z-COFFEE_POS.z)<4.5)takeCoffee();else if(near.dist<3)approach(near.t);
   else if(nearWall.surface&&nearWall.dist<4.2){if(carriedProduct)hangCarriedProductAt(nearWall.surface.id,wallPlayerU(nearWall.surface),3.55);else toast('点击墙上的作品可以取下；拿着成品点击空位可以挂上。');}
  }
 });
 window.addEventListener('keyup',e=>{const k=e.key.toLowerCase(),normalized={arrowup:'w',arrowdown:'s',arrowleft:'a',arrowright:'d'}[k]||k;if(['w','a','s','d'].includes(normalized))input[normalized]=false;});
 window.addEventListener('blur',()=>{for(const key in input)input[key]=false;});
 document.querySelectorAll('[data-dir]').forEach(b=>{
  const keys={forward:'w',back:'s',left:'a',right:'d'},k=keys[b.dataset.dir];
  b.addEventListener('pointerdown',e=>{e.preventDefault();input[k]=true;b.setPointerCapture(e.pointerId);});
  for(const n of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(n,()=>input[k]=false);
 });
 // One translucent mobile thumb-stick replaces the four persistent arrow keys.
 const joy=$('touchJoystick'),thumb=$('joystickThumb');
 if(joy&&thumb){let pointerId=null;
  const applyJoy=e=>{const r=joy.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
   const dx=e.clientX-cx,dy=e.clientY-cy,d=Math.hypot(dx,dy),scale=d>30?30/d:1,x=dx*scale,y=dy*scale;
   thumb.style.transform=`translate(${x}px,${y}px)`;
   input.w=y < -8;input.s=y > 8;input.a=x < -8;input.d=x > 8;
  };
  const reset=()=>{pointerId=null;thumb.style.transform='translate(0,0)';for(const k of ['w','a','s','d'])input[k]=false;};
  joy.addEventListener('pointerdown',e=>{if(activeModal)return;e.preventDefault();pointerId=e.pointerId;joy.setPointerCapture(e.pointerId);applyJoy(e);$('microHint')?.classList.add('hint-gone');});
  joy.addEventListener('pointermove',e=>{if(pointerId!==e.pointerId)return;e.preventDefault();applyJoy(e);});
 for(const evt of ['pointerup','pointercancel','lostpointercapture'])joy.addEventListener(evt,reset);
 }
 // Always-visible phone controls: they work while roaming, seated at a table, or viewing the bead wall.
 for(const [id,amount] of [['mobileZoomIn',1],['mobileZoomOut',-1]]){const b=$(id);if(!b)continue;let repeat=0,delay=0;
  const stop=()=>{clearTimeout(delay);clearInterval(repeat);delay=repeat=0;};
  b.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();adjustViewZoom(amount);try{b.setPointerCapture(e.pointerId);}catch(_e){}delay=setTimeout(()=>{repeat=setInterval(()=>adjustViewZoom(amount),95);},320);});
  for(const evt of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(evt,stop);
 }
 let pointer=null,scenePinch=null,seatTouchPending=null;
 const sceneTouchPoints=new Map(),scenePinchIds=new Set();
 const clearSeatTouchPending=()=>{if(seatTouchPending){clearTimeout(seatTouchPending.timer);seatTouchPending=null;}};
 const beginScenePinch=()=>{const points=[...sceneTouchPoints.entries()].slice(0,2);if(points.length<2)return;const a=points[0][1],b=points[1][1],distance=Math.max(12,Math.hypot(a.x-b.x,a.y-b.y));
  clearSeatTouchPending();pointer=null;PH.pointer=null;if(PH.active)PH.viewAuto=false;scene.classList.remove('dragging');for(const [id] of points)scenePinchIds.add(id);
  const mode=PH.active?'seat':firstPerson&&!PH.wall?'fov':'distance',value=mode==='seat'?PH.cameraDistance:mode==='fov'?camera.fovTarget:camera.dTarget;scenePinch={distance,mode,value};};
 const moveScenePinch=()=>{if(!scenePinch)return;const points=[...scenePinchIds].map(id=>sceneTouchPoints.get(id)).filter(Boolean).slice(0,2);if(points.length<2)return;const distance=Math.max(12,Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y)),ratio=Math.max(.35,Math.min(3,distance/scenePinch.distance)),next=scenePinch.value/ratio;
  if(scenePinch.mode==='seat')PH.cameraDistance=Math.max(1,Math.min(11,next));else if(scenePinch.mode==='fov')camera.fov=camera.fovTarget=Math.max(.52,Math.min(1.35,next));else{const min=PH.wall?5.2:16,max=PH.wall?18:53;camera.dTarget=Math.max(min,Math.min(max,next));}};
 const releaseSceneTouch=e=>{if(e.pointerType==='touch')sceneTouchPoints.delete(e.pointerId);if(!scenePinchIds.has(e.pointerId))return false;scenePinchIds.delete(e.pointerId);if(sceneTouchPoints.size<2)scenePinch=null;pointer=null;PH.pointer=null;scene.classList.remove('dragging');return true;};
 scene.addEventListener('pointerdown',e=>{if(activeModal||PH.picker)return;
  if(e.pointerType==='touch'){e.preventDefault();sceneTouchPoints.set(e.pointerId,{x:e.clientX,y:e.clientY});try{scene.setPointerCapture(e.pointerId);}catch(_e){}if(sceneTouchPoints.size>=2){beginScenePinch();return;}}
  if(PH.wall){e.preventDefault();return;}
  if(PH.active){e.preventDefault();const r=scene.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top;if(e.pointerType==='touch'){const start={pointerId:e.pointerId,px,py};seatTouchPending={...start,timer:setTimeout(()=>{if(seatTouchPending?.pointerId!==start.pointerId||scenePinch)return;seatTouchPending=null;phBeginPointer(start,start.px,start.py);},110)};}else{scene.setPointerCapture(e.pointerId);phBeginPointer(e,px,py);}return;}$('microHint')?.classList.add('hint-gone');pointer={x:e.clientX,y:e.clientY,angle:camera.aTarget,pitch:camera.pTarget,fpLook:camera.fpLookT,id:e.pointerId,dragged:false};scene.setPointerCapture(e.pointerId);});
 scene.addEventListener('pointermove',e=>{
 if(e.pointerType==='touch'&&sceneTouchPoints.has(e.pointerId)){sceneTouchPoints.set(e.pointerId,{x:e.clientX,y:e.clientY});if(scenePinch){e.preventDefault();moveScenePinch();return;}}
 if(PH.wall)return;
 if(PH.active){if(!PH.picker){const r=scene.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top;if(seatTouchPending?.pointerId===e.pointerId&&Math.hypot(px-seatTouchPending.px,py-seatTouchPending.py)>4){const start=seatTouchPending;clearSeatTouchPending();phBeginPointer(start,start.px,start.py);}phMovePointer(e,px,py);}return;}
 const rect=scene.getBoundingClientRect();hoverScene={x:e.clientX-rect.left,y:e.clientY-rect.top};if(!pointer||pointer.id!==e.pointerId)return;const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;
  if(Math.hypot(dx,dy)>7)pointer.dragged=true;
  if(pointer.dragged){
    if(firstPerson){camera.aTarget=pointer.angle+dx*.006;camera.fpLookT=Math.max(-.95,Math.min(.55,pointer.fpLook-dy*.004));} // drag to look around
    else{camera.aTarget=pointer.angle+dx*.005;camera.pTarget=Math.max(.28,Math.min(1.25,pointer.pitch+dy*.004));}
    scene.classList.add('dragging');}
 });
 scene.addEventListener('pointerup',e=>{
 if(releaseSceneTouch(e)){clearSeatTouchPending();return;}
 if(PH.wall){const r=scene.getBoundingClientRect();phWallTap(e.clientX-r.left,e.clientY-r.top);return;}
 if(PH.active){if(!PH.picker){const r=scene.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top;if(seatTouchPending?.pointerId===e.pointerId){const start=seatTouchPending;clearSeatTouchPending();phBeginPointer(start,start.px,start.py);}phEndPointer(px,py);}return;}
 if(!pointer)return;const dragged=pointer.dragged;pointer=null;scene.classList.remove('dragging');if(dragged||activeModal)return;
  const rect=scene.getBoundingClientRect(),px=e.clientX-rect.left,py=e.clientY-rect.top;
  // Cast the tap ray against furniture and every interactive wall surface.
  const ray=screenRay(px,py);
  let hitTable=null,hitTableT=1e9;
  for(const t of positions){const tt=rayAABB(camPos,ray,[t.x-1.55,0,t.z-1.3],[t.x+1.55,1.5,t.z+1.3]);if(tt!=null&&tt<hitTableT){hitTableT=tt;hitTable=t;}}
  const stations=[{mn:[10.9,0,-14.6],mx:[16.5,2.0,-6.6],go:goCoffeeStation},   // café counter, machines & barista
                  {mn:[10.4,0,15.6],mx:[16.0,1.6,18.6],go:goIronStation},       // ironing table
                  {mn:[-16.7,0,18.7],mx:[-7.2,4.2,20.4],go:goBeadStation}];      // bead wall
  let hitStation=null,hitStationT=1e9;
  for(const s of stations){const tt=rayAABB(camPos,ray,s.mn,s.mx);if(tt!=null&&tt<hitStationT){hitStationT=tt;hitStation=s;}}
  const wallHit=wallRayHit(ray),wallDistance=wallHit?wallHit.t:1e9;
  if(hitTable&&hitTableT<=hitStationT&&hitTableT<=wallDistance){approach(hitTable);return;}
  if(hitStation&&hitStationT<=wallDistance){hitStation.go();return;}
  if(wallHit){
   if(carriedProduct)hangCarriedProductAt(wallHit.surface.id,wallHit.u,wallHit.y);
   else{const item=galleryItemAtWallHit(wallHit);if(item)takeGalleryItem(item);else if(!nearWallSurface(wallHit.surface)){walkToWallSurface(wallHit.surface,wallHit.u);toast(`正在靠近${wallHit.surface.label}。`);}else toast('这里可以挂作品；空手点击已有作品可以取下。');}
   return;
  }
  const world=groundAt(px,py);
  if(world){player.target={x:Math.max(ROOM.minX,Math.min(ROOM.maxX,world[0])),z:Math.max(ROOM.minZ,Math.min(ROOM.maxZ,world[2]))};pendingTable=null;pendingBeadStation=false;pendingStation=false;pendingCoffee=false;}
 });
 scene.addEventListener('pointercancel',e=>{releaseSceneTouch(e);clearSeatTouchPending();pointer=null;PH.pointer=null;scene.classList.remove('dragging');});scene.addEventListener('pointerleave',()=>hoverScene={x:-999,y:-999});
 scene.addEventListener('wheel',e=>{e.preventDefault();adjustViewZoom(e.deltaY<0?1:-1);},{passive:false});
}
// Perspective canvas fallback: no WebGL required for exploring the larger studio.
function shade(hex,factor){const v=parseInt(hex.slice(1),16);return '#'+[16,8,0].map(s=>Math.min(255,Math.max(0,Math.round(((v>>s)&255)*factor))).toString(16).padStart(2,'0')).join('');}
function drawFallback(){
 if(!ctx2d)return;
 const c=ctx2d,s=renderScale,w=layout.width,h=layout.height;
 c.setTransform(s,0,0,s,0,0);c.clearRect(0,0,w,h);
 const grad=c.createLinearGradient(0,0,w,h);grad.addColorStop(0,'#fcf6ec');grad.addColorStop(1,'#e9dac8');c.fillStyle=grad;c.fillRect(0,0,w,h);
 const polygon=(pts,color)=>{const ps=pts.map(worldToScreen);if(ps.some(p=>!p))return;c.beginPath();ps.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fillStyle=color;c.fill();};
 const box=(x,y,z,wd,ht,dp,color)=>{const L=x-wd/2,R=x+wd/2,B=y-ht/2,T=y+ht/2,N=z-dp/2,F=z+dp/2;
  polygon([[L,B,F],[R,B,F],[R,T,F],[L,T,F]],color);
  polygon([[R,B,F],[R,B,N],[R,T,N],[R,T,F]],shade(color,.86));
  polygon([[L,T,N],[L,T,F],[R,T,F],[R,T,N]],shade(color,1.08));
 };
 const circle=(pos,r,color)=>{const point=worldToScreen(pos),other=worldToScreen([pos[0]+r,pos[1],pos[2]]);if(!point||!other)return;const rad=Math.max(.8,Math.hypot(point.x-other.x,point.y-other.y));c.fillStyle=color;c.beginPath();c.arc(point.x,point.y,rad,0,Math.PI*2);c.fill();};
 polygon([[-17,0,-19.7],[17,0,-19.7],[17,0,21],[-17,0,21]],'#ddc2a1');
 for(let x=-16.5;x<17;x+=1.12)box(x,-.03,1,1,.045,41.2,Math.floor(x)%2?'#e8cfaf':'#e3c5a0');
 polygon([[-17,0,-19.7],[17,0,-19.7],[17,6.7,-19.7],[-17,6.7,-19.7]],'#f3e5d4');
 polygon([[-17,0,-19.7],[-17,0,21],[-17,6.7,21],[-17,6.7,-19.7]],'#eddbc6');
 const wallWorks=galleryArtworks();
 // Warm wainscoting and not-too-regular handmade display wall.
 box(0,1.04,-19.36,34.1,2.03,.09,'#dfc5a7');
 const fallbackArt=(work,x,y,z,w,h,finish,side)=>{
  const step=Math.min(w,h)/side;
  for(let row=0;row<side;row++)for(let col=0;col<side;col++){
    const id=sampledColor(work,col,row,side);if(!id)continue;
    const xx=x+(col-(side-1)/2)*step,yy=y+((side-1)/2-row)*step;
    const inset=finish==='flat'?0:.028;
    polygon([[xx-step/2+inset,yy-step/2+inset,z],[xx+step/2-inset,yy-step/2+inset,z],
      [xx+step/2-inset,yy+step/2-inset,z],[xx-step/2+inset,yy+step/2-inset,z]],colorLookup[id]);
    if(finish==='towel'&&(row+col)%7===0)circle([xx,yy,z+.014],step*.21,'#fff4db');
  }
 };
 const fallbackWallBox=(surface,u,y,out,w,h,depth,color)=>{if(surface.axis==='z')box(u,y,surface.plane+surface.normal*(out+depth/2),w,h,depth,color);else box(surface.plane+surface.normal*(out+depth/2),y,u,depth,h,w,color);};
 const fallbackWallArt=(work,surface,u,y,out,w,h,finish,side)=>{const step=Math.min(w,h)/side,plane=surface.plane+surface.normal*out,inset=finish==='flat'?0:.028;
  for(let row=0;row<side;row++)for(let col=0;col<side;col++){const id=sampledColor(work,col,row,side);if(!id)continue;const uu=u+(col-(side-1)/2)*step,yy=y+((side-1)/2-row)*step;
   if(surface.axis==='z')polygon([[uu-step/2+inset,yy-step/2+inset,plane],[uu+step/2-inset,yy-step/2+inset,plane],[uu+step/2-inset,yy+step/2-inset,plane],[uu-step/2+inset,yy+step/2-inset,plane]],colorLookup[id]);
   else polygon([[plane,yy-step/2+inset,uu-step/2+inset],[plane,yy-step/2+inset,uu+step/2-inset],[plane,yy+step/2-inset,uu+step/2-inset],[plane,yy+step/2-inset,uu-step/2+inset]],colorLookup[id]);
  }};
 [
  [-13.1,4.02,4.44,4.42,'#967456','standard'],
  [-8.25,3.67,3.95,4.13,'#ad9174','glitter'],
  [-3.62,4.0,4.14,4.30,'#a57f68','towel']
 ].forEach(([x,y,w,h,color,finish],k)=>{
  box(x,y,-19.27,w,h,.18,color);box(x,y,-19.11,w-.28,h-.28,.08,'#fff6e9');
  fallbackArt(wallWorks[k],x,y,-18.99,w-.75,h-.70,finish,18);
  box(x,y+h/2+.34,-18.93,.83,.11,.38,'#9e846c');
 });
 box(2.2,3.58,-19.24,5.8,4.7,.19,'#a78362');box(2.2,3.58,-19.09,5.45,4.35,.10,'#cba785');
 for(let row=0;row<3;row++)for(let col=0;col<4;col++){
  const x=.27+col*1.27,y=5.12-row*1.30+((col+row)%2)*.08;
  circle([x,y+.25,-18.92],.063,'#ebe1cd');
  box(x,y+.12,-18.91,.022,.31,.020,'#85735e');
  fallbackArt(wallWorks[(col+row+2)%5],x,y-.38,-18.86,.88,.88,'standard',9);
 }
 box(8.2,3.6,-19.20,4.70,4.55,.18,'#8da29f');box(8.2,3.6,-19.07,4.45,4.3,.04,'#e4ede7');
 for(let row=0;row<2;row++)for(let col=0;col<3;col++){
  const x=6.90+col*1.29,y=4.53-row*1.78+(col%2)*.14;
  box(x,y,-18.99,1.12,1.20,.04,'#f5ead8');
  fallbackArt(wallWorks[(row*3+col)%5],x,y,-18.93,.98,1.03,row===0?'standard':'flat',11);
 }
 for(let k=0;k<3;k++){
  const y=2.45+k*1.47;box(13.25,y,-19.08,4.80,.17,.50,'#956f51');
  for(let col=0;col<3;col++){
   const x=11.97+col*1.23;
   box(x,y+.18,-18.87,.95,.21,.32,'#dac4a4');
   fallbackArt(wallWorks[(k+col+1)%5],x,y+.63,-18.82,.86,.85,'standard',10);
  }
 }
 galleryWishItems().forEach((item,index)=>{
  const surface=wallSurface(item.wallId),shape=galleryWishShape(item),u=item.wallU,y=item.wallY,out=surface.displayOffset+Math.min(index,1000)*.001,style=item.technique==='normal'?(item.level==='flat'?'flat':'standard'):item.technique;
  fallbackWallBox(surface,u,y,out,shape.w,shape.h,.10,shape.back);fallbackWallBox(surface,u,y,out+.07,shape.w-.16,shape.h-.16,.025,shape.mat);
  if(item.mount==='keychain'){const p=wallWorldPoint(surface,u,y+shape.h/2+.16,out+.10);circle(p,.13,'#d9d5c7');fallbackWallBox(surface,u,y+shape.h/2+.04,out+.10,.025,.22,.025,'#8d7a67');}
  if(item.mount==='stand')fallbackWallBox(surface,u,y-shape.h/2-.10,out+.08,shape.w+.16,.16,.30,'#a97e5c');
  fallbackWallArt(item,surface,u,y,out+.11,shape.w-.22,shape.h-.22,style,12);
 });
 for(const [x,z,sz] of [[-15,-16,1],[-14,7,1.1],[2.4,-16,.85],[7.9,11,1],[13,0,1]]){box(x,.26,z,.44,.52,.44,'#b88263');circle([x,1.01*sz,z],.40*sz,'#719a76');}
 // Bundled communal tables and the real tools on each tabletop.
 for(const [x,z,w,d,color] of [[-8.2,-8.26,7.9,6.65,'#c2c8b5'],[-1.1,-4.0,7.6,5.5,'#d1bcaa'],[5.25,-2.55,7.6,5.25,'#c8c9b2'],[3.55,4.65,7.65,3.6,'#e0c7b7']])box(x,.026,z,w,.035,d,color);
 positions.slice().sort((a,b)=>a.z-b.z).forEach((t,i)=>{
  for(const dx of [-1,1])for(const dz of [-.75,.75])box(t.x+dx,.43,t.z+dz,.16,.75,.16,'#8d664b');
  box(t.x,.84,t.z,2.82,.20,2.18,'#b98863');box(t.x,.95,t.z,2.94,.065,2.29,'#e0b992');
  if(carriedBoard!==t.id)box(t.x-.22,1.025,t.z,1.49,.056,1.52,'#f6e8d4');
  // Individual desk organizers, with compartments and distinct bead colors.
  box(t.x+1.03,1.02,t.z,.58,.16,1.46,'#fff5e5');
  for(let q=0;q<12;q++){const xx=t.x+.9+Math.floor(q/6)*.23,zz=t.z-.65+(q%6)*.23;box(xx,1.13,zz,.18,.05,.18,swatches[(q+i*2)%24].hex);}
  const stoolZ=t.z+(i%2===0?1.5:-1.47);box(t.x-.14,.44,stoolZ,.89,.16,.63,'#a77452');box(t.x-.14,.86,stoolZ+Math.sign(stoolZ-t.z)*.4,.89,.77,.11,'#a77c5a');
  const work=tableBoards[t.id];if(carriedBoard!==t.id&&work.cells.some(Boolean))for(let py=0;py<18;py++)for(let px=0;px<18;px++){const id=sampledColor(work,px,py,18);if(id)circle([t.x-.22+(px-8.5)*.075,1.08,t.z+(py-8.5)*.075],.034,colorLookup[id]);}
  if(tableDrinks[t.id]){const d=drinkById(tableDrinks[t.id].id);box(t.x-1.03,1.14,t.z+.61,.22,.26,.22,d.cup||'#f4eee4');circle([t.x-1.03,1.29,t.z+.61],.08,d.drink);}
 });
 // Side wall display storage and a scattered reception / lounge.
 for(const z of [-15,-1,7]){box(-15.65,.70,z,1.35,1.24,3.3,'#a27e61');box(-15.65,1.36,z,1.48,.12,3.35,'#e3c19c');}
 box(-11.4,.87,12,6.7,1.58,2.2,'#ba8b68');box(-11.4,1.72,12,6.9,.14,2.3,'#ebcfaf');
 box(-11.95,2.5,19.79,9.15,4.7,.6,'#a88768');
 const fDH=WALL_STEPY*.82;for(let i=0;i<swatches.length;i++){const s=wallSlot(i),x=s.x,y=s.y;box(x,y,19.22,.9,fDH*.95,.45,'#f0e2cc');box(x,y+fDH*.07,18.96,.78,fDH*.5,.12,glHex(swatches[i].id));
   box(x,y-fDH*.33,18.88,.3,.09,.06,'#fff8eb');const pp=worldToScreen([x,y-fDH*.33,18.84]);if(pp){c.save();c.fillStyle='#55473b';c.font='bold 9px Arial';c.textAlign='center';c.textBaseline='middle';c.fillText(swatches[i].id,pp.x,pp.y);c.restore();}
 }
 box(-12,.66,16.75,7.5,1.1,2.15,'#b68a65');box(-12,1.28,16.75,7.7,.17,2.28,'#ecd1ad');
 for(const [x,z] of [[-2,15.7],[1.4,16.25]])box(x,.45,z,2.1,.85,1.1,'#c0a38a');
 // Inviting café corner with a visible counter, coffee machine, drinks fridge, menu board and seating.
 box(12.88,.04,-11.3,7.6,.05,11.95,'#eadbc1');
 box(16.5,2.82,-11.35,.34,4.9,10.3,'#c4a083');
 box(13.55,.76,-10.92,3.08,1.43,6.82,'#a07a5d');box(13.48,1.54,-10.92,3.36,.14,7.20,'#ead5b6');
 box(12.03,.85,-13.26,1.34,1.42,1.42,'#b38b6b');box(12.03,1.61,-13.26,1.45,.12,1.55,'#f5ddbe');
 box(13.83,1.91,-12.76,1.17,.66,.94,'#505754');box(13.83,2.29,-12.76,1.27,.12,.98,'#839188');
 box(15.08,.99,-8.25,1.25,1.84,1.12,'#c4cfca');box(15.06,1.08,-7.62,1.12,1.61,.12,'#a0c3b8');
 box(15.91,3.99,-11.68,.17,1.44,2.6,'#42423b');
 for(const [x,z] of [[12.5,-13.9],[12.5,-11.15],[12.5,-8.35]]){box(x,5.24,z,.04,2.1,.04,'#967e69');box(x,4.05,z,.65,.29,.65,'#d6a87b');circle([x,3.87,z],.17,'#fff0cd');}
 box(10.35,.48,-16.45,2.58,.35,.76,'#9daa9a');box(10.35,.92,-16.87,2.58,.78,.16,'#94a293');
 box(10.46,.37,-14.95,1.25,.06,1.18,'#d8bca0');
 // Compact reading/merchandise corner beside the reception.
 box(-5.0,.04,10.2,6.9,.055,5.1,'#d7c4ab');
 box(-6.5,.49,10.65,2.28,.34,.96,'#9ba995');box(-6.5,.96,11.05,2.28,.82,.17,'#839589');
 box(-3.75,.32,9.8,1.64,.11,1.04,'#c39979');box(-2.35,.69,11.52,1.2,1.18,.59,'#b69c80');
 for(const [x,z] of [[-13.9,-8.4],[-12.7,4.9],[-1.2,6.6],[8.15,7.9]]){box(x,.36,z,.72,.55,.68,'#be9a7c');circle([x,.79,z],.17,'#e8b1a1');}
 circle([15.38,.96,-12.04],.27,'#eed0b1');circle([15.38,.57,-12.04],.34,'#a2ad9b');
 // Real separate ironing room in the eastern front section.
 box(13.08,.05,15.0,7.5,.06,10.0,'#d9c6ac');
 box(13.3,.66,17.2,4.9,1.12,2.2,'#ab7958');box(13.3,1.30,17.2,5.1,.15,2.34,'#ead0af');box(12.65,1.47,17.13,.85,.20,.60,'#b3bcb3');
 circle([11.1,.92,17.6],.3,'#f0d1af');circle([11.1,.48,17.6],.40,'#a98a70');
 // Interior has a visible door opening in the west partition.
 box(13.1,1.82,9.8,7.7,3.65,.24,'#e9d7c1');
 box(9.26,1.83,11.5,.27,3.64,3.4,'#e6cfb5');box(9.26,1.83,17.95,.27,3.64,4.7,'#e6cfb5');box(9.26,3.22,14.15,.28,.84,2.30,'#c39a78');
 phDrawFallback(box,circle);
 if(PH.active)return;
 circle([player.x,.49,player.z],.33,'#a5bba4');circle([player.x,.97,player.z],.30,'#f3d6bc');circle([player.x,.99,player.z-.09],.30,'#765440');
 circle([player.x-.10,.86,player.z+.30],.026,'#553c34');circle([player.x+.10,.86,player.z+.30],.026,'#553c34');
 if(carriedBoard){box(player.x,.61,player.z+.37,1.05,.07,.74,'#f2dfc4');const work=tableBoards[carriedBoard];for(let py=0;py<8;py++)for(let px=0;px<10;px++){const sx=Math.min(work.size-1,Math.floor((px+.5)*work.size/10)),sy=Math.min(work.size-1,Math.floor((py+.5)*work.size/8)),id=work.cells[sy*work.size+sx];if(id)circle([player.x+(px-4.5)*.09,.66,player.z+.37+(py-3.5)*.08],.035,colorLookup[id]);}}
 else if(carriedProduct){const work={size:carriedProduct.size,cells:carriedProduct.cells||unpackCells(carriedProduct.pixels,carriedProduct.size)};box(player.x,.65,player.z+.37,.65,.06,.65,carriedProduct.mount==='frame'?'#946e50':'#f2dfc4');for(let py=0;py<7;py++)for(let px=0;px<7;px++){const id=sampledColor(work,px,py,7);if(id)circle([player.x+(px-3)*.078,.69,player.z+.37+(py-3)*.078],.032,colorLookup[id]);}}
 else{const d=currentDrink();if(d){box(player.x+.43,.63,player.z+.3,.24,.3,.24,d.cup);box(player.x+.43,.80,player.z+.3,.27,.04,.27,'#fff9ed');}}
}
function mountSoundToggle(){
 // The topbar is hidden in the immersive view, so the sound switch is a standalone
 // floating button (top-right) that stays visible while playing.
 const host=document.querySelector('.app')||document.body;
 const b=document.createElement('button');b.className='floating-sound';b.id='soundToggle';b.type='button';
 const paint=()=>{b.textContent=SFX.enabled?'🔊':'🔇';b.setAttribute('aria-label',SFX.enabled?'关闭声音':'开启声音');b.title=SFX.enabled?'声音：开（点此静音）':'声音：静音（点此开启）';b.classList.toggle('muted',!SFX.enabled);};
 b.onclick=e=>{e.stopPropagation();SFX.toggle();SFX.ui();paint();};paint();
 host.appendChild(b);
}
function createPhysicalSceneLabels(){
 const root=$('sceneLabels');const rack=document.createElement('button');rack.className='desk-label spatial-label rack-label';rack.innerHTML='<span class="spatial-icon">◉</span><span>豆墙</span>';rack.setAttribute('aria-label','前往豆墙取豆');rack.onclick=()=>goBeadStation();root.appendChild(rack);labels.push({el:rack,kind:'rack'});
}
try{
 if(gl){prepareGL();document.body.dataset.renderer='webgl';}
 else{fallback2d=true;ctx2d=scene.getContext('2d');document.body.dataset.renderer='software-perspective';}
 createLabels();createPhysicalSceneLabels();buildPatterns();buildBins();buildPalette();wire();phWireAlbum();updateDrinkStatus();updateCarryBoardStatus();updateCarryProductStatus();updateGalleryInfo();mountSoundToggle();netStart();resize();calcCamera();requestAnimationFrame(frame);
 $('seatPutDown').onclick=phPutDownTool;$('seatReturn').onclick=()=>{if(PH.held){phReturnBead();updateStatic();updateSeatHud();SFX.pick();}};$('seatDrinkAction').onclick=placeOrTakeTableDrink;$('seatBoardAction').onclick=carryBoardForIron;
 $('seatViewReset').onclick=()=>{phResetDeskView();SFX.ui();};
 {let zt=0;const holdZoom=dir=>{phZoom(dir);clearInterval(zt);zt=setInterval(()=>phZoom(dir),90);};const stopZoom=()=>clearInterval(zt);
  for(const [id,dir] of [['seatZoomIn',-1],['seatZoomOut',1]]){const b=$(id);if(!b)continue;b.addEventListener('pointerdown',e=>{e.preventDefault();holdZoom(dir);});['pointerup','pointerleave','pointercancel'].forEach(ev=>b.addEventListener(ev,stopZoom));}}
 document.querySelectorAll('#seatHud [data-grab]').forEach(b=>b.onclick=()=>{const v=b.dataset.grab;if(v==='all'){PH.grabAll=true;}else{PH.grabAll=false;PH.grabCount=Number(v);}seatHudSig='';updateSeatHud();SFX.ui();});
 $('microHint')?.classList.add('hint-gone');
}catch(error){console.error('Studio initialization error',error);const message=document.createElement('div');message.className='fatal-error';message.textContent='工作室加载失败。请使用最新版 Chrome / Edge / Safari 打开，或开启浏览器硬件加速。';document.body.appendChild(message);}
})();
