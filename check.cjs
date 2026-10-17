const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const script=fs.readFileSync(__dirname+'/index.html','utf8').match(/<script>([\s\S]*)<\/script>/)[1];
function boot(saved,session={},prefs={}){const nodes={},storage={...prefs},events={},windowEvents={};if(saved)storage['nisekura-v1']=saved;let triangles=0;
const gl=new Proxy({getShaderParameter:()=>true,getProgramParameter:()=>true,createBuffer:()=>({}),getAttribLocation:()=>1,bufferData:(_,data)=>{if(typeof data==='number'){assert(Number.isFinite(data)&&data>=0);return}assert(data.every(Number.isFinite));triangles+=data.length},bufferSubData:(_,offset,data)=>{assert(data.every(Number.isFinite));triangles+=data.length}}, {get:(o,k)=>k in o?o[k]:(()=>({}))});
const node=()=>({style:{},classList:{values:new Set(),add(n){this.values.add(n)},remove(n){this.values.delete(n)},toggle(n,on){if(on)this.values.add(n);else this.values.delete(n)},contains(n){return this.values.has(n)}},setAttribute(){},focus(){},listeners:{},addEventListener(n,f){(this.listeners[n]??=[]).push(f)},appendChild(){},getContext:()=>gl,setPointerCapture(){},getBoundingClientRect:()=>({left:0,top:0,width:112,height:112})});
const c={console,Math,Uint8Array,Float32Array,Map,Set,JSON,Number,Error,Date,performance:{now:()=>0},sessionStorage:{getItem:k=>session[k]||null,setItem:(k,v)=>session[k]=v,removeItem:k=>{delete session[k]}},localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>storage[k]=v,removeItem:k=>{delete storage[k]}},document:{body:node(),getElementById:id=>nodes[id]??=node(),createElement:node,querySelectorAll:()=>[],hidden:false,addEventListener:(n,f)=>events[n]=f},matchMedia:()=>({matches:false}),requestAnimationFrame(){},innerWidth:800,innerHeight:600,devicePixelRatio:1};c.window=c;c.addEventListener=(n,f)=>windowEvents[n]=f;c.confirm=()=>true;c.location={pathname:'/jocraft/',href:'/jocraft/'};vm.createContext(c);vm.runInContext(script,c);return {gl,c,api:c.Nisekura,storage,get triangles(){return triangles},events,windowEvents,nodes,session}}
const run=(b,code)=>vm.runInContext(code,b.c);const SEA0=62;
function fingerprint(api,x0,x1,z0,z1,y1){let h=2166136261;for(let x=x0;x<x1;x++)for(let z=z0;z<z1;z++)for(let y=0;y<y1;y++){h^=api.get(x,y,z);h=Math.imul(h,16777619)}return h>>>0}

// ---- New GRAND VISTA world: basics, saves, physics.
const t0=Date.now();const a=boot();console.log(`boot new world: ${Date.now()-t0} ms`);
assert(a.triangles>0);assert(!a.api.collides(a.api.player),'spawn must be clear');assert.equal(a.api.get(32,0,32),11);assert(a.api.collides({x:32.5,y:.5,z:32.5}));assert(a.api.collides({x:-1,y:25,z:30}));
assert.equal(run(a,'terrainVersion'),11);assert.equal(run(a,'H'),192);assert.equal(run(a,'SEA'),62);
a.api.edit(30,30,30,8);assert(a.api.save());const b=boot(a.storage['nisekura-v1']);assert.equal(b.api.get(30,30,30),8,'world edit survives reload');assert(!b.api.collides(b.api.player));
assert.equal(run(b,'terrainVersion'),11,'v11 save reloads as v11');
run(b,'paused=false;for(let i=0;i<120;i++)update(1/60)');assert(!b.api.collides(b.api.player),'gravity stays outside ground');assert(run(b,'ground'));
console.log('PASS: finite mesh, safe spawn, bedrock, boundary collision, save/reload, gravity landing');

// ---- Mobile browser zoom prevention: keep game gestures and menu scrolling working.
assert.match(fs.readFileSync(__dirname+'/index.html','utf8'),/<meta name="viewport" content="[^"]*user-scalable=no/);
assert(fs.readFileSync(__dirname+'/index.html','utf8').includes('#world{touch-action:none}'));
const zoomEvent=(props={})=>({cancelable:true,defaultPrevented:false,...props,preventDefault(){this.defaultPrevented=true}});
for(const eventName of ['gesturestart','gesturechange','dblclick']){
 const e=zoomEvent();a.events[eventName](e);assert(e.defaultPrevented,eventName+' must not zoom the page');
}
const twoFingers=zoomEvent({touches:[{},{}]});a.events.touchmove(twoFingers);
assert(twoFingers.defaultPrevented,'pinch must not zoom the page');
const oneFinger=zoomEvent({touches:[{}]});a.events.touchmove(oneFinger);
assert(!oneFinger.defaultPrevented,'single-finger look/swipe and menu scrolling must work');
const pinchTrackpad=zoomEvent({ctrlKey:true});a.events.wheel(pinchTrackpad);
assert(pinchTrackpad.defaultPrevented,'trackpad pinch must not zoom the page');
const ordinaryWheel=zoomEvent({ctrlKey:false});a.events.wheel(ordinaryWheel);
assert(!ordinaryWheel.defaultPrevented,'ordinary wheel gestures must remain available');
console.log('PASS: iOS pinch/double-tap and trackpad zoom prevented; normal gestures preserved');

// ---- Compass headings, route home, title/menu state and world-edge warnings.
assert.equal(run(a,'compassBearing(0,-10)'),0,'-Z is north');
assert.equal(run(a,'compassBearing(10,0)'),90,'+X is east');
assert.equal(run(a,'compassDelta(350,10)'),-20,'bearing wraps correctly');
run(a,'paused=false;yaw=0;updateCompass()');
assert.equal(a.nodes.compassHeading.textContent,'S 180°','yaw 0 points south');
assert.match(a.nodes.compassHomeText.textContent,/出発地点/);
assert(!a.nodes.compass.classList.contains('hidden'));
run(a,'yaw=Math.PI/2;updateCompass()');
assert.equal(a.nodes.compassHeading.textContent,'E 90°','yaw PI/2 points east');
run(a,'player.x=1356.5;player.z=.5;updateCompass()');
assert.match(a.nodes.compassWarning.textContent,/北の端まで 0m/);
assert(!a.nodes.compassWarning.classList.contains('hidden'));
run(a,'player.x=1024.5;player.z=1024.5;updateCompass()');
assert(a.nodes.compassWarning.classList.contains('hidden'),'warning hides in the interior');
run(a,'paused=true;updateCompass()');
assert(a.nodes.compass.classList.contains('hidden'),'compass hides in the menu');
run(a,'spawn();yaw=0');
console.log('PASS: compass cardinal directions, home marker, boundary warning, menu state');

// ---- Terrain composition: scenic point, mountains, ocean, inland water, beaches, forests.
const V=a.api.vista;assert(V&&Number.isFinite(V.x)&&Number.isFinite(V.yaw),'vista is computed');
assert(Math.abs(a.api.player.x-(V.x+.5))<1e-9&&Math.abs(a.api.player.z-(V.z+.5))<1e-9,'new world starts at the vista');
assert(a.api.player.y>run(a,'SEA')+8,'vista is a hill above the sea');
let peak=0,ocean=0,inland=0,cells=0;for(let x=64;x<2048;x+=32)for(let z=64;z<2048;z+=32){const h=a.api.height(x,z);cells++;peak=Math.max(peak,h);if(h<62){if(run(a,'gLand')>0)inland++;else ocean++}}
assert(peak>62+90,`high mountains exist (peak ${peak})`);assert(ocean/cells>.2,'large ocean');assert(inland>3,'rivers or lakes inland');
let logs=0,leaves=0,sand=0,snow=0;for(let x=V.x-60;x<V.x+60;x+=2)for(let z=V.z-60;z<V.z+60;z+=2)for(let y=55;y<150;y++){const t=a.api.get(x,y,z);if(t===4||t===13)logs++;if(t===5||t===14||t===15||t===16)leaves++}
for(let x=V.x-220;x<V.x+220;x+=4)for(let z=V.z-220;z<V.z+220;z+=4)for(let y=58;y<70;y++)if(a.api.get(x,y,z)===6)sand++;
for(let x=0;x<2048&&!snow;x+=16)for(let z=0;z<2048;z+=16)if(a.api.height(x,z)>62+100){snow++;break}
assert(logs>20&&leaves>200,'trees near the vista');assert(sand>0,'beach or riverbank sand within view of the vista');assert(snow>0,'snow-capped peaks exist');
let clear=true;for(let x=V.x-5;x<=V.x+5;x++)for(let z=V.z-5;z<=V.z+5;z++)for(let y=Math.floor(a.api.player.y);y<Math.floor(a.api.player.y)+8;y++)if(a.api.get(x,y,z)===4)clear=false;assert(clear,'vista hilltop is clear of trunks');
console.log(`PASS: vista (${V.x},${V.z}), peak ${peak}, ocean ${(ocean/cells*100).toFixed(0)}%, inland water cells ${inland}, trees, beaches, snow`);

// ---- Wildlife, rendering paths and far LOD tiles.
assert(a.api.cows.length>=3,'new world has wildlife');
for(const cow of a.api.cows)assert(Math.hypot(cow.x-a.api.player.x,cow.z-a.api.player.z)>3,'cow spawn clears player');
run(a,'paused=false;canvas.width=1200;canvas.height=700;drawWorldDetails();drawTool();frame(16)');
for(let i=0;i<400;i++)run(a,`frame(${32+i*16})`);
const ready=[...a.api.lodTiles.values()].filter(t=>t.ready);assert(ready.length>=4,'far LOD tiles get built');assert(ready.every(t=>t.quads>0&&t.ymax>t.ymin),'LOD tiles have geometry and bounds');
assert(run(a,'oceanTiles.length')===8,'ocean continues beyond the world edge');
assert(run(a,'readyR')>=1,'near field square is ready');
const F=a.api.makeFrustum({x:0,y:0,z:0,yaw:0,pitch:0},16/9);assert(a.api.sphereVisible(F,0,0,50,1));assert(!a.api.sphereVisible(F,0,0,-50,1));assert(!a.api.sphereVisible(F,200,0,10,1));assert(a.api.sphereVisible(F,200,0,10,200));
// Uniforms shared by both shader stages must not exist (iOS precision mismatch broke linking before).
const names=src=>new Set([...src.matchAll(/uniform\s+(?:\w+\s+)?(?:vec[234]|float|mat[234])\s+(\w+)/g)].map(m=>m[1]));
for(const [vs,fs]of[[a.api.vertexSource,a.api.fragmentSource],[a.api.vertexSource,a.api.waterFragmentSource],[a.api.lodVertexSource,a.api.lodFragmentSource],[a.api.skyVertexSource,a.api.skyFragmentSource]]){const f=names(fs);for(const n of names(vs))assert(!f.has(n),'uniform '+n+' declared in both stages')}
console.log(`PASS: wildlife, render paths, ${ready.length} LOD tiles, ocean skirt, frustum culling, stage-local uniforms`);

// ---- Raycast, mining and placement on the vista hilltop.
run(a,`paused=false;flying=true;player.x=${V.x}+.5;player.z=${V.z}+.5;player.y=surface(player.x,player.z)+3;yaw=0;pitch=0`);
const py=Math.floor(a.api.player.y+1.62);run(a,`edit(${V.x},${py},${V.z+3},3)`);
assert.equal(a.api.ray().z,V.z+3);const count=a.api.inventory[3]||0;run(a,'mine()');assert.equal(a.api.get(V.x,py,V.z+3),0);assert.equal(a.api.inventory[3],count+1);
run(a,`edit(${V.x},${py},${V.z+3},3);selected=1;place()`);assert.equal(a.api.get(V.x,py,V.z+2),2);
for(let i=0;i<120;i++)a.api.animateWorld(1/60);for(const cow of a.api.cows)assert([cow.x,cow.y,cow.z].every(Number.isFinite));
console.log('PASS: raycast mining/placement, animal movement');

// ---- Browser focus/visibility changes must not switch to title or retain movement inputs.
run(a,'flying=false;play();keys.KeyW=true');a.c.onblur();assert.equal(run(a,'paused'),false);assert(a.nodes.menu.classList.contains('hidden'));assert.equal(run(a,'!!keys.KeyW'),false);
a.c.document.hidden=true;a.events.visibilitychange();assert.equal(run(a,'suspended'),true);assert.equal(run(a,'paused'),false);const beforeHidden=a.api.player.z;run(a,'frame(99999)');assert.equal(a.api.player.z,beforeHidden);
a.c.document.hidden=false;a.events.visibilitychange();assert.equal(run(a,'suspended'),false);assert(a.nodes.menu.classList.contains('hidden'));
// Flight ascends, hovers, descends, and respects solid blocks and the altitude ceiling.
run(a,'player.x=100.5;player.z=100.5;player.y=50;toggleFlight();keys.Space=true;for(let i=0;i<60;i++)update(1/60);delete keys.Space');
assert(Math.abs(a.api.player.y-57)<.001);run(a,'for(let i=0;i<60;i++)update(1/60)');assert(Math.abs(a.api.player.y-57)<.001);
run(a,'keys.KeyQ=true;for(let i=0;i<60;i++)update(1/60);delete keys.KeyQ');assert(Math.abs(a.api.player.y-50)<.001);
run(a,'edit(100,52,100,3);keys.Space=true;for(let i=0;i<60;i++)update(1/60);delete keys.Space');assert(a.api.player.y<50.22);assert(!a.api.collides(a.api.player));
run(a,'player.x=110.5;player.y=H-3;keys.Space=true;for(let i=0;i<60;i++)update(1/60);delete keys.Space');assert(a.api.player.y<run(a,'H')-1.79);assert(!a.api.collides(a.api.player));
// Distant edits save/load using the 2048 coordinate stride; streaming keeps memory bounded.
a.api.edit(1400,45,1400,8);assert.equal(a.api.get(1400,45,1400),8);a.api.save();const wide=boot(a.storage['nisekura-v1'],{'nisekura-playing':'1'});assert.equal(wide.api.get(1400,45,1400),8);assert.equal(run(wide,'flying'),true);assert.equal(run(wide,'paused'),false);assert(wide.nodes.menu.classList.contains('hidden'));assert.equal(JSON.parse(a.storage['nisekura-v1']).worldWidth,2048);assert.equal(JSON.parse(a.storage['nisekura-v1']).worldHeight,192);
run(wide,'player.x=1400.5;player.z=1400.5;streamChunks(true);for(let i=0;i<400;i++)streamChunks()');assert(run(wide,'chunks.has("87,87")'));
const R=run(wide,'Q.near+1');assert(run(wide,'chunks.size')<=(2*R+1)**2);assert(run(wide,'blocks.size')<=(2*R+7)**2);assert.equal(run(wide,'readyR'),R,'all near rings complete');
run(wide,'pause()');assert.equal(run(wide,'paused'),true);assert(!wide.nodes.menu.classList.contains('hidden'));assert.equal(wide.session['nisekura-playing'],'0');
console.log('PASS: focus/background resume, flight ascent/hover/descent/collision/ceiling, 2048-wide save roundtrip, bounded chunk streaming, explicit menu');

// ---- Quality presets change the near radius and are remembered.
const q=boot(null,{},{'jocraft2-quality':'low'});assert.equal(run(q,'Q.near'),3);run(q,'setQuality("high")');assert.equal(run(q,'Q.near'),7);assert.equal(q.storage['jocraft2-quality'],'high');
run(q,'player.x=900.5;player.z=900.5;paused=false;for(let i=0;i<900;i++)streamChunks()');assert.equal(run(q,'readyR'),8);
console.log('PASS: quality presets');

// ---- Reset must not resurrect old terrain via blur/visibility/pagehide autosave.
const resetTest=boot(JSON.stringify({version:1,worldWidth:2048,worldHeight:96,terrainVersion:3,seed:73219,changes:[],inventory:{}}));
assert.equal(run(resetTest,'terrainVersion'),3);
resetTest.nodes.reset.onclick();
assert.equal(resetTest.storage['nisekura-v1'],undefined,'reset must remove the saved world');
assert.match(resetTest.c.location.href,/\?seed=\d+/,'reset must navigate to a newly seeded world');
resetTest.c.onblur();
resetTest.c.document.hidden=true;resetTest.events.visibilitychange();
resetTest.windowEvents.pagehide();
assert.equal(resetTest.storage['nisekura-v1'],undefined,'unload callbacks must not restore deleted saves');
assert.equal(run(resetTest,'save()'),false,'autosave must remain disabled until navigation completes');
const afterReset=boot(resetTest.storage['nisekura-v1']);
assert.equal(run(afterReset,'terrainVersion'),11,'reset must activate new terrain generator');
assert.equal(run(afterReset,'SEA'),62,'new world sea level is 62');
assert.equal(run(afterReset,'H'),192,'new world height is 192');
console.log('PASS: new world reset survives blur, visibility and pagehide without resurrecting legacy terrain');

// ---- Legacy saves keep their original generator, height and edits (fingerprints recorded from v4.1).
const legacy=JSON.stringify({version:1,seed:73219,changes:[[30+64*(30+64*30),8]],inventory:{4:7}});
const old=boot(legacy);assert.equal(run(old,'terrainVersion'),1);assert.equal(run(old,'H'),96);assert.equal(old.api.get(30,30,30),8);assert.equal(old.api.inventory[4],7);
const old256=JSON.stringify({version:1,worldWidth:256,worldHeight:96,terrainVersion:2,seed:73219,changes:[[140+256*(140+256*24),8]],inventory:{7:5}});
const migrated=boot(old256);assert.equal(migrated.api.get(140,24,140),8);assert.equal(migrated.api.inventory[7],5);
const v3=boot(JSON.stringify({version:1,worldWidth:2048,worldHeight:96,terrainVersion:3,seed:73219,changes:[[1020+2048*(1020+2048*20),9]],inventory:{}}));
assert.equal(run(v3,'terrainVersion'),3);assert.equal(v3.api.get(1024+500,10,1024),10,'distant ocean');assert(!v3.api.collides(v3.api.player),'center spawn is safe');assert.equal(v3.api.get(1020,20,1020),9);
const pure3=boot(JSON.stringify({version:1,worldWidth:2048,worldHeight:96,terrainVersion:3,seed:73219,changes:[],inventory:{}})),pure1=boot(JSON.stringify({version:1,seed:73219,changes:[],inventory:{}}));
assert.equal(fingerprint(pure3.api,1000,1050,990,1040,60),2877372116,'v3 terrain identical to v4.1');assert.equal(fingerprint(pure3.api,1190,1230,1000,1030,40),3204535156,'v3 coast identical to v4.1');
assert.equal(fingerprint(pure1.api,0,64,0,64,40),1029875420,'v1 terrain identical to v4.1');
run(pure3,'paused=false;for(let i=0;i<200;i++)frame(i*16)');assert([...pure3.api.lodTiles.values()].some(t=>t.ready),'legacy worlds also get far LOD');
console.log('PASS: legacy 64/256/2048 saves, byte-identical legacy terrain, legacy far view');

// ---- Phase 3: day cycle, sky palettes, packed lighting attributes, water depth/shoreline data.
{const d=boot();const env=t=>JSON.parse(run(d,`JSON.stringify(skyEnv(sunFromTime(${t})))`));
 const noon=env(.5),dusk=env(.74),night=env(0);const lum=c=>c[0]*.3+c[1]*.59+c[2]*.11;
 assert(noon.night===0&&night.night>.99,'night factor follows the sun');assert(lum(noon.amb)>lum(dusk.amb)&&lum(dusk.amb)>lum(night.amb),'ambient dims toward night');
 assert(night.dir[1]>0&&noon.dir[1]>0,'directional light (sun or moon) comes from above');assert(dusk.horizon[0]>dusk.horizon[2],'sunset horizon is warm');
 for(const e of[noon,dusk,night])assert(Math.abs(Math.hypot(...e.dir)-1)<1e-6&&[...e.amb,...e.dirCol,...e.zenith,...e.horizon].every(Number.isFinite));
 run(d,'paused=false;dayTime=.5');const t0=run(d,'dayTime');run(d,'for(let i=0;i<600;i++)advanceDay(.1)');const dayStep=run(d,'dayTime')-t0;
 run(d,'dayTime=.0');run(d,'for(let i=0;i<600;i++)advanceDay(.1)');const nightStep=run(d,'dayTime');assert(dayStep>0&&nightStep>dayStep*2,'nights pass faster than days');
 run(d,'dayTime=.61');assert(run(d,'save()'));const e2=boot(d.storage['nisekura-v1']);assert(Math.abs(run(e2,'dayTime')-.61)<1e-9,'time of day is saved');
 assert.match(run(d,'clockText()'),/^14:38$/);
 // Every opaque vertex packs material + 32*face (+256 under a roof); water carries depth (0..1) and a shoreline flag.
 const V=d.api.vista;let wx=null;for(let x=V.x;x<V.x+700&&wx===null;x+=16)if(d.api.height(x,V.z)<run(d,'SEA')-4)wx=x;assert(wx!==null,'sea east of the vista');
 run(d,`rebuild(${wx>>4},${V.z>>4})`);const water=JSON.parse(run(d,'JSON.stringify(Array.from(waterW.a.subarray(0,waterW.n)))'));assert(water.length>0,'water mesh exists');
 for(let i=0;i<water.length;i+=9){assert(water[i+3]>=0&&water[i+3]<=1,'water depth encoded');assert(water[i+4]>=0&&water[i+4]<=1,'shore nearness');assert(water[i+5]>=0&&water[i+5]<=1,'sandy bed share');assert.equal(Math.floor(water[i+8]%32),10);assert(water[i+8]%1<=.4501,'exposure fraction')}
 run(d,`rebuild(${V.x>>4},${V.z>>4})`);const op=JSON.parse(run(d,'JSON.stringify(Array.from(opaqueW.a.subarray(0,opaqueW.n)))'));let shaded=0,plants=0;
 for(let i=0;i<op.length;i+=9){const code=op[i+8],m=code%32,face=Math.floor(code%256/32);assert(m<=25.5&&face<=6&&code<1024&&(m<=19||face===6),'packed material code '+code);if(code%512>=256)shaded++;if(face===6)plants++}
 assert(plants>0,'plants use the soft plant face');assert(shaded>0,'canopy shade is flagged for dappled light');
 console.log('PASS: day cycle, sky palettes, moonlight, saved time of day, packed face/shade codes, water depth & shoreline data')}
// ---- Phase 4: LOD worker matches the main-thread mesher; benchmark never writes the save; presets cap memory.
{const d=boot();const src=run(d,'lodWorkerSource()');let out=null;
 const wc={Math,Int16Array,Uint8Array,Float32Array,ArrayBuffer,JSON,Number,Array,postMessage:m=>out=m};vm.createContext(wc);vm.runInContext(src,wc);
 for(const [step,x0,z0] of [[2,960,704],[8,512,1024],[16,1536,0]]){
  wc.onmessage({data:{id:7,step,x0,z0}});assert.equal(out.id,7);
  const main=JSON.parse(run(d,`(()=>{const it=tileMesh(${step},${x0},${z0});let r;while(!(r=it.next()).done);return JSON.stringify({r:r.value,b:Array.from(lw.u8.subarray(0,lw.n*12))})})()`));
  assert.equal(JSON.stringify(out.r),JSON.stringify(main.r),'worker tile bounds match');assert.equal(out.bytes.length,main.b.length,'worker tile size matches');
  for(let i=0;i<main.b.length;i+=97)assert.equal(out.bytes[i],main.b[i],'worker tile bytes match')}
 for(const q of['low','standard','high'])assert(run(d,`QUALITY.${q}.lodCap`)>=100);
 assert.equal(run(d,'autoQuality()'),'standard','unknown devices default to standard');
 const before=d.storage['nisekura-v1'];run(d,'startBench()');assert.equal(run(d,'paused'),false);
 for(let i=1;i<=400;i++)run(d,`frame(${i*100})`);
 const rep=d.c.__bench;assert(rep,'benchmark report produced');assert(rep.frames>100&&[rep.avgFps,rep.low1Fps,rep.worstMs,rep.gpuMB].every(Number.isFinite));
 assert.equal(run(d,'save()'),false,'benchmark never saves');run(d,'pause()');assert.equal(d.storage['nisekura-v1'],before,'save untouched by benchmark');
 console.log(`PASS: LOD worker output identical to main thread, quality caps, benchmark (${rep.frames} frames, GPU est ${rep.gpuMB} MB) without saving`)}
// ---- Phase 6: natural vegetation (terrainVersion 5) and untouched v4 vegetation.
{// v4 worlds keep their exact trees, grass and flowers (fingerprints recorded from v5.2 before the vegetation update).
 const v4=boot(JSON.stringify({version:1,worldWidth:2048,worldHeight:192,terrainVersion:4,seed:73219,changes:[],inventory:{}}));
 assert.equal(run(v4,'VEG'),false);const V=v4.api.vista;
 const fpv=(x0,x1,z0,z1)=>{let h=2166136261;for(let x=x0;x<x1;x++)for(let z=z0;z<z1;z++)for(let y=40;y<170;y++){h^=v4.api.get(x,y,z);h=Math.imul(h,16777619)}return h>>>0};
 assert.equal(fpv(V.x-60,V.x+60,V.z-60,V.z+60),3884826321,'v4 vista vegetation unchanged');assert.equal(fpv(512,576,352,416),1103971050,'v4 forest unchanged');
 assert.equal(fpv(896,960,928,992),1089862464,'v4 mountain forest unchanged');assert.equal(fpv(640,704,1184,1248),936981568,'v4 conifer forest unchanged');
 for(const [key,h,n] of [['62,48',855370142,37332],['56,62',1131273904,27144],['36,26',1787268620,54468]]){run(v4,`rebuild(${key})`);
  // The Phase 7 "faces water" bit (+512) is masked: it only changes shading, not the vegetation being checked.
  const m=JSON.parse(run(v4,`(()=>{let h=2166136261;const a=opaqueW.a;for(let i=0;i<opaqueW.n;i++){h^=Math.round((i%9===8&&a[i]>=512?a[i]-512:a[i])*1000);h=Math.imul(h,16777619)}return JSON.stringify({h:h>>>0,n:opaqueW.n})})()`));
  assert.equal(m.n,n,'v4 mesh size '+key);assert.equal(m.h,h,'v4 grass/flower mesh unchanged '+key)}
 console.log('PASS: v4 worlds keep identical trees, terrain and ground-cover meshes')}
{const w1=boot(),w2=boot(),list=[];for(let cx=56;cx<61;cx++)for(let cz=53;cz<58;cz++)list.push([cx,cz]);
 // Same seed → same world, whatever order the chunks are generated in (trees crossing chunk borders included).
 for(const [cx,cz] of list)run(w1,`voxelChunk(${cx},${cz})`);for(const [cx,cz] of list.slice().reverse())run(w2,`voxelChunk(${cz-53+56},${cx-56+53})`);
 for(const [cx,cz] of list){const a=run(w1,`Array.from(voxelChunk(${cx},${cz})).join(',')`),b=run(w2,`Array.from(voxelChunk(${cx},${cz})).join(',')`);assert.equal(a,b,`chunk ${cx},${cz} independent of generation order`)}
 // Trees: count trunk bases and species; the forest must have dense, sparse and empty windows.
 const win=new Map();let species={4:0,13:0},leafIds=new Set();
 for(const [cx,cz] of list)for(let x=cx*16;x<cx*16+16;x++)for(let z=cz*16;z<cz*16+16;z++){let y=180;while(y>1&&!w1.api.get(x,y,z))y--;
  for(let yy=y;yy>y-40&&yy>1;yy--){const t=w1.api.get(x,yy,z),b=w1.api.get(x,yy-1,z);if(t===14||t===15||t===16||t===5)leafIds.add(t);if((t===4||t===13)&&(b===1||b===2)){species[t]++;const k=Math.floor(x/32)+','+Math.floor(z/32);win.set(k,(win.get(k)||0)+1);break}}}
 const counts=[...win.values()],mean=counts.reduce((a,b)=>a+b,0)/Math.max(1,counts.length),cv=Math.sqrt(counts.reduce((a,b)=>a+(b-mean)**2,0)/Math.max(1,counts.length))/Math.max(mean,1e-9);
 assert(species[4]+species[13]>30,'forest region has trees');assert(leafIds.size>=3,'several leaf types (oak/birch/conifer/shrub)');
 console.log(`PASS: deterministic, order-independent chunks; ${species[4]+species[13]} trunks, ${[...leafIds].length} leaf types, window CV ${cv.toFixed(2)}`)}
{const d=boot();
 // Individual trees: no two of the same species are alike; heights, widths and leaf counts vary widely.
 for(const sp of['oak','birch','spruce','shrub']){
  const r=JSON.parse(run(d,`(()=>{const out=[];for(let i=0;i<40;i++){const m=new Map();gX0=-64;gX1=64;gZ0=-64;gZ1=64;
   const w=(x,y,z,t)=>m.set(x+','+y+','+z,t),l=(x,y,z,t)=>{const k=x+','+y+','+z;if(!m.has(k))m.set(k,t)},R=treeRng(i*37+5,i*91+3,1),A=treeAge(R);
   ${sp==='oak'?'growOak(w,l,0,0,0,R,A,false,i)':sp==='birch'?'growBirch(w,l,0,0,0,R,A,i)':sp==='spruce'?'growSpruce(w,l,0,0,0,R,A,false,1,i)':'growShrub(w,l,0,0,0,R,i)'};
   let top=0,minx=99,maxx=-99,leaves=0,cx=0;for(const [k,t] of m){const [x,y,z]=k.split(',').map(Number);top=Math.max(top,y);if(t!==4&&t!==13){leaves++;minx=Math.min(minx,x);maxx=Math.max(maxx,x);cx+=x}}
   out.push({sig:[...m.keys()].sort().join(';'),top,w:maxx-minx+1,leaves,off:cx/Math.max(1,leaves)})}return JSON.stringify(out)})()`));
  const uniq=new Set(r.map(t=>t.sig)).size,tops=r.map(t=>t.top),ws=r.map(t=>t.w),ls=r.map(t=>t.leaves),lm=ls.reduce((a,b)=>a+b,0)/ls.length,lcv=Math.sqrt(ls.reduce((a,b)=>a+(b-lm)**2,0)/ls.length)/lm;
  assert(uniq>=39,sp+' shapes are unique ('+uniq+'/40)');assert(Math.max(...tops)-Math.min(...tops)>=(sp==='shrub'?1:5),sp+' heights vary');assert(Math.max(...ws)-Math.min(...ws)>=2,sp+' crown widths vary');assert(lcv>.18,sp+' leaf amount varies');
  if(sp!=='shrub')assert(r.some(t=>Math.abs(t.off)>(sp==='spruce'?.12:.4)),sp+' has asymmetric crowns');
  console.log(`PASS: ${sp}: ${uniq}/40 unique, height ${Math.min(...tops)}-${Math.max(...tops)}, width ${Math.min(...ws)}-${Math.max(...ws)}, leaves CV ${lcv.toFixed(2)}`)}
 // Environment: density spread, conifers with altitude, open land kept, flower patches clustered and colourful.
 const st=JSON.parse(run(d,`(()=>{let n=0,dense=0,sparse=0,open=0,fc=0,big=0,same=0,pairs=0,sameCol=0;const cols=new Set(),shapes=new Set(),pals=new Set();
  for(let cx=30;cx<100;cx+=2)for(let cz=30;cz<100;cz+=2){const c=columnInfo(cx,cz);for(let k=0;k<256;k++){if(c.h[k]<=SEA+1)continue;n++;const dd=c.dens[k];if(dd>.6)dense++;else if(dd>.05&&dd<.35)sparse++;else if(dd<=.05)open++;
   if(c.fc[k]>.05){fc++;pals.add(c.fp[k]);const wx=cx*16+(k&15),wz=cz*16+(k>>4);flowerPick(wx,wz,c.fp[k]);cols.add(FPK.ci);shapes.add(FPK.sh);if(c.fc[k]>.6)big++;
    if((k&15)<15&&c.fc[k+1]>.3&&c.fc[k]>.3){pairs++;if(c.fp[k+1]===c.fp[k])same++;const a=FPK.ci;flowerPick(wx+1,wz,c.fp[k+1]);if(FPK.ci===a)sameCol++}}}}
  let con=0,tot=0;for(let i=0;i<4000;i++){const alt=55+(i%30);if(pickSpecies(alt,0,rand(i,3),rand(i,7))===4)con++;tot++}
  let low=0;for(let i=0;i<4000;i++)if(pickSpecies(8,0,rand(i,3),rand(i,7))===4)low++;
  return JSON.stringify({n,dense:dense/n,sparse:sparse/n,open:open/n,fc:fc/n,big:big/n,same:same/pairs,sameCol:sameCol/pairs,cols:cols.size,shapes:shapes.size,pals:pals.size,con:con/tot,low:low/4000})})()`));
 assert(st.dense>.04&&st.sparse>.08&&st.open>.25,'dense, sparse and open land all exist '+JSON.stringify(st));
 assert(st.con>.85&&st.low<.05,'conifers dominate high ground, lowlands are broadleaf');
 assert(st.fc>.03&&st.fc<.3&&st.big<.12,'flower patches are present but not everywhere');
 assert(st.cols===6&&st.shapes===4&&st.pals>=8,'white/yellow/red/pink/purple/blue in four flower shapes');
 assert(st.same>.9&&st.sameCol>.5,'flowers cluster: neighbours share a patch palette and often a colour');
 console.log(`PASS: forest dense ${(st.dense*100).toFixed(0)}% / sparse ${(st.sparse*100).toFixed(0)}% / open ${(st.open*100).toFixed(0)}%, flowers ${(st.fc*100).toFixed(1)}% (big ${(st.big*100).toFixed(1)}%), 6 colours, clustering ${(st.same*100).toFixed(0)}%/${(st.sameCol*100).toFixed(0)}%`)
 // Ground cover detail follows quality as a subset: lower quality never adds plants.
 const q=k=>{run(d,`Q=Object.assign({},Q,{plant:${k}});rebuild(vista.x>>4,vista.z>>4)`);return run(d,'(()=>{let p=0;for(let i=8;i<opaqueW.n;i+=36)if(Math.floor((opaqueW.a[i]%256)/32)===6)p++;return p})()')};
 const hi=q(1),lo=q(.4);run(d,'Q=QUALITY[qualityName]');assert(hi>lo&&lo>0,`plants scale with quality (${lo} < ${hi})`);
 // Mined trees stay mined after their chunk is evicted and regenerated; placed blocks persist inside forests.
 const tr=JSON.parse(run(d,`(()=>{for(let x=944;x<1000;x++)for(let z=880;z<940;z++)for(let y=150;y>60;y--){const t=get(x,y,z);if(t===4)return JSON.stringify([x,y,z])}return 'null'})()`));
 assert(tr,'found a trunk');run(d,`edit(${tr},0);edit(${tr[0]},${tr[1]+1},${tr[2]},8)`);run(d,`blocks.delete(chunkKey(${tr[0]},${tr[2]}));lastData=null`);
 assert.equal(d.api.get(...tr),0,'mined log not regrown');assert.equal(d.api.get(tr[0],tr[1]+1,tr[2]),8,'placed block persists');
 console.log(`PASS: quality subset (${lo}/${hi} plant quads), edits survive regeneration`)}
