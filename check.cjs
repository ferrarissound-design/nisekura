const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const script=fs.readFileSync(__dirname+'/index.html','utf8').match(/<script>([\s\S]*)<\/script>/)[1];
function boot(saved,session={},prefs={}){const nodes={},storage={...prefs},events={},windowEvents={};if(saved)storage['nisekura-v1']=saved;let triangles=0;
const gl=new Proxy({getShaderParameter:()=>true,getProgramParameter:()=>true,createBuffer:()=>({}),getAttribLocation:()=>1,bufferData:(_,data)=>{assert(data.every(Number.isFinite));triangles+=data.length}}, {get:(o,k)=>k in o?o[k]:(()=>({}))});
const node=()=>({style:{},classList:{values:new Set(),add(n){this.values.add(n)},remove(n){this.values.delete(n)},toggle(n,on){if(on)this.values.add(n);else this.values.delete(n)},contains(n){return this.values.has(n)}},addEventListener(){},appendChild(){},getContext:()=>gl,setPointerCapture(){},getBoundingClientRect:()=>({left:0,top:0,width:112,height:112})});
const c={console,Math,Uint8Array,Float32Array,Map,Set,JSON,Number,Error,Date,performance:{now:()=>0},sessionStorage:{getItem:k=>session[k]||null,setItem:(k,v)=>session[k]=v},localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>storage[k]=v},document:{getElementById:id=>nodes[id]??=node(),createElement:node,querySelectorAll:()=>[],hidden:false,addEventListener:(n,f)=>events[n]=f},matchMedia:()=>({matches:false}),requestAnimationFrame(){},innerWidth:800,innerHeight:600,devicePixelRatio:1};c.window=c;c.addEventListener=(n,f)=>windowEvents[n]=f;c.confirm=()=>true;c.location={pathname:'/jocraft/',href:'/jocraft/'};vm.createContext(c);vm.runInContext(script,c);return {c,api:c.Nisekura,storage,get triangles(){return triangles},events,windowEvents,nodes,session}}
const run=(b,code)=>vm.runInContext(code,b.c);
function fingerprint(api,x0,x1,z0,z1,y1){let h=2166136261;for(let x=x0;x<x1;x++)for(let z=z0;z<z1;z++)for(let y=0;y<y1;y++){h^=api.get(x,y,z);h=Math.imul(h,16777619)}return h>>>0}

// ---- New GRAND VISTA world: basics, saves, physics.
const t0=Date.now();const a=boot();console.log(`boot new world: ${Date.now()-t0} ms`);
assert(a.triangles>0);assert(!a.api.collides(a.api.player),'spawn must be clear');assert.equal(a.api.get(32,0,32),11);assert(a.api.collides({x:32.5,y:.5,z:32.5}));assert(a.api.collides({x:-1,y:25,z:30}));
assert.equal(run(a,'terrainVersion'),4);assert.equal(run(a,'H'),192);assert.equal(run(a,'SEA'),62);
a.api.edit(30,30,30,8);assert(a.api.save());const b=boot(a.storage['nisekura-v1']);assert.equal(b.api.get(30,30,30),8,'world edit survives reload');assert(!b.api.collides(b.api.player));
assert.equal(run(b,'terrainVersion'),4,'v4 save reloads as v4');
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
let logs=0,leaves=0,sand=0,snow=0;for(let x=V.x-60;x<V.x+60;x+=2)for(let z=V.z-60;z<V.z+60;z+=2)for(let y=55;y<150;y++){const t=a.api.get(x,y,z);if(t===4||t===13)logs++;if(t===5)leaves++;if(t===6)sand++}
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
for(const [vs,fs]of[[a.api.vertexSource,a.api.fragmentSource],[a.api.lodVertexSource,a.api.lodFragmentSource],[a.api.skyVertexSource,a.api.skyFragmentSource]]){const f=names(fs);for(const n of names(vs))assert(!f.has(n),'uniform '+n+' declared in both stages')}
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
assert.match(resetTest.c.location.href,/\\?seed=\\d+/,'reset must navigate to a newly seeded world');
resetTest.c.onblur();
resetTest.c.document.hidden=true;resetTest.events.visibilitychange();
resetTest.windowEvents.pagehide();
assert.equal(resetTest.storage['nisekura-v1'],undefined,'unload callbacks must not restore deleted saves');
assert.equal(run(resetTest,'save()'),false,'autosave must remain disabled until navigation completes');
const afterReset=boot(resetTest.storage['nisekura-v1']);
assert.equal(run(afterReset,'terrainVersion'),4,'reset must activate new terrain generator');
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

// Performance is profiled in a real browser (Node's vm sandbox makes global lookups ~10x slower); see README.
