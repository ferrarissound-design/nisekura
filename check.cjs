const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const script=fs.readFileSync(__dirname+'/index.html','utf8').match(/<script>([\s\S]*)<\/script>/)[1];
function boot(saved,session={},prefs={}){const nodes={},storage={...prefs},events={},windowEvents={};if(saved)storage['nisekura-v1']=saved;let triangles=0;
const gl=new Proxy({getShaderParameter:()=>true,getProgramParameter:()=>true,createBuffer:()=>({}),getAttribLocation:()=>1,bufferData:(_,data)=>{assert(data.every(Number.isFinite));triangles+=data.length}}, {get:(o,k)=>k in o?o[k]:(()=>({}))});
const node=()=>({style:{},classList:{values:new Set(),add(n){this.values.add(n)},remove(n){this.values.delete(n)},toggle(n,on){if(on)this.values.add(n);else this.values.delete(n)},contains(n){return this.values.has(n)}},setAttribute(){},focus(){},listeners:{},addEventListener(n,f){(this.listeners[n]??=[]).push(f)},appendChild(){},getContext:()=>gl,setPointerCapture(){},getBoundingClientRect:()=>({left:0,top:0,width:112,height:112})});
const c={console,Math,Uint8Array,Float32Array,Map,Set,JSON,Number,Error,Date,performance:{now:()=>0},sessionStorage:{getItem:k=>session[k]||null,setItem:(k,v)=>session[k]=v,removeItem:k=>{delete session[k]}},localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>storage[k]=v,removeItem:k=>{delete storage[k]}},document:{body:node(),getElementById:id=>nodes[id]??=node(),createElement:node,querySelectorAll:()=>[],hidden:false,addEventListener:(n,f)=>events[n]=f},matchMedia:()=>({matches:false}),requestAnimationFrame(){},innerWidth:800,innerHeight:600,devicePixelRatio:1};c.window=c;c.addEventListener=(n,f)=>windowEvents[n]=f;c.confirm=()=>true;c.location={pathname:'/jocraft/',href:'/jocraft/'};vm.createContext(c);vm.runInContext(script,c);return {c,api:c.Nisekura,storage,get triangles(){return triangles},events,windowEvents,nodes,session}}
const run=(b,code)=>vm.runInContext(code,b.c);
function fingerprint(api,x0,x1,z0,z1,y1){let h=2166136261;for(let x=x0;x<x1;x++)for(let z=z0;z<z1;z++)for(let y=0;y<y1;y++){h^=api.get(x,y,z);h=Math.imul(h,16777619)}return h>>>0}

// ---- New GRAND VISTA world: basics, saves, physics.
const t0=Date.now();const a=boot();console.log(`boot new world: ${Date.now()-t0} ms`);
assert(a.triangles>0);assert(!a.api.collides(a.api.player),'spawn must be clear');assert.equal(a.api.get(32,0,32),11);assert(a.api.collides({x:32.5,y:.5,z:32.5}));assert(a.api.collides({x:-1,y:25,z:30}));
assert.equal(run(a,'terrainVersion'),5);assert.equal(run(a,'H'),192);assert.equal(run(a,'SEA'),62);
a.api.edit(30,30,30,8);assert(a.api.save());const b=boot(a.storage['nisekura-v1']);assert.equal(b.api.get(30,30,30),8,'world edit survives reload');assert(!b.api.collides(b.api.player));
assert.equal(run(b,'terrainVersion'),5,'v5 save reloads as v5');
run(b,'paused=false;for(let i=0;i<120;i++)update(1/60)');assert(!b.api.collides(b.api.player),'gravity stays outside ground');assert(run(b,'ground'));
console.log('PASS: finite mesh, safe spawn, bedrock, boundary collision, save/reload, gravity landing');

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
let logs=0,leaves=0,sand=0,snow=0;for(let x=V.x-60;x<V.x+60;x+=2)for(let z=V.z-60;z<V.z+60;z+=2)for(let y=55;y<150;y++){const t=a.api.get(x,y,z);if(t===4||t===13)logs++;if(t===5||t===14||t===15||t===16)leaves++;if(t===6)sand++}
for(let x=0;x<2048&&!snow;x+=16)for(let z=0;z<2048;z+=16)if(a.api.height(x,z)>62+100){snow++;break}
assert(logs>20&&leaves>200,'trees near the vista');assert(sand>0,'beach or riverbank sand near the vista');assert(snow>0,'snow-capped peaks exist');
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
assert.equal(run(afterReset,'terrainVersion'),5,'reset must activate new terrain generator');
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
 let coast=null;for(let x=V.x;x<V.x+700&&!coast;x+=16){const a=d.api.height(x,V.z),b=d.api.height(x+15,V.z);if(a>=SEA&&b<SEA)coast=[x>>4,V.z>>4]}
 assert(coast,'coastal chunk found');const {w,o}=waterOf(...coast);
 const corners=new Map();let near1=0,far0=0,tops=0;
 for(let i=0;i<w.length;i+=9){if(Math.floor(w[i+8]/32)!==2)continue;tops++;const key=w[i]+','+w[i+2],val=[w[i+3],w[i+4],w[i+5],w[i+6],w[i+7],w[i+8]%1].map(v=>v.toFixed(5)).join();
  if(corners.has(key))assert.equal(corners.get(key),val,'water data is continuous across blocks at '+key);else corners.set(key,val);
  const x=w[i],z=w[i+2],land=[[0,0],[-1,0],[0,-1],[-1,-1]].some(([dx,dz])=>d.api.get(x+dx,SEA,z+dz)!==10&&d.api.get(x+dx,SEA,z+dz)!==0);
  if(land){assert.equal(w[i+4],1,'corners touching land have shore nearness 1');near1++}
  let open=true;for(let dx=-5;dx<5&&open;dx++)for(let dz=-5;dz<5;dz++){const t=d.api.get(x+dx,SEA,z+dz);if(t!==10&&t!==0){open=false;break}}
  if(open){assert.equal(w[i+4],0,'no shore foam data far from land');far0++}}
 assert(tops>0&&near1>0&&far0>0,'coastal chunk has shore and open-water corners');
 // Wet flag: faces touching water (sea bed) carry +512; nothing above the water does.
 let wet=0;for(let i=0;i<o.length;i+=9)if(o[i+8]>=512){wet++;assert(o[i+1]<=SEA+1,'wet faces lie under the water surface')}assert(wet>0,'sea bed faces are flagged wet');
 // River: water flows (non-zero uv) toward the east; the open sea does not flow.
 const fl=JSON.parse(run(d,'(()=>{const o=[0,0];riverFlow(978,820,2.5,o);const a=[o[0],o[1]];riverFlow(1500,768,-1,o);return JSON.stringify([a,[o[0],o[1]]])})()'));
 assert(fl[0][0]>.2&&Math.hypot(...fl[0])<=1.5,'river flows downstream (east) at a bounded speed');assert.equal(Math.hypot(...fl[1]),0,'open sea has no river flow');
 const rv=waterOf(978>>4,820>>4).w;let flowing=0;for(let i=0;i<rv.length;i+=9)if(Math.hypot(rv[i+6],rv[i+7])>.1)flowing++;assert(flowing>0,'river surface vertices carry flow');
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