// Performance is profiled in a real browser (Node's vm sandbox makes global lookups ~10x slower); see README.

// Scenic HUD preferences and photo mode must not leak held inputs or edit the world.
run(a,'paused=false;hudMinimal=false;toggleHUD();toggleDetails()');
assert.equal(JSON.parse(a.storage['jocraft2-hud']).minimal,true);
assert(a.c.document.body.classList.contains('hud-minimal'));
run(a,'keys.KeyW=true;joy.x=1;mineHeld=true;riseHeld=true;setPhotoMode(true)');
const photoPosition={...a.api.player},photoChanges=run(a,'changes.size'),photoFlight=run(a,'flying');
assert.equal(run(a,'mineHeld||riseHeld||!!keys.KeyW||joy.x!==0'),false);
run(a,'update(1);mine();place();toggleFlight()');
assert.deepEqual({...a.api.player},photoPosition);
assert.equal(run(a,'changes.size'),photoChanges);assert.equal(run(a,'flying'),photoFlight);
a.c.document.onkeydown({code:'KeyE'});assert.equal(run(a,'paused'),false);
a.c.document.onkeydown({code:'Escape',preventDefault(){}});
assert.equal(run(a,'photoMode'),false);assert(a.c.document.body.classList.contains('hud-minimal'));
run(a,'setPhotoMode(true);pause()');assert.equal(run(a,'photoMode'),false);assert.equal(run(a,'paused'),true);
const hudReload=boot(null,{}, {'jocraft2-hud':a.storage['jocraft2-hud']});
assert.equal(run(hudReload,'hudMinimal'),true);assert.equal(run(hudReload,'photoMode'),false);
console.log('PASS: HUD preferences, photo input reset, frozen position, blocked edits/flight/craft, Escape/menu recovery');

// Touch holds, cancellation, stick movement and look still work after a photo round-trip.
run(a,'play();flying=true');
const touch={pointerId:7,clientX:90,clientY:56,preventDefault(){}};
a.nodes.stick.onpointerdown(touch);assert(run(a,'joy.x>0'));
a.nodes.stick.listeners.pointercancel.forEach(f=>f());assert.equal(run(a,'joy.x'),0);
for(const [id,flag] of [['mine','mineHeld'],['place','placeHeld'],['jump','riseHeld'],['down','descendHeld']]){
 a.nodes[id].listeners.pointerdown.forEach(f=>f(touch));assert.equal(run(a,flag),true);
 a.nodes[id].listeners.lostpointercapture.forEach(f=>f());assert.equal(run(a,flag),false);
}
run(a,'setPhotoMode(true)');const beforeYaw=run(a,'yaw');
a.nodes.world.onpointerdown({...touch,pointerType:'touch'});
a.nodes.world.onpointermove({...touch,clientX:110});assert(run(a,'yaw')>beforeYaw);
a.nodes.jump.listeners.pointerdown.forEach(f=>f(touch));assert.equal(run(a,'riseHeld'),false);
run(a,'setPhotoMode(false)');a.nodes.fly.onclick();assert.equal(run(a,'flying'),false);
console.log('PASS: touch stick/cancel, mining/placing/ascent/descent holds, lost capture, photo look and restored flight button');

// ---- Phase 7: water. Smooth per-corner water data, shoreline nearness, river flow, wet faces, far water depth, safe shaders.
{const d=boot(),SEA=run(d,'SEA'),V=d.api.vista;
 const waterOf=(cx,cz)=>{run(d,`rebuild(${cx},${cz})`);return JSON.parse(run(d,'JSON.stringify({w:Array.from(waterW.a.subarray(0,waterW.n)),o:Array.from(opaqueW.a.subarray(0,opaqueW.n))})'))};
 // A coastal chunk east of the vista: sea and land in the same chunk.
 const analyse=cc=>{const {w,o}=waterOf(...cc),corners=new Map();let near1=0,far0=0,tops=0;
  for(let i=0;i<w.length;i+=9){if(Math.floor(w[i+8]/32)!==2)continue;tops++;const key=w[i]+','+w[i+2],val=[w[i+3],w[i+4],w[i+5],w[i+6],w[i+7],w[i+8]%1].map(v=>v.toFixed(5)).join();
   if(corners.has(key))assert.equal(corners.get(key),val,'water data is continuous across blocks at '+key);else corners.set(key,val);
   const x=w[i],z=w[i+2],land=[[0,0],[-1,0],[0,-1],[-1,-1]].some(([dx,dz])=>d.api.get(x+dx,SEA,z+dz)!==10&&d.api.get(x+dx,SEA,z+dz)!==0);
   if(land){assert.equal(w[i+4],1,'corners touching land have shore nearness 1');near1++}
   let open=true;for(let dx=-5;dx<5&&open;dx++)for(let dz=-5;dz<5;dz++){const t=d.api.get(x+dx,SEA,z+dz);if(t!==10&&t!==0){open=false;break}}
   if(open){assert.equal(w[i+4],0,'no shore foam data far from land');far0++}}
  return{w,o,corners,near1,far0,tops}};
 // A coastal chunk with both a shoreline and open water in it (sea cliffs make some coasts all-or-nothing, so look along the coast).
 let coast=null,res=null;for(let dz=0;dz<40&&!coast;dz++)for(let x=V.x;x<V.x+700&&!coast;x+=16){const z=V.z+((dz&1)?-1:1)*Math.ceil(dz/2)*16,a=d.api.height(x,z),b=d.api.height(x+15,z);
  if(a>=SEA&&b<SEA){const r=analyse([x>>4,z>>4]);if(r.tops>0&&r.near1>0&&r.far0>0){coast=[x>>4,z>>4];res=r}}}
 assert(coast,'coastal chunk with shore and open water found');const {w,o,corners,near1,far0,tops}=res;
 // Wet flag: faces touching water (sea bed) carry +512; nothing above the water does.
 let wet=0;for(let i=0;i<o.length;i+=9)if(o[i+8]>=512){wet++;assert(o[i+1]<=SEA+1,'wet faces lie under the water surface')}assert(wet>0,'sea bed faces are flagged wet');
 // River: water flows (non-zero uv) toward the east; the open sea does not flow.
 // Find a river channel (water inland with flow) near the vista, then check its flow and that its chunk carries it.
 const rp=JSON.parse(run(d,`(()=>{const o=[0,0];for(let r=8;r<700;r+=8)for(let a=0;a<24;a++){const x=Math.round(${V.x}+Math.cos(a*.26)*r),z=Math.round(${V.z}+Math.sin(a*.26)*r),h=height4(x,z);if(h>=SEA-1||gLand<.4)continue;riverFlow(x,z,gLand,o);if(Math.hypot(o[0],o[1])>.4)return JSON.stringify({x,z,f:[o[0],o[1]]})}return 'null'})()`));
 assert(rp,'river found');const fl=[rp.f,JSON.parse(run(d,'(()=>{const o=[0,0];riverFlow(1500,768,-1,o);return JSON.stringify([o[0],o[1]])})()'))];
 assert(fl[0][0]>.1&&Math.hypot(...fl[0])<=1.5,'river flows downstream (east) at a bounded speed');assert.equal(Math.hypot(...fl[1]),0,'open sea has no river flow');
 const rv=waterOf(rp.x>>4,rp.z>>4).w;let flowing=0;for(let i=0;i<rv.length;i+=9)if(Math.hypot(rv[i+6],rv[i+7])>.1)flowing++;assert(flowing>0,'river surface vertices carry flow');
 // Far water: corners carry depth/40 and fade from shallow near land to deep offshore.
 const tile=JSON.parse(run(d,`(()=>{const it=tileMesh(16,${coast[0]*16-128},${coast[1]*16-256});while(!it.next().done);const r=[];for(let i=0;i<lw.n;i++){const m=lw.i16[i*6+3];if(m===17)r.push(lw.u8[i*12+8])}return JSON.stringify(r)})()`));
 assert(tile.length>0&&Math.min(...tile)<60&&Math.max(...tile)>120,'far water shades from shallow to deep');
 // Shaders: the light fallback strips the heavier water code; quality presets choose a water detail level.
 const lite=run(d,'liteWaterSource');assert(lite.includes('#define WATER_LITE')&&!run(d,'waterFragmentSource').includes('#define WATER_LITE'));
 assert(!run(d,'fragmentSource').includes('waveSlope'),'terrain shader stays free of the water code');
 for(const q of['low','standard','high'])assert([0,1,2].includes(run(d,`QUALITY.${q}.water`)));
 // Water appearance never touches the saved world: generation fingerprints stay identical across a rebuild.
 const fp=()=>{let h=2166136261;for(let x=coast[0]*16;x<coast[0]*16+16;x++)for(let z=coast[1]*16;z<coast[1]*16+16;z++)for(let y=40;y<90;y++){h^=d.api.get(x,y,z);h=Math.imul(h,16777619)}return h>>>0};
 const f0=fp();waterOf(...coast);assert.equal(fp(),f0,'meshing water does not alter blocks');
 console.log(`PASS: water corners continuous (${corners.size}), shore ${near1}/open ${far0}, ${wet} wet faces, river flow ${fl[0].map(v=>v.toFixed(2))}, far water depth, lite shader fallback`)}

// ---- Phase 8: scenic landforms (terrainVersion 6) and untouched v5 worlds.
const SEA_=62;
{// v5 worlds keep their exact terrain, blocks, meshes and far tiles (fingerprints recorded from v7.0 before the scenic update).
 const v5=boot(JSON.stringify({version:1,worldWidth:2048,worldHeight:192,terrainVersion:5,seed:73219,changes:[],inventory:{}}));
 assert.equal(run(v5,'terrainVersion'),5);assert.equal(run(v5,'SCENIC'),false);
 assert.equal(JSON.stringify(v5.api.vista),'{"x":992,"z":768,"yaw":0,"eye":122.5}','v5 vista unchanged');
 assert.equal(run(v5,`(()=>{let h=2166136261;for(let x=64;x<2048;x+=37)for(let z=64;z<2048;z+=41){h^=height4(x,z);h=Math.imul(h,16777619)}return h>>>0})()`),1676993611,'v5 heights unchanged');
 const blocks=[[960,704,64],[1100,500,64],[500,1500,64],[1180,900,64]].map(([x0,z0,n])=>{let h=2166136261;for(let x=x0;x<x0+n;x++)for(let z=z0;z<z0+n;z++)for(let y=30;y<180;y++){h^=v5.api.get(x,y,z);h=Math.imul(h,16777619)}return h>>>0});
 assert.equal(JSON.stringify(blocks),'[3353232788,534966564,1278627299,1910027677]','v5 blocks unchanged');
 const mesh=[[62,48],[56,62],[74,40]].map(([cx,cz])=>{run(v5,`rebuild(${cx},${cz})`);return JSON.parse(run(v5,`(()=>{let h=2166136261;for(const w of[opaqueW,waterW]){const a=w.a;for(let i=0;i<w.n;i++){h^=Math.round(a[i]*1000);h=Math.imul(h,16777619)}}return JSON.stringify({h:h>>>0,n:opaqueW.n+waterW.n})})()`))});
 assert.equal(JSON.stringify(mesh),'[{"h":2349763090,"n":52380},{"h":3897508280,"n":43560},{"h":1921417758,"n":18864}]','v5 meshes unchanged');
 const tile=[[8,512,1024],[2,960,704],[16,1536,0]].map(([s,x,z])=>JSON.parse(run(v5,`(()=>{const it=tileMesh(${s},${x},${z});let q;while(!(q=it.next()).done);let h=2166136261;for(let i=0;i<lw.n*12;i++){h^=lw.u8[i];h=Math.imul(h,16777619)}return JSON.stringify({h:h>>>0,n:lw.n})})()`)));
 assert.equal(JSON.stringify(tile),'[{"h":4285102453,"n":13432},{"h":3205140737,"n":24396},{"h":402233311,"n":4196}]','v5 far tiles unchanged');
 // The spot finder also works on old worlds, and a v5 save stays v5 after a reload.
 assert(run(v5,'save()'));const again=boot(v5.storage['nisekura-v1']);assert.equal(run(again,'terrainVersion'),5,'v5 save stays v5');
 console.log('PASS: v5 worlds keep identical terrain, blocks, near meshes and far tiles (saves stay on their generator)')}
{const seeds=[73219,5,999,31337,424242],stat=[];
 for(const sd of seeds){const w=boot(JSON.stringify({version:1,worldWidth:2048,worldHeight:192,terrainVersion:6,seed:sd,changes:[],inventory:{}}));const R=c=>run(w,c);
  assert.equal(R('SCENIC'),true);
  // Coast: share of cliff vs beach shoreline; the share differs from world to world.
  const co=JSON.parse(R(`(()=>{let n=0,cl=0,bc=0;for(let z=200;z<1850;z+=16){let x=1500,f=false;while(x>900){if(height4(x,z)>=SEA){f=true;break}x-=2}if(!f)continue;n++;const h0=height4(x,z);let rise=0;for(let d=2;d<=14;d+=2)rise=Math.max(rise,height4(x-d,z)-h0);if(rise>=9)cl++;else if(rise<=3)bc++}return JSON.stringify({n,cl:cl/n,bc:bc/n})})()`));
  assert(co.cl>.05&&co.cl<.8,`seed ${sd}: sea cliffs on part of the coast (${(co.cl*100).toFixed(0)}%)`);assert(co.bc>.12,`seed ${sd}: beaches remain (${(co.bc*100).toFixed(0)}%)`);
  // Terrain is continuous: no sheer walls from rings, island edges or cliff masks.
  const md=R(`(()=>{let m=0;for(let x=170;x<1400;x+=5)for(let z=170;z<1880;z+=5){const h=height4(x,z);m=Math.max(m,Math.abs(h-height4(x+1,z)),Math.abs(h-height4(x,z+1)))}return m})()`);assert(md<=24,`seed ${sd}: steepest step ${md}`);
  // Landmark peaks: at least one summit well above the treeline, and the highest point is bounded.
  const top=R(`(()=>{let m=0;for(let x=170;x<1400;x+=8)for(let z=170;z<1880;z+=8)m=Math.max(m,height4(x,z));return m})()`);assert(top>=SEA_+95&&top<=182,`seed ${sd}: peaks reach y${top}`);
  // River plains are open meadow: far fewer trees where the ground is kept open.
  const op=JSON.parse(R(`(()=>{let n=0,s=0,m=0,k=0;for(let x=300;x<1250;x+=10)for(let z=300;z<1750;z+=10){const h=height4(x,z);if(h<SEA+3)continue;const o=gOpen,L=gLand;vegEnv(x,z,h,0,0,L,humidity(x,z),o);if(o>.6){n++;s+=E.dens}else if(L>.8&&h<SEA+14){k++;m+=E.dens}}return JSON.stringify({n,d:n?s/n:0,k,m:k?m/k:0})})()`));
  if(op.n>5)assert(op.d<.35&&op.d<op.m*.7,`seed ${sd}: open ground is meadow (${op.d.toFixed(2)} vs ${op.m.toFixed(2)})`);
  // Spots: found for every kind that the terrain offers, deterministic, spaced, in the world, open and on land.
  const t0=Date.now(),sp=JSON.parse(R(`(()=>{const o={};const it=scanSpots(o);while(!it.next().done);return JSON.stringify(o.spots)})()`));const ms=Date.now()-t0;
  const sp2=JSON.parse(R(`(()=>{const o={};const it=scanSpots(o);while(!it.next().done);return JSON.stringify(o.spots)})()`));assert.equal(JSON.stringify(sp),JSON.stringify(sp2),'spot search is deterministic');
  const by=k=>sp.filter(s=>s.kind===k);assert(by('cliff').length>=1&&by('summit').length>=2&&by('valley').length>=1,`seed ${sd}: spots ${sp.map(s=>s.kind[0]).join('')}`);
  for(const k of['cliff','summit','valley','river']){const l=by(k);for(let i=0;i<l.length;i++)for(let j=i+1;j<l.length;j++)assert(Math.hypot(l[i].x-l[j].x,l[i].z-l[j].z)>250,'spots of one kind are spread out')}
  for(const s of sp){assert(s.x>0&&s.z>0&&s.x<2048&&s.z<2048&&s.h>=SEA_+1&&Number.isFinite(s.yaw),'spot is on land inside the world');assert(s.dens<=.5,'spot is not buried in forest')
   const H_=(x,z)=>w.api.height(Math.round(x),Math.round(z));
   if(s.kind==='summit'){assert(s.h>=SEA_+68);let low=0;for(let a=0;a<8;a++)if(s.h-H_(s.x+Math.cos(a*.785)*160,s.z+Math.sin(a*.785)*160)>=15)low++;assert(low>=6,'summit stands clear of its surroundings')}
   if(s.kind==='cliff'){const dx=Math.sin(s.yaw),dz=Math.cos(s.yaw);let drop=0,sea=false;for(let r=8;r<=300;r+=8){const q=H_(s.x+dx*r,s.z+dz*r);if(r<=96)drop=Math.max(drop,s.h-q);if(q<SEA_-2)sea=true}assert(drop>=10&&sea,'cliff drops toward open sea')}
   if(s.kind==='river'){let water=false;for(let r=8;r<=160&&!water;r+=8)for(let a=0;a<8;a++)if(H_(s.x+Math.cos(a*.785)*r,s.z+Math.sin(a*.785)*r)<SEA_-1)water=true;assert(water&&s.h-SEA_>=3&&s.h-SEA_<=12,'river plain lies beside water')}}
  // The starting view: on land above the sea, not inside a forest.
  const V=w.api.vista,vd=R(`(()=>{const h=height4(${V.x},${V.z});vegEnv(${V.x},${V.z},h,0,0,gLand,humidity(${V.x},${V.z}),gOpen);return E.dens})()`);assert(V.eye>SEA_+6&&vd<.6,`seed ${sd}: vista is open (density ${vd.toFixed(2)})`);
  stat.push({sd,cl:co.cl,ms,spots:sp.length})}
 assert(Math.max(...stat.map(s=>s.cl))-Math.min(...stat.map(s=>s.cl))>.15,'cliff share differs between worlds');
 console.log(`PASS: scenic landforms over ${seeds.length} seeds: cliffs ${stat.map(s=>(s.cl*100).toFixed(0)+'%').join('/')}, spots ${stat.map(s=>s.spots).join('/')}, search ${Math.max(...stat.map(s=>s.ms))}ms max`)}

{// "絶景スポットへ": cycles through the spots, always standing safely on open ground facing the view; legacy worlds are left alone.
 const d=boot(),R=c=>run(d,c);R('paused=true');
 const first=R('(()=>{nextSpot();return JSON.stringify({x:player.x,y:player.y,z:player.z,yaw,n:spotList.length,i:spotIdx,paused})})()');const f=JSON.parse(first);
 assert(f.n>=8&&f.i===0&&f.paused===false,'first press searches and jumps to the first spot');
 const seen=new Set();let clear=0;for(let i=0;i<f.n+2;i++){const s=JSON.parse(R('(()=>{const p=spotList[spotIdx];return JSON.stringify({kind:p.kind,w:!!p.w,x:p.x,z:p.z,px:player.x,py:player.y,pz:player.z,col:collides(player),flying})})()'));
  if(s.w){assert(!s.col,'v9 wonder visits land in open space');R('nextSpot()');continue} // wonders pick their own viewpoints (tested in the v9 block)
  assert(!s.col&&!s.flying&&Math.hypot(s.px-s.x-.5,s.pz-s.z-.5)<=21,'player stands near the spot without colliding');seen.add(s.kind);
  let wood=0;for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)for(let dy=1;dy<=8;dy++){const t=d.api.get(Math.floor(s.px)+dx,Math.floor(s.py)+dy,Math.floor(s.pz)+dz);if([4,5,13,14,15,16].includes(t))wood++}
  if(!s.fallback)clear+=wood===0?1:0;R('nextSpot()')}
 const classic=JSON.parse(R('spotList.filter(s=>!s.w).length'));assert(clear>=classic-2,`spots land in the open (${clear}/${classic})`);
 assert.equal(seen.size,4,'all four kinds of spot are visited');assert.equal(R('spotIdx'),(f.n+2)%f.n,'spots cycle');
 // Mined or placed blocks near a spot survive; the player's edits are not touched by the search.
 d.api.edit(Math.floor(f.x),Math.floor(f.y)+3,Math.floor(f.z),8);assert.equal(d.api.get(Math.floor(f.x),Math.floor(f.y)+3,Math.floor(f.z)),8);
 const v3=boot(JSON.stringify({version:1,worldWidth:2048,worldHeight:96,terrainVersion:3,seed:73219,changes:[],inventory:{}})),px=v3.api.player.x;run(v3,'nextSpot()');assert.equal(v3.api.player.x,px,'legacy worlds ignore the spot button');
 const v4=boot(JSON.stringify({version:1,worldWidth:2048,worldHeight:192,terrainVersion:4,seed:73219,changes:[],inventory:{}}));run(v4,'nextSpot()');assert(run(v4,'spotList.length')>0&&!v4.api.collides(v4.api.player),'older GRAND worlds get spots too');
 // The far-field worker agrees with the main thread on the new landforms (sea cliff, landmark peak).
 const src=R('lodWorkerSource()');let out=null;const wc={Math,Int16Array,Uint8Array,Float32Array,ArrayBuffer,JSON,Number,Array,postMessage:m=>out=m};vm.createContext(wc);vm.runInContext(src,wc);
 for(const [step,x0,z0] of [[8,1024,512],[4,1152,1600],[8,768,512]]){wc.onmessage({data:{id:3,step,x0,z0}});
  const main=JSON.parse(R(`(()=>{const it=tileMesh(${step},${x0},${z0});let r;while(!(r=it.next()).done);return JSON.stringify({r:r.value,b:Array.from(lw.u8.subarray(0,lw.n*12))})})()`));
  assert.equal(JSON.stringify(out.r),JSON.stringify(main.r),'worker bounds match');assert.equal(out.bytes.length,main.b.length);for(let i=0;i<main.b.length;i+=53)assert.equal(out.bytes[i],main.b[i],'worker bytes match')}
 console.log(`PASS: spot button (${f.n} spots, 4 kinds, cycling, safe landing), legacy worlds untouched, worker matches main thread on scenic tiles`)}

// ---- Phase 9: volumetric clouds and sky layers.
{const d=boot(),R=c=>run(d,c);
 // Clouds: deterministic per cell, a mix of kinds and sizes, with gaps of open sky.
 const cl=JSON.parse(R(`(()=>{const o=[];let n=0,cells=0;const kinds=new Set(),sizes=new Set(),bases=new Set(),hs=new Set();
  for(let gx=-20;gx<20;gx++)for(let gz=-20;gz<20;gz++){cells++;const c=cloudAt(gx,gz),c2=cloudAt(gx,gz);if(JSON.stringify(c)!==JSON.stringify(c2))return JSON.stringify('nondeterministic');
   if(!c)continue;n++;kinds.add(c.kind);sizes.add(c.nx*c.ny*c.nz);bases.add(c.y);hs.add(c.ny);let occ=0;for(const v of c.occ)occ+=v;if(occ<1||c.nx*c.ny*c.nz>200)return JSON.stringify('bad shape '+gx+','+gz)}
  return JSON.stringify({cover:n/cells,kinds:[...kinds].sort(),sizes:sizes.size,bases:bases.size,thick:[...hs].sort()})})()`));
 assert.notEqual(cl,'nondeterministic');assert(typeof cl==='object',String(cl));
 assert(cl.cover>.25&&cl.cover<.7,`cloud cover leaves open sky (${(cl.cover*100).toFixed(0)}%)`);assert.deepEqual(cl.kinds,[0,1,2],'cumulus, stratus and puffs');assert(cl.sizes>=10&&cl.bases>=4&&cl.thick.length>=3,'clouds differ in size, height and thickness');
 // Mesh: only exposed faces, finite data, packed colour channels in range, quad budget grows with quality.
 const stat={};for(const q of['low','standard','high']){R(`Q=QUALITY.${q};buildClouds(1000,1000)`);
  stat[q]=JSON.parse(R(`(()=>{const a=cw.a;let bad=0,max=0;for(let i=0;i<cw.n;i+=9){const r=a[i+3],g=a[i+4],b=a[i+5],m=a[i+8];if(!(r>=0&&r<=1&&g>=.84&&g<=1&&b>=0&&b<=1&&a[i+1]>40&&Number.isFinite(a[i])&&Number.isFinite(a[i+2])))bad++;const face=Math.floor(m/32),mat=m-face*32;if(mat!==18||face>5)bad++}return JSON.stringify({quads:cloudQuads,bad})})()`))}
 assert(stat.low.quads>200&&stat.low.quads<stat.standard.quads&&stat.standard.quads<stat.high.quads&&stat.high.quads<40000,`cloud quads ${stat.low.quads}/${stat.standard.quads}/${stat.high.quads}`);
 assert.equal(stat.low.bad+stat.standard.bad+stat.high.bad,0,'cloud vertices are valid');
 const solid=JSON.parse(R(`(()=>{let faces=0,vox=0;for(let gx=0;gx<12;gx++)for(let gz=0;gz<12;gz++){const c=cloudAt(gx,gz);if(!c)continue;const{nx,ny,nz,occ}=c;const at=(i,j,k)=>i<0||j<0||k<0||i>=nx||j>=ny||k>=nz?0:occ[(j*nz+k)*nx+i];
  for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)if(occ[(j*nz+k)*nx+i]){vox++;for(const f of FACE)if(!at(i+f.n[0],j+f.n[1],k+f.n[2]))faces++}}return JSON.stringify({faces,vox})})()`));
 assert(solid.faces<solid.vox*5,'faces between neighbouring cloud blocks are not drawn');
 // Shaders: layers exist in the sky shader, clouds are mirrored in the sea, the new uniform is wired and stage-local.
 const sky=d.api.skyFragmentSource,water=R('waterFragmentSource');
 assert(sky.includes('skyDeck(d,')&&sky.includes('skyCirrus(d)')&&sky.includes('uniform vec4 skyP'),'sky fragment draws both cloud layers');
 assert(water.includes('skyDeck(r,fp>3.?-1.:0.)'),'water mirrors clouds');assert(!R('fragmentSource').includes('skyDeck(r'),'terrain shader has no reflection code');
 assert(R('SKY_UNIFORMS').includes('skyP'));
 // A far rebuild is spread over frames: the old mesh stays until the new one is ready.
 R('Q=QUALITY.standard;cloudGen=null;buildClouds(500,500);var __t=0;performance.now=()=>(__t+=1)');const q0=R('cloudQuads'),ax0=R('cloudAX');R('updateClouds(500+cloudRadius()*.5,500)');assert(R('cloudGen')!==null&&R('cloudAX')===ax0&&R('cloudQuads')===q0,'rebuild starts without replacing the visible mesh');
 let steps=0;while(R('cloudGen')!==null&&steps++<500)R('updateClouds(500+cloudRadius()*.5,500)');assert(R('cloudAX')!==ax0&&R('cloudQuads')>0,'rebuild finishes and swaps the mesh'); R('performance.now=()=>0');
 const calls=[];R(`gl.uniform4f=(l,...a)=>{if(l&&l.n==='skyP')__calls.push(a)}`);d.c.__calls=calls;
 R(`(()=>{const u={sunDir:1,zenithCol:1,horizonCol:1,sunCol:1,fogP:1,dirLight:1,dirCol:1,ambCol:1,misc:1,skyP:{n:'skyP'}};const env=skyEnv(sunFromTime(.5));cloudDrift=123.5;time=100;Q=QUALITY.high;setEnv(u,env,[1,1,1,0])})()`);
 assert(calls.length===1&&calls[0][0]===123.5&&calls[0][1]>.1&&calls[0][1]<.9&&calls[0][2]===2,`sky uniform carries drift, cover and quality ${JSON.stringify(calls[0])}`);
 // Lighting inputs follow the time of day: warm and low at sunset, cool and dim at night.
 const env=t=>JSON.parse(R(`JSON.stringify(skyEnv(sunFromTime(${t})))`));const noon=env(.5),dusk=env(.74),night=env(0);
 assert(dusk.dirCol[0]>dusk.dirCol[2]*1.5,'sunset cloud light is warm');assert(noon.amb[1]>night.amb[1]*2.5,'night clouds are dark');
 console.log(`PASS: clouds: cover ${(cl.cover*100).toFixed(0)}%, ${cl.sizes} sizes, 3 kinds, quads ${stat.low.quads}/${stat.standard.quads}/${stat.high.quads} (low/standard/high), hidden faces culled, sky layers + sea reflection wired`)}

