const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const script=fs.readFileSync(__dirname+'/index.html','utf8').match(/<script>([\s\S]*)<\/script>/)[1];
function boot(saved,session={},prefs={}){const nodes={},storage={...prefs},events={},windowEvents={};if(saved)storage['nisekura-v1']=saved;let triangles=0;
const gl=new Proxy({getShaderParameter:()=>true,getProgramParameter:()=>true,createBuffer:()=>({}),getAttribLocation:()=>1,bufferData:(_,data)=>{if(typeof data==='number'){assert(Number.isFinite(data)&&data>=0);return}assert(data.every(Number.isFinite));triangles+=data.length},bufferSubData:(_,offset,data)=>{assert(data.every(Number.isFinite));triangles+=data.length}}, {get:(o,k)=>k in o?o[k]:(()=>({}))});
const node=()=>({style:{},classList:{values:new Set(),add(n){this.values.add(n)},remove(n){this.values.delete(n)},toggle(n,on){if(on)this.values.add(n);else this.values.delete(n)},contains(n){return this.values.has(n)}},setAttribute(){},focus(){},listeners:{},addEventListener(n,f){(this.listeners[n]??=[]).push(f)},appendChild(){},getContext:()=>gl,setPointerCapture(){},getBoundingClientRect:()=>({left:0,top:0,width:112,height:112})});
const c={console,Math,Uint8Array,Float32Array,Map,Set,JSON,Number,Error,Date,performance:{now:()=>0},sessionStorage:{getItem:k=>session[k]||null,setItem:(k,v)=>session[k]=v,removeItem:k=>{delete session[k]}},localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>storage[k]=v,removeItem:k=>{delete storage[k]}},document:{body:node(),getElementById:id=>nodes[id]??=node(),createElement:node,querySelectorAll:()=>[],hidden:false,addEventListener:(n,f)=>events[n]=f},matchMedia:()=>({matches:false}),requestAnimationFrame(){},innerWidth:800,innerHeight:600,devicePixelRatio:1};c.window=c;c.addEventListener=(n,f)=>windowEvents[n]=f;c.confirm=()=>true;c.location={pathname:'/jocraft/',href:'/jocraft/'};vm.createContext(c);vm.runInContext(script,c);return {gl,c,api:c.Nisekura,storage,get triangles(){return triangles},events,windowEvents,nodes,session}}
const run=(b,code)=>vm.runInContext(code,b.c);
function fingerprint(api,x0,x1,z0,z1,y1){let h=2166136261;for(let x=x0;x<x1;x++)for(let z=z0;z<z1;z++)for(let y=0;y<y1;y++){h^=api.get(x,y,z);h=Math.imul(h,16777619)}return h>>>0}