// ---- Phase 10: creatures (animals, birds, sea life, monsters), natural spawning, AI, eggs and saves.
{const d=boot(),R=c=>run(d,c),J=c=>JSON.parse(R(`JSON.stringify(${c})`));
 const want=['cow','pig','sheep','chicken','horse','deer','fox','rabbit','wolf','squirrel','aji','tai','ayu','clown','tang','turtle','dolphin','squid','goat','eagle','songbird','gull','starling','zombie','skeleton','spider','slime','bomb','wisp','crawler'];
 const sp=J(`LIFE_SPECIES.map(s=>({id:s.id,cat:s.cat,group:s.group,nq:s.nq,nb:s.nb,move:s.move}))`);
 for(const id of want)assert(sp.some(s=>s.id===id),'species '+id);
 assert.equal(sp.filter(s=>s.cat==='monster'&&s.group==='モンスター').length,7,'seven monster types');assert.deepEqual(sp.filter(s=>s.group==='洞窟').map(s=>s.id),['caveSpider','crystalSlime'],'two v16 cave monsters');assert(sp.every(s=>s.nb<=16&&s.nq>=12&&s.nq<1200),'model budgets');
 // Models: finite vertices, valid bones, and no two species share a shape.
 const m=J(`(()=>{const a=lifeModel.a,out=[];for(const s of LIFE_SPECIES){let h=2166136261,bad=0;for(let i=s.q0*36;i<(s.q0+s.nq)*36;i++){const v=a[i];if(!Number.isFinite(v))bad++;if(i%9<3){h^=Math.round(v*16);h=Math.imul(h,16777619)}}
   for(let i=s.q0*36+8;i<(s.q0+s.nq)*36;i+=9)if(Math.floor(a[i]/128)>=s.nb)bad++;
   out.push({id:s.id,h:h>>>0,bad,par:s.par.every((p,i)=>i===0?p===-1:p>=0&&p<i)})}return out})()`);
 assert(m.every(x=>!x.bad&&x.par),'models are valid');assert.equal(new Set(m.map(x=>x.h)).size,m.length,'every species has its own model');
 // Poses and bone matrices stay finite in every behaviour; the root maps model +z to the creature's heading.
 assert(R(`(()=>{const cam={x:0,y:0,z:0};for(const s of LIFE_SPECIES){const c=lifeNew(s,10,70,10,false);for(const mode of ['idle','walk','flee','graze','rear','fuse','freeze','chase']){c.mode=mode;c.speed=s.run;c.air=s.move==='fly';c.ground=mode!=='walk';c.t+=.7;c.ph+=.9;c.swell=.5;c.sq=.2;lifePose(c);lifeMatrices(c,cam);if(!c.M.subarray(0,s.nb*12).every(Number.isFinite))return false}lifeRemove(c)}return true})()`),'poses are finite');
 const rootT=J(`(()=>{const c=lifeNew(COW,10,70,10,false,1);c.yaw=Math.PI/2;c.pitch=0;c.roll=0;lifePose(c);lifeMatrices(c,{x:0,y:0,z:0});const M=c.M,p=[0,0,16];const r=[0,1,2].map(i=>M[i*4]*p[0]+M[i*4+1]*p[1]+M[i*4+2]*p[2]+M[i*4+3]);lifeRemove(c);return r})()`);
 assert(Math.abs(rootT[0]-11)<1e-4&&Math.abs(rootT[1]-70)<1e-4&&Math.abs(rootT[2]-10)<1e-4,'yaw PI/2 faces +x');
 // Shaders: stage-local uniforms, enough bone slots for the biggest rig.
 const names=src=>new Set([...src.matchAll(/uniform\s+(?:\w+\s+)?(?:vec[234]|float|mat[234])\s+(\w+)/g)].map(x=>x[1]));const lv=R('lifeVertexSource'),lf=R('lifeFragmentSource');
 for(const n of names(lv))assert(!names(lf).has(n),'life uniform '+n+' declared in both stages');assert(+lv.match(/uniform vec4 B\[(\d+)\]/)[1]>=Math.max(...sp.map(s=>s.nb))*3,'bone uniform array fits');
 // Natural spawning in daylight around the start: land animals on dry ground, sea life in water, birds above ground, no monsters.
 const changes0=R('changes.size');R('paused=false;dayTime=.45;timeOverride=.45;life.length=0');for(let i=0;i<120&&R('readyR')<2;i++)R('streamChunks()');
 const t0=Date.now();R('for(let k=0;k<900;k++)updateLife(.1,player)');const simMs=Date.now()-t0;
 const check=()=>J(`(()=>{const bad=[],cnt={};for(const c of life){cnt[c.sp.cat]=(cnt[c.sp.cat]||0)+1;const X=Math.floor(c.x),Y=Math.floor(c.y),Z=Math.floor(c.z);if(c.dormant)continue;
   if(![c.x,c.y,c.z,c.yaw].every(Number.isFinite))bad.push(c.sp.id+' NaN');
   if(c.sp.cat==='water'&&peek(X,Y,Z)!==10&&!c.leap&&!c.stranded)bad.push(c.sp.id+' dry');
   if((c.sp.cat==='land'||c.sp.cat==='monster')&&c.sp.move!=='float'){const t=peek(X,Y,Z);if(t===10)bad.push(c.sp.id+' in water');if(t>0&&t!==10)bad.push(c.sp.id+' inside a block');if(c.ground&&!(peek(X,Math.floor(c.y-.05),Z)>0))bad.push(c.sp.id+' floats')}
   if(c.sp.cat==='bird'&&c.air&&c.y<terrainH(X,Z)-.5)bad.push(c.sp.id+' underground')}return{cnt,bad,n:life.length,nat:life.filter(c=>!c.manual).length,cap:lifeCap(),kinds:[...new Set(life.map(c=>c.sp.id))]}})()`);
 const day=check();assert.deepEqual(day.bad,[],'creatures stand, swim and fly in the right places: '+day.bad.join(','));
 assert(day.nat>=10&&day.nat<=day.cap+6,`natural count within cap (${day.nat}/${day.cap})`);assert(!day.cnt.monster,'no monsters by day: '+JSON.stringify(J('life.filter(c=>c.sp.cat==="monster").map(c=>c.sp.id)')));assert(day.cnt.land>=4,'land animals spawn');assert(day.kinds.length>=4,'several species: '+day.kinds.join(','));
 // Night brings monsters; daybreak sends them away.
 R('dayTime=.95;timeOverride=.95;for(let k=0;k<900;k++)updateLife(.1,player)');const night=check();assert.deepEqual(night.bad,[],'night placement: '+night.bad.join(','));assert(night.cnt.monster>=1,'monsters appear at night');
 const mons=J(`life.filter(c=>c.sp.cat==='monster').map(c=>Math.hypot(c.x-player.x,c.z-player.z))`);
 R('dayTime=.45;timeOverride=.45;for(let k=0;k<300;k++)updateLife(.1,player)');assert(!check().cnt.monster,'monsters leave at daybreak');
 // A long session flying across the world: the population and the object pool stay bounded, nothing becomes NaN, the world is never edited.
 let maxN=0,maxPool=0;R('flying=true');for(let s=0;s<60;s++){R(`player.x=Math.min(${2000},player.x+12);player.z=player.z+Math.sin(${s}*.3)*6;player.y=Math.max(player.y,terrainH(Math.floor(player.x),Math.floor(player.z))+3);dayTime=${s%20<10?.45:.95};streamChunks();for(let k=0;k<200;k++)updateLife(.1,player)`);
  maxN=Math.max(maxN,R('life.filter(c=>!c.manual).length'));maxPool=Math.max(maxPool,R('lifePool.length'))}
 const after=check();assert.deepEqual(after.bad,[],'after a long flight: '+after.bad.join(','));assert(maxN<=R('LIFE_Q[qualityName].cap')+10,`population bounded (max ${maxN})`);assert(maxPool<120,'object pool bounded');
 assert.equal(R('changes.size'),changes0,'creatures never edit the world');
 // Low frame rate thins the herds.
 R('lifeScale=.45;for(let k=0;k<200;k++)updateLife(.1,player)');assert(R('life.filter(c=>!c.manual).length')<=R('lifeCap()')+6,'surplus leaves when the frame rate drops');R('lifeScale=1');
 // Natural spawning switch: animals only (no monsters at night), then off (natural creatures leave; placed ones stay).
 R(`spawn();flying=true;player.y+=2;streamChunks(true);setLifeMode('animals');dayTime=.95;for(let k=0;k<600;k++)updateLife(.1,player)`);assert(!check().cnt.monster,'animals-only mode has no monsters');
 // Spawn eggs: place a horse by looking at the ground, refuse fish on land, place fish in water, send a creature home, honour the cap.
 const V=d.api.vista;R(`life.length=0;eggSp=LIFE_BY_ID.horse.i;player.x=${V.x}+.5;player.z=${V.z}+.5;player.y=surface(player.x,player.z)+1.5;yaw=0;pitch=-.7;placeEgg()`);
 const egg=J(`life.filter(c=>c.manual).map(c=>({id:c.sp.id,x:c.x,y:c.y,z:c.z,below:peek(Math.floor(c.x),Math.floor(c.y)-1,Math.floor(c.z))}))`);
 assert(egg.length===1&&egg[0].id==='horse'&&egg[0].below>0&&egg[0].below!==10,'egg places a horse on the ground in front');
 R('eggSp=LIFE_BY_ID.aji.i;placeEgg()');assert.equal(R('life.filter(c=>c.manual).length'),1,'fish cannot be placed on land');
 const sea=J(`(()=>{for(let r=20;r<400;r+=4)for(let a=0;a<16;a++){const x=Math.floor(player.x+Math.sin(a*.39)*r),z=Math.floor(player.z+Math.cos(a*.39)*r);if(terrainH(x,z)<SEA-4)return[x,z]}return null})()`);
 R(`player.x=${sea[0]}+.5;player.z=${sea[1]}+.5;player.y=SEA+3;flying=true;streamChunks(true);pitch=-1.2;placeEgg()`);assert.equal(R('life.filter(c=>c.manual&&c.sp.id==="aji").length'),1,'fish can be placed in the sea');
 R('for(let k=0;k<200;k++)updateLife(.05,player)');assert(R('(()=>{const c=life.find(c=>c.sp.id==="aji");return peek(Math.floor(c.x),Math.floor(c.y),Math.floor(c.z))===10})()'),'placed fish keeps swimming in water');
 // Tap placement: the centre of the screen is the view direction.
 const sd=J(`(canvas.getBoundingClientRect=()=>({left:0,top:0,width:800,height:600}),yaw=.4,pitch=-.3,screenDir(400,300))`);assert(Math.hypot(sd[0]-Math.sin(.4)*Math.cos(-.3),sd[1]-Math.sin(-.3),sd[2]-Math.cos(.4)*Math.cos(-.3))<1e-6,'tap ray matches the view');
 R(`player.x=${V.x}+.5;player.z=${V.z}+.5;player.y=surface(player.x,player.z)+1.5;yaw=0;pitch=0;streamChunks(true);const c=lifeNew(LIFE_BY_ID.sheep,player.x,player.y+1.62-LIFE_BY_ID.sheep.top*.5,player.z+3,true,1);c.dormant=false`);
 assert(R('shooEgg([0,0,1])')===true&&!R('life.some(c=>c.manual&&c.sp.id==="sheep")'),'pointing 壊す at a creature sends it home');
 R('eggSp=LIFE_BY_ID.rabbit.i;pitch=-.7;for(let i=0;i<90;i++)placeEgg()');assert.equal(R('life.filter(c=>c.manual).length'),R('MANUAL_MAX'),'placed creatures are capped');
 // Saved and restored with the world; natural ones are not saved. Natural spawning off removes natural creatures only.
 R(`setLifeMode('off');life.push(lifeNew(COW,player.x+2,player.y,player.z,false));for(let k=0;k<40;k++)updateLife(.1,player)`);assert.equal(R('life.filter(c=>!c.manual).length'),0,'switching natural spawning off clears natural creatures');
 assert(d.api.save());const saved=JSON.parse(d.storage['nisekura-v1']);assert.equal(saved.life.mode,'off');assert.equal(saved.life.eggs.length,80,'eggs are saved');
 const e=boot(d.storage['nisekura-v1']);assert.equal(run(e,'life.filter(c=>c.manual).length'),80,'eggs reload');assert.equal(run(e,'lifeMode'),'off','spawn setting reloads');
 assert.equal(run(e,'life.filter(c=>c.sp.id==="aji").length'),1,'the fish reloads too');
 // Old saves without creature data load with natural spawning on and no placed creatures.
 const old=JSON.parse(d.storage['nisekura-v1']);delete old.life;delete old.integrity;delete old.settings;const f=boot(JSON.stringify(old));assert.equal(run(f,'lifeMode'),'all');assert.equal(run(f,'life.filter(c=>c.manual).length'),0);
 // UI: egg picker icons, chip, menu label; voices never throw without audio.
 R('openEggs()');assert(!d.nodes.eggs.classList.contains('hidden'),'egg picker opens');R('play()');assert(d.nodes.eggs.classList.contains('hidden'),'egg picker closes on play');
 R('eggSp=LIFE_BY_ID.wolf.i;refresh()');assert(!d.nodes.eggChip.classList.contains('hidden'),'egg chip shows');R('selected=2;eggSp=-1;refresh()');assert(d.nodes.eggChip.classList.contains('hidden'));
 // Survival has no creature-placing UI: the picker cannot open, a chosen egg is dropped and nothing can be placed.
 {const s=boot();run(s,"lifeNew;eggSp=LIFE_BY_ID.wolf.i;life.length=0;gameMode='survival';refresh()");assert.equal(run(s,'eggSp'),-1,'survival drops a chosen egg');assert(s.c.document.body.classList.contains('mode-survival'));assert(s.nodes.eggChip.classList.contains('hidden'),'no egg chip in survival');
 run(s,'paused=false;openEggs()');assert.equal(run(s,'paused'),false,'egg picker cannot open in survival');run(s,'eggSp=LIFE_BY_ID.cow.i;placeEgg()');assert.equal(run(s,'life.filter(c=>c.manual).length'),0,'nothing is placed in survival');}
 R('for(const s of LIFE_SPECIES)if(s.voice)lifeVoice(life[0]||{x:0,y:0,z:0},s.voice)');
 console.log(`PASS: creatures: ${sp.length} species (7 monsters), unique models, finite poses, daytime ${day.nat} natural (${day.kinds.length} kinds), night monsters ${night.cnt.monster} (nearest ${Math.min(...mons).toFixed(0)}m), bounded over a long flight (max ${maxN}), eggs place/remove/cap/save/reload, sim ${(simMs/900).toFixed(2)} ms/step`)}

// ---- Save protection: exercise real storage failures and transactional UI paths.
{
 const d=boot(legacy),K='nisekura-v1',B=K+'-backup',A=K+'-protected';
 assert.equal(d.storage[K],legacy,'opening a legacy world never migrates storage');
 assert(d.api.save());const first=d.storage[K];assert.equal(d.storage[B],legacy,'first migration retains exact legacy bytes');
 let writes=0;const setItem=d.c.localStorage.setItem;d.c.localStorage.setItem=(k,v)=>{writes++;setItem(k,v)};
 assert(d.api.save());assert.equal(writes,0,'identical snapshots skip writes');
 run(d,'player.x+=1;flying=true;dayTime=.72;inventory[7]=123');assert(d.api.save());assert.equal(d.storage[B],first);
 const current=d.storage[K],round=boot(current);assert.equal(round.api.player.x,d.api.player.x);assert(run(round,'flying'));assert.equal(round.api.inventory[7],123);assert.equal(run(round,'dayTime'),.72);
 for(const failingKey of [B,K]){d.c.localStorage.setItem=(k,v)=>{if(k===failingKey)throw Error('QuotaExceededError');setItem(k,v)};run(d,'dayTime+=.001');assert.equal(d.api.save(),false);assert.equal(d.storage[K],current,'quota failure preserves primary');assert.equal(d.storage[B],failingKey===B?first:current,'backup stays valid');assert.match(d.nodes.saveInfo.textContent,/保存失敗/)}
 d.c.localStorage.setItem=setItem;assert(d.api.save());
 const before=JSON.stringify(d.storage);d.c.confirm=()=>false;assert.equal(run(d,'importWorld(encodeSave(snapshot()))'),false);assert.equal(JSON.stringify(d.storage),before,'cancel import touches nothing');d.nodes.reset.onclick();assert.equal(JSON.stringify(d.storage),before,'cancel reset touches nothing');
 d.c.confirm=()=>true;d.c.localStorage.setItem=(k,v)=>{if(k===K)throw Error('QuotaExceededError');setItem(k,v)};
 assert.equal(run(d,'importWorld(encodeSave({...snapshot(),seed:123}))'),false);assert.equal(run(d,'resettingWorld'),false);assert.equal(d.storage[K],JSON.parse(before)[K]);assert(d.storage[A],'failed import has recoverable checkpoint');
 d.c.localStorage.setItem=setItem;assert(run(d,'importWorld(encodeSave({...snapshot(),seed:123}))'));assert.equal(JSON.parse(d.storage[K]).seed,123);const replaced=d.storage[K];d.windowEvents.pagehide();d.c.onblur();assert.equal(d.storage[K],replaced,'old callbacks cannot overwrite import');
 const restored=boot(replaced,{}, {[A]:d.storage[A]});restored.nodes.restoreProtected.onclick();assert.equal(JSON.parse(restored.storage[K]).seed,73219,'protected world is restorable');
 console.log('PASS: legacy migration, unchanged-save elision, movement/time/inventory/flight, quota failures, import rollback and cancellation');
}
{
 const K='nisekura-v1',B=K+'-backup',A=K+'-protected',bad='{broken',d=boot(bad,{}, {[B]:legacy});
 assert(run(d,'storageBlocked'));assert.equal(d.api.save(),false);d.events.visibilitychange();d.windowEvents.pagehide();assert.equal(d.storage[K],bad);
 d.c.confirm=()=>false;assert.equal(run(d,'recoverWorld()'),false);assert.equal(d.storage[K],bad);
 d.c.confirm=()=>true;assert(run(d,'recoverWorld()'));assert.equal(d.storage[K],legacy);assert.equal(d.storage[A],bad,'corrupt original retained verbatim for export');
 const noBackup=boot(bad);assert.equal(run(noBackup,'recoverWorld()'),false);assert.equal(noBackup.storage[K],bad);noBackup.nodes.reset.onclick();assert.equal(noBackup.storage[K],bad);
 const valid=boot(legacy);valid.api.save();let altered=JSON.parse(valid.storage[K]);altered.seed++;const damaged=boot(JSON.stringify(altered));assert(run(damaged,'storageBlocked'));assert.equal(damaged.api.save(),false);
 for(const patch of [{terrainVersion:12},{changes:[[1,999]]},{changes:[[1]]},{inventory:{'__proto__':1,'999':1}},{life:{mode:'all',eggs:[['unknown',1,1,1,0,1]]}},{player:{x:NaN,y:20,z:30}}]){valid.c.patch=patch;assert.throws(()=>run(valid,'encodeSave({...snapshot(),...patch})'))}
 valid.storage[K]=legacy;assert.equal(valid.api.save(),false,'different tab must not be overwritten');assert.equal(valid.storage[K],legacy);
 console.log('PASS: corruption, checksum mismatch, missing backup, rejected schema, explicit recovery and other-tab protection');
}
{
 // Exact baseline from the same generator, including vegetation, water and cross-chunk leaves.
 for(const version of [1,2,3,4,5,6,7]){
  const d=boot(JSON.stringify({version:1,terrainVersion:version,seed:73219,changes:[],inventory:{}}));
  run(d,`for(const [cx,cz]of [[2,2],[63,46]]){const base=generateChunk(cx,cz),types=new Set();for(let y=0;y<H;y++)for(let z=cz*16;z<cz*16+16;z++)for(let x=cx*16;x<cx*16+16;x++){const t=base[localIdx(x,y,z)];if(types.has(t))continue;types.add(t);edit(x,y,z,t===8?7:8);edit(x,y,z,t);if(changes.has(idx(x,y,z)))throw Error('redundant edit retained: '+t);if(get(x,y,z)!==t)throw Error('baseline changed')}}`);
  assert.equal(run(d,'changes.size'),0);d.api.edit(40,30,40,8);d.api.edit(40,30,40,8);assert.equal(run(d,'changes.size'),1);assert.equal(run(d,'changeIndex.get(chunkKey(40,40)).length'),1);assert(d.api.save());const reload=boot(d.storage['nisekura-v1']);assert.equal(reload.api.get(40,30,40),8);assert.equal(run(reload,'terrainVersion'),version);
 }
 console.log('PASS: v1–v7 exact terrain/vegetation/water edit undo, unique indices, building roundtrips');
}
{
 const K='nisekura-v1',A=K+'-protected',d=boot(legacy);d.api.edit(30,30,30,9);d.nodes.reset.onclick();assert.equal(d.storage[K],undefined);assert.equal(JSON.parse(d.storage[A]).changes.find(e=>e[0]===30+2048*(30+2048*30))[1],9,'reset checkpoints unsaved construction');
 const next=boot(null,{}, {[A]:d.storage[A]});assert.equal(run(next,'terrainVersion'),11,'archive never auto-resurrects');next.api.save();run(next,'dayTime+=.1');next.api.save();assert.equal(next.storage[A],d.storage[A],'autosave cannot overwrite protected world');
 const failed=boot(legacy);failed.c.localStorage.setItem=()=>{throw Error('QuotaExceededError')};failed.nodes.reset.onclick();assert.equal(failed.storage[K],legacy);assert.equal(run(failed,'resettingWorld'),false);
 const auto=boot(legacy);run(auto,'paused=false;frame(16001)');assert(auto.storage[K]);assert(JSON.parse(auto.storage[K]).integrity);run(auto,'dayTime=.64');auto.c.document.hidden=true;auto.events.visibilitychange();assert.equal(JSON.parse(auto.storage[K]).dayTime,.64);
 run(auto,'dayTime=.65');auto.windowEvents.pagehide();assert.equal(JSON.parse(auto.storage[K]).dayTime,.65);
 let idle;auto.c.requestIdleCallback=cb=>{idle=cb};run(auto,'queueSave();queueSave()');assert(run(auto,'saveQueued'));idle();assert.equal(run(auto,'saveQueued'),false);
 console.log('PASS: reset checkpoint, no resurrection, failed reset, 15-second autosave, background flush, idle coalescing');
}
{
 const d=boot(legacy);let downloaded,clicked=false,removed=false,revoked=false,delay;
 d.c.Blob=class{constructor(parts,options){downloaded=parts.join('');assert.equal(options.type,'application/json')}};
 d.c.URL={createObjectURL:()=> 'blob:test',revokeObjectURL:()=>{revoked=true}};d.c.setTimeout=(cb,ms)=>{delay=ms;return 1};
 const create=d.c.document.createElement;d.c.document.createElement=tag=>tag==='a'?{click(){clicked=true},remove(){removed=true}}:create(tag);
 run(d,'exportWorld()');assert(clicked&&removed);assert.equal(delay,60000);assert(!revoked,'Safari download URL is not revoked immediately');assert.equal(JSON.parse(downloaded).seed,73219);d.c.downloaded=downloaded;assert(run(d,'decodeSave(downloaded)'));
 assert.match(fs.readFileSync(__dirname+'/index.html','utf8'),/type="file" accept=".json,application\/json"/);
 console.log('PASS: JSON export roundtrip, Blob download and file-input compatibility structure (real Safari unverified)');
}
{
 const d=boot(legacy);run(d,"life.length=0;lifeNew(LIFE_BY_ID.zombie,35,35,35,true,1);lifeNew(LIFE_BY_ID.cow,36,35,35,true,1);selected=4;eggSp=LIFE_BY_ID.zombie.i;qualityName='low';hudMinimal=true;hudDetails=true;lifeVoices=false;yaw=.42;pitch=-.31");assert(d.api.save());
 const r=boot(d.storage['nisekura-v1']);assert.equal(run(r,'life.filter(c=>c.manual).length'),2);assert(run(r,'life.some(c=>c.manual&&c.sp.id==="zombie")'));assert.equal(run(r,'selected'),4);assert.equal(run(r,'eggSp'),run(d,'eggSp'));assert.equal(run(r,'qualityName'),'low');assert(run(r,'hudMinimal&&hudDetails&&!lifeVoices'));assert.equal(run(r,'yaw'),.42);assert.equal(run(r,'pitch'),-.31);
 const K='nisekura-v1',B=K+'-backup',A=K+'-protected',arch=legacy,primary=d.storage[K],t=boot(primary,{}, {[A]:arch});const set=t.c.localStorage.setItem;t.c.localStorage.setItem=(k,v)=>{if(k===K)throw Error('QuotaExceededError');set(k,v)};t.nodes.restoreProtected.onclick();assert.equal(t.storage[K],primary);assert.equal(t.storage[B],arch,'failed protected-world swap keeps the restore target');assert(t.storage[A]);
 console.log('PASS: placed monsters/animals, selected egg, view and settings, failed protected checkpoint swap');
}
(async()=>{
 const d=boot(legacy),before=JSON.stringify(d.storage);d.c.confirm=()=>false;
 for(const file of [undefined,{size:100,text:async()=>legacy}]){const target={files:file?[file]:[],value:'chosen'};await d.nodes.importFile.onchange({target});assert.equal(target.value,'');assert.equal(JSON.stringify(d.storage),before)}
 d.c.confirm=()=>true;
 for(const file of [{size:20*1024*1024,text:async()=>{throw Error('must not read oversized file')}},{size:10,text:async()=>'{broken'},{size:10,text:async()=>{throw Error('read failed')}}]){await d.nodes.importFile.onchange({target:{files:[file],value:'chosen'}});assert.equal(JSON.stringify(d.storage),before)}
 await d.nodes.importFile.onchange({target:{files:[{size:legacy.length,text:async()=>legacy}],value:'chosen'}});assert(run(d,'resettingWorld'));assert(d.storage['nisekura-v1-protected']);
 console.log('PASS: asynchronous file selection, cancellation, size/parse/read failures and successful import');
})().catch(e=>{console.error(e);process.exitCode=1});

// ---- Mobile performance: command equivalence, cadence, resource lifetimes and async UI.
{
 const d=boot(legacy);run(d,'life.length=0;readyR=8;for(let i=0;i<12;i++)lifeNew(LIFE_SPECIES[i%2],player.x+(i%3),player.y,player.z+10+i,true,1)');
 let binds=0,pointers=0,draws=[];d.gl.bindBuffer=()=>binds++;d.gl.vertexAttribPointer=()=>pointers++;d.gl.drawElements=(mode,n,type,offset)=>draws.push({n,offset});
 run(d,'const testCam={...player,y:player.y+1.62,yaw:0,pitch:0};drawLife(testCam,makeFrustum(testCam,1.5),skyEnv(sunFromTime(.5)),[300,400,500,0],1.5,.1,250)');
 assert.equal(run(d,'lifeDrawn'),12);assert.equal(binds,1);assert.equal(pointers,4);assert.equal(draws.length,12);
 const spans=JSON.parse(run(d,'JSON.stringify(life.map(c=>({n:c.sp.nq*6,offset:c.sp.q0*12})))'));assert.deepEqual(draws,spans,'same ordered creatures, index offsets select exact original model vertices');
 assert(run(d,'LIFE_SPECIES.every(sp=>(sp.q0+sp.nq)*4<=65536)'));
 run(d,'const testCreature=life[0];lifePose(testCreature);lifeMatrices(testCreature,testCam);lifeMatrices(testCreature,{...testCam,x:testCam.x+.25,y:testCam.y+.5,z:testCam.z-.1});const cachedMatrix=Array.from(testCreature.Mv);testCreature.matrixValid=false;lifeMatrices(testCreature,{...testCam,x:testCam.x+.25,y:testCam.y+.5,z:testCam.z-.1})');
 assert(run(d,'cachedMatrix.every((v,i)=>Math.abs(v-testCreature.Mv[i])<.0001)'),'camera-rebased matrices match full computation');
 run(d,'for(const c of life)c.z=player.z+70;var poseCount=0;const originalPose=lifePose;lifePose=c=>{poseCount++;originalPose(c)};for(let i=0;i<120;i++){for(const c of life)c.t+=1/60;drawLife(testCam,makeFrustum(testCam,1.5),skyEnv(sunFromTime(.5)),[300,400,500,0],1.5,.1,250)}');assert(run(d,'poseCount<12*60&&poseCount>12*25'));
 run(d,'poseCount=0;for(const c of life)c.z=player.z-70;drawLife(testCam,makeFrustum(testCam,1.5),skyEnv(sunFromTime(.5)),[300,400,500,0],1.5,.1,250)');assert.equal(run(d,'poseCount'),0,'offscreen creatures never posed');
 console.log('PASS: shared model/index buffer, unchanged draw order, exact camera rebasing, distant poses and offscreen culling');
}
{
 const d=boot(legacy),pos=JSON.stringify(d.api.player);run(d,'var rendered=0,physics=0;render=()=>rendered++;streamChunks=()=>0;lodWork=()=>{};update=()=>physics++;updateLife=()=>{};last=0;for(let i=1;i<=120;i++)frame(i*1000/60)');assert.equal(run(d,'rendered'),60);assert.equal(run(d,'physics'),0);assert.equal(JSON.stringify(d.api.player),pos);assert.equal(run(d,'renderScale'),1);assert(run(d,'time>1.27&&time<1.31'),'title clock follows elapsed time');
 run(d,'play();for(let i=121;i<=240;i++)frame(i*1000/60)');assert.equal(run(d,'physics'),120,'play resumes full update cadence');
 run(d,'suspended=true;for(let i=241;i<=300;i++)frame(i*1000/60)');assert.equal(run(d,'rendered'),180,'background stops all rendering');
 run(d,'renderScale=1;lowStreak=highStreak=0;adaptPerformance(30,0)');assert.equal(run(d,'renderScale'),1,'one bad window does not change resolution');run(d,'adaptPerformance(30,0)');assert.equal(run(d,'renderScale'),.9);
 run(d,'adaptPerformance(60,0);adaptPerformance(60,0)');assert.equal(run(d,'renderScale'),.9);run(d,'adaptPerformance(60,0)');assert.equal(run(d,'renderScale'),.95);
 run(d,'renderScale=1;lowStreak=0;for(let i=0;i<5;i++)adaptPerformance(30,12)');assert.equal(run(d,'renderScale'),1,'streaming-heavy windows do not trigger resolution loss');assert.equal(run(d,'loadScale'),.5);
 assert.equal(d.api.performanceProfile,null,'detailed counters disabled in ordinary play');
 console.log('PASS: title 30Hz, unchanged physics/clock, full play resume, hidden suspension and quality hysteresis');
}
{
 const d=boot(legacy);let callbacks=[],icons=0;d.c.requestAnimationFrame=fn=>callbacks.push(fn);d.c.iconStub=()=>{icons++;return d.c.document.createElement('canvas')};run(d,'lifeIcon=iconStub;openEggs()');assert.equal(icons,0);assert.equal(run(d,'eggIconQueue.length'),30);assert.equal(callbacks.length,1);
 callbacks.shift()();assert.equal(icons,2);run(d,'play()');callbacks.shift()();assert.equal(icons,2,'closed UI generates no icons');run(d,'openEggs()');while(callbacks.length)callbacks.shift()();assert.equal(icons,30);run(d,'play();openEggs()');assert.equal(callbacks.length,0,'reopen uses cached panel');
 const buttons=run(d,'hotbarButtons.slice()');run(d,'refresh();refresh()');assert(buttons.every((b,i)=>b===run(d,`hotbarButtons[${i}]`)),'hotbar nodes reused');
 console.log('PASS: immediate egg labels, 2 icons per callback, pause/resume, cached reopen and stable hotbar DOM');
}
{
 const d=boot(legacy);let allocations=0,uploads=0;d.gl.bufferData=()=>allocations++;d.gl.bufferSubData=()=>uploads++;
 run(d,'dyn.n=36;for(let i=0;i<20;i++)drawData(dynamicBuffer,dyn)');assert.equal(allocations,1);assert.equal(uploads,20);run(d,'dyn.n=100;drawData(dynamicBuffer,dyn)');assert.equal(allocations,2);assert.equal(run(d,'dynamicCaps.size'),1);
 let shaders=0,programs=0;d.gl.deleteShader=()=>shaders++;d.gl.deleteProgram=()=>programs++;run(d,'buildProgram(vertexSource,fragmentSource,[])');assert.equal(shaders,2);d.gl.getProgramParameter=()=>false;assert.throws(()=>run(d,'buildProgram(vertexSource,fragmentSource,[])'));assert.equal(shaders,4);assert.equal(programs,1);
 console.log('PASS: dynamic buffer capacity reuse and shader cleanup on successful/failed links');
}
{
 const d=boot(legacy);d.api.save();const saved=d.storage['nisekura-v1'];let terminated=0,revoked=0,workers=[];
 d.c.Blob=class{};d.c.URL={createObjectURL:()=> 'blob:worker',revokeObjectURL:()=>revoked++};d.c.Worker=class{constructor(){workers.push(this)}terminate(){terminated++}postMessage(){}};
 run(d,'startLodWorker();buildClouds(player.x,player.z)');const oldCloud=run(d,'cloudBuffer'),oldWorker=workers[0];assert.equal(revoked,1);
 d.nodes.world.listeners.webglcontextlost[0]({preventDefault(){}});assert.equal(terminated,1);assert.equal(run(d,'renderReady'),false);assert.equal(run(d,'lodPending.size'),0);
 d.nodes.world.listeners.webglcontextrestored[0]();assert(run(d,'renderReady'));assert.equal(revoked,2);assert.equal(workers.length,2);assert.equal(run(d,'cloudAX'),1e9);assert.equal(run(d,'activeProgram'),null);assert.equal(run(d,'dynamicCaps.size'),0);
 oldWorker.onmessage({data:{id:1,bytes:new Uint8Array(12),r:{quads:1,ymin:1,ymax:2}}});assert.equal(run(d,'lodPending.size'),0,'stale worker completion ignored');
 run(d,'updateClouds(player.x,player.z)');assert(run(d,'cloudQuads>0'));assert.notEqual(run(d,'cloudBuffer'),oldCloud);assert.equal(d.storage['nisekura-v1'],saved,'context recovery never writes saves');
 run(d,'stopLodWorker()');assert.equal(terminated,2);
 console.log('PASS: context recovery rebuilds clouds/buffers, restarts worker, revokes URLs and rejects stale results without saving');
}

{
 const d=boot(legacy);run(d,'life.length=0;lifeMode="off";const slowCreature=lifeNew(COW,player.x,player.y,player.z,true,1);var simulatedSeconds=0;lifeLand=(c,dt)=>simulatedSeconds+=dt;for(let i=0;i<100;i++)updateLife(.035,{x:player.x+120,y:player.y,z:player.z})');assert(run(d,'Math.abs(simulatedSeconds+slowCreature.acc-3.5)<1e-8'),'distant AI retains elapsed-time remainder');
 let uploads=0;d.gl.bufferData=()=>uploads++;run(d,'hit={x:30,y:30,z:30};for(let i=0;i<60;i++)drawOutline()');assert.equal(uploads,1);run(d,'hit.x++;drawOutline()');assert.equal(uploads,2);assert(run(d,'outlineData.every(Number.isFinite)'));
 console.log('PASS: distant AI elapsed-time remainder and cached outline geometry');
}

// ---- Phase 11: caves (terrainVersion 7) and untouched v6 worlds.
{const hashStep=(h,v)=>Math.imul(h^v,16777619);
 // v6 worlds keep their exact terrain, blocks, near meshes and far tiles (recorded from the release before caves existed).
 const v6=boot(JSON.stringify({version:1,worldWidth:2048,worldHeight:192,terrainVersion:6,seed:73219,changes:[],inventory:{}})),r6=c=>run(v6,c);
 assert.equal(run(v6,'CAVES'),false);assert.equal(JSON.stringify(v6.api.vista),'{"x":992,"z":736,"yaw":0,"eye":121.5}');
 assert.equal(r6(`(()=>{let h=2166136261;for(let x=64;x<2048;x+=37)for(let z=64;z<2048;z+=41){h^=height4(x,z);h=Math.imul(h,16777619)}return h>>>0})()`),3097239738,'v6 heights');
 const blk=[[960,704,64],[1100,500,64],[500,1500,64],[1180,900,64],[300,300,64],[1650,700,64]].map(([x0,z0,n])=>{let h=2166136261;for(let x=x0;x<x0+n;x++)for(let z=z0;z<z0+n;z++)for(let y=30;y<180;y++)h=hashStep(h,v6.api.get(x,y,z));return h>>>0});
 assert.deepEqual(blk,[3401685464,3341635826,684155341,925267210,157621921,409286778],'v6 blocks are byte-identical');
 const meshes=[[62,48],[56,62],[74,40]].map(([cx,cz])=>{r6(`rebuild(${cx},${cz})`);return JSON.parse(r6(`(()=>{let h=2166136261;for(const w of[opaqueW,waterW]){const a=w.a;for(let i=0;i<w.n;i++){h^=Math.round(a[i]*1000);h=Math.imul(h,16777619)}}return JSON.stringify({h:h>>>0,n:opaqueW.n+waterW.n})})()`))});
 assert.deepEqual(meshes,[{h:3466480933,n:42480},{h:763661516,n:34236},{h:3022605093,n:18828}],'v6 near meshes are identical (no cave bits)');
 const tiles=[[8,512,1024],[2,960,704],[16,1536,0]].map(([s,x,z])=>JSON.parse(r6(`(()=>{const it=tileMesh(${s},${x},${z});let q;while(!(q=it.next()).done);let h=2166136261;for(let i=0;i<lw.n*12;i++){h^=lw.u8[i];h=Math.imul(h,16777619)}return JSON.stringify({h:h>>>0,n:lw.n})})()`)));
 assert.deepEqual(tiles,[{h:4013535438,n:14232},{h:2852765177,n:24328},{h:2652048814,n:4180}],'v6 far tiles are identical');
 run(v6,'nextCave()');assert.equal(run(v6,'caveList'),null,'v6 worlds have no cave search');
 console.log('PASS: v6 worlds keep identical terrain, blocks, near meshes and far tiles (no caves generated for them)')}
{const d=boot(),R=c=>run(d,c),J=c=>JSON.parse(R(`JSON.stringify(${c})`));
 assert.equal(R('CAVES'),true);
 // Caves exist, in several kinds, and are the same on every run for a seed.
 const info=J(`(()=>{const out=[];for(let i=0;i<8;i++)for(let j=0;j<8;j++){const c=caveCell(i,j);if(c)out.push({i,j,ent:c.entrances.length,kinds:c.chambers.map(h=>h.kind),sph:c.sph.length,bridges:c.fill.length})}return out})()`);
 const kinds=new Set(info.flatMap(c=>c.kinds));
 assert(info.length>=10&&info.length<=50,`cave cells ${info.length}/64`);assert(info.every(c=>c.ent>=1),'every system has a mouth');
 for(const k of['hall','lake','cavern','crystal','pocket'])assert(kinds.has(k),'chamber kind '+k);
 assert(info.some(c=>c.bridges>0),'rock bridges exist');
 const crystals=info.reduce((n,c)=>n+c.kinds.filter(k=>k==='crystal').length,0);assert(crystals>=1&&crystals<=8,`crystal caves are rare (${crystals})`);
 const sig=()=>R(`(()=>{let h=2166136261;for(const [i,j] of[[2,2],[3,2],[1,3]]){const c=caveCell(i,j);if(!c)continue;for(const s of c.sph){h^=Math.round(s[0]*8)+Math.round(s[1]*8)*7+Math.round(s[2]*8)*13;h=Math.imul(h,16777619)}}return h>>>0})()`);
 const s1=sig();R('caveCells.clear()');assert.equal(sig(),s1,'cave cells are a pure function of the seed');
 const e=boot();assert.equal(run(e,`(()=>{let h=2166136261;for(const [i,j] of[[2,2],[3,2],[1,3]]){const c=caveCell(i,j);if(!c)continue;for(const s of c.sph){h^=Math.round(s[0]*8)+Math.round(s[1]*8)*7+Math.round(s[2]*8)*13;h=Math.imul(h,16777619)}}return h>>>0})()`),s1,'a second boot builds the same caves');
 // Chunk data is identical when generated again (after the cache is dropped) and edits survive.
 const chunkSig=(x,z)=>R(`(()=>{const a=generateChunk(${x},${z});let h=2166136261;for(let i=0;i<a.length;i++){h^=a[i];h=Math.imul(h,16777619)}return h>>>0})()`);
 const target=J(`(()=>{const c=caveCell(2,2);const L=c.chambers.find(h=>h.kind==='lake')||c.chambers[0];return{x:Math.floor(L.x/16),z:Math.floor(L.z/16)}})()`);
 const g1=chunkSig(target.x,target.z);R('blocks.clear();columns.clear();caveCells.clear()');assert.equal(chunkSig(target.x,target.z),g1,'a regenerated cave chunk is identical');
 // Surface integrity: outside the mouths and chimneys, the top three blocks of every column stay solid, so no holes appear on the surface.
 const surf=J(`(()=>{let holes=0,cols=0,carved=0,chunksChecked=0;
  for(const [i,j] of[[2,2],[3,2],[1,3],[2,1]]){const cell=caveCell(i,j);if(!cell)continue;
   cell.buckets.forEach((b,k)=>{if(!b||!(b.lobes.length||b.sph.length))return;const cx=i*16+k%16,cz=j*16+Math.floor(k/16),info=columnInfo(cx,cz),data=generateChunk(cx,cz);chunksChecked++;
    for(let z=0;z<16;z++)for(let x=0;x<16;x++){const wx=cx*16+x,wz=cz*16+z,h=info.h[z*16+x];if(h<=SEA)continue;
     if(cell.open.some(o=>Math.hypot(wx-o.x,wz-o.z)<o.r+2))continue;cols++;
     for(let y=h-2;y<=h;y++){const t=data[localIdx(wx,y,wz)];if(t===0||t===10){holes++;break}}}
    for(let y=7;y<H-2;y++)for(let z=0;z<16;z++)for(let x=0;x<16;x++)if(data[(y*16+z)*16+x]===0&&y<info.h[z*16+x]-3)carved++})}
  return{holes,cols,carved,chunksChecked}})()`);
 assert(surf.chunksChecked>=20&&surf.carved>20000,`cave chunks checked (${surf.chunksChecked}, ${surf.carved} carved voxels)`);assert.equal(surf.holes,0,`no holes in the ${surf.cols} surface columns above caves`);
 // Mouths are open to the outside and lead to a chamber through connected air.
 const conn=J(`(()=>{const res=[];for(const [i,j] of[[2,2],[3,2],[1,3],[3,1],[1,4],[2,4]]){const cell=caveCell(i,j);if(!cell)continue;
   for(const e of cell.entrances){const start=e.p0.map(Math.floor);
    const ch=cell.chambers[e.chamber];const goal=(x,y,z)=>ch.lobes.some(L=>((x-L.x)/L.rx)**2+((y-L.y)/L.ry)**2+((z-L.z)/L.rz)**2<.35);
    const seen=new Set(),key=(x,y,z)=>(y*2048+z)*2048+x;let ok=false,n=0,found=get(...start)===0;
    // breadth-first through air that lies under the natural surface (the first few blocks at the mouth excepted), so the open sky does not count
    const q=[[...start]];seen.add(key(...start));let qi=0;
    const under=(X,Y,Z)=>Y<=columnInfo(X>>4,Z>>4).h[(Z&15)*16+(X&15)]-2||Math.hypot(X-start[0],Z-start[2])<10;
    while(qi<q.length&&n<400000&&!ok&&found){const [x,y,z]=q[qi++];n++;if(goal(x,y,z)){ok=true;break}
     for(const [dx,dy,dz] of[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){const X=x+dx,Y=y+dy,Z=z+dz;if(Y<2||Y>=H-1)continue;const k=key(X,Y,Z);if(seen.has(k))continue;seen.add(k);const t=get(X,Y,Z);if((t===0||t===10)&&under(X,Y,Z))q.push([X,Y,Z])}}
    res.push({found,ok,n,kind:ch.kind})}}
   return res})()`);
 assert(conn.length>=8,`mouths tested (${conn.length})`);assert(conn.every(c=>c.found),'every mouth is open air');assert(conn.every(c=>c.ok),'every mouth connects through air to its chamber: '+JSON.stringify(conn.filter(c=>!c.ok)));
 console.log(`PASS: caves: ${info.length} cells, kinds ${[...kinds].join('/')}, ${crystals} crystal caves, deterministic, no surface holes (${surf.cols} columns), ${conn.length} mouths connect to chambers`)}
{// Caves: lakes, crystals and light in the mesh, the underground factor, edits and saves, the title button.
 const d=boot(),R=c=>run(d,c),J=c=>JSON.parse(R(`JSON.stringify(${c})`));
 const find=kind=>J(`(()=>{for(let i=0;i<8;i++)for(let j=0;j<8;j++){const c=caveCell(i,j);if(!c)continue;const k=c.chambers.find(h=>h.kind==='${kind}');if(k)return{x:k.x,y:k.y,z:k.z,rx:k.rx,rz:k.rz,ry:k.ry,view:k.view,i,j}}return null})()`);
 const lake=find('lake'),crys=find('crystal'),hall=find('hall');assert(lake&&crys&&hall,'a lake, a crystal cave and a hall exist');
 // Lake: still water at sea level, a sand/stone bed, a dry balcony; no open water walls (water meets rock or water on its sides).
 const lk=J(`(()=>{let water=0,exposed=0,sand=0,top=0;const x0=${Math.floor(lake.x)}-${Math.ceil(lake.rx)},z0=${Math.floor(lake.z)}-${Math.ceil(lake.rz)};
  for(let x=x0;x<=x0+${Math.ceil(lake.rx*2)};x++)for(let z=z0;z<=z0+${Math.ceil(lake.rz*2)};z++){for(let y=20;y<=SEA+1;y++){if(get(x,y,z)!==10)continue;water++;if(y===SEA)top++;
    for(const [dx,dz] of[[1,0],[-1,0],[0,1],[0,-1]]){if(get(x+dx,y,z+dz)===0)exposed++}
    if(get(x,y-1,z)===6)sand++}}
  return{water,exposed,sand,top}})()`);
 assert(lk.water>3000&&lk.top>500,`underground lake has water (${lk.water} voxels, ${lk.top} on the surface)`);assert(lk.exposed<lk.water*.01,`water is walled in by rock (${lk.exposed} open sides)`);assert(lk.sand>20,'lake bed has sand patches');
 const lakeChunk={x:Math.floor(lake.x/16),z:Math.floor(lake.z/16)};R(`rebuild(${lakeChunk.x},${lakeChunk.z})`);
 const mesh=J(`(()=>{const out={water:waterW.n/9,opaque:opaqueW.n/9,bad:0,dark:new Array(8).fill(0),glow:0,maxHi:0};for(const w of[opaqueW,waterW]){for(let i=0;i<w.n;i+=9){const m=w.a[i+8],hi=Math.floor(m/1024),dk=hi%8,gl=Math.floor(hi/8)%8,tint=Math.floor(hi/64);if(!(Number.isFinite(m)&&tint<=3&&dk<=7&&gl<=7))out.bad++;out.dark[dk]++;if(gl)out.glow++;out.maxHi=Math.max(out.maxHi,hi)}}return out})()`);
 assert.equal(mesh.bad,0,'every packed vertex code is valid');assert(mesh.water>10,'the lake chunk has water faces');assert(mesh.dark[7]>0&&mesh.dark[0]>0||mesh.dark.slice(4).some(v=>v>0),`cave faces are darkened (${mesh.dark})`);
 // Crystals: blocks, bake and glow bits.
 const cc={x:Math.floor(crys.x/16),z:Math.floor(crys.z/16)};
 const cr=J(`(()=>{let n=0,chunks=0,glowFaces=0,sources=0,tints=new Set();for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){const cx=${cc.x}+dx,cz=${cc.z}+dz,data=voxelChunk(cx,cz);let here=0;for(let i=0;i<data.length;i++)if(data[i]>=26&&data[i]<=28)here++;n+=here;if(here)chunks++;
   if(here){sources+=glowSources(cx,cz,data).length/4;rebuild(cx,cz);for(let i=0;i<opaqueW.n;i+=9){const hi=Math.floor(opaqueW.a[i+8]/1024),gl=Math.floor(hi/8)%8;if(gl){glowFaces++;tints.add(Math.floor(hi/64))}}}}
  return{n,chunks,glowFaces,sources,tints:[...tints]}})()`);
 assert(cr.n>150&&cr.chunks>=2,`crystal cave has crystals (${cr.n} blocks in ${cr.chunks} chunks)`);assert(cr.glowFaces>200,`crystal light is baked into nearby faces (${cr.glowFaces})`);assert(cr.tints.length>=1&&cr.tints.every(t=>t>=1&&t<=3),'glow tints are 1..3');
 // Decoration: stalactites hang from ceilings, stalagmites stand on floors, in the halls.
 const dec=J(`(()=>{let hang=0,stand=0;const x0=${Math.floor(hall.x)}-24,z0=${Math.floor(hall.z)}-24;for(let x=x0;x<x0+48;x++)for(let z=z0;z<z0+48;z++)for(let y=12;y<150;y++){if(get(x,y,z)!==3)continue;const a=get(x,y+1,z),b=get(x,y-1,z);if(b===0&&get(x,y-2,z)===0&&a===3&&get(x,y+2,z)===3&&get(x+1,y,z)===0&&get(x-1,y,z)===0)hang++;if(a===0&&get(x,y+2,z)===0&&b===3&&get(x,y-2,z)===3&&get(x+1,y,z)===0&&get(x-1,y,z)===0)stand++}return{hang,stand}})()`);
 assert(dec.hang+dec.stand>5,`stalactites and stalagmites exist (${dec.hang}/${dec.stand})`);
 // Underground factor: the surface, a hut on the surface and the inside of a hall.
 const V=d.api.vista;R(`paused=false;spawn();streamChunks(true);pkX=1e9;caveF=0`);assert.equal(R('cavePoll()'),0,'on the surface');
 const hx=Math.floor(player_x=d.api.player.x),hz=Math.floor(d.api.player.z),hy=Math.floor(d.api.player.y);
 for(let x=hx-2;x<=hx+2;x++)for(let z=hz-2;z<=hz+2;z++){for(let y=hy;y<=hy+3;y++)if(Math.abs(x-hx)===2||Math.abs(z-hz)===2)d.api.edit(x,y,z,7);d.api.edit(x,hy+4,z,7)}
 R('pkX=1e9');assert.equal(R('cavePoll()'),0,'inside a house on the surface is not underground');
 const hv=J(`(()=>{const L=${JSON.stringify(lake)};const c=caveStand(L.view.x,L.view.y+1.5,L.view.z);return c})()`);assert(hv,'there is a place to stand on the lake balcony');
 R(`player.x=${hv.x};player.z=${hv.z};player.y=${hv.y};streamChunks(true);for(let i=0;i<30;i++)streamChunks();pkX=1e9`);const deep=R('cavePoll()');assert(deep>.9,`inside the lake cave the factor is ${deep.toFixed(2)}`);
 R('caveF=1;caveRaw=1;updateCave(.016,false)');assert(R('caveF')>.99);R('for(let i=0;i<20;i++)updateCave(.2,false)');assert(R('caveUnder'),'underground mode turns on');assert(R('nearN()')<=4,'near range shrinks underground');
 R('caveRaw=0;caveF=0;caveUnder=false;streamDirty=true');
 // The title button teleports to safe spots in order and the player can walk on.
 R('paused=true;flying=false;nextCave()');const spots=R('caveList.length');assert(spots>=8,`cave spots found (${spots})`);
 const seen=new Set();for(let i=0;i<spots+1;i++){R('nextCave()');const s=JSON.parse(R('JSON.stringify({k:caveList[caveIdx].kind,col:collides(player),paused,y:player.y,x:player.x,z:player.z})'));assert(!s.col,'spot is not inside rock: '+JSON.stringify(s));assert.equal(s.paused,false);seen.add(s.k);R('paused=true')}
 assert.equal(seen.size,4,'entrance, hall, lake and crystal spots are visited');
 // Standing in a cave: gravity keeps the player on the floor, flying works, blocks can be mined and placed, edits survive a save and reload.
 R('paused=false;update(.05)');for(let i=0;i<60;i++)R('update(1/60)');assert(!R('collides(player)'),'player rests on the cave floor');
 const px=Math.floor(d.api.player.x),py=Math.floor(d.api.player.y),pz=Math.floor(d.api.player.z);R(`yaw=0;pitch=-1.2`);const hit=R('ray()');
 if(hit){R('mine()');assert.equal(d.api.get(hit.x,hit.y,hit.z),0,'a cave block can be mined')}
 d.api.edit(px,py+3,pz,27);assert.equal(d.api.get(px,py+3,pz),27,'a crystal block can be placed');assert(R(`glowChunks.has(chunkKey(${px},${pz}))`),'placing a crystal marks its chunk as glowing');
 const srcHas=()=>R(`(()=>{const l=glowSources(${px>>4},${pz>>4},voxelChunk(${px>>4},${pz>>4}));for(let i=0;i<l.length;i+=4)if(l[i]===${px}&&l[i+1]===${py+3}&&l[i+2]===${pz})return true;return false})()`);
 assert.equal(srcHas(),true,'the placed crystal is a light source');d.api.edit(px,py+3,pz,0);assert.equal(srcHas(),false,'removing it drops it from the light sources');
 R('toggleFlight()');R('keys.Space=true;for(let i=0;i<30;i++)update(1/60);delete keys.Space');assert(R('flying')&&!R('collides(player)'),'flying inside a cave');
 d.api.edit(px,py+2,pz,28);assert(d.api.save());const re=boot(d.storage['nisekura-v1']);assert.equal(re.api.get(px,py+2,pz),28,'a cave edit survives reload');assert.equal(run(re,'terrainVersion'),11);
 assert.equal(run(re,`(()=>{let h=2166136261;for(const [x,y,z] of[[${Math.floor(hall.x)},${Math.floor(hall.y)},${Math.floor(hall.z)},],[${Math.floor(lake.x)},60,${Math.floor(lake.z)}]]){h^=get(x,y,z);h=Math.imul(h,16777619)}return h>>>0})()`),R(`(()=>{let h=2166136261;for(const [x,y,z] of[[${Math.floor(hall.x)},${Math.floor(hall.y)},${Math.floor(hall.z)},],[${Math.floor(lake.x)},60,${Math.floor(lake.z)}]]){h^=get(x,y,z);h=Math.imul(h,16777619)}return h>>>0})()`),'reloading does not change the caves');
 // Save format: new block ids are accepted, the unused plant-material ids are not, and future versions are rejected.
 const base=JSON.parse(d.storage['nisekura-v1']);for(const [patch,ok] of[[{changes:[[5000,26]]},true],[{changes:[[5000,29]]},true],[{changes:[[5000,17]]},false],[{changes:[[5000,25]]},false],[{inventory:{27:3}},true],[{inventory:{20:3}},false],[{terrainVersion:8},true],[{terrainVersion:9},true],[{terrainVersion:10},true],[{terrainVersion:11},true],[{terrainVersion:12},false],[{changes:[[5000,31]]},true],[{changes:[[5000,35]]},true],[{changes:[[5000,36]]},true],[{changes:[[5000,41]]},false]]){
  const t=()=>run(d,`validateSave(${JSON.stringify({...base,...patch})})`);if(ok)t();else assert.throws(t,/不正/)}
 console.log(`PASS: caves: lake ${lk.water} water voxels (${lk.exposed} open sides), ${cr.n} crystals lighting ${cr.glowFaces} faces, ${dec.hang}/${dec.stand} stalactites/stalagmites, underground factor ${deep.toFixed(2)}, ${spots} spots visited, edits/save/validation`)}
{// Underground life: dark-loving monsters appear on cave floors only, and the surface is left alone while the player is below.
 const d=boot(),R=c=>run(d,c),J=c=>JSON.parse(R(`JSON.stringify(${c})`));
 const spot=J(`(()=>{for(let i=0;i<8;i++)for(let j=0;j<8;j++){const c=caveCell(i,j);if(!c)continue;const h=c.chambers.find(k=>k.kind==='hall'&&k.view);if(h)return{x:h.view.x,y:h.view.y,z:h.view.z}}return null})()`);
 const f=J(`caveStand(${spot.x},${spot.y+1.5},${spot.z})`);assert(f);
 R(`paused=false;life.length=0;lifeMode='all';player.x=${f.x};player.y=${f.y};player.z=${f.z};streamChunks(true);for(let i=0;i<60;i++)streamChunks();caveRaw=caveF=1;caveUnder=true;streamDirty=true;for(let i=0;i<10;i++)streamChunks()`);
 R('for(let k=0;k<400;k++)updateLife(.1,player)');
 const m=J(`life.map(c=>({id:c.sp.id,cat:c.sp.cat,x:c.x,y:c.y,z:c.z,sh:surfaceAt(Math.floor(c.x),Math.floor(c.z)),inside:peek(Math.floor(c.x),Math.floor(c.y),Math.floor(c.z)),floor:peek(Math.floor(c.x),Math.floor(c.y)-1,Math.floor(c.z))}))`);
 assert(m.length>=1&&m.length<=8,`cave monsters appear in small numbers (${m.length})`);
 assert(m.every(c=>c.cat==='monster'&&['crawler','spider','slime','skeleton'].includes(c.id)),'only dark-loving monsters: '+m.map(c=>c.id));
 assert(m.every(c=>c.sh-c.y>=6),'they live underground, not on the surface');assert(m.every(c=>c.inside<=0||c.inside===undefined||c.inside===0),'none are inside rock');
 R('lifeMode="animals";life.length=0;for(let k=0;k<200;k++)updateLife(.1,player)');assert.equal(R('life.length'),0,'animals-only mode keeps caves quiet');
 console.log(`PASS: cave creatures: ${m.map(c=>c.id).join('/')} on cave floors, none on the surface, quiet in animals-only mode`)}

// ---- Phase 12: underwater life. Flora is mesh-only (material 31), fish are runtime-only schools; neither touches saves.
const AQ_SPOTS={river:[982,808],lake:[1102,712],reef:[1258,856],kelp:[1258,598]};
const aquaQuads=(b,cx,cz)=>JSON.parse(run(b,`(()=>{rebuild(${cx},${cz});const a=opaqueW.a,o=[];for(let i=0;i<opaqueW.n;i+=36){let code=a[i+8];const cv=Math.floor(code/1024);code-=cv*1024;const wet=code>=511.5;if(wet)code-=512;const sh=code>=255.5;if(sh)code-=256;
 const face=Math.floor((code+.5)/32),m=code-face*32;if(m<30.5)continue;let y0=1e9,y1=-1e9,xs=0,zs=0;for(let k=0;k<4;k++){const j=i+k*9;y0=Math.min(y0,a[j+1]);y1=Math.max(y1,a[j+1]);xs+=a[j];zs+=a[j+2]}
 o.push([Math.round((m-31)/.06),face,+(xs/4).toFixed(3),+y0.toFixed(3),+y1.toFixed(3),+(zs/4).toFixed(3),wet?1:0,+a[i+7].toFixed(2)])}return JSON.stringify(o)})()`));
{const d=boot(),R=c=>run(d,c);const found={},stat={};
 for(const [name,[x,z]] of Object.entries(AQ_SPOTS)){R(`paused=false;player.x=${x}+.5;player.z=${z}+.5;player.y=70;streamChunks(true);for(let i=0;i<40;i++)streamChunks()`);
  let all=[];for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)all=all.concat(aquaQuads(d,(x>>4)+dx,(z>>4)+dz));stat[name]=all.length;
  const kinds=new Set(all.map(q=>(q[1]===6?'b':'x')+q[0]));found[name]=kinds;
  for(const q of all){assert.equal(q[6],1,'underwater decorations are lit as wet faces');assert(q[4]<62.88,`${name}: nothing pokes out of the water (${q})`)}
  // Every decoration stands on a solid floor block with water above it (billboards: a crossed pair shares the cell of its root).
  for(const q of all.filter(q=>q[1]===6&&q[7]===0)){const X=Math.floor(q[2]),Z=Math.floor(q[5]),Y=Math.round(q[3]);if(Y!==q[3])continue;assert(R(`solid(${X},${Y-1},${Z})&&get(${X},${Y},${Z})===10`),`${name}: plant on a floor under water (${q})`)}}
 assert(found.river.has('b0'),'river: short seagrass');assert(found.lake.has('b1'),'lake: long waterweed');assert(found.kelp.has('b2'),'sea: kelp');
 assert(['x0','x1','x3','b4'].filter(k=>found.reef.has(k)).length>=3,'reef: several coral forms '+[...found.reef]);assert(found.reef.has('b0')||found.lake.has('b3')||found.river.has('b3'),'seagrass and small plants mix in');
 assert(!found.river.has('x0')&&!found.lake.has('x0')&&!found.river.has('b2'),'no coral or kelp in fresh water');
 // Deterministic: a second boot of the same seed meshes identical decorations; lower quality keeps a subset.
 const e=boot();run(e,`paused=false;player.x=${AQ_SPOTS.reef[0]}.5;player.z=${AQ_SPOTS.reef[1]}.5;player.y=70;streamChunks(true);for(let i=0;i<40;i++)streamChunks()`);
 const cx=AQ_SPOTS.reef[0]>>4,cz=AQ_SPOTS.reef[1]>>4;R(`player.x=${AQ_SPOTS.reef[0]}.5;player.z=${AQ_SPOTS.reef[1]}.5;streamChunks(true);for(let i=0;i<40;i++)streamChunks()`);
 const hi=aquaQuads(d,cx,cz);assert.deepEqual(aquaQuads(e,cx,cz),hi,'same seed, same reef');
 R("Q=QUALITY.low");const lo=aquaQuads(d,cx,cz);R("Q=QUALITY[qualityName]");const key=q=>q.slice(0,6).join(),hs=new Set(hi.map(key));
 assert(lo.length<hi.length*.9&&lo.length>0&&lo.every(q=>hs.has(key(q))),`low quality keeps a subset (${lo.length}/${hi.length})`);
 // Edits: digging out the floor under a plant removes it; nothing floats.
 const p=hi.find(q=>q[1]===6&&q[7]===0&&Math.round(q[3])===q[3]);const X=Math.floor(p[2]),Y=p[3]-1,Z=Math.floor(p[5]);const t=R(`get(${X},${Y},${Z})`);
 d.api.edit(X,Y,Z,10);assert(!aquaQuads(d,cx,cz).some(q=>Math.floor(q[2])===X&&Math.floor(q[5])===Z&&q[3]===Y+1),'no plant left floating over a dug hole');d.api.edit(X,Y,Z,t);
 assert.deepEqual(aquaQuads(d,cx,cz),hi,'restoring the floor restores the plant');
 // Saves: nothing new is stored.
 const snap=JSON.parse(R('JSON.stringify(snapshot())'));assert.deepEqual(Object.keys(snap).sort(),['adventure','changes','creative','dayTime','flying','inventory','life','pitch','player','seed','settings','terrainVersion','version','worldHeight','worldWidth','yaw','gameMode','health','items','defeated'].sort());
 assert(!JSON.stringify(snap.life).includes('medaka'),'fish are not saved');
 console.log(`PASS: underwater flora: river ${[...found.river]} / lake ${[...found.lake]} / reef ${[...found.reef]} / kelp sea ${[...found.kelp]} (${Object.values(stat).join('/')} quads), on floors under water, deterministic, quality subset ${lo.length}/${hi.length}, edits, saves unchanged`)}
{// Fish: models, habitats, staying in water, flight from the player, bounded numbers and determinism.
 const d=boot(),R=c=>run(d,c),J=c=>JSON.parse(R(`JSON.stringify(${c})`));
 const sp=J('FISH_SPECIES.map(s=>({id:s.id,nq:s.nq,q0:s.q0,tail:s.parts.filter(p=>p[0]==="tail").length,fins:s.parts.length,rare:!!s.rare,zone:s.zone,dims:[s.rad.toFixed(2),s.h.toFixed(2)]}))');
 assert(sp.length>=8,'at least eight new fish');assert.equal(R('LIFE_SPECIES.length'),35,'the 30 existing creatures are unchanged (plus the two v16 cave monsters and the v18 dragon and its nest egg)');
 assert(sp.every(s=>!R(`!!LIFE_BY_ID['${s.id}']`)),'new ids');assert(sp.every(s=>s.tail>=1&&s.fins>=8),'every fish has a tail and fins');
 assert.equal(new Set(sp.map(s=>s.dims.join())).size,sp.length,'every species has its own shape');assert(sp.some(s=>s.rare)&&sp.some(s=>s.zone==='bottom')&&sp.some(s=>s.zone==='top'));
 assert(sp.every(s=>s.q0+s.nq*8<=R('MAXQ')),'shared index buffer covers every batch');
 const sim=(x,z,secs)=>{R(`paused=false;fishSchools.length&&fishSchools.splice(0);fishCells.clear();fishCount=0;lifeMode='all';player.x=${x}+.5;player.z=${z}+.5;player.y=75;flying=true;streamChunks(true);for(let i=0;i<60;i++)streamChunks();fishT=0`);
  for(let k=0;k<secs*10;k++)R('updateFish(.1,player)');return J('fishSchools.map(s=>({id:s.sp.id,n:s.n,key:s.key,m:s.m.slice(0,s.n).map(m=>[m.x,m.y,m.z,peek(Math.floor(m.x),Math.floor(m.y),Math.floor(m.z))])}))')};
 const hab={};let total=0;
 for(const [name,[x,z]] of Object.entries(AQ_SPOTS)){const s=sim(x,z,40);hab[name]=[...new Set(s.map(q=>q.id))];total+=s.length;
  for(const q of s)for(const m of q.m){assert.equal(m[3],10,`${q.id} stays in water`);assert(m[1]<=62.6,`${q.id} stays under the surface`)}
  assert(s.reduce((a,q)=>a+q.n,0)<=R('FISH_Q[qualityName].fish')+16,'bounded numbers')}
 const fresh=['medaka','koi','nishiki','namazu'],reefFish=['hanadai','kakure','sorasuzume','chocho','nanyouhagi','hatatate'],salt=[...reefFish,'aobudai','kasago','hirame','ryugu'];
 assert(hab.river.length&&hab.river.every(i=>fresh.includes(i)),'river fish: '+hab.river);assert(hab.lake.length&&hab.lake.every(i=>fresh.includes(i)),'lake fish: '+hab.lake);
 assert(hab.reef.some(i=>reefFish.includes(i))&&hab.reef.every(i=>salt.includes(i)),'reef fish: '+hab.reef);
 // Deterministic schools: leaving and coming back finds the same species in the same cells, never more.
 const a1=sim(...AQ_SPOTS.reef,8).map(q=>q.key+q.id).sort();R(`player.x=200;player.z=200;for(let k=0;k<20;k++)updateFish(.1,player)`);assert.equal(R('fishSchools.length'),0,'schools leave with the player');
 const a2=sim(...AQ_SPOTS.reef,8).map(q=>q.key+q.id).sort();assert.deepEqual(a2,a1,'same schools on return');
 for(let k=0;k<5;k++){R(`player.x=200;player.z=200;for(let k=0;k<6;k++)updateFish(.1,player);player.x=${AQ_SPOTS.reef[0]}.5;player.z=${AQ_SPOTS.reef[1]}.5;for(let k=0;k<30;k++)updateFish(.1,player)`)}
 assert(R('fishSchools.length')<=a1.length&&R('fishCount')===R('fishSchools.reduce((a,s)=>a+s.n,0)'),'reloading never multiplies fish');
 // A school of small fish scatters when the player swims into it; matrices stay finite.
 const sc=J(`(()=>{const s=fishSchools.find(s=>s.sp.flee&&s.n>3);return s?{x:s.x,y:s.y,z:s.z,id:s.sp.id}:null})()`);assert(sc,'a school that can flee');
 R(`player.x=${sc.x};player.y=${sc.y}-1;player.z=${sc.z};for(let k=0;k<5;k++)updateFish(.1,player)`);const fl=J(`(()=>{const s=fishSchools.find(s=>Math.hypot(s.x-${sc.x},s.z-${sc.z})<6&&s.sp.id==='${sc.id}');return{flee:s.flee,d:Math.hypot(s.x-player.x,s.z-player.z)}})()`);
 assert(fl.flee>0,'the school takes fright');for(let k=0;k<15;k++)R('updateFish(.1,player)');
 const away=R(`(()=>{let b=1e9;for(const s of fishSchools)if(s.sp.id==='${sc.id}')b=Math.min(b,Math.hypot(s.x-player.x,s.z-player.z));return b})()`);assert(away>fl.d+1,`it swims away (${fl.d.toFixed(1)} -> ${away.toFixed(1)})`);
 assert(R(`(()=>{for(const s of fishSchools)for(let i=0;i<s.n;i++){fishMats(0,s.m[i],s.sp,{x:player.x,y:player.y,z:player.z});if(!FB.subarray(0,24).every(Number.isFinite))return false}return true})()`),'finite fish matrices');
 const perQ={};for(const q of['low','standard','high']){R(`qualityName='${q}';Q=QUALITY.${q}`);const s=sim(...AQ_SPOTS.reef,25);perQ[q]=s.reduce((a,x)=>a+x.n,0);
  assert(perQ[q]<=R(`FISH_Q.${q}.fish`)+16&&s.length<=R(`FISH_Q.${q}.schools`),`${q}: within caps (${perQ[q]} fish, ${s.length} schools)`)}
 assert(perQ.low<=perQ.high,'low quality never has more fish than high');R("qualityName='standard';Q=QUALITY.standard");
 R("lifeMode='off';updateFish(.1,player)");assert.equal(R('fishSchools.length+fishCount'),0,'creatures off clears the fish');
 // Caps per quality.
 assert(R('FISH_Q.low.fish<FISH_Q.standard.fish&&FISH_Q.standard.fish<FISH_Q.high.fish'));
 console.log(`PASS: fish: ${sp.length} species (${sp.map(s=>s.id).join('/')}), river ${hab.river} / lake ${hab.lake} / reef ${hab.reef} / kelp sea ${hab.kelp}, all in water, deterministic schools, flight, fish per quality ${perQ.low}/${perQ.standard}/${perQ.high}`)}