// ---- New GRAND VISTA world: basics, saves, physics.
const t0=Date.now();const a=boot();console.log(`boot new world: ${Date.now()-t0} ms`);
assert(a.triangles>0);assert(!a.api.collides(a.api.player),'spawn must be clear');assert.equal(a.api.get(32,0,32),11);assert(a.api.collides({x:32.5,y:.5,z:32.5}));assert(a.api.collides({x:-1,y:25,z:30}));
assert.equal(run(a,'terrainVersion'),8);assert.equal(run(a,'H'),192);assert.equal(run(a,'SEA'),62);
a.api.edit(30,30,30,8);assert(a.api.save());const b=boot(a.storage['nisekura-v1']);assert.equal(b.api.get(30,30,30),8,'world edit survives reload');assert(!b.api.collides(b.api.player));
assert.equal(run(b,'terrainVersion'),8,'v8 save reloads as v8');
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
assert.equal(run(afterReset,'terrainVersion'),8,'reset must activate new terrain generator');
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
 const seen=new Set();let clear=0;for(let i=0;i<f.n+2;i++){const s=JSON.parse(R('(()=>{const p=spotList[spotIdx];return JSON.stringify({kind:p.kind,x:p.x,z:p.z,px:player.x,py:player.y,pz:player.z,col:collides(player),flying})})()'));
  assert(!s.col&&!s.flying&&Math.hypot(s.px-s.x-.5,s.pz-s.z-.5)<=21,'player stands near the spot without colliding');seen.add(s.kind);
  let wood=0;for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)for(let dy=1;dy<=8;dy++){const t=d.api.get(Math.floor(s.px)+dx,Math.floor(s.py)+dy,Math.floor(s.pz)+dz);if([4,5,13,14,15,16].includes(t))wood++}
  if(!s.fallback)clear+=wood===0?1:0;R('nextSpot()')}
 assert(clear>=f.n-2,`spots land in the open (${clear}/${f.n})`);
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
 assert.equal(sp.filter(s=>s.cat==='monster').length,7,'seven monster types');assert(sp.every(s=>s.nb<=16&&s.nq>=12&&s.nq<1200),'model budgets');
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
 for(const patch of [{terrainVersion:9},{changes:[[1,999]]},{changes:[[1]]},{inventory:{'__proto__':1,'999':1}},{life:{mode:'all',eggs:[['unknown',1,1,1,0,1]]}},{player:{x:NaN,y:20,z:30}}]){valid.c.patch=patch;assert.throws(()=>run(valid,'encodeSave({...snapshot(),...patch})'))}
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
 const next=boot(null,{}, {[A]:d.storage[A]});assert.equal(run(next,'terrainVersion'),8,'archive never auto-resurrects');next.api.save();run(next,'dayTime+=.1');next.api.save();assert.equal(next.storage[A],d.storage[A],'autosave cannot overwrite protected world');
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
 d.api.edit(px,py+2,pz,28);assert(d.api.save());const re=boot(d.storage['nisekura-v1']);assert.equal(re.api.get(px,py+2,pz),28,'a cave edit survives reload');assert.equal(run(re,'terrainVersion'),8);
 assert.equal(run(re,`(()=>{let h=2166136261;for(const [x,y,z] of[[${Math.floor(hall.x)},${Math.floor(hall.y)},${Math.floor(hall.z)},],[${Math.floor(lake.x)},60,${Math.floor(lake.z)}]]){h^=get(x,y,z);h=Math.imul(h,16777619)}return h>>>0})()`),R(`(()=>{let h=2166136261;for(const [x,y,z] of[[${Math.floor(hall.x)},${Math.floor(hall.y)},${Math.floor(hall.z)},],[${Math.floor(lake.x)},60,${Math.floor(lake.z)}]]){h^=get(x,y,z);h=Math.imul(h,16777619)}return h>>>0})()`),'reloading does not change the caves');
 // Save format: new block ids are accepted, the unused plant-material ids are not, and future versions are rejected.
 const base=JSON.parse(d.storage['nisekura-v1']);for(const [patch,ok] of[[{changes:[[5000,26]]},true],[{changes:[[5000,29]]},true],[{changes:[[5000,17]]},false],[{changes:[[5000,25]]},false],[{inventory:{27:3}},true],[{inventory:{20:3}},false],[{terrainVersion:8},true],[{terrainVersion:9},false]]){
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
 const snap=JSON.parse(R('JSON.stringify(snapshot())'));assert.deepEqual(Object.keys(snap).sort(),['changes','creative','dayTime','flying','inventory','life','pitch','player','seed','settings','terrainVersion','version','worldHeight','worldWidth','yaw'].sort());
 assert(!JSON.stringify(snap.life).includes('medaka'),'fish are not saved');
 console.log(`PASS: underwater flora: river ${[...found.river]} / lake ${[...found.lake]} / reef ${[...found.reef]} / kelp sea ${[...found.kelp]} (${Object.values(stat).join('/')} quads), on floors under water, deterministic, quality subset ${lo.length}/${hi.length}, edits, saves unchanged`)}
{// Fish: models, habitats, staying in water, flight from the player, bounded numbers and determinism.
 const d=boot(),R=c=>run(d,c),J=c=>JSON.parse(R(`JSON.stringify(${c})`));
 const sp=J('FISH_SPECIES.map(s=>({id:s.id,nq:s.nq,q0:s.q0,tail:s.parts.filter(p=>p[0]==="tail").length,fins:s.parts.length,rare:!!s.rare,zone:s.zone,dims:[s.rad.toFixed(2),s.h.toFixed(2)]}))');
 assert(sp.length>=8,'at least eight new fish');assert.equal(R('LIFE_SPECIES.length'),30,'the 30 existing creatures are unchanged');
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
 // Sun shafts: slanted pale columns over reef cores only, none over plain sea, none on low quality; they end at the surface.
 const shafts=(x,z)=>{R(`paused=false;player.x=${x}+.5;player.z=${z}+.5;player.y=70;streamChunks(true);for(let i=0;i<40;i++)streamChunks()`);let n=0,top=-1e9,bot=1e9;
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){const o=JSON.parse(R(`(()=>{rebuild(${(x>>4)+dx},${(z>>4)+dz});const a=waterW.a,o=[];for(let i=0;i<waterW.n;i+=36){let code=a[i+8];code-=Math.floor(code/1024)*1024;if(code>=511.5)code-=512;if(code>=255.5)code-=256;const m=code-Math.floor((code+.5)/32)*32;if(m>30.3&&m<30.5)o.push([a[i+1],a[i+10],a[i+19],a[i+28]])}return JSON.stringify(o)})()`));
   n+=o.length;for(const q of o)for(const y of q){top=Math.max(top,y);bot=Math.min(bot,y)}}return{n,top,bot}};
 const sc=shafts(...tier.spots.core),sp=shafts(...tier.spots.plain);R("Q=QUALITY.low");const sl=shafts(...tier.spots.core);R("Q=QUALITY[qualityName]");
 assert(sc.n>=4&&sp.n===0&&sl.n===0,`sun shafts over reefs only (core ${sc.n}, plain ${sp.n}, low ${sl.n})`);assert(sc.top<=63.8&&sc.bot>=40,'shafts run from the floor to the surface '+JSON.stringify(sc));
 // Fish: a core holds more fish than plain sea, reef species live there, and reef cells host a second school.
 const sim=(x,z,secs)=>{R(`paused=false;fishSchools.length&&fishSchools.splice(0);fishCells.clear();fishCount=0;lifeMode='all';player.x=${x}+.5;player.z=${z}+.5;player.y=75;flying=true;streamChunks(true);for(let i=0;i<60;i++)streamChunks();fishT=0`);
  for(let k=0;k<secs*10;k++)R('updateFish(.1,player)');return J(`fishSchools.filter(s=>Math.hypot(s.hx-player.x,s.hz-player.z)<40).map(s=>({id:s.sp.id,n:s.n,key:s.key}))`)};
 const fc=sim(...tier.spots.core,30),fp=sim(...tier.spots.plain,30),cnt=a=>a.reduce((t,s)=>t+s.n,0),reefIds=['kakure','sorasuzume','chocho','nanyouhagi','hatatate','hanadai'];
 assert(cnt(fc)>cnt(fp)&&fc.filter(s=>reefIds.includes(s.id)).length>=2,`reef fish gather at a core (${cnt(fc)} fish: ${fc.map(s=>s.id)}) vs plain sea (${cnt(fp)}: ${fp.map(s=>s.id)})`);
 assert(fc.some(s=>s.key>=16777216),'reef cells host a second school');assert(!fp.some(s=>['kakure','chocho','hatatate'].includes(s.id)),'core fish stay at reefs');
 assert.deepEqual(sim(...tier.spots.core,30).map(s=>s.key+s.id).sort(),fc.map(s=>s.key+s.id).sort(),'the same reef schools every visit');
 console.log(`PASS: coral reefs: sun shafts ${sc.n}, tiers ${tier.t.map(v=>v.toFixed(2)).join('/')} (plain/fringe/reef/core), core forms ${forms} + rocks, hues ${[...bins]}, ${nc} vs ${np} coral quads, low ${lo.length}/${core.length}, fish ${cnt(fc)} (${[...new Set(fc.map(s=>s.id))]}) vs ${cnt(fp)}`)}
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
 const d7=dry(v7),v8=boot(),d8=dry(v8);assert.equal(run(v8,'terrainVersion'),8);
 assert(d8.dry<d7.dry*.25&&d8.wet>d7.wet,`v8 fills most dry river beds (${d7.dry} -> ${d8.dry} dry, ${d7.wet} -> ${d8.wet} wet)`);
 // The far view agrees with the near terrain (the LOD worker serialises height4 with the version).
 assert(run(v8,'lodWorkerSource()').includes('terrainVersion>=8&&h>SEA-3'),'worker carries the v8 river rule');
 console.log(`PASS: v8 rivers: dry sand beds ${d7.dry} -> ${d8.dry}, wet centre line ${d7.wet} -> ${d8.wet}; v7 worlds keep identical terrain, blocks, near meshes and far tiles`)}