// ---- Coral reefs (v13): reef hot spots in the shallow sea, five coral forms in seven hues, rocks, and reef fish that gather there.
{const d=boot(),R=c=>run(d,c),J=c=>JSON.parse(R(`JSON.stringify(${c})`));
 // Tiers: plain floor, a fringe, reef and dense cores; cores are a small share of the shallow sea.
 const tier=J(`(()=>{let n=0,t=[0,0,0,0];const spots={core:null,plain:null};for(let z=600;z<1300;z+=3)for(let x=900;x<1600;x+=3){const h=height4(x,z);if(h>=SEA||gLand>0)continue;const D=SEA-h;if(D<3||D>9)continue;n++;
  const r=reefZone(x,z)*smooth(1.2,3,D)*(1-smooth(10,16,D));t[r>.5?3:r>.2?2:r>.03?1:0]++;if(r>.85&&D>=5&&!spots.core)spots.core=[x,z];
  if(reefZone(x,z)===0&&kelpZone(x,z)<.05&&D>=4&&D<=7&&!spots.plain&&Math.hypot(x-1300,z-936)>150)spots.plain=[x,z]}return{n,t:t.map(v=>v/n),spots}})()`);
 assert(tier.t.every(v=>v>.02)&&tier.t[3]<.2&&tier.t[0]>.3,'reefs are spots, not the whole sea: '+tier.t.map(v=>v.toFixed(2)));
 assert(tier.spots.core&&tier.spots.plain,'found a reef core and plain shallow sea');
 const quads=(x,z)=>{R(`paused=false;player.x=${x}+.5;player.z=${z}+.5;player.y=70;streamChunks(true);for(let i=0;i<40;i++)streamChunks()`);let all=[];
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)all=all.concat(JSON.parse(R(`(()=>{rebuild(${(x>>4)+dx},${(z>>4)+dz});const a=opaqueW.a,o=[];for(let i=0;i<opaqueW.n;i+=36){let code=a[i+8];code-=Math.floor(code/1024)*1024;const wet=code>=511.5;if(wet)code-=512;if(code>=255.5)code-=256;
   const face=Math.floor((code+.5)/32),m=code-face*32;if(m<30.5)continue;let y1=-1e9;for(let k=0;k<4;k++)y1=Math.max(y1,a[i+k*9+1]);o.push([Math.round((m-31)/.06),face,+y1.toFixed(3),+a[i+3].toFixed(3),+a[i+4].toFixed(3),+a[i+5].toFixed(3),+a[i].toFixed(2),+a[i+2].toFixed(2)])}return JSON.stringify(o)})()`)));return all};
 const core=quads(...tier.spots.core),plain=quads(...tier.spots.plain);
 const kinds=new Set(core.map(q=>(q[1]===6?'b':'x')+q[0])),forms=['b4','x6','x0','x3','x5','x1','b5','b6'].filter(k=>kinds.has(k));
 assert(forms.length>=7,'many coral forms in a core: '+forms);assert(kinds.has('x4'),'reef rocks in a core');
 const coralQ=q=>q[1]===6?q[0]>=4:[0,1,3,5,6].includes(q[0]),nc=core.filter(coralQ).length,np=plain.filter(coralQ).length;
 assert(nc>8*Math.max(1,np),`a core is much busier than plain sea (${nc} vs ${np} coral quads)`);
 for(const q of core)assert(q[2]<62.88,'corals stay under the surface '+q);
 // Hues: classify every coral colour; the seven palette families all show up around a core.
 const hue=([r,g,b])=>{const mx=Math.max(r,g,b),mn=Math.min(r,g,b);if(mx-mn<.1)return-1;let h=mx===r?((g-b)/(mx-mn)+6)%6:mx===g?(b-r)/(mx-mn)+2:(r-g)/(mx-mn)+4;return h*60};
 const bins=new Set();for(const q of core.filter(coralQ)){const h=hue(q.slice(3,6));if(h<0)continue;bins.add(h<20||h>=345?'red':h<38?'orange':h<70?'yellow':h<185?'teal':h<225?'lightblue':h<300?'purple':'pink')}
 assert(bins.size>=7,'seven coral hues: '+[...bins]);
 // Lower quality keeps fewer decorations (a subset), so phones pay less for the same reef.
 R(`player.x=${tier.spots.core[0]}.5;player.z=${tier.spots.core[1]}.5`);R("Q=QUALITY.low");const lo=quads(...tier.spots.core);R("Q=QUALITY[qualityName]");
 const key=q=>q.join(),hs=new Set(core.map(key));assert(lo.length<core.length*.8&&lo.every(q=>hs.has(key(q))),`low quality: a smaller subset (${lo.length}/${core.length})`);
 // Coral mounds: big colonies in cores (none over plain sea), taller than a block, each owning its 3x3 columns.
 const mounds=(x,z)=>{R(`paused=false;player.x=${x}+.5;player.z=${z}+.5;player.y=70;streamChunks(true);for(let i=0;i<40;i++)streamChunks()`);const o=[];
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)o.push(...J(`(()=>{rebuild(${(x>>4)+dx},${(z>>4)+dz});const cx=${(x>>4)+dx},cz=${(z>>4)+dz};return aqM.filter(m=>m.ax>>4===cx&&m.az>>4===cz)})()`));return o};
 const mc=mounds(...tier.spots.core),mp=mounds(...tier.spots.plain);
 assert(mc.length>=3&&mp.length===0,`coral mounds in cores only (${mc.length} vs ${mp.length})`);
 const tall=core.filter(coralQ).filter(q=>mc.some(m=>Math.abs(q[6]-m.ax-.5)<1.6&&Math.abs(q[7]-m.az-.5)<1.6&&q[2]-m.fy>1));assert(tall.length>0,'mounds rise more than a block above the floor');
 for(let i=0;i<mc.length;i++)for(let j=i+1;j<mc.length;j++)assert(Math.max(Math.abs(mc[i].ax-mc[j].ax),Math.abs(mc[i].az-mc[j].az))>=3,'mound footprints never overlap');
 // Sun shafts: slanted pale columns over reef cores only, none over plain sea, none on low quality; they end at the surface.
 const shafts=(x,z)=>{R(`paused=false;player.x=${x}+.5;player.z=${z}+.5;player.y=70;streamChunks(true);for(let i=0;i<40;i++)streamChunks()`);let n=0,top=-1e9,bot=1e9;
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){const o=JSON.parse(R(`(()=>{rebuild(${(x>>4)+dx},${(z>>4)+dz});const a=waterW.a,o=[];for(let i=0;i<waterW.n;i+=36){let code=a[i+8];code-=Math.floor(code/1024)*1024;if(code>=511.5)code-=512;if(code>=255.5)code-=256;const m=code-Math.floor((code+.5)/32)*32;if(m>30.3&&m<30.5)o.push([a[i+1],a[i+10],a[i+19],a[i+28]])}return JSON.stringify(o)})()`));
   n+=o.length;for(const q of o)for(const y of q){top=Math.max(top,y);bot=Math.min(bot,y)}}return{n,top,bot}};
 const sc=shafts(...tier.spots.core),sp=shafts(...tier.spots.plain);R("Q=QUALITY.low");const sl=shafts(...tier.spots.core);R("Q=QUALITY[qualityName]");
 assert(sc.n>=4&&sp.n===0&&sl.n===0,`sun shafts over reefs only (core ${sc.n}, plain ${sp.n}, low ${sl.n})`);assert(sc.top<=63.8&&sc.bot>=40,'shafts run from the floor to the surface '+JSON.stringify(sc));
 // Regression: switching quality while a reef chunk is already cached must update its shaft mesh.
 // Discard far missing chunks in this focused scheduler test so existing cached chunks are checked first.
 const [shaftCX,shaftCZ]=tier.spots.core.map(v=>v>>4),shaftKey=shaftCX+','+shaftCZ;
 R(`Q=QUALITY.standard;qualityName='standard';paused=false;player.x=${tier.spots.core[0]}+.5;player.z=${tier.spots.core[1]}+.5;streamChunks(true);rebuild(${shaftCX},${shaftCZ})`);
 assert.equal(R(`chunks.get('${shaftKey}').reefShafts`),true,'standard mesh starts with reef shafts enabled');
 R("setQuality('low');streamChunks();chunkQueue.length=0");
 for(let i=0;i<5;i++)R('streamChunks()');
 assert.equal(R(`chunks.get('${shaftKey}').reefShafts`),false,'low quality removes cached reef shaft geometry');
 R("setQuality('standard');streamChunks();chunkQueue.length=0");
 for(let i=0;i<5;i++)R('streamChunks()');
 assert.equal(R(`chunks.get('${shaftKey}').reefShafts`),true,'standard quality restores cached reef shafts');
 // Fish: a core holds more fish than plain sea, reef species live there, and reef cells host a second school.
 const sim=(x,z,secs)=>{R(`paused=false;fishSchools.length&&fishSchools.splice(0);fishCells.clear();fishCount=0;lifeMode='all';player.x=${x}+.5;player.z=${z}+.5;player.y=75;flying=true;streamChunks(true);for(let i=0;i<60;i++)streamChunks();fishT=0`);
  for(let k=0;k<secs*10;k++)R('updateFish(.1,player)');return J(`fishSchools.filter(s=>Math.hypot(s.hx-player.x,s.hz-player.z)<40).map(s=>({id:s.sp.id,n:s.n,key:s.key}))`)};
 const fc=sim(...tier.spots.core,30),fp=sim(...tier.spots.plain,30),cnt=a=>a.reduce((t,s)=>t+s.n,0),reefIds=['kakure','sorasuzume','chocho','nanyouhagi','hatatate','hanadai'];
 assert(cnt(fc)>cnt(fp)&&fc.filter(s=>reefIds.includes(s.id)).length>=2,`reef fish gather at a core (${cnt(fc)} fish: ${fc.map(s=>s.id)}) vs plain sea (${cnt(fp)}: ${fp.map(s=>s.id)})`);
 assert(fc.some(s=>s.key>=16777216),'reef cells host a second school');assert(!fp.some(s=>['kakure','chocho','hatatate'].includes(s.id)),'core fish stay at reefs');
 assert.deepEqual(sim(...tier.spots.core,30).map(s=>s.key+s.id).sort(),fc.map(s=>s.key+s.id).sort(),'the same reef schools every visit');
 console.log(`PASS: coral reefs: mounds ${mc.length}, sun shafts ${sc.n}, tiers ${tier.t.map(v=>v.toFixed(2)).join('/')} (plain/fringe/reef/core), core forms ${forms} + rocks, hues ${[...bins]}, ${nc} vs ${np} coral quads, low ${lo.length}/${core.length}, fish ${cnt(fc)} (${[...new Set(fc.map(s=>s.id))]}) vs ${cnt(fp)}`)}
// ---- v8: river stretches that used to be dry sand beds hold water; v7 worlds keep their exact terrain (recorded before v8).
{const hashStep=(h,v)=>Math.imul(h^v,16777619);
 const v7=boot(JSON.stringify({version:1,worldWidth:2048,worldHeight:192,terrainVersion:7,seed:73219,changes:[],inventory:{}})),r7=c=>run(v7,c);
 assert.equal(r7('terrainVersion'),7);assert.equal(r7('CAVES&&AQUA'),true,'v7 keeps caves and underwater life');
 assert.equal(r7(`(()=>{let h=2166136261;for(let x=64;x<2048;x+=37)for(let z=64;z<2048;z+=41){h^=height4(x,z);h=Math.imul(h,16777619)}return h>>>0})()`),3097239738,'v7 heights');
 const blk=[[960,704,64],[1100,600,64],[500,1500,64],[1180,900,64],[400,420,64],[1650,700,64]].map(([x0,z0,n])=>{let h=2166136261;for(let x=x0;x<x0+n;x++)for(let z=z0;z<z0+n;z++)for(let y=20;y<180;y++)h=hashStep(h,v7.api.get(x,y,z));return h>>>0});
 assert.deepEqual(blk,[3372455204,3675025364,3480147517,1447613522,1736089219,2630077258],'v7 blocks are byte-identical');
 const meshes=[[62,48],[69,39],[74,40],[61,50]].map(([cx,cz])=>{r7(`rebuild(${cx},${cz})`);return JSON.parse(r7(`(()=>{let h=2166136261,n=0;for(const w of[opaqueW,waterW]){const a=w.a;for(let i=0;i<w.n;i+=36){let code=a[i+8];code-=Math.floor(code/1024)*1024;if(code>=511.5)code-=512;if(code>=255.5)code-=256;if(code-Math.floor((code+.5)/32)*32>30.5)continue;n+=36;for(let k=i;k<i+36;k++){h^=Math.round(a[k]*1000);h=Math.imul(h,16777619)}}}return JSON.stringify({h:h>>>0,n})})()`))});
 // Terrain faces only: underwater decorations (material 31) are mesh-only and were redesigned in v13 (coral reefs).
 assert.deepEqual(meshes,[{h:3466480933,n:42480},{h:1469257073,n:36432},{h:1115478590,n:58392},{h:3561083328,n:25668}],'v7 near terrain meshes are identical');
 const tiles=[[8,512,1024],[2,1088,576],[16,1536,0]].map(([s,x,z])=>JSON.parse(r7(`(()=>{const it=tileMesh(${s},${x},${z});let q;while(!(q=it.next()).done);let h=2166136261;for(let i=0;i<lw.n*12;i++){h^=lw.u8[i];h=Math.imul(h,16777619)}return JSON.stringify({h:h>>>0,n:lw.n})})()`)));
 assert.deepEqual(tiles,[{h:4013535438,n:14232},{h:1573468157,n:24252},{h:2652048814,n:4180}],'v7 far tiles are identical');
 // Dry sand beds on river centre lines near sea level: v7 against v8 on the same seed.
 const dry=b=>JSON.parse(run(b,`(()=>{let wet=0,dry=0;for(let z=40;z<W-40;z+=4)for(let x=40;x<W-40;x+=4){if(Math.abs(riverField(x,z))>.006)continue;const h=height4(x,z);if(gLand<=0||smooth(-.12,.18,pn(x/900+60.1,z/900+12.3))<=0)continue;if(h<SEA)wet++;else if(h<=SEA+2)dry++}return JSON.stringify({wet,dry})})()`));
 const d7=dry(v7),v8=boot(JSON.stringify({version:1,worldWidth:2048,worldHeight:192,terrainVersion:8,seed:73219,changes:[],inventory:{}})),d8=dry(v8);assert.equal(run(v8,'terrainVersion'),8);
 assert(d8.dry<d7.dry*.25&&d8.wet>d7.wet,`v8 fills most dry river beds (${d7.dry} -> ${d8.dry} dry, ${d7.wet} -> ${d8.wet} wet)`);
 // The far view agrees with the near terrain (the LOD worker serialises height4 with the version).
 assert(run(v8,'lodWorkerSource()').includes('terrainVersion>=8&&h>SEA-3'),'worker carries the v8 river rule');
 console.log(`PASS: v8 rivers: dry sand beds ${d7.dry} -> ${d8.dry}, wet centre line ${d7.wet} -> ${d8.wet}; v7 worlds keep identical terrain, blocks, near meshes and far tiles`)}
// ---- v9 WONDERS: canyons, waterfalls, arches, rock windows and sea-floor landforms; v8 worlds keep their exact terrain (recorded before v9).
{const hashStep=(h,v)=>Math.imul(h^v,16777619);
 const v8=boot(JSON.stringify({version:1,worldWidth:2048,worldHeight:192,terrainVersion:8,seed:73219,changes:[],inventory:{}})),r8=c=>run(v8,c);
 assert.equal(r8('terrainVersion'),8);assert.equal(r8('WON'),false,'v8 worlds build no wonders');assert.equal(r8('WLIST.length+WF.length+WA.length'),0);
 assert.equal(r8(`(()=>{let h=2166136261;for(let x=64;x<2048;x+=37)for(let z=64;z<2048;z+=41){h^=height4(x,z);h=Math.imul(h,16777619)}return h>>>0})()`),1998421872,'v8 heights');
 const blk=[[960,704,64],[1100,600,64],[500,1500,64],[1180,900,64],[400,420,64],[1650,700,64]].map(([x0,z0,n])=>{let h=2166136261;for(let x=x0;x<x0+n;x++)for(let z=z0;z<z0+n;z++)for(let y=20;y<180;y++)h=hashStep(h,v8.api.get(x,y,z));return h>>>0});
 assert.deepEqual(blk,[3372455204,3643137044,3480147517,1447613522,1736089219,2630077258],'v8 blocks are byte-identical');
 const meshes=[[62,48],[69,39],[74,40],[61,50]].map(([cx,cz])=>{r8(`rebuild(${cx},${cz})`);return JSON.parse(r8(`(()=>{let h=2166136261,n=0;for(const w of[opaqueW,waterW]){const a=w.a;for(let i=0;i<w.n;i+=36){n+=36;for(let k=i;k<i+36;k++){h^=Math.round(a[k]*1000);h=Math.imul(h,16777619)}}}return JSON.stringify({h:h>>>0,n})})()`))});
 assert.deepEqual(meshes,[{h:3466480933,n:42480},{h:3148664237,n:26316},{h:162066211,n:35748},{h:1248027087,n:31608}],'v8 near meshes (terrain, water and decorations) are identical');
 const tiles=[[8,512,1024],[2,1088,576],[16,1536,0]].map(([s,x,z])=>JSON.parse(r8(`(()=>{const it=tileMesh(${s},${x},${z});let q;while(!(q=it.next()).done);let h=2166136261;for(let i=0;i<lw.n*12;i++){h^=lw.u8[i];h=Math.imul(h,16777619)}return JSON.stringify({h:h>>>0,n:lw.n})})()`)));
 assert.deepEqual(tiles,[{h:3593889150,n:14172},{h:3175642778,n:22984},{h:2652048814,n:4180}],'v8 far tiles are identical');
 assert.equal(r8('JSON.stringify(vista)'),'{"x":992,"z":736,"yaw":0,"eye":121.5}','v8 start point unchanged');
 // New worlds: every kind of wonder exists, the list is a pure function of the seed, giants stay rare and wonders keep apart.
 const d=boot(),R=c=>run(d,c),J=c=>JSON.parse(R(`JSON.stringify(${c})`)),G=(x,y,z)=>d.api.get(Math.floor(x),Math.floor(y),Math.floor(z));
 assert.equal(R('terrainVersion'),11);
 const L=J('WLIST.map(s=>({k:s.kind,x:s.x,z:s.z,size:s.size,label:s.label}))'),count=k=>L.filter(s=>s.k===k).length;
 for(const [k,n] of [['canyon',1],['falls',3],['arch',1],['hoodoo',1],['seaArch',1],['uwArch',1],['reefHill',1]])assert(count(k)>=n,`${k} exists (${count(k)})`);
 assert(count('trench')+count('drop')>=1,'a trench or drop-off exists');
 assert.equal(JSON.stringify(L),run(boot(),'JSON.stringify(WLIST.map(s=>({k:s.kind,x:s.x,z:s.z,size:s.size,label:s.label})))'),'same seed, same wonders');
 assert(L.filter(s=>s.k==='falls'&&s.size>=60).length<=1&&count('arch')<=2,'giant falls and big arches are rare');
 const pts=L.filter(s=>['arch','hoodoo','seaArch','uwArch','reefHill'].includes(s.k));for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++)assert(Math.hypot(pts[i].x-pts[j].x,pts[i].z-pts[j].z)>40,'wonders keep apart');
 // Waterfalls: an unbroken sheet from the pool to the lip in open air, a stream at the lip level behind it, a pool that runs on to a river or the sea.
 const F=J('WF.filter(f=>f.t===3)');let drops=[];
 for(const f of F){const sx=f.x+f.dx,sz=f.z+f.dz;let wet=0;for(let y=SEA0+1;y<=f.wu;y++)if(G(sx,y,sz)===10)wet++;assert.equal(wet,f.wu-SEA0,`falls sheet is unbroken water (${wet}/${f.wu-SEA0})`);
  let air=0;for(let y=SEA0+2;y<=f.wu;y++)if(G(f.x+f.dx*4,y,f.z+f.dz*4)===0)air++;assert(air>=(f.wu-SEA0-1)*.85,`the sheet falls through open air (${air}/${f.wu-SEA0-1})`);
  assert.equal(G(f.x-f.dx*1.5,f.wu,f.z-f.dz*1.5),10,'the stream reaches the lip at the sheet level');assert(![0,10].includes(G(f.x-f.dx*1.5,f.wu-3,f.z-f.dz*1.5)),'the stream has a solid bed');
  assert.equal(G(f.px,SEA0,f.pz),10,'the plunge pool holds water');drops.push(f.wu-SEA0)}
 const conn=J(`WF.filter(f=>f.t===3).map(f=>{const q=[[Math.floor(f.px),Math.floor(f.pz)]],seen=new Set([q[0].join()]);let ok=false;
  while(q.length&&seen.size<5000&&!ok){const [x,z]=q.shift();height4(x,z);if(gWF&8||gLand<=0||Math.hypot(x-f.x,z-f.z)>f.sl+f.pr*2+40){ok=true;break}
   for(const [a,b] of [[1,0],[-1,0],[0,1],[0,-1]]){const k=(x+a)+','+(z+b);if(seen.has(k))continue;seen.add(k);if(get(x+a,SEA,z+b)===10)q.push([x+a,z+b])}}return ok})`);
 assert(conn.every(Boolean),`every plunge pool runs on to a river or the sea (${conn})`);
 // Canyons: a river at the bottom, walls 20+ blocks high with sheer steps, the same in the near field and in the far LOD worker.
 const C=J('WF.find(f=>f.t===1)');let ci=-1;for(let i=1;i<C.P.length-2;i++)if(F.every(f=>Math.hypot(f.x-C.P[i][0],f.z-C.P[i][1])>C.P[i][4]+50)&&(ci<0||C.P[i][4]>C.P[ci][4]))ci=i;
 const cp=C.P[ci],cq=C.P[ci+1],cl=Math.hypot(cq[0]-cp[0],cq[1]-cp[1]),cnx=-(cq[1]-cp[1])/cl,cnz=(cq[0]-cp[0])/cl,h4=(x,z)=>d.api.height(Math.round(x),Math.round(z));
 assert(h4(cp[0],cp[1])<SEA0,'the canyon floor holds its river');assert(h4(cp[0]+cnx*(cp[4]+3),cp[1]+cnz*(cp[4]+3))-SEA0>=20,'the canyon walls are tall');
 let sheer=0;for(let s=cp[3];s<cp[4];s++){const a=h4(cp[0]+cnx*s,cp[1]+cnz*s),b=h4(cp[0]+cnx*(s+1),cp[1]+cnz*(s+1));if(b-a>=6)sheer++}assert(sheer>=1,'canyon walls have sheer steps');
 const src=R('lodWorkerSource()');let out=null;const wc={Math,Int16Array,Uint8Array,Float32Array,ArrayBuffer,JSON,Number,Array,postMessage:m=>out=m};vm.createContext(wc);vm.runInContext(src,wc);
 const A=J("WA.find(f=>f.t===4&&f.kind==='arch')"),tileOf=(x,z,s)=>[s,Math.floor(x/(s*32))*s*32,Math.floor(z/(s*32))*s*32];let fallQuads=0,rockQuads=0;
 for(const [step,x0,z0] of [tileOf(cp[0],cp[1],2),tileOf(F[0].x+F[0].dx,F[0].z+F[0].dz,4),tileOf(F[0].x+F[0].dx,F[0].z+F[0].dz,16),tileOf(A.x,A.z,8),tileOf(A.x,A.z,2)]){wc.onmessage({data:{id:9,step,x0,z0}});
  const main=JSON.parse(R(`(()=>{const it=tileMesh(${step},${x0},${z0});let r;while(!(r=it.next()).done);return JSON.stringify({r:r.value,b:Array.from(lw.u8.subarray(0,lw.n*12)),m:Array.from(lw.i16.subarray(0,lw.n*6)).filter((v,i)=>i%6===3)})})()`));
  assert.equal(JSON.stringify(out.r),JSON.stringify(main.r),'worker bounds match on wonder tiles');assert.equal(out.bytes.length,main.b.length,'worker size matches on wonder tiles');for(let i=0;i<main.b.length;i+=29)assert.equal(out.bytes[i],main.b[i],'worker bytes match on wonder tiles');
  fallQuads+=main.m.filter(m=>(m&7)===3).length/4;rockQuads+=main.r.ymax>0?1:0}
 assert(fallQuads>=1,'falls show in the far LOD');
 // Arches and rock windows: an opening that stays open (walk under, or swim under at sea), rock above it, and no loose blocks.
 const rocks=J('WA.filter(f=>f.t===4)');const floating=[];
 for(const f of rocks){const mid=f.N[Math.floor(f.N.length/2)];
  if(f.kind==='hoodoo'){const hc=f.holes[0],hx=(hc[0][0]+hc[1][0])/2,hy=(hc[0][1]+hc[1][1])/2,hz=(hc[0][2]+hc[1][2])/2;assert([0,10].includes(G(hx,hy,hz)),'the rock window is open');
   let above=0;for(let y=hy+hc[0][3]+1;y<hy+hc[0][3]+6;y++)if(G(f.N[4][0],y,f.N[4][2])===3||G(f.N[4][0],y,f.N[4][2])===1)above++;assert(above>=1,'rock stands above the window')}
  else{const gx=mid[0],gz=mid[2];let y=Math.floor(mid[1]);while(y>2&&[3,1].includes(G(gx,y,gz)))y--;let open=0;while(y>2&&[0,10].includes(G(gx,y,gz))){open++;y--}
   assert(open>=4,`${f.kind}: an opening at least 4 blocks tall under the crown (${open})`);let rock=0;for(let yy=Math.floor(mid[1]-mid[4]);yy<=Math.ceil(mid[1]+mid[4]);yy++)if([3,1].includes(G(gx,yy,gz)))rock++;assert(rock>=2,`${f.kind}: rock at the crown`)}
  // Loose blocks: every rock voxel of the solid connects (6-neighbour) to the ground.
  floating.push(R(`(()=>{const f=WA.find(q=>q.id===${JSON.stringify(f.id)}),b=f.bb,x0=Math.floor(b[0]),x1=Math.ceil(b[1]),z0=Math.floor(b[4]),z1=Math.ceil(b[5]),y0=Math.max(1,Math.floor(b[2])),y1=Math.min(H-3,Math.ceil(b[3]));
   const nx=x1-x0+1,ny=y1-y0+1,nz=z1-z0+1,S=new Uint8Array(nx*ny*nz),id=(x,y,z)=>((y-y0)*nz+(z-z0))*nx+(x-x0);let total=0;
   for(let y=y0;y<=y1;y++)for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){const t=get(x,y,z);if(t&&t!==10&&t!==5&&t!==4&&(t<13||t>16)){S[id(x,y,z)]=1;if(rockIn(f,x+.5,y+.5,z+.5))total++}}
   const q=[];for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)if(S[id(x,y0,z)]){S[id(x,y0,z)]=2;q.push([x,y0,z])}
   while(q.length){const [x,y,z]=q.pop();for(const [a,b,c] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){const X=x+a,Y=y+b,Z=z+c;if(X<x0||X>x1||Y<y0||Y>y1||Z<z0||Z>z1)continue;const i=id(X,Y,Z);if(S[i]===1){S[i]=2;q.push([X,Y,Z])}}}
   let loose=0;for(let y=y0;y<=y1;y++)for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)if(S[id(x,y,z)]===1&&rockIn(f,x+.5,y+.5,z+.5))loose++;return loose})()`))}
 assert(floating.every(n=>n===0),`no loose rock blocks in arches and rock windows (${floating})`);
 // The hollow behind a fall: open, lit by crystals.
 const al=J('WA.filter(f=>f.t===5)');for(const a of al){assert(a.cry.length>0,'crystals behind the fall');const c=a.cry.find(c=>c[3]!==29);if(c)assert.equal(G(c[0],c[1],c[2]),c[3],'crystal placed');assert.equal(G(a.x-a.dx*2,a.y0+1,a.z-a.dz*2),0,'the hollow behind the fall is open')}
 // Sea floor: a reef hill rises toward the surface and carries corals on its floor (not floating); trenches cut deep.
 const hill=J('WF.find(f=>f.t===2&&f.s===0)');assert(SEA0-h4(hill.x,hill.z)<=7,'the reef hill rises close to the surface');
 const reef=J(`(()=>{rebuild(${Math.floor(hill.x/16)},${Math.floor(hill.z/16)});const a=opaqueW.a,out={coral:0,bad:0};for(let i=0;i<opaqueW.n;i+=36){let c=a[i+8];c-=Math.floor(c/1024)*1024;if(c>=511.5)c-=512;if(c>=255.5)c-=256;const face=Math.floor((c+.5)/32),m=c-face*32;if(m<30.5)continue;
  let y=a[i+1],v0=9,lo=1e9,hi=-1e9;for(let k=0;k<4;k++){const X=a[i+k*9],Z=a[i+k*9+2];y=Math.min(y,a[i+k*9+1]);v0=Math.min(v0,a[i+k*9+7]);
   for(const [ox,oz] of [[-.05,-.05],[.05,.05]]){let fy=SEA;while(fy>1&&get(Math.floor(X+ox),fy,Math.floor(Z+oz))===10)fy--;lo=Math.min(lo,fy+1);hi=Math.max(hi,fy+1)}}
  out.coral++;if((face===6&&v0>.01)||face===2||face===3)continue; // upper plant segments and box tops/bottoms say nothing about support
  if(y>hi+3)out.bad++}return out})()`); // a base more than 3 blocks above every floor under it (mound tops reach about 2.8) would float
 assert(reef.coral>200&&reef.bad===0,`reef hill decorations sit on the floor (${reef.coral} quads, ${reef.bad} floating)`);
 for(const t of J('WF.filter(f=>f.t===2&&f.s===1)')){let cut=0;for(let i=1;i<t.P.length-2;i++){const p=t.P[i],q=t.P[i+1],l=Math.hypot(q[0]-p[0],q[1]-p[1]),nx=-(q[1]-p[1])/l,nz=(q[0]-p[0])/l;
  cut=Math.max(cut,Math.min(h4(p[0]+nx*(p[3]+4),p[1]+nz*(p[3]+4)),h4(p[0]-nx*(p[3]+4),p[1]-nz*(p[3]+4)))-h4(p[0],p[1]))}assert(cut>=8,`the trench cuts well below the sea bed on both sides (${cut})`)}
 // Effects: spray, rainbow mist and ripples are meshed at the foot of each fall in every quality; the shader branches exist.
 for(const q of ['low','standard','high']){R(`setQuality('${q}')`);const fx=J(`(()=>{const f=WF.find(f=>f.t===3);rebuild(Math.floor((f.x+f.dx*1.5)/16),Math.floor((f.z+f.dz*1.5)/16));let mist=0,ring=0;const a=waterW.a;for(let i=0;i<waterW.n;i+=36){const m=a[i+8];if(Math.abs(m-30.6)<.01)mist++;if(Math.abs(m-30.7)<.01)ring++}return{mist,ring}})()`);assert(fx.mist===3&&fx.ring===1,`falls effects in ${q} quality (${JSON.stringify(fx)})`)}
 assert(d.api.waterFragmentSource.includes('v9 falling water')&&d.api.waterFragmentSource.includes('rainbow')&&d.api.lodFragmentSource.includes('v9 far falls'),'falls shaders');
 // Discovery and the scenic tour: classic spots keep their order, wonders follow; each visit lands safely; finding one on foot names it once.
 R('spotList=null;nextSpot()');const tour=J('spotList.map(s=>s.w?"w:"+s.w.kind:s.kind)');assert(tour.slice(0,12).every(k=>!k.startsWith('w:')),'classic spots first');assert(tour.filter(k=>k.startsWith('w:')).length===L.length,'every wonder is on the tour');
 for(const k of ['falls','canyon','arch','hoodoo','uwArch']){R(`visitWonder(WLIST.find(s=>s.kind==='${k}'))`);assert(!d.api.collides(d.api.player),`${k} visit lands in open space`)}
 R(`paused=false;wonderFound=null;localStorage.removeItem(WONDER_FOUND_KEY+seed);const s=WLIST.find(s=>s.kind==='falls');player.x=s.x+.5;player.z=s.z+.5;player.y=SEA+40;wonderNext=0;wonderTick(1)`);
 const first=d.nodes.hint.textContent;assert.match(first,/絶景を発見/,'finding a wonder on foot names it');
 for(let i=0;i<6;i++){R(`$('hint').textContent='';wonderNext=0;wonderTick(${i+2})`);assert.notEqual(d.nodes.hint.textContent,first,'a found wonder is not announced twice')}
 assert.equal(J('JSON.parse(localStorage.getItem(WONDER_FOUND_KEY+seed)).length'),J('wonderFound.size'),'found wonders are remembered on the device');
 // Save: an edit at a fall survives a reload of the v9 world.
 const f0=F[0];d.api.edit(Math.floor(f0.x+f0.dx),f0.wu,Math.floor(f0.z+f0.dz),0);assert(d.api.save());const re=boot(d.storage['nisekura-v1']);assert.equal(run(re,'terrainVersion'),11);assert.equal(re.api.get(Math.floor(f0.x+f0.dx),f0.wu,Math.floor(f0.z+f0.dz)),0,'an edit at a fall survives reload');
 console.log(`PASS: v9 wonders: ${L.length} (${[...new Set(L.map(s=>s.k))].map(k=>k+' '+count(k)).join(', ')}), falls ${drops.join('/')}m with pools that run on, canyon river and sheer walls, worker matches on wonder tiles (${fallQuads} far falls quads), arches open with no loose blocks, ${al.length} hollows with crystals, reef hill ${reef.coral} coral quads, effects in 3 qualities, tour/discovery/save; v8 worlds identical`)}

// ---- SURVIVAL Phase 1: game modes, hearts, swords, hostile zombies / skeletons / slimes, arrows, death and respawn, saves, touch.
{const d=boot(),R=c=>run(d,c),J=c=>JSON.parse(R(`JSON.stringify(${c})`));
 // Modes: a brand-new world asks once; old saves keep their rules (自由建築 -> creative, 素材集め -> peaceful, never forced into survival).
 assert.equal(R('gameMode'),'peaceful');assert.equal(R('modeChosen'),false);
 d.nodes.play.onclick();assert(!d.nodes.modePick.classList.contains('hidden'),'single play on a new world opens the mode picker');assert.equal(R('paused'),true);
 d.nodes.pickSurvival.onclick();assert.equal(R('gameMode'),'survival');assert.equal(R('paused'),false);assert(d.nodes.modePick.classList.contains('hidden'));
 assert(Math.abs(R('dayTime')-.52)<1e-9,'a new survival world starts after noon so the first night comes within about five minutes');
 assert(d.c.document.body.classList.contains('mode-survival'),'survival HUD (hearts, attack button) is shown');assert.equal(J('heartNodes.map(h=>h.className)').join(),Array(10).fill('full').join(),'ten full hearts = 20 HP');
 assert.equal(R('MAX_HP'),20);R('flying=false;toggleFlight()');assert.equal(R('flying'),false,'no flight in survival');
 const legacyC=boot(JSON.stringify({version:1,terrainVersion:9,worldWidth:2048,worldHeight:192,seed:5,changes:[],inventory:{},creative:true}));assert.equal(run(legacyC,'gameMode'),'creative');assert.equal(run(legacyC,'modeChosen'),true);
 const legacyP=boot(JSON.stringify({version:1,terrainVersion:9,worldWidth:2048,worldHeight:192,seed:5,changes:[],inventory:{},creative:false,flying:true}));assert.equal(run(legacyP,'gameMode'),'peaceful');assert.equal(run(legacyP,'flying'),true,'a peaceful (素材集め) world keeps its flight');
 legacyP.nodes.play.onclick();assert(legacyP.nodes.modePick.classList.contains('hidden'),'saved worlds start without asking');
 for(const [from,to] of [['survival','peaceful'],['peaceful','creative'],['creative','survival']]){run(legacyC,`setGameMode('${from}')`);legacyC.nodes.mode.onclick();assert.equal(run(legacyC,'gameMode'),to,'mode button cycles');assert.equal(run(legacyC,'creative'),to==='creative')}
 run(legacyC,'flying=true;setGameMode("survival")');assert.equal(run(legacyC,'flying'),false,'switching to survival lands the player');assert(run(legacyC,'protectT')>0,'and grants a short shield');
 // Arena in the sky so terrain does not decide the outcome.
 R(`setGameMode('survival');timeOverride=.95;dayTime=.95;var X0=Math.floor(player.x)+300,Z0=Math.floor(player.z),Y0=150;
  for(let x=X0-24;x<=X0+24;x++)for(let z=Z0-24;z<=Z0+24;z++){get(x,Y0,z);set(x,Y0,z,3);for(let y=Y0+1;y<Y0+8;y++)set(x,y,z,0)}
  var arena=()=>{life.length=0;arrows.length=0;health=MAX_HP;invulT=0;protectT=0;dead=false;paused=false;flying=false;player.x=X0+.5;player.z=Z0+.5;player.y=Y0+1;vy=0;kbx=kbz=0;yaw=0;pitch=0;atkCD=0;$('death').classList.add('hidden')};
  var step=(n,dt=1/30)=>{for(let i=0;i<n;i++){update(dt);updateLife(dt,player);updateSurvival(dt)}};
  var wall=(z,t)=>{for(let x=X0-8;x<=X0+8;x++)for(let y=Y0+1;y<Y0+6;y++)set(x,y,z,t)}`);
 const changes0=R('changes.size');
 // Zombie: slow chase, a visible wind-up, then a hit; short invulnerability after each hit; red vignette.
 R(`arena();var z=lifeNew(LIFE_BY_ID.zombie,X0+.5,Y0+1,Z0+8.5,false)`);const z0=R('Math.hypot(z.x-player.x,z.z-player.z)');R('step(45)');
 assert(R('Math.hypot(z.x-player.x,z.z-player.z)')<z0-1.5&&R('z.mode')==='hunt','zombie walks toward the player');assert(R('z.speed')<=R('LIFE_BY_ID.zombie.run')+1e-9&&R('LIFE_BY_ID.zombie.run')<R('4.3/2'),'zombies are slower than half the walking speed');
 let sawWindup=false,hp0=20;for(let i=0;i<240&&R('health')===20;i++){R('step(1)');if(R('z.mode')==='windup'){sawWindup=true;assert(R('z.flash')>0,'wind-up glows')}}
 assert(sawWindup,'zombie winds up before hitting');assert(R('health')<hp0,'zombie hits the player');assert(R('hurtGlow')>0,'damage vignette');assert(R('invulT')>0);
 const afterHit=R('health');R('hurtPlayer(3,z)');assert.equal(R('health'),afterHit,'invulnerable right after a hit');
 // Walls: no attacks through blocks, and the zombie cannot pass them.
 R(`arena();wall(Z0+2,3);var z=lifeNew(LIFE_BY_ID.zombie,X0+.5,Y0+1,Z0+3.6,false);step(300)`);assert.equal(R('health'),20,'no zombie hits through a wall');assert(R('z.z>Z0+2.9'),'zombie does not walk through the wall');assert.equal(R('z.los'),false);R('wall(Z0+2,0)');
 // Skeleton: keeps its distance, draws (aim) and fires arrows that fly in an arc; terrain stops them.
 R(`arena();var s=lifeNew(LIFE_BY_ID.skeleton,X0+.5,Y0+1,Z0+9.5,false);var shots=0,aims=0,minD=99;for(let i=0;i<600;i++){const n=arrows.length;step(1);if(arrows.length>n)shots++;if(s.mode==='aim')aims++;minD=Math.min(minD,Math.hypot(s.x-player.x,s.z-player.z))}`);
 assert(R('shots')>=2&&R('aims')>0,`skeleton draws and shoots (${R('shots')} arrows)`);assert(R('health')<20,'arrows hurt');assert(R('minD')>3.5,'skeleton keeps its distance');
 R(`arena();wall(Z0+4,3);arrows.push({x:X0+.5,y:Y0+2,z:Z0+9,vx:0,vy:1,vz:-15,life:5,stuck:false,dmg:2});step(30)`);assert.equal(R('health'),20,'an arrow cannot pass a wall');assert.equal(R('arrows[0].stuck'),true,'it sticks in the wall');R('wall(Z0+4,0)');
 R(`arena();for(let i=0;i<40;i++)shootArrow({x:X0+.5,y:Y0+1,z:Z0+12,yaw:Math.PI,size:1},2)`);assert(R('arrows.length')<=R('ARROW_MAX'),'arrows are capped');
 R(`arena();var s=lifeNew(LIFE_BY_ID.skeleton,X0+.5,Y0+1,Z0+9.5,false);wall(Z0+5,3);step(300)`);assert.equal(R('arrows.length'),0,'skeletons do not shoot without a clear line');R('wall(Z0+5,0)');
 // Slime: hops while hunting, crouches, then lunges once.
 R(`arena();var sl=lifeNew(LIFE_BY_ID.slime,X0+.5,Y0+1,Z0+7.5,false,1);var air=0,modes=new Set();for(let i=0;i<300;i++){step(1);if(!sl.ground)air++;modes.add(sl.mode)}`);
 assert(R('air')>20,'slime hops');assert(J('[...modes]').includes('windup')&&J('[...modes]').includes('pounce'),'slime crouches then lunges');assert(R('health')<20,'slime bumps the player');
 // Player attacks: the attack button swings, the sword damages, knocks back and defeats; cooldown; 壊す hits a monster instead of the block behind it.
 R(`arena();var z=lifeNew(LIFE_BY_ID.zombie,X0+.5,Y0+1,Z0+2.5,false);pitch=-.1`);assert.equal(R('weapon().name'),'素手');R('strike(true)');assert.equal(R('z.mhp'),11,'fists do 1 damage');assert(R('z.hurtF')>0&&R('z.barT')>0,'hit flash and health bar');
 R('strike(true)');assert.equal(R('z.mhp'),11,'attack cooldown');R('step(8)');assert(R('Math.hypot(z.x-player.x,z.z-player.z)')>2.6,'knockback pushes the monster away');
 R(`life.length=0;items.woodSword=1;var z=lifeNew(LIFE_BY_ID.zombie,X0+.5,Y0+1,Z0+2.5,false);var hits=0;for(let i=0;i<8&&life.includes(z);i++){atkCD=0;z.z=Z0+2.5;z.x=X0+.5;if(strike(true))hits++}`);
 assert.equal(R('hits'),3,'a wooden sword defeats a zombie in three hits');assert.equal(R('life.includes(z)'),false);assert.equal(R('defeated'),1);assert.match(d.nodes.hint.textContent,/たおした/,'defeat is celebrated');
 R(`arena();wall(Z0+4,3);var z=lifeNew(LIFE_BY_ID.zombie,X0+.5,Y0+1,Z0+2.5,false);pitch=0;mine()`);assert.equal(R('z.mhp'),R('monsterMaxHP(z)-weapon().dmg'),'壊す hits the monster in front');assert.equal(R(`get(X0,Y0+2,Z0+4)`),3,'and not the block behind it');R('wall(Z0+4,0)');
 R(`arena();var far=lifeNew(LIFE_BY_ID.zombie,X0+.5,Y0+1,Z0+20,false);step(30)`);assert.notEqual(R('far.mode'),'windup');R('items.stoneSword=1');assert.equal(R('weapon().dmg'),6,'the stone sword is stronger');assert.deepEqual(JSON.parse(R('JSON.stringify(SWORDS.ironSword.need)')),{7:1,iron:2},'v16: the iron sword is made from iron');
 // Monster HP / AI only near the player; nothing hostile beyond the active radius.
 R(`arena();var far=lifeNew(LIFE_BY_ID.zombie,X0+.5,Y0+1,Z0+23.5,false);far.los=true;step(60)`);assert(!R('HOSTILE_MODES.has(far.mode)')||R('Math.hypot(far.x-player.x,far.z-player.z)')<R('ACTIVE_R'),'far monsters stay passive');
 // Creative and peaceful: never hurt; peaceful monsters never wind up.
 R(`arena();setGameMode('peaceful');var z=lifeNew(LIFE_BY_ID.zombie,X0+.5,Y0+1,Z0+1.5,false);var wind=0;for(let i=0;i<300;i++){step(1);if(z.mode==='windup'||z.mode==='aim')wind++}`);assert.equal(R('health'),20,'peaceful: monsters never attack');assert.equal(R('wind'),0);
 assert.equal(R('hurtPlayer(5,z)'),false);R('setGameMode("creative")');assert.equal(R('hurtPlayer(5,z)'),false,'creative: no damage');assert.equal(R('health'),20);R('strike(true)');assert.equal(R('z.mhp'),0,'no combat outside survival');
 // Death: the respawn screen, nothing lost, back at the start point with a shield, and monsters near it sent away.
 R(`setGameMode('survival');arena();inventory[3]=7;items.apple=2;var keep=JSON.stringify([inventory,items]);var z=lifeNew(LIFE_BY_ID.zombie,homeX+3,surface(homeX+3,homeZ),homeZ,false);health=2;hurtPlayer(9,{x:player.x,y:player.y,z:player.z+1})`);
 assert.equal(R('dead'),true);assert.equal(R('paused'),true);assert(!d.nodes.death.classList.contains('hidden'),'respawn screen');assert.equal(JSON.parse(d.storage['nisekura-v1']).health,0,'death is saved');
 R('step(30)');assert.equal(R('health'),0,'the world waits while dead');d.c.document.onkeydown({code:'Escape',preventDefault(){}});assert(!d.nodes.death.classList.contains('hidden'),'Escape cannot skip the respawn screen');
 d.nodes.respawn.onclick();assert.equal(R('dead'),false);assert.equal(R('health'),20);assert(R('protectT')>=4.9,'respawn shield');assert(R('Math.hypot(player.x-homeX,player.z-homeZ)')<1,'respawn at the start point');assert.equal(R('JSON.stringify([inventory,items])'),R('keep'),'nothing is lost');
 assert.equal(R('life.includes(z)'),false,'monsters at the start point leave');assert(!d.api.collides(d.api.player),'respawn in open space');R('health=1;hurtPlayer(5,{x:player.x,y:player.y,z:player.z+1})');assert.equal(R('health'),1,'no damage during the shield');
 // Sanctuary: around the start point monsters neither enter nor attack.
 R(`arena();spawn();protectT=0;var g=surface(homeX+SAFE_R+1.5,homeZ);var z=lifeNew(LIFE_BY_ID.zombie,homeX+SAFE_R+1.5,g,homeZ,false);player.x=homeX+SAFE_R-1.5;player.z=homeZ;player.y=surface(player.x,player.z)+.02;streamChunks(true);step(300)`);
 assert.equal(R('health'),20,'no damage inside the start area');assert(R('Math.hypot(z.x-homeX,z.z-homeZ)')>=R('SAFE_R')-.01,'monsters do not walk into the start area');
 // Healing: apples (leaves -> apple), slow regeneration after quiet time.
 R('arena();health=10;items.apple=0;inventory[5]=4;craftItem("apple")');assert.equal(R('items.apple'),1);assert.equal(R('inventory[5]'),0);assert(R('Object.values(inventory).every(Number.isSafeInteger)'),'crafting keeps every count a whole number');R('eat()');assert.equal(R('health'),16,'an apple heals 3 hearts');assert.equal(R('eat()'),false,'no apples left');
 R('health=10;sinceHurt=0;step(30*9)');assert.equal(R('health'),10);R('step(30*10)');assert(R('health')>10,'slow natural healing');
 // Crafting: the wooden sword within minutes (1 log -> 4 planks -> sword), then stone; no duplicates.
 R('items.woodSword=items.stoneSword=0;inventory[7]=2');assert.equal(R('craftItem("woodSword")'),false);R('inventory[7]=4');assert.equal(R('craftItem("woodSword")'),true);assert.equal(R('inventory[7]'),1);assert.equal(R('craftItem("woodSword")'),false,'one sword is enough');
 R('inventory[3]=3');assert.equal(R('craftItem("stoneSword")'),true);assert.equal(R('weapon()'),R('SWORDS.stoneSword'));
 // Night spawning in survival: only zombies, skeletons and slimes, a few at a time, never in the start area, gone at dawn.
 const n=boot(),N=c=>run(n,c);N(`paused=false;setGameMode('survival');protectT=1e9;dayTime=.45;timeOverride=.45;life.length=0`);for(let i=0;i<120&&N('readyR')<2;i++)N('streamChunks()');
 N(`player.x+=60;player.y=surface(player.x,player.z)+.02;streamChunks(true)`);for(let i=0;i<120&&N('readyR')<2;i++)N('streamChunks()');N('for(let k=0;k<300;k++){updateLife(.1,player);updateSurvival(.1)}');
 assert.equal(N('life.filter(c=>c.sp.hostile).length'),0,'no hostile monsters by day');N('dayTime=.95;timeOverride=.95');const ramp=[];
 for(let s=0;s<12;s++){N('for(let k=0;k<100;k++){updateLife(.1,player);updateSurvival(.1)}');ramp.push(N('life.filter(c=>c.sp.hostile&&!c.manual).length'))}
 assert(ramp[ramp.length-1]>=1,'monsters appear at night in survival: '+ramp);assert(ramp[0]<=1&&Math.max(...ramp)<=2,'at most two at once before three wins: '+ramp);
 assert(JSON.parse(N('JSON.stringify(life.filter(c=>c.sp.cat==="monster"&&!c.manual).map(c=>c.sp.id))')).every(id=>['zombie','skeleton','slime'].includes(id)),'only the three survival monsters');
 assert.equal(N('life.filter(c=>c.sp.hostile&&Math.hypot(c.x-homeX,c.z-homeZ)<SAFE_R).length'),0,'safe zone around the start point');
 N('defeated=5;for(let k=0;k<1200;k++){updateLife(.1,player);updateSurvival(.1)}');assert(N('life.filter(c=>c.sp.hostile&&!c.manual).length')<=N('HOSTILE_CAP[qualityName]'),'hostile cap');
 assert(N('HOSTILE_CAP.low')<N('HOSTILE_CAP.standard'),'fewer monsters on low quality');
 N('dayTime=.45;timeOverride=.45;for(let k=0;k<300;k++){updateLife(.1,player);updateSurvival(.1)}');assert.equal(N('life.filter(c=>c.sp.hostile&&!c.manual).length'),0,'they leave at dawn');
 // Saves: mode, hearts, swords, apples and wins come back; older releases still see `creative` and a hotbar slot they accept.
 R(`arena();setGameMode('survival');health=13;items.apple=3;defeated=4;selected=11`);assert(d.api.save(),'saving with hotbar slot 12 selected works: '+d.nodes.saveInfo.textContent);const sv=JSON.parse(d.storage['nisekura-v1']);
 assert.equal(sv.gameMode,'survival');assert.equal(sv.creative,false);assert.equal(sv.health,13);assert.equal(sv.settings.selected,0,'old-release compatible slot');assert.equal(sv.settings.hotbar,11);
 const re=boot(d.storage['nisekura-v1']);const ri=JSON.parse(run(re,'JSON.stringify([gameMode,health,items,defeated,selected,creative])'));assert.deepEqual([ri[0],ri[1],ri[3],ri[4],ri[5]],['survival',13,4,11,false]);assert.deepEqual({woodSword:ri[2].woodSword,stoneSword:ri[2].stoneSword,ironSword:ri[2].ironSword,apple:ri[2].apple},{woodSword:1,stoneSword:1,ironSword:0,apple:3});
 const deadSave={...sv,health:0};delete deadSave.integrity;const rd=boot(JSON.stringify(deadSave));assert.equal(run(rd,'health'),20,'a world saved on the respawn screen comes back alive');assert(run(rd,'Math.hypot(player.x-homeX,player.z-homeZ)')<1);
 for(const bad of [{gameMode:'hard'},{health:-1},{health:21},{items:[]},{items:{apple:-1}},{defeated:1.5}]){const x={...sv,...bad};delete x.integrity;const b=boot(JSON.stringify(x));assert(run(b,'storageBlocked'),'rejects '+JSON.stringify(bad))}
 const future={...sv,items:{...sv.items,diamondSword:1}};delete future.integrity;assert.equal(run(boot(JSON.stringify(future)),'storageBlocked'),false,'unknown future items are tolerated');
 // Touch: the attack button holds and releases like the others; photo mode and menus block it.
 R(`arena();var z=lifeNew(LIFE_BY_ID.zombie,X0+.5,Y0+1,Z0+2.5,false);atkCD=0`);const touch={pointerId:9,clientX:10,clientY:10,preventDefault(){}};
 d.nodes.attack.listeners.pointerdown.forEach(f=>f(touch));assert.equal(R('attackHeld'),true);assert(R('z.mhp')>0&&R('z.mhp')<R('monsterMaxHP(z)'),'attack button hits');R('step(20)');assert(R('z.mhp')<R('monsterMaxHP(z)-6'),'holding repeats at the sword cooldown');
 d.nodes.attack.listeners.lostpointercapture.forEach(f=>f());assert.equal(R('attackHeld'),false);R('attackHeld=true;clearInput()');assert.equal(R('attackHeld'),false);
 R('setPhotoMode(true);atkCD=0');assert.equal(R('strike(true)'),false,'no attacks in photo mode');R('setPhotoMode(false)');
 // First-time guide: wood -> sword -> fight, remembered on the device.
 const g=boot(),G=c=>run(g,c);G('paused=false;setGameMode("survival");updateSurvival(.1)');assert.match(g.nodes.guide.innerHTML,/木/);assert(!g.nodes.guide.classList.contains('hidden'));
 G('items.woodSword=1;updateSurvival(.1)');assert.match(g.nodes.guide.innerHTML,/安全地帯の外へ/);assert.equal(g.storage['jocraft2-guide'],'2');
 console.log(`PASS: survival: 3 modes (picker, legacy mapping, safe switching), 20 HP hearts, zombie chase/wind-up/hit, walls block hits and arrows, skeleton arrows (${R('shots')}), slime lunges, sword 3-hit defeat, knockback, death/respawn with nothing lost, apples, crafting, night ramp ${ramp.join('/')}, safe zone, dawn, saves and old-release compatibility, touch attack`)}

// ---- SURVIVAL polish: life setting vs monsters, guidance to leave the safe zone, multi-touch attack, release stops repeats, no side effects elsewhere.
{const T={pointerId:3,clientX:90,clientY:56,preventDefault(){}};
 // A brand-new world that picks survival gets 「生き物：すべて」 and no warning.
 const f=boot(),F=c=>run(f,c);f.nodes.play.onclick();f.nodes.pickSurvival.onclick();
 assert.equal(F('lifeMode'),'all');assert.equal(F('monsterNotice()'),'');assert(!f.nodes.lifeMenu.textContent.includes('⚠'));
 // Existing world with natural spawning OFF: survival never changes it silently, but explains why no monsters come.
 const base=JSON.parse((()=>{const x=boot();x.api.save();return x.storage['nisekura-v1']})());delete base.integrity;base.life={mode:'off',eggs:[]};base.gameMode='peaceful';base.creative=false;
 for(const mode of ['off','animals']){const w=boot(JSON.stringify({...base,life:{mode,eggs:[]}})),W=c=>run(w,c);
  for(let i=0;i<3&&W('gameMode')!=='survival';i++)w.nodes.mode.onclick();assert.equal(W('gameMode'),'survival');assert.equal(W('lifeMode'),mode,'the player\'s choice is kept');
  const label=mode==='off'?'自然発生OFF':'動物だけ';assert(W('monsterNotice()').includes(label)&&W('monsterNotice()').includes('モンスターは出ない'),'the notice names the setting');
  assert(w.nodes.lifeMenu.textContent.includes('⚠敵なし'),'the title button shows the warning (the hint bubble is hidden behind the title)');
  W('play()');assert(w.nodes.hint.textContent.includes(label),'starting play explains it');
  W('paused=false;timeOverride=.95;dayTime=.95;protectT=0;for(let i=0;i<120&&readyR<2;i++)streamChunks();player.x+=60;player.y=surface(player.x,player.z)+.02;streamChunks(true);for(let k=0;k<1500;k++){updateLife(.1,player);updateSurvival(.1)}');
  assert.equal(W('life.filter(c=>c.sp.hostile).length'),0,'no monsters while natural spawning is not "all"');
  W('updateSurvival(.1);fps=0');assert(/敵なし/.test(W('`${gameMode==="survival"&&lifeMode!=="all"?" · 敵なし":""}`')),'stats line flags it');
  W('hint=0');W('setLifeMode("all")');assert.equal(W('monsterNotice()'),'');assert(!w.nodes.lifeMenu.textContent.includes('⚠'),'the warning clears');assert.match(w.nodes.hint.textContent,/モンスターが出るように/,'turning it on is announced');
  W('timeOverride=.95;for(let k=0;k<1500;k++){updateLife(.1,player);updateSurvival(.1)}');assert(W('life.filter(c=>c.sp.hostile).length')>=1,'monsters come once it is "all"');
  W('setLifeMode("off")');assert.match(w.nodes.hint.textContent,/自然発生OFF/,'turning it off again is explained');
  for(let k=0;k<400;k++)W('updateLife(.1,player);updateSurvival(.1)');assert.equal(W('life.filter(c=>c.sp.hostile).length'),0,'OFF is respected: monsters leave');
  W('setGameMode("peaceful")');assert.equal(W('monsterNotice()'),'','no warning outside survival');assert.equal(W('lifeMode'),'off');
 }
 // Guidance: after the sword, the player is sent out of the sanctuary; the fight tip appears only outside it.
 const g=boot(),G=c=>run(g,c);G('paused=false;setGameMode("survival");guideStep=1;items.woodSword=1;spawn();updateSurvival(.1)');
 assert.match(g.nodes.guide.innerHTML,/安全地帯の外へ冒険しよう/);assert.match(g.nodes.guide.innerHTML,/夜になるとモンスター/);assert(!g.nodes.guide.classList.contains('hidden'));assert(g.nodes.guide.innerHTML.length<140,'the tip is short');
 G('player.x=homeX+SAFE_R+3;updateSurvival(.1)');assert.match(g.nodes.guide.innerHTML,/攻撃/);assert(!/安全地帯の外へ/.test(g.nodes.guide.innerHTML));
 G('guideSince=-20000;updateSurvival(.1)');assert(g.nodes.guide.classList.contains('hidden'),'the tip fades after 15 s');
 const css=fs.readFileSync(__dirname+'/index.html','utf8');assert(/#guide\{[^}]*pointer-events:none/.test(css),'the tip lets touches through to the camera');assert(css.includes("body:has(#craft:not(.hidden)) #guide"),'tip hides behind panels');
 // Safe zone: nothing attacks inside it, even when a monster is right next to the player; outside, the same monster fights.
 const s=boot(),S=c=>run(s,c);S(`paused=false;setGameMode('survival');timeOverride=.95;dayTime=.95;protectT=0;for(let i=0;i<120&&readyR<2;i++)streamChunks();life.length=0;spawn();streamChunks(true);
  var z=lifeNew(LIFE_BY_ID.zombie,player.x+1.2,player.y,player.z,false);z.aggro=4;z.los=true;for(let k=0;k<200;k++){update(.03);updateLife(.03,player);updateSurvival(.03)}`);
 assert.equal(S('health'),20,'no attacks in the safe zone');
 S(`life.length=0;var PX=Math.floor(homeX+SAFE_R+10),PZ=Math.floor(homeZ);player.x=PX+.5;player.z=PZ+.5;player.y=surface(player.x,player.z)+.02;streamChunks(true);for(let i=0;i<120&&readyR<2;i++)streamChunks();
  for(let x=PX-6;x<=PX+6;x++)for(let z=PZ-6;z<=PZ+6;z++){set(x,150,z,3);for(let y=151;y<158;y++)set(x,y,z,0)}player.x=PX+.5;player.z=PZ+.5;player.y=151;var z=lifeNew(LIFE_BY_ID.zombie,PX+1.7,151,PZ+.5,false);for(let k=0;k<200&&health===20;k++){update(.03);updateLife(.03,player);updateSurvival(.03)}`);
 assert(S('health')<20,'outside the safe zone the same monster attacks');
 // Creative / peaceful: no hostile spawns, no damage, no survival HUD, nothing queued for survival.
 for(const m of ['creative','peaceful']){S(`setGameMode('${m}');life.length=0;health=20;timeOverride=.95;dayTime=.95;for(let k=0;k<600;k++){updateLife(.1,player);updateSurvival(.1)}`);
  assert.equal(S('life.filter(c=>c.sp.hostile&&c.mode==="hunt").length'),0,m+': monsters never hunt');assert.equal(S('health'),20);assert.equal(S('hurtPlayer(3,{x:player.x,y:player.y,z:player.z})'),false);
  assert(!s.c.document.body.classList.contains('mode-survival'),m+': survival HUD hidden');assert.equal(S('arrows.length'),0);assert.equal(S('monsterNotice()'),'');}
 // Touch: move with the stick while attacking, look around while attacking, release stops the repeat.
 const t=boot(),Tt=c=>run(t,c);Tt(`paused=false;setGameMode('survival');timeOverride=.95;dayTime=.95;protectT=1e9;items.woodSword=1;life.length=0;var X0=Math.floor(player.x)+300,Z0=Math.floor(player.z),Y0=150;
  for(let x=X0-20;x<=X0+20;x++)for(let z=Z0-20;z<=Z0+20;z++){get(x,Y0,z);set(x,Y0,z,3);for(let y=Y0+1;y<Y0+8;y++)set(x,y,z,0)}
  player.x=X0+.5;player.z=Z0+.5;player.y=Y0+1;yaw=0;pitch=0;atkCD=0;var hold=(n=1)=>{for(let i=0;i<n;i++){update(1/30);updateLife(1/30,player);updateSurvival(1/30)}}`);
 Tt(`var z=lifeNew(LIFE_BY_ID.zombie,X0+.5,Y0+1,Z0+3,false);z.mhp=999;z.aggro=-99;z.timer=999;z.mode='freeze'`);
 t.nodes.stick.onpointerdown({...T,pointerId:11,clientX:56,clientY:10});t.nodes.attack.listeners.pointerdown.forEach(f=>f({...T,pointerId:12}));
 assert(Tt('joy.y')<0&&Tt('attackHeld'),'the stick and the attack button work at the same time');const z0=Tt('player.z');Tt('for(let i=0;i<45;i++){z.x=player.x+Math.sin(yaw)*2.2;z.z=player.z+Math.cos(yaw)*2.2;hold()}');assert(Tt('player.z')>z0+2,'the player keeps walking while attacking');assert(Tt('z.mhp')<999-8,'and keeps hitting');
 t.nodes.world.onpointerdown({...T,pointerId:13,pointerType:'touch',clientX:200,clientY:200});const yaw0=Tt('yaw');t.nodes.world.onpointermove({...T,pointerId:13,clientX:260,clientY:200});assert(Tt('yaw')>yaw0&&Tt('attackHeld'),'the view turns while the attack button stays held');
 for(const ev of ['pointerup']){t.nodes.attack.listeners[ev].forEach(f=>f())}assert.equal(Tt('attackHeld'),false);Tt('z.x=player.x+Math.sin(yaw)*2.2;z.z=player.z+Math.cos(yaw)*2.2;hold(3)');const hp=Tt('z.mhp');Tt('hold(60)');assert.equal(Tt('z.mhp'),hp,'releasing the button stops the repeated attacks');
 t.nodes.attack.listeners.pointerdown.forEach(f=>f({...T,pointerId:14}));t.nodes.attack.listeners.pointercancel.forEach(f=>f());assert.equal(Tt('attackHeld'),false,'a cancelled touch also stops it');
 t.nodes.attack.listeners.pointerdown.forEach(f=>f({...T,pointerId:15}));Tt('pause()');assert.equal(Tt('attackHeld'),false,'opening the menu releases the button');Tt('play()');Tt('atkCD=0;hold(30)');assert.equal(Tt('z.mhp'),hp,'and it stays released after returning');
 Tt('hurtPlayer(99,{x:player.x,y:player.y,z:player.z+1});protectT=0;invulT=0');Tt('protectT=0;invulT=0;health=1;hurtPlayer(5,{x:player.x,y:player.y,z:player.z+1})');
 t.nodes.attack.listeners.pointerdown.forEach(f=>f({...T,pointerId:16}));assert.equal(Tt('attackHeld'),false,'the attack button does nothing on the respawn screen');
 console.log('PASS: survival polish: life setting kept and explained (off/animals/all), title warning, stats flag, short exploration guide, safe zone vs outside, creative/peaceful untouched, stick+attack+look at once, release/cancel/menu/death stop attacks')}

// ---- v16 ADVENTURE: ores (terrain v10), pickaxes and dig times, swords and armour, treasure chests, cave monsters, rare items.
{const d=boot(JSON.stringify({version:1,worldWidth:2048,worldHeight:192,terrainVersion:10,seed:73219,changes:[],inventory:{}})),R=c=>run(d,c),J=c=>JSON.parse(R(`JSON.stringify(${c})`));
 assert.equal(R('terrainVersion'),10);assert.equal(R('ORES'),true);
 // Chunks around cave chambers in a v10 world and the same seed in v9: identical except where ore replaced stone and a chest sits on a floor.
 const v9=boot(JSON.stringify({version:1,worldWidth:2048,worldHeight:192,terrainVersion:9,seed:73219,changes:[],inventory:{}}));assert.equal(run(v9,'ORES'),false);
 const cks=J(`(()=>{const p=[];for(let ci=0;ci<8&&p.length<40;ci++)for(let cj=0;cj<8&&p.length<40;cj++){const c=caveCell(ci,cj);if(!c)continue;for(const ch of c.chambers.slice(0,3))p.push([Math.floor(ch.x)>>4,Math.floor(ch.z)>>4])}return p})()`);
 const cnt={30:0,31:0,32:0,33:0,34:0},ys={30:[],31:[],32:[],33:[]};let t10=0,t9=0,exposed=0;
 for(const [cx,cz] of cks){let s=Date.now();const a10=J(`Array.from(generateChunk(${cx},${cz}))`);t10+=Date.now()-s;s=Date.now();const a9=JSON.parse(run(v9,`JSON.stringify(Array.from(generateChunk(${cx},${cz})))`));t9+=Date.now()-s;
  const h=J(`Array.from(columnInfo(${cx},${cz}).h)`);
  for(let i=0;i<a10.length;i++){const t=a10[i];if(t===a9[i])continue;
   if(t>=30&&t<=33){assert.equal(a9[i],3,'ore only ever replaces stone (never air, water, trees or other blocks)');cnt[t]++;const y=i>>8;ys[t].push(y);assert(y<=h[i&255]-2,'ore stays under the ground surface');
    const x=i&15,z=(i>>4)&15;if(x>0&&x<15&&z>0&&z<15&&[1,-1,16,-16,256,-256].some(o=>a10[i+o]===0))exposed++}
   else if(t===34){assert([0,10].includes(a9[i]),'a chest stands in open space');const b=a10[i-256];assert(b&&b!==10&&b!==11,'a chest stands on a solid floor');cnt[34]++}
   else assert.fail(`unexpected v10 difference ${a9[i]} -> ${t}`)}}
 for(const t of [30,31,32,33])assert(cnt[t]>0,'every ore is generated: '+t);
 assert(cnt[30]>cnt[31]&&cnt[31]>cnt[32]&&cnt[32]>cnt[33],'rarer the deeper: coal > iron > gold > diamond '+JSON.stringify(cnt));
 const med=a=>a.sort((p,q)=>p-q)[a.length>>1];assert(med(ys[30])>med(ys[31])&&med(ys[31])>med(ys[32])&&med(ys[32])>=med(ys[33]),'coal shallow, iron middle, gold and diamond deep');
 assert(Math.max(...ys[33])<=34&&Math.max(...ys[32])<=48,'diamond and gold only deep down');assert(exposed>cks.length,'cave walls show ore to explorers');
 assert(cnt[30]/cks.length<40,'ore never crowds the rock');
 // Deterministic: the same chunk again (and after the cache is dropped) is identical.
 assert.equal(R(`(()=>{const a=generateChunk(${cks[0]}),b=generateChunk(${cks[0]});return a.every((v,i)=>v===b[i])})()`),true);
 // Chests: candidates from caves and wonders, tiers, the v9 world has none.
 const tiers=J(`(()=>{const t={};for(let ci=0;ci<8;ci++)for(let cj=0;cj<8;cj++){const c=caveCell(ci,cj);if(c)for(const k of cellChests(c))t[k.tier]=(t[k.tier]||0)+1}for(const k of wonderChests())t[k.tier]=(t[k.tier]||0)+1;return t})()`);
 for(const k of ['cave','hall','crystal'])assert(tiers[k]>0,'chest kind '+k);assert(Object.values(tiers).reduce((a,b)=>a+b,0)<160,'chests stay special');
 assert.equal(run(v9,'wonderChests().length'),0);
 // v9 save played in this release stays readable by the previous release: no new block ids and terrain v9.
 v9.api.edit(1000,70,1000,8);assert(v9.api.save());const v9s=JSON.parse(v9.storage['nisekura-v1']);assert.equal(v9s.terrainVersion,9);assert(v9s.changes.every(e=>e[1]<30));
 console.log(`PASS: v16 ores: coal ${cnt[30]} / iron ${cnt[31]} / gold ${cnt[32]} / diamond ${cnt[33]} in ${cks.length} cave chunks (median y ${med(ys[30])}/${med(ys[31])}/${med(ys[32])}/${med(ys[33])}), ${exposed} on cave walls, only stone replaced, ${cnt[34]} chests on floors, kinds ${JSON.stringify(tiers)}, chunk generation ${(t10/cks.length).toFixed(1)} ms vs v9 ${(t9/cks.length).toFixed(1)} ms (incl. JSON copy), v9 untouched`);

 // ---- Mining with pickaxes.
 R(`var findView=function(T){for(let ci=0;ci<8;ci++)for(let cj=0;cj<8;cj++){const cell=caveCell(ci,cj);if(!cell)continue;for(const ch of cell.chambers){const cx=Math.floor(ch.x)>>4,cz=Math.floor(ch.z)>>4;
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){const X=cx+dx,Z=cz+dz,dd=voxelChunk(X,Z);for(let i=0;i<dd.length;i++){if(dd[i]!==T)continue;const x=X*16+(i&15),z=Z*16+((i>>4)&15),y=i>>8;
   for(const [ox,oz] of [[2,0],[-2,0],[0,2],[0,-2],[3,0],[-3,0],[0,3],[0,-3]])for(const oy of [0,-1,1]){const px=x+ox,pz=z+oz,py=y+oy;if(get(px,py,pz)!==0||get(px,py+1,pz)!==0||!solid(px,py-1,pz)||collides({x:px+.5,y:py,z:pz+.5}))continue;
    const ex=px+.5,ey=py+1.62,ez=pz+.5,tx=x+.5,ty=y+.5,tz=z+.5;player.x=ex;player.y=py+.02;player.z=ez;yaw=Math.atan2(tx-ex,tz-ez);pitch=Math.atan2(ty-ey,Math.hypot(tx-ex,tz-ez));const h=ray();if(h&&h.x===x&&h.y===y&&h.z===z)return{x,y,z}}}}}}return null};
  var hold=n=>{mineHeld=true;for(let i=0;i<n;i++)update(1/30);mineHeld=false};paused=false;setGameMode('survival');protectT=1e9;life.length=0`);
 const iron=J('findView(31)');assert(iron,'an iron ore can be seen from a cave floor');const at=`get(${iron.x},${iron.y},${iron.z})`;
 R('mine();hold(60)');assert.equal(R(at),31,'bare hands cannot mine iron ore');assert.match(d.nodes.hint.textContent,/石のツルハシ/,'and the player is told which pickaxe is needed');
 assert.match(R('targetLabel(ray())'),/🔒/,'the crosshair label shows the lock');
 R('items.woodPick=1;mine();hold(60)');assert.equal(R(at),31,'a wooden pickaxe is not enough for iron');
 R('items.stonePick=1;mine();hold(5)');assert.equal(R(at),31,'digging takes a moment');assert(R('dig&&dig.p>0&&dig.p<1'),'progress builds while held');assert.match(R('targetLabel(ray())'),/▰/,'progress shows under the crosshair');
 R('update(1/30);update(1/30);drawWorldDetails()');R('hold(20)');assert.equal(R(at),0,'held long enough, the ore breaks');assert.equal(R('items.iron'),1,'iron ore gives iron');assert(R('items.found&FOUND_BIT.iron'));assert.match(d.nodes.find.innerHTML,/はじめての鉄/,'the first iron is celebrated');
 // dig times: hand > wood > stone > iron > diamond for stone; peaceful and creative stay instant
 const times=J(`[0,1,2,3,4].map(k=>{for(const p in PICKS)items[p]=0;if(k)items[Object.keys(PICKS)[k-1]]=1;return +(DIG_BASE[3]/pickaxe().speed).toFixed(3)})`);assert(times.every((v,i)=>!i||v<times[i-1]),'better pickaxes dig faster '+times);assert(times[0]<=1,'stone by hand under a second');
 R('for(const p in PICKS)items[p]=0;items.stonePick=1');const gold=J('findView(32)');if(gold){R('mine();hold(90)');assert.equal(R(`get(${gold.x},${gold.y},${gold.z})`),32,'gold needs an iron pickaxe');R('items.ironPick=1;mine();hold(40)');assert.equal(R(`get(${gold.x},${gold.y},${gold.z})`),0);assert.equal(R('items.gold'),1)}
 R('setGameMode("peaceful");items.stonePick=items.ironPick=items.woodPick=0');const pc=J('findView(30)');R('mine()');assert.equal(R(`get(${pc.x},${pc.y},${pc.z})`),0,'peaceful: ore is mined at once, as before');assert(R('items.coal')>=1);
 R('setGameMode("creative")');const cc=J('findView(31)');R('mine()');assert.equal(R(`get(${cc.x},${cc.y},${cc.z})`),0,'creative: no pickaxe needed');
 console.log(`PASS: v16 mining: pickaxe tiers (hand/wood blocked on iron, stone ok, gold needs iron), hold-to-dig ${times.join('/')} s for stone, cracks and progress label, materials, first-find banner, peaceful/creative instant`);

 // ---- Gear: crafting with exact missing materials, swords, armour.
 R('setGameMode("survival");for(const k in items)items[k]=0;inventory[7]=0;inventory[3]=0');
 assert.equal(R('craftItem("ironSword")'),false);assert.match(d.nodes.hint.textContent,/鉄 あと2/,'the missing material is named with the amount');assert.match(d.nodes.hint.textContent,/木材 あと1/);
 R('craftUI()');assert.match(d.nodes.craft_ironSword.innerHTML,/たりない：鉄 あと2/,'the craft screen shows what is missing');
 R('items.iron=8;inventory[7]=4');assert.equal(R('craftItem("ironSword")'),true);assert.equal(R('weapon().name'),'鉄の剣');assert.equal(R('items.iron'),6);assert.equal(R('inventory[7]'),3);
 assert.equal(R('craftItem("ironSword")'),false,'one is enough');R('craftUI()');assert.match(d.nodes.craft_ironSword.innerHTML,/持っている/);
 R('items.diamond=2;inventory[7]=1');assert.equal(R('craftItem("diamondSword")'),true);assert.equal(R('weapon().dmg'),12);
 const dmg=J('[SWORDS.woodSword.dmg,SWORDS.stoneSword.dmg,SWORDS.ironSword.dmg,SWORDS.diamondSword.dmg]');assert(dmg.every((v,i)=>!i||v>dmg[i-1]));
 assert(J('Math.ceil(HOSTILE.zombie.hp/SWORDS.diamondSword.dmg)')===1&&J('Math.ceil(HOSTILE.zombie.hp/SWORDS.woodSword.dmg)')===3,'a zombie takes 3 hits with wood, 1 with diamond');
 R('health=15;invulT=0;protectT=0;defeated=9;life.length=0');const h0=R('health');assert.equal(R('craftItem("ironArmor")'),true,'iron armour from 5 iron');assert.equal(R('health'),h0,'armour never changes the hearts');assert.match(d.nodes.armorIco.textContent,/鉄/,'the worn armour shows next to the hearts');
 R('hurtPlayer(4,{x:player.x+1,y:player.y,z:player.z})');assert.equal(R('health'),h0-2.5,'iron armour stops 40% (4 -> 2.5)');
 R('items.ironArmor=0;invulT=0;health=15;hurtPlayer(4,{x:player.x+1,y:player.y,z:player.z})');assert.equal(R('health'),11,'without armour the damage is as before');
 R('items.leather=3;invulT=0;health=15');assert.equal(R('craftItem("leatherArmor")'),true);R('hurtPlayer(4,{x:player.x+1,y:player.y,z:player.z})');assert.equal(R('health'),12,'leather armour stops 20%');
 R('items.ironArmor=1;items.ironPick=1;health=1;invulT=0;hurtPlayer(9,{x:player.x+1,y:player.y,z:player.z})');assert(R('dead'));R('respawn()');assert.equal(R('armor().name'),'鉄の防具','gear is kept after respawn');assert.equal(R('weapon().name'),'ダイヤの剣');assert.equal(R('pickaxe().name'),'鉄のツルハシ');assert.equal(R('health'),20);
 // leather from monsters (always from the first win)
 R(`life.length=0;defeated=0;items.leather=0;var z=lifeNew(LIFE_BY_ID.zombie,player.x,player.y,player.z+2,false);defeatMonster(z)`);assert(R('items.leather')>=2,'the first monster always leaves leather');
 console.log(`PASS: v16 gear: missing materials named (toast and craft screen), swords ${dmg.join('/')}, armour 20/40% with hearts untouched, worn armour shown, gear kept after respawn, leather drops`);

 // ---- Treasure chests.
 R('setGameMode("survival");for(const k in items)items[k]=0');const ch=J('findView(34)');assert(ch,'a chest can be reached on a cave floor');
 const tier=R(`chestInfo.get(idx(${ch.x},${ch.y},${ch.z}))`);assert(Object.keys(J('LOOT')).includes(tier));
 R('chestScanT=0;chestTick(.2)');assert.deepEqual(J('nearChest'),[ch.x,ch.y,ch.z],'the chest in front is found');assert(!d.nodes.openChest.classList.contains('hidden'),'and 開ける appears');
 const loot=J(`chestLoot(${ch.x},${ch.y},${ch.z},"${tier}")`);assert.deepEqual(J(`chestLoot(${ch.x},${ch.y},${ch.z},"${tier}")`),loot,'loot is a pure function of the chest');
 assert.equal(R(`openChest(${ch.x},${ch.y},${ch.z})`),true);assert.equal(R(`get(${ch.x},${ch.y},${ch.z})`),35,'it becomes an open chest');assert.equal(R('items.chests'),1);assert(R('items.iron')>=2,'the first chest helps toward iron gear');
 assert(!d.nodes.loot.classList.contains('hidden')&&/宝箱/.test(d.nodes.loot.innerHTML),'the loot is listed');assert(d.nodes.openChest.classList.contains('hidden'));
 const after=R('JSON.stringify(items)');assert.equal(R(`openChest(${ch.x},${ch.y},${ch.z})`),false,'an open chest gives nothing again');R(`inventory[slots[selected]]=0;place()`);assert.equal(R('JSON.stringify(items)'),after,'right click / 置く on it gives nothing either');
 assert(d.api.save());const re=boot(d.storage['nisekura-v1']),RR=c=>run(re,c);assert.equal(re.api.get(ch.x,ch.y,ch.z),35,'the open state is saved');assert.equal(RR('JSON.stringify(items)'),after,'items and the collection are saved');
 assert.equal(RR(`openChest(${ch.x},${ch.y},${ch.z})`),false,'and cannot be emptied again after a reload');
 R('mine()');assert.equal(R(`get(${ch.x},${ch.y},${ch.z})`),0,'an empty chest can be broken (gives planks)');
 // a player's build wins over a chest
 const ch2=J(`(()=>{for(const [i,t] of chestInfo){const x=i%W,z=Math.floor(i/W)%W,y=Math.floor(i/(W*W));if(get(x,y,z)===34&&(x!==${ch.x}||z!==${ch.z}))return{x,y,z}}return null})()`);
 if(ch2){R(`edit(${ch2.x},${ch2.y},${ch2.z},8)`);assert.equal(R(`openChest(${ch2.x},${ch2.y},${ch2.z})`),false);assert(d.api.save());assert.equal(boot(d.storage['nisekura-v1']).api.get(ch2.x,ch2.y,ch2.z),8,'a block placed where a chest was stays')}
 // rare items: banner the first time, saved, never used up
 R('items.found&=~FOUND_BIT.dragonEgg;items.dragonEgg=0');assert.equal(R('giveRare("dragonEgg",1,[])'),true);assert.match(d.nodes.find.innerHTML,/レアアイテム発見/);assert.match(d.nodes.find.innerHTML,/ドラゴンの卵/);assert.equal(R('giveRare("dragonEgg",1,[])'),false,'only the first find gets the banner');
 R('craftUI()');assert.match(d.nodes.rareRow.innerHTML,/ドラゴンの卵 <b>×2/);assert(d.api.save());assert.equal(run(boot(d.storage['nisekura-v1']),'items.dragonEgg'),2,'the collection is saved');
 // every loot table yields sensible things, diamonds and dragon eggs stay rare
 const stats=J(`(()=>{const s={};for(const t in LOOT){let dia=0,egg=0,n=0;for(let i=0;i<400;i++){const l=chestLoot(i*7,20+i%9,i*13,t);n+=l.length;for(const [k,c] of l){if(k==='diamond')dia+=c;if(k==='dragonEgg')egg++}}s[t]={items:+(n/400).toFixed(1),dia:+(dia/400).toFixed(2),egg:+(egg/400).toFixed(3)}}return s})()`);
 for(const t in stats){assert(stats[t].items>=2,'a chest holds a few things: '+t);assert(stats[t].dia<1,'diamonds stay rare: '+t);assert(stats[t].egg<.1,'the dragon egg stays very rare: '+t)}
 console.log(`PASS: v16 chests: found and opened (${tier}), 開ける button, deterministic loot, one-time only (also after reload), break when empty, builds win, rare-item banner and collection saved, loot ${JSON.stringify(stats)}`);

 // ---- Cave monsters (survival).
 R(`setGameMode('survival');for(const k in items)items[k]=0;life.length=0;protectT=0;invulT=0;health=20;defeated=9;var X0=Math.floor(player.x)+300,Z0=Math.floor(player.z),Y0=150;for(let x=X0-8;x<=X0+8;x++)for(let z=Z0-8;z<=Z0+12;z++){edit(x,Y0,z,3);for(let y=Y0+1;y<Y0+5;y++)edit(x,y,z,0);edit(x,Y0+5,z,3)}player.x=X0+.5;player.z=Z0+.5;player.y=Y0+1;vy=0;yaw=0;pitch=-.1;streamChunks(true)`);
 for(const [hab,ids] of [['cave',['skeleton','slime','caveSpider']],['crystal',['crystalSlime','caveSpider']]]){const seen=new Set(J(`Array.from({length:200},()=>hostilePick('${hab}').id)`));for(const id of ids)assert(seen.has(id),hab+' spawns '+id);if(hab==='crystal')assert(!seen.has('zombie'))}
 assert.equal(R('hostilePick("meadow").id==="crystalSlime"||hostilePick("meadow").id==="caveSpider"'),false,'cave monsters never come to the surface');
 R(`var s=lifeNew(LIFE_BY_ID.caveSpider,X0+.5,Y0+1,Z0+7.5,false);var step=n=>{for(let i=0;i<n;i++){updateLife(1/30,player);updateSurvival(1/30)}};step(60)`);
 assert(R('Math.hypot(s.x-player.x,s.z-player.z)')<7,'the cave spider rushes in');R('step(150)');assert(R('health')<20,'and bites');
 assert.equal(R('monsterMaxHP(s)'),8);assert(R('s.vanish<0'),'a cave monster stays in a covered cave by day');R('items.ironSword=1;atkCD=0;s.x=player.x;s.z=player.z+1.8;s.y=player.y;pitch=-.15;strike(true)');assert.equal(R('life.includes(s)'),false,'an iron sword defeats a cave spider in one hit');
 R(`health=20;invulT=0;var g=lifeNew(LIFE_BY_ID.crystalSlime,X0+.5,Y0+1,Z0+6.5,false);step(200)`);assert(R('health')<20,'the crystal slime lunges and hits');assert.equal(R('monsterMaxHP(g)'),16,'tougher than an amber slime');
 R('items.gold=0;items.crystal=0;let n=0;for(let i=0;i<40;i++){const c=lifeNew(LIFE_BY_ID.crystalSlime,X0+.5,Y0+1,Z0+3,false);defeatMonster(c)}');assert(R('items.gold')>0&&R('items.crystal')>0,'crystal slimes leave gold and mysterious crystals');
 assert.equal(R('inCrystalCave(player.x,player.y,player.z)'),false);const cr=J(`(()=>{for(let ci=0;ci<8;ci++)for(let cj=0;cj<8;cj++){const c=caveCell(ci,cj);if(c)for(const ch of c.chambers)if(ch.kind==='crystal')return[ch.x,ch.y,ch.z]}return null})()`);assert(cr&&R(`inCrystalCave(${cr})`),'crystal caves are recognised');
 R('setGameMode("peaceful");life.length=0;for(let i=0;i<30;i++)caveSpawn(player)');assert.equal(R('life.filter(c=>c.sp.group==="洞窟").length'),0,'cave monsters never appear outside survival');
 console.log('PASS: v16 cave monsters: cave spider rushes/bites/one-hit with iron, crystal slime lunges (16 HP) and drops gold and crystals, crystal-cave spawning, surface and peaceful stay free of them');

 // ---- Goals, the cave compass and the HUD.
 R('setGameMode("survival");for(const k in items)items[k]=0;guideStep=4;paused=false;guideShown="";updateSurvival(.1)');assert.match(d.nodes.guide.innerHTML,/木のツルハシ/,'next goal: a wooden pickaxe');
 R('items.woodPick=items.stonePick=1;updateSurvival(.1)');assert.match(d.nodes.guide.innerHTML,/鉄鉱石/);R('items.found|=FOUND_BIT.iron;items.ironPick=1;updateSurvival(.1)');assert.match(d.nodes.guide.innerHTML,/宝箱/);
 R('caveAimT=0;updateCompass()');const mouth=J('caveAim');assert(mouth&&Number.isFinite(mouth.d),'the nearest cave mouth is known');
 R(`caveUnder=true;caveAimT=0;updateCompass()`);assert(!d.nodes.compassCave.classList.contains('hidden'));assert.match(d.nodes.compassCaveText.textContent,/出口/,'underground the compass points the way out');R('caveUnder=false');
 const html=fs.readFileSync(__dirname+'/index.html','utf8');
 for(const sel of ['#find{','#loot{','#openChest{','body:has(#find:not(.hidden)) #guide','body:has(#craft:not(.hidden)) #openChest'])assert(html.includes(sel),'HUD rule '+sel);
 assert(/#find\{[^}]*pointer-events:none/.test(html)&&/#loot\{[^}]*pointer-events:none/.test(html),'banners never take touches');
 assert(!/@keyframes findPop\{[^}]*opacity:0/.test(html),'banners never start invisible');
 assert(d.api.fragmentSource.includes('v10 ores')&&d.api.fragmentSource.includes('v10 treasure chest'),'ore and chest shading');
 console.log('PASS: v16 goals (pickaxe -> iron -> chest), cave compass (entrance / way out), discovery banner, loot panel and 開ける button rules');
}

// ---- v17 ANCIENT RUINS: real generated routes, latched puzzles, encounter, rewards and resume.
{const d=boot(),R=c=>run(d,c),J=c=>JSON.parse(R(`JSON.stringify(${c})`));
 assert.equal(R('terrainVersion'),11);assert.equal(R('ruins.length'),R('buildRuins().length'));
 assert.equal(R('JSON.stringify(ruins)'),R('JSON.stringify(buildRuins())'),'seed plan reproduces exactly');
 assert.deepEqual(new Set(J('ruins.map(r=>r.kind)')),new Set(['forest','coast','city']));
 R(`var rr=ruins[0];var go=(u,v,y=rr.f+1)=>{const p=ruinWorld(rr,u,v);player.x=p.x+.5;player.z=p.z+.5;player.y=y;vy=0;pkX=1e9};
 var localGet=(u,y,v)=>{const p=ruinWorld(rr,u,v);return get(p.x,y,p.z)};
 // Walkability flood fill in actual voxels (no flight, digging, teleports or gates assumed open).
 var reachable=()=>{const q=[[0,rr.base+1,-14]],seen=new Set(),key=(u,y,v)=>u+','+y+','+v;
  const stand=(u,y,v)=>{if(u< -23||u>23||v< -16||v>56||y<rr.f+1||y>rr.base+3)return false;
   return localGet(u,y-1,v)>0&&localGet(u,y-1,v)!==10&&localGet(u,y,v)===0&&localGet(u,y+1,v)===0};
  for(let i=0;i<q.length;i++){const[u,y,v]=q[i];for(const[du,dv]of[[1,0],[-1,0],[0,1],[0,-1]])for(const dy of[0,1,-1]){const a=u+du,b=y+dy,c=v+dv,k=key(a,b,c);if(seen.has(k)||!stand(a,b,c))continue;
   // Enough headroom for the rising step, not just an empty destination cell.
   if(dy===1&&localGet(u,y+2,v)!==0)continue;seen.add(k);q.push([a,b,c])}}
  return seen};
 paused=false;setGameMode('survival');protectT=0;invulT=0;life.length=0;go(0,-14,rr.base+1);streamChunks(true);`);
 for(const r of J('ruins')){
  R(`rr=ruins.find(r=>r.id==='${r.id}');var path=reachable()`);
  assert(R('path.has([rr.side*12,rr.f+1,26].join(","))'),'entrance stair reaches puzzle: '+r.id);
  assert(R('path.has([-rr.side*14,rr.f+1,25].join(","))'),'branch chest reachable: '+r.id);
  assert(!R('path.has([0,rr.f+1,46].join(","))'),'closed gate and secret passage actually seal the boss area');
  assert(R('unlockRuin(rr)'));R('path=reachable()');assert(R('path.has([0,rr.f+1,52].join(","))'),'latched gate connects the boss chest and return stair');
  for(const q of J('ruins'))if(q.id!==r.id)assert(Math.hypot(q.x-r.x,q.z-r.z)>=235);
  assert(R(`![...WF,...WA].some(w=>w.bb&&rr.x+70>=w.bb[0]&&rr.x-70<=w.bb[1]&&rr.z+70>=w.bb[2]&&rr.z-70<=w.bb[3])`),'whole wonder bounds reserved');
 }
 // Trigger the actual pressure pad and save/reload; also preserve user-built blocks in its doorway.
 R(`rr=ruins[0];ruinState(rr).gate=false;go(rr.side*12,26);dungeonTick(1)`);assert(R('ruinState(rr).gate'));
 R(`var door=ruinWorld(rr,0,35);edit(door.x,rr.f+1,door.z,8);go(0,32);dungeonTick(1)`);assert(d.api.save());
 const re=boot(d.storage['nisekura-v1']);assert.equal(run(re,'adventure.ruins.r0.gate'),true);assert.equal(re.api.get(R('door.x'),R('rr.f+1'),R('door.z')),8,'saved construction wins over unlocked door');
 R('edit(door.x,rr.f+1,door.z,0);go(0,40);dungeonTick(1);pkX=1e9');
 assert(R('life.some(c=>c.sp.id==="guardian")'),'guardian appears when its room is near');
 R(`var boss=life.find(c=>c.sp.id==='guardian');boss.mode='guardianIdle';boss.timer=0;go(0,43);health=20;guardianThink(boss,.1)`);
 assert.equal(R('boss.mode'),'guardianTell');assert.equal(R('health'),20,'visible tell precedes damage');
 R('guardianThink(boss,2)');assert(R('health')<20,'arm attack deals damage in reach');
 // A real wall blocks both perception and all damaging attacks. Charge checks full body + swept movement.
 R(`health=20;invulT=0;protectT=0;var wall=ruinWorld(rr,0,44);for(let u=-3;u<=3;u++){const p=ruinWorld(rr,u,44);for(let y=rr.f+1;y<=rr.f+5;y++)set(p.x,y,p.z,36)}pkX=1e9;
 boss.mode='guardianTell';boss.skill='slam';boss.timer=0;guardianThink(boss,.1)`);
 assert.equal(R('health'),20,'slam cannot hit through a wall');assert.equal(R('canSee(boss)'),false,'wall blocks detection');
 R(`boss.yaw=Math.atan2(player.x-boss.x,player.z-boss.z);var bx=boss.x,bz=boss.z;guardianMove(boss,.8,8)`);
 assert(R('Math.hypot(boss.x-bx,boss.z-bz)<1.5'),'charge stops before body intersects the wall');
 R(`for(let u=-3;u<=3;u++){const p=ruinWorld(rr,u,44);for(let y=rr.f+1;y<=rr.f+5;y++)set(p.x,y,p.z,0)}pkX=1e9;
 boss.mode='guardianTell';boss.skill='slam';boss.timer=0;go(0,42);health=20;invulT=0;guardianThink(boss,.1)`);
 assert(R('health')<20,'unobstructed slam hits');
 // Attack the actual model through the existing player strike path, then resume its remaining HP.
 R(`go(0,43);yaw=Math.atan2(boss.x-player.x,boss.z-player.z);pitch=.04;items.ironSword=1;atkCD=0;strike(true)`);
 assert(R('ruinState(rr).hp<96&&ruinState(rr).hp>0'),'melee damage recorded');assert(d.api.save());
 const mid=boot(d.storage['nisekura-v1']);assert.equal(run(mid,'adventure.ruins.r0.hp'),R('ruinState(rr).hp'),'boss HP survives interruption');
 R(`ruinState(rr).hp=boss.mhp=40;boss.mode='guardianIdle';boss.timer=0;guardianThink(boss,.1)`);assert(R('boss.timer<1.25'),'phase two shortens tells but leaves readable time');
 R(`go(0,53);var chest=ruinWorld(rr,0,53)`);assert.equal(R('openChest(chest.x,rr.f+1,chest.z)'),false,'boss reward is sealed before victory');
 R(`go(0,43);boss.mhp=1;ruinState(rr).hp=1;yaw=Math.atan2(boss.x-player.x,boss.z-player.z);pitch=.04;atkCD=0;strike(true)`);
 assert(R('ruinState(rr).defeated'));assert.equal(R('ruinState(rr).hp'),0);
 R('go(0,52)');assert.equal(R('openChest(chest.x,rr.f+1,chest.z)'),true);assert(R('items.ancientSword===1&&items.eggClue===1&&items.coin>0&&items.crystal>0'));
 assert(R('ruinState(rr).cleared&&ruinState(rr).claimed'));assert.equal(R('weapon().dmg'),9,'ancient sword does not exceed diamond damage');
 const before=R('JSON.stringify(items)');assert.equal(R('openChest(chest.x,rr.f+1,chest.z)'),false);assert.equal(R('JSON.stringify(items)'),before);
 assert(d.api.save());const done=boot(d.storage['nisekura-v1']);assert.equal(run(done,'adventure.ruins.r0.claimed'),true);assert.equal(run(done,'items.ancientSword'),1);
 run(done,'paused=false');assert.equal(run(done,`openChest(${R('chest.x')},${R('rr.f+1')},${R('chest.z')})`),false,'reward cannot repeat after reload');
 // A small chest opens the loop, and peaceful/creative grant treasure without recording a boss kill.
 R(`rr=ruins[1];go(-rr.side*14,25);dungeonTick(1);var small=ruinWorld(rr,-rr.side*14,26);openChest(small.x,rr.f+1,small.z)`);assert(R('ruinState(rr).secret'));
 assert(d.api.save());assert.equal(run(boot(d.storage['nisekura-v1']),'adventure.ruins.r1.secret'),true);
 for(const [mode,i] of [['peaceful',2],['creative',3]]){R(`rr=ruins[${i}];setGameMode('${mode}');go(0,52);dungeonTick(1);var cc=ruinWorld(rr,0,53);openChest(cc.x,rr.f+1,cc.z)`);assert(R('ruinState(rr).cleared&&!ruinState(rr).defeated'));}
 for(const quality of ['low','standard','high']){R(`setQuality('${quality}');go(0,42);dungeonTick(1);drawWorldDetails();adventureUI();updateCompass()`);assert.match(d.nodes.adventureLog.textContent,/冒険の記録/)}
 assert.match(d.nodes.compassRuinText.textContent,/踏み石|出口|守護者/);
 // Reject malformed progress without writing it or clobbering the existing save.
 const raw=d.storage['nisekura-v1'];R('var badAdventure={ruins:{r0:{...ruinState(rr),hp:-1}}}');assert.throws(()=>R('encodeSave({...snapshot(),adventure:badAdventure})'));assert.equal(d.storage['nisekura-v1'],raw);
 console.log('PASS: v17 seed plans, all ruin types and real walkable stair/branches/gates/return routes; wonder reservations, pressure pad and secret save/reload, guardian tell/melee/slam/charge/walls/phase/damage/victory, unique rewards, peaceful/creative, all qualities, record and compass');
}

// v1-v10 byte fixtures captured from v16 commit a40d15d, including the location now used by a v11 ruin.
{const f=JSON.parse(fs.readFileSync(__dirname+'/docs/v16-terrain-fixtures.json','utf8'));
 for(let v=1;v<=10;v++){const d=boot(JSON.stringify({version:1,worldWidth:2048,worldHeight:v>=4?192:96,terrainVersion:v,seed:f.seed,changes:[],inventory:{},items:{coin:3,ironArmor:1}}));
  assert.equal(run(d,'RUINS'),false);assert.equal(run(d,'ruins.length'),0);
  const hashes=f.chunks.map(([x,z])=>run(d,`(()=>{let h=2166136261;for(const t of generateChunk(${x},${z})){h^=t;h=Math.imul(h,16777619)}return h>>>0})()`));assert.deepEqual(hashes,f.versions[v],'legacy terrain bytes v'+v);
  d.api.edit(306,20,429,8);assert(d.api.save());const re=boot(d.storage['nisekura-v1']);assert.equal(re.api.get(306,20,429),8);assert.equal(run(re,'items.coin'),3);assert.equal(run(re,'items.ironArmor'),1);assert.equal(run(re,'terrainVersion'),v);assert(!('adventure' in JSON.parse(d.storage['nisekura-v1'])));
 }
 console.log('PASS: v1-v10 terrain chunk bytes match v16 fixtures; construction, gear, rare items and generator survive old-world reloads; no ruins or adventure field added');
}
// Chunk-boundary ownership and worker/main LOD geometry use the exact same plan, including rotated ruins.
{const d=boot(),R=c=>run(d,c);assert(R(`(()=>{for(const r of ruins){const expected=new Map();for(const [u0,u1,y0,y1,v0,v1,t] of ruinPlan(r)){
 for(const u of[u0,u1])for(const v of[v0,v1])for(const y of[y0,y1]){const p=ruinWorld(r,u,v);expected.set(p.x+','+y+','+p.z,[p.x,y,p.z])}}
 const cache=new Map();for(const p of expected.values()){const key=(p[0]>>4)+','+(p[2]>>4);if(!cache.has(key))cache.set(key,generateChunk(p[0]>>4,p[2]>>4))}const reverse=new Map();for(const key of [...cache.keys()].reverse())reverse.set(key,generateChunk(...key.split(',').map(Number)));
 for(const p of expected.values()){const u=ruinLocal(r,p[0],p[2]);let want;for(const[a,b,c,e,f,g,t]of ruinPlan(r))if(u.u>=a&&u.u<=b&&p[1]>=c&&p[1]<=e&&u.v>=f&&u.v<=g)want=t;
 const key=(p[0]>>4)+','+(p[2]>>4),a=cache.get(key),b=reverse.get(key);if(a[localIdx(...p)]!==want||b[localIdx(...p)]!==want)return false}}
 return true})()`),'overlapping operations agree at every plan boundary, for every rotation and chunk load order');
 // The worker also executes the same tileMesh and ruinPlan, rather than a separate approximation.
 const worker={Uint8Array,Int16Array,Float32Array,Float64Array,ArrayBuffer,Map,Set,Math,JSON,Number,postMessage:m=>worker.result=m};vm.createContext(worker);vm.runInContext(R('lodWorkerSource()'),worker);
 for(const q of ['low','standard','high']){R(`setQuality('${q}')`);for(const r of JSON.parse(R('JSON.stringify(ruins.slice(0,2))'))){const x=Math.floor((r.x-8)/64)*64,z=Math.floor((r.z-8)/64)*64;worker.onmessage({data:{id:1,step:2,x0:x,z0:z}});
  const bytes=R(`(()=>{const it=tileMesh(2,${x},${z});while(!it.next().done);return Array.from(lw.u8.slice(0,lw.n*12))})()`);
  assert.deepEqual(Array.from(worker.result.bytes),Array.from(bytes),'worker LOD matches fallback with ruin silhouette');}}
 console.log('PASS: all ruin plan boundaries and rotations agree across streamed chunks; low/standard/high worker and fallback LOD bytes match');
}
// Coast passages have a continuous, walkable stair into the ocean; additional seeds keep deterministic placement.
{for(const seed of [73219,42,937]){const d=boot(JSON.stringify({version:1,terrainVersion:11,worldWidth:2048,worldHeight:192,seed,changes:[],inventory:{}})),R=c=>run(d,c);
 assert(R('ruins.length>0&&ruins.length<=12'));assert.equal(R('JSON.stringify(ruins)'),R('JSON.stringify(buildRuins())'));
 assert(R(`(()=>{for(const r of ruins.filter(r=>r.sea)){const e=r.sea,u=e.u||32,steps=[],add=(a,b)=>steps.push([a,b]);
 for(let a=20;a!==u;a+=Math.sign(u-20))add(a,24);for(let b=24;b!==e.v;b+=Math.sign(e.v-24))add(u,b);add(u,e.v);
 if(!e.u)for(let a=u-1;a>=0;a--)add(a,e.v);
 const du=e.u?0:-1,dv=e.u?-1:0,rise=e.h-1-r.f;
 for(const[a,b]of steps){const dist=(e.u-a)*du+(e.v-b)*dv,y=r.f+1+Math.max(0,rise-dist),p=ruinWorld(r,a,b),floor=get(p.x,y-1,p.z);
  if(floor<=0||floor===10||![0,10].includes(get(p.x,y,p.z))||![0,10].includes(get(p.x,y+1,p.z)))return false}
 const end=ruinWorld(r,e.u+du*4,e.v+dv*4);if(get(end.x,SEA,end.z)!==10)return false;
 }return true})()`),'coast passage stair and underwater opening are continuous for seed '+seed);
 }
 console.log('PASS: multiple v11 seeds reproduce placements; coast passages have supported stairs/headroom and underwater exits');
}

// ---- v17 review fix: sealed ruin doors (block 39) cannot be dug in survival until their puzzle flag is set.
{const hint=b=>b.nodes.hint.textContent;
 const setup=b=>run(b,`var rr=ruins[0];var go=(u,v,y=rr.f+1)=>{const p=ruinWorld(rr,u,v);player.x=p.x+.5;player.z=p.z+.5;player.y=y;vy=0;pkX=1e9;streamChunks(true)};
  var aimDoor=(u,v,dy)=>{const p=ruinWorld(rr,u,v),ex=player.x,ey=player.y+1.62,ez=player.z,tx=p.x+.5,ty=rr.f+dy+.5,tz=p.z+.5;yaw=Math.atan2(tx-ex,tz-ez);pitch=Math.atan2(ty-ey,Math.hypot(tx-ex,tz-ez));pkX=1e9};
  var doorCells=(secret)=>{const o=[];const [u0,u1,v,h]=secret?[19,21,30,4]:[-2,2,35,5];for(let u=u0;u<=u1;u++){const p=ruinWorld(rr,u,v);for(let y=rr.f+1;y<=rr.f+h;y++)o.push([p.x,y,p.z])}return o};
  var doorsGet=secret=>doorCells(secret).map(([x,y,z])=>get(x,y,z));
  var digFor=n=>{mineHeld=true;for(let i=0;i<n;i++)update(1/30);mineHeld=false};
  paused=false;protectT=1e9;life.length=0;1`);
 const d=boot(),R=c=>run(d,c),J=c=>JSON.parse(R(`JSON.stringify(${c})`));setup(d);R('setGameMode("survival");go(0,32)');
 // Every ruin in the world: both doors stand sealed in the generated blocks and survival cannot dig them (hand and tools), through mine(), holding 壊す and breakBlock().
 for(const r of J('ruins')){
  R(`rr=ruins.find(r=>r.id==='${r.id}');for(const k in adventure.ruins)delete adventure.ruins[k];go(0,32)`);
  assert(R('doorsGet(false).every(t=>t===39)&&doorsGet(true).every(t=>t===39)'),'both doors are generated: '+r.id);
  assert.equal(R('sealedDoor(...doorCells(false)[0])'),'gate');assert.equal(R('sealedDoor(...doorCells(true)[0])'),'secret');
  R('items.ironPick=1;items.diamondPick=1;inventory[39]=0');
  R('aimDoor(0,35,2);hit=ray()');assert.equal(R('hit.t'),39,'the gate door is under the crosshair: '+r.id);
  R('mine()');assert(R('doorsGet(false).every(t=>t===39)'),'mine() cannot break the sealed gate door');assert.match(hint(d),/封印の石扉.*踏み石/,'the player is told how to open it');
  R('digFor(90)');assert(R('doorsGet(false).every(t=>t===39)'),'holding 壊す never digs it through');assert.equal(R('dig'),null,'no digging starts');
  R('breakBlock(hit)');assert.equal(R('get(hit.x,hit.y,hit.z)'),39,'breakBlock() also refuses (any other caller)');assert.equal(R('inventory[39]||0'),0,'and gives no door block');
  assert.match(R('targetLabel(hit)'),/🔒踏み石で開く/,'the label says how to open it');
  R('go(20,27);aimDoor(20,30,2);hit=ray()');assert.equal(R('hit.t'),39,'the hidden-passage door is under the crosshair');
  assert.match(R('targetLabel(hit)'),/🔒宝箱で開く/);R('mine();digFor(90)');assert(R('doorsGet(true).every(t=>t===39)'),'the secret door cannot be dug either');assert.match(hint(d),/かくし扉.*宝箱/);
  R('breakBlock(hit)');assert.equal(R('get(hit.x,hit.y,hit.z)'),39);
  assert(!R('ruinState(rr).gate')&&!R('ruinState(rr).secret'),'trying to dig never sets a progress flag');
 }
 // Opening the gate by the stepping stone frees only the gate: the passage is walkable, the secret door still holds.
 R(`rr=ruins[0];for(const k in adventure.ruins)delete adventure.ruins[k];go(rr.side*12,26);dungeonTick(1)`);assert(R('ruinState(rr).gate'));
 assert(R('doorsGet(false).every(t=>t===0)'),'the stepping stone opens the gate door');assert(R('doorsGet(true).every(t=>t===39)'),'but not the hidden door');
 R('go(0,35);');assert(!R('collides(player)'),'the opened doorway can be walked through');R('go(0,38);');assert(!R('collides(player)'));
 R('go(20,27);aimDoor(20,30,2);hit=ray();mine();digFor(60)');assert(R('doorsGet(true).every(t=>t===39)'),'the secret door is still sealed after the gate opened');
 // Its chest opens the hidden door.
 R(`rr=ruins[1];go(-rr.side*14,25);dungeonTick(1);var small=ruinWorld(rr,-rr.side*14,26);openChest(small.x,rr.f+1,small.z)`);assert(R('ruinState(rr).secret'));
 assert(R('doorsGet(true).every(t=>t===0)'),'the matching chest opens the hidden door');R('go(20,31);');assert(!R('collides(player)'),'the hidden passage can be walked through');
 assert(R('doorsGet(false).every(t=>t===39)&&sealedDoor(...doorCells(false)[0])==="gate"'),'and does not open the other ruin\'s main gate');
 // Save and reload: the open gate stays open, the sealed ones stay sealed and still cannot be dug.
 R('rr=ruins[0]');assert(d.api.save());const re=boot(d.storage['nisekura-v1']),RR=c=>run(re,c);setup(re);
 assert.equal(RR('gameMode'),'survival');assert(RR('doorsGet(false).every(t=>t===0)'),'the opened gate is still open after reload');assert(RR('doorsGet(true).every(t=>t===39)'),'the sealed hidden door is still there after reload');
 RR('go(0,36)');assert(!RR('collides(player)'),'walkable after reload');
 RR('go(20,27);aimDoor(20,30,2);hit=ray();mine();digFor(90)');assert(RR('doorsGet(true).every(t=>t===39)'),'still cannot be dug after reload');
 RR('rr=ruins[1]');assert(RR('doorsGet(true).every(t=>t===0)'),'the other ruin\'s hidden door stayed open after reload');
 // A save written before anything was solved reloads with every door sealed.
 const fresh=boot();setup(fresh);run(fresh,'setGameMode("survival")');assert(fresh.api.save());const fr=boot(fresh.storage['nisekura-v1']);setup(fr);
 assert(run(fr,'doorsGet(false).every(t=>t===39)&&doorsGet(true).every(t=>t===39)'));run(fr,'go(0,32);aimDoor(0,35,2);hit=ray();mine();digFor(60)');assert(run(fr,'doorsGet(false).every(t=>t===39)'),'sealed after reloading an unsolved save');
 // Creative mode is unchanged (free building); a block 39 that is not a ruin door cell is ordinary in survival.
 const cr=boot();setup(cr);const C=c=>run(cr,c);C('setGameMode("creative");go(0,32);aimDoor(0,35,2);hit=ray();mine()');assert(C('get(hit.x,hit.y,hit.z)')===0&&C('inventory[39]')===1,'creative can still remove a door');
 C('setGameMode("survival");var X0=Math.floor(player.x)+40,Z0=Math.floor(player.z)+40,Y0=150;for(let x=X0-2;x<=X0+3;x++)for(let z=Z0-2;z<=Z0+2;z++){edit(x,Y0,z,3);for(let y=Y0+1;y<Y0+4;y++)edit(x,y,z,0)}edit(X0+1,Y0+1,Z0,39);player.x=X0-.5+.5;player.z=Z0+.5;player.y=Y0+1;vy=0;yaw=Math.PI/2;pitch=Math.atan2(Y0+1.5-(player.y+1.62),1);pkX=1e9;hit=ray()');
 assert(C('hit&&hit.t===39&&!sealedDoor(hit.x,hit.y,hit.z)'),'a block 39 outside the door cells is under the crosshair and not sealed');C('mine()');assert.equal(C('get(hit.x,hit.y,hit.z)'),0,'an ordinary block 39 can be broken in survival');
 // Old worlds (no ruins at all): block 39 has no special rule, saves still load.
 const old=boot(JSON.stringify({version:1,terrainVersion:10,worldWidth:2048,worldHeight:192,seed:73219,changes:[],inventory:{},gameMode:'survival'})),O=c=>run(old,c);
 assert.equal(O('RUINS'),false);assert.equal(O('sealedDoor(1000,40,1000)'),null);O('paused=false;protectT=1e9;var ox=Math.floor(player.x)+2,oy=Math.floor(player.y)+1,oz=Math.floor(player.z);edit(ox,oy,oz,39);player.x=ox-.5;player.y=oy-1+.02;player.z=oz+.5;yaw=Math.PI/2;pitch=Math.atan2(oy+.5-(player.y+1.62),1);pkX=1e9;hit=ray()');assert.equal(O('hit&&hit.t'),39,'old world: block 39 is under the crosshair');O('mine()');assert.equal(O('get(ox,oy,oz)'),0,'old worlds have no sealed doors');
 console.log('PASS: v17 sealed doors: every ruin\'s gate and hidden door cannot be dug in survival (mine, held 壊す, breakBlock, with pickaxes), kid-readable messages and label, stepping stone / chest unlock only their own door, passage walkable, saved and reloaded (open stays open, sealed stays sealed), creative and old worlds unchanged');
}

// ---- v18 DRAGON AWAKENING: egg from legendary chests, nest, hatching, growth, partner commands, riding flight, saves and modes.
{const d=boot(),R=c=>run(d,c),J=c=>JSON.parse(R(`JSON.stringify(${c})`)),near=()=>R('Math.hypot(pet.x-player.x,pet.z-player.z)');
 R('paused=false;streamChunks(true);for(let i=0;i<40;i++)update(1/60)');assert(R('ground'),'standing');
 assert.equal(R('dragon.stage'),'none');assert.equal(R('items.dragonEgg'),0);assert(!JSON.parse((d.api.save(),d.storage['nisekura-v1'])).dragon,'no dragon field until there is one');
 // Legendary chests (crystal / falls / sea): the egg is guaranteed by the third one (or the first after the ancient clue).
 const openLegend=()=>R(`(()=>{const x=Math.floor(player.x)+2,y=Math.floor(player.y),z=Math.floor(player.z);edit(x,y,z,B_CHEST);chestInfo.set(idx(x,y,z),'crystal');const ok=openChest(x,y,z);edit(x,y,z,0);return ok})()`);
 R('items.eggClue=0;items.eggChests=0');for(let i=0;i<3;i++)assert(openLegend(),'legendary chest opens');assert(R('items.dragonEgg')>=1,'third legendary chest holds the egg');assert.equal(R('items.eggChests'),3);
 R('items.dragonEgg=0;items.eggChests=0;items.eggClue=1');assert(openLegend());assert.equal(R('items.dragonEgg'),1,'the clue leads to the egg at once');
 assert.equal(R('legendEgg(chestLoot(1,30,1,"cave"),"cave")'),undefined);assert.equal(R('items.eggChests'),1,'ordinary chests do not count');
 // Nest: placed once, picked up again without loss, one dragon per world.
 assert(R('placeDragonEgg()'));assert.equal(R('dragon.stage'),'egg');assert.equal(R('items.dragonEgg'),0);assert(R('nest&&dragonEnts.includes(nest)&&!life.includes(nest)'),'nest is outside the natural life list');
 assert(R('peek(Math.floor(nest.x),nest.y-1,Math.floor(nest.z))>0&&peek(Math.floor(nest.x),nest.y-1,Math.floor(nest.z))!==10'),'nest on firm ground');
 R('items.dragonEgg=1');assert(!R('placeDragonEgg()'));assert.equal(R('items.dragonEgg'),1,'no second nest');R('items.dragonEgg=0');
 R('items.crystal=0;for(let i=0;i<20*30;i++)dragonTick(1/20)');const w1=R('dragon.warmth');assert(w1>29&&w1<31,'warms while the player is near: '+w1);
 R('items.crystal=1;dragonTick(1);items.crystal=0');assert(Math.abs(R('dragon.warmth')-w1-1.5)<1e-6,'a mysterious crystal warms faster');R('dragon.warmth-=1.5');
 assert(R('liftDragonEgg()'));assert.equal(R('dragon.stage'),'none');assert.equal(R('items.dragonEgg'),1);assert.equal(R('dragonEnts.length'),0);assert(!R('liftDragonEgg()'),'nothing to lift twice');
 assert(R('placeDragonEgg()'));assert(Math.abs(R('dragon.warmth')-w1)<1e-6,'warmth is kept');
 // Far away the egg stays cold; petting warms it; save / reload keeps the nest.
 R('const hx=player.x;player.x+=40;for(let i=0;i<20*10;i++)dragonTick(1/20);player.x=hx');assert(Math.abs(R('dragon.warmth')-w1)<1e-6,'no warmth from far away');
 R('dragonHUD(1)');assert.equal(d.nodes.dragonAct.textContent,'🥚 なでる','pet button beside the egg');assert(!d.nodes.dragonAct.classList.contains('hidden'));
 R('petCD=0;dragonAct()');assert(Math.abs(R('dragon.warmth')-w1-5)<1e-6,'petting warms the egg');
 assert(d.api.save());const eggSave=d.storage['nisekura-v1'],e1=boot(eggSave);assert.equal(run(e1,'dragon.stage'),'egg');assert(Math.abs(run(e1,'dragon.warmth')-w1-5)<.01,'warmth reloads');assert(run(e1,'nest!==null&&Math.abs(nest.x-dragon.x)<.01'));assert.equal(run(e1,'items.dragonEgg'),0,'no copy on reload');
 // Hatching: cracks, then a baby with a name, standing where the nest was.
 R('for(let i=0;i<20*130;i++)dragonTick(1/20)');assert.equal(R('dragon.stage'),'baby','hatched');assert(R('pet&&!nest&&dragonEnts.length===1'));assert(R('dragon.name.length>0'));
 assert.equal(R('pet.size'),.5);assert(!R('life.includes(pet)'),'the partner never joins the culled list');R('placeDragonEgg()');assert.equal(R('dragon.stage'),'baby','no egg over a dragon');
 // Following: walks after the player, comes back when lost, waits when told.
 R('player.x+=12;for(let i=0;i<20;i++)update(1/60)');const f0=near();R('for(let i=0;i<20*10;i++)dragonTick(1/20)');assert(near()<f0-5,'follows ('+f0+' -> '+near()+')');
 R('player.x+=60;streamChunks(true);for(let i=0;i<900&&!(ground&&i>30);i++)update(1/60);for(let i=0;i<10;i++)dragonTick(1/20)');assert(near()<8,'never lost: hops back beside the player');
 assert(R('toggleFollow()'));assert.equal(R('dragon.follow'),false);const st0=J('[pet.x,pet.z]');R('player.x+=10;for(let i=0;i<20*6;i++)dragonTick(1/20)');assert(Math.hypot(R('pet.x')-st0[0],R('pet.z')-st0[1])<4.5,'waits near its spot');
 R('player.x-=10');assert(R('callDragon()'));assert.equal(R('dragon.follow'),true);assert(near()<8,'called back');
 // Growth: time together, apples (survival / peaceful use them, creative is free), petting; stages and sizes.
 R('dragon.joy=0;items.apple=3;gameMode="peaceful"');assert(R('feedDragon()'));assert.equal(R('items.apple'),2);assert(R('dragon.joy')>=60);assert(R('feedDragon()'));assert(!R('feedDragon()'),'full after two apples');assert.equal(R('items.apple'),1);
 R('dragon.joy=0;setGameMode("creative")');assert(R('feedDragon()'));assert.equal(R('items.apple'),1,'creative feeds for free');R('setGameMode("peaceful")');
 const g0=R('dragon.growth');R('for(let i=0;i<20*20;i++)dragonTick(1/20)');assert(R('dragon.growth')>g0+19,'grows while together');
 R('dragon.growth=359.9;dragonTick(.2)');assert.equal(R('dragon.stage'),'young');assert.match(d.nodes.find.innerHTML,/大きくなった/);
 R('for(let i=0;i<200;i++)dragonTick(1/20)');assert(Math.abs(R('pet.size')-.95)<.01,'young size');R('dragonHUD(1)');assert.equal(d.nodes.dragonAct.textContent,'🐉 なでる');assert(!R('mount()'),'too young to ride');
 R('dragon.growth=1199.9;dragonTick(.2)');assert.equal(R('dragon.stage'),'adult');R('for(let i=0;i<300;i++)dragonTick(1/20)');assert(Math.abs(R('pet.size')-1.9)<.01,'adult size');
 // Names are cleaned (no markup) and kept.
 d.c.prompt=()=>'<b>ルリ&</b>';assert(R('renameDragon()'));assert.equal(R('dragon.name'),'bルリ/b');d.c.prompt=()=>'  ';assert(!R('renameDragon()'));d.c.prompt=()=>null;assert(!R('renameDragon()'));assert.equal(R('dragon.name'),'bルリ/b');
 R('craftUI()');assert.match(d.nodes.dragonBox.innerHTML,/bルリ\/b/);assert.match(d.nodes.dragonBox.innerHTML,/成体のドラゴン/);assert(!/<b>ルリ/.test(d.nodes.dragonBox.innerHTML));
 // Riding: mount, take off, fly forward and up, land, get off on safe ground.
 R('spawn();streamChunks(true);for(let i=0;i<60;i++)update(1/60);petTeleport();pet.mode="idle";dragonHUD(1)');assert(!R('waterBelow(player.x,player.y+1,player.z)'),'riding test starts on land');assert.equal(d.nodes.dragonAct.textContent,'🐉 乗る');assert(R('dragonAct()'),'mount');assert(R('riding'));assert(d.c.document.body.classList.contains('riding'));
 R('dragonHUD(1)');assert.equal(d.nodes.dragonAct.textContent,'🐉 降りる');assert.equal(d.nodes.jump.textContent,'↑ 上昇');assert.equal(d.nodes.down.disabled,false);
 const y0=R('pet.y'),s0=J('[pet.x,pet.z]');R('riseHeld=true;for(let i=0;i<60*3;i++)update(1/60);riseHeld=false');assert(R('pet.air'),'airborne');assert(R('pet.y')>y0+8,'climbs');assert.equal(R('dragon.flights'),1);
 const p0=J('[pet.x,pet.z]');R('joy.y=-1;for(let i=0;i<60*4;i++)update(1/60);joy.y=0');const flown=Math.hypot(R('pet.x')-p0[0],R('pet.z')-p0[1]);assert(flown>25,'flies forward '+flown);assert(R('dragon.flyDist')>25);
 assert(R('Math.abs(player.x-pet.x)<1e-9&&player.y>pet.y'),'the rider sits on the dragon');assert(R('mine()===undefined&&!hit'),'no digging from the saddle');
 const cam=J('rideCamera()');assert(Math.hypot(cam.x-R('pet.x'),cam.z-R('pet.z'))>3,'third-person camera behind');
 // A save in flight resumes in flight.
 assert(d.api.save());const flySave=JSON.parse(d.storage['nisekura-v1']);assert.equal(flySave.dragon.riding,true);assert.equal(flySave.dragon.stage,'adult');
 const e2=boot(d.storage['nisekura-v1']);assert(run(e2,'riding&&pet.air&&dragon.name==="bルリ/b"'),'same dragon, still flying');assert.equal(run(e2,'dragonEnts.length'),1);
 // Over the sea: getting off is refused and holding ↓ hovers just above the water instead of sinking.
 const sea=J(`(()=>{for(let r=20;r<900;r+=6)for(let a=0;a<16;a++){const x=Math.floor(pet.x+Math.cos(a*.39)*r),z=Math.floor(pet.z+Math.sin(a*.39)*r);if(x>8&&z>8&&x<W-8&&z<W-8&&height4(x,z)<SEA-4)return[x,z]}return null})()`);assert(sea,'sea nearby');
 R(`pet.x=${sea[0]}+.5;pet.z=${sea[1]}+.5;pet.y=SEA+12;player.x=pet.x;player.z=pet.z;streamChunks(true)`);assert(R('waterBelow(pet.x,pet.y,pet.z)'));assert(R('!dismount()&&!rideLand&&riding'),'never get off over water');
 R('descendHeld=true;for(let i=0;i<60*6;i++)update(1/60);descendHeld=false');assert(R('pet.air&&pet.y>=SEA+.3&&pet.y<SEA+2'),'hovers above the water: '+R('pet.y'));
 R(`pet.x=${s0[0]};pet.z=${s0[1]}`);assert(!R('waterBelow(pet.x,pet.y,pet.z)'));R('dismount()');assert(R('rideLand'),'getting off in the air lands first');R('for(let i=0;i<60*20&&riding;i++)update(1/60)');assert(!R('riding'),'landed and got off');
 assert(!R('collides(player)'),'safe footing');assert(!d.c.document.body.classList.contains('riding'));R('for(let i=0;i<60;i++)update(1/60)');assert(R('ground'),'standing after getting off');
 // Survival: riding is allowed, the cold breath helps against a monster after the player, terrain is never edited.
 R('setGameMode("survival");lifeMode="all";petTeleport();life.length=0');const ch=R('changes.size');
 R('var zb=lifeNew(LIFE_BY_ID.zombie,pet.x+3,pet.y,pet.z,false,1);zb.aggro=4;zb.mhp=12;breathCD=0;dragonBreath(.1)');assert.equal(R('zb.mhp'),8,'breath hits for 4');assert.equal(R('breathCD'),7);assert.equal(R('changes.size'),ch,'no terrain change');
 R('zb.aggro=0;zb.mhp=12;breathCD=0;dragonBreath(.1)');assert.equal(R('zb.mhp'),12,'only monsters that are after the player');
 R('setGameMode("peaceful");zb.aggro=4;breathCD=0;dragonBreath(.1)');assert.equal(R('zb.mhp'),12,'no breath outside survival');R('setGameMode("survival");pet.mode="idle"');assert(R('mount()'),'survival can ride');R('endRide()');
 // Death or a title-menu teleport always ends the ride.
 assert(R('mount()'));R('spawn()');assert(!R('riding'));
 // Saves: the dragon field validates; bad values are refused; old saves load with no dragon.
 const ok=JSON.parse(d.storage['nisekura-v1']).dragon,bad=o=>{const v={version:1,seed:1,changes:[],inventory:{},terrainVersion:11,worldWidth:2048,worldHeight:192,dragon:{...ok,...o}};assert.throws(()=>R(`validateSave(${JSON.stringify(v)})`),undefined,JSON.stringify(o))};
 assert(R(`!!validateSave(${JSON.stringify({version:1,seed:1,changes:[],inventory:{},terrainVersion:11,worldWidth:2048,worldHeight:192,dragon:ok})})`));
 for(const o of [{stage:'dragon'},{name:'あ'.repeat(13)},{name:3},{riding:true,stage:'baby'},{growth:-1},{growth:'9'},{x:2048},{y:-1},{flights:1.5},{follow:'yes'},{joy:101},{fed:-1}])bad(o);
 const old=boot(JSON.stringify({version:1,seed:9,changes:[],inventory:{1:3}}));assert.equal(run(old,'dragon.stage'),'none');assert.equal(run(old,'riding'),false);assert(old.api.save());assert(!JSON.parse(old.storage['nisekura-v1']).dragon,'old worlds stay without a dragon field');
 // The egg book never lists the dragon.
 assert(!R('LIFE_GROUPS.includes("ドラゴン")'));assert.equal(R('lifePick("pet","meadow",false,false)'),null);
 console.log(`PASS: v18 dragon: legendary egg, nest (place/lift, one per world), warmth & petting, hatch, follow/wait/call, growth ${'baby→young→adult'}, names cleaned, riding (take-off, ${flown.toFixed(0)} blocks in 4 s, landing, safe dismount), save in flight, survival breath, validation, old saves`);
}
