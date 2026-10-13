const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const script=fs.readFileSync(__dirname+'/index.html','utf8').match(/<script>([\s\S]*)<\/script>/)[1];
function boot(saved,session={}){const nodes={},storage={},events={};if(saved)storage['nisekura-v1']=saved;let triangles=0;
const gl=new Proxy({getShaderParameter:()=>true,getProgramParameter:()=>true,createBuffer:()=>({}),getAttribLocation:()=>1,bufferData:(_,data)=>{assert(data.every(Number.isFinite));triangles+=data.length}}, {get:(o,k)=>k in o?o[k]:(()=>({}))});
const node=()=>({style:{},classList:{values:new Set(),add(n){this.values.add(n)},remove(n){this.values.delete(n)},toggle(n,on){if(on)this.values.add(n);else this.values.delete(n)},contains(n){return this.values.has(n)}},addEventListener(){},appendChild(){},getContext:()=>gl,setPointerCapture(){},getBoundingClientRect:()=>({left:0,top:0,width:112,height:112})});
const c={console,Math,Uint8Array,Float32Array,Map,Set,JSON,Number,Error,Date,performance:{now:()=>0},sessionStorage:{getItem:k=>session[k]||null,setItem:(k,v)=>session[k]=v},localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>storage[k]=v},document:{getElementById:id=>nodes[id]??=node(),createElement:node,querySelectorAll:()=>[],hidden:false,addEventListener:(n,f)=>events[n]=f},matchMedia:()=>({matches:false}),requestAnimationFrame(){},innerWidth:800,innerHeight:600,devicePixelRatio:1};c.window=c;c.addEventListener=()=>{};vm.createContext(c);vm.runInContext(script,c);return {c,api:c.Nisekura,storage,triangles,events,nodes,session}}
const a=boot();assert(a.triangles>0);assert(!a.api.collides(a.api.player),'spawn must be clear');assert.equal(a.api.get(32,0,32),11);assert(a.api.collides({x:32.5,y:.5,z:32.5}));assert(a.api.collides({x:-1,y:25,z:30}));a.api.edit(30,30,30,8);assert(a.api.save());const b=boot(a.storage['nisekura-v1']);assert.equal(b.api.get(30,30,30),8,'world edit survives reload');assert(!b.api.collides(b.api.player));vm.runInContext('paused=false;for(let i=0;i<120;i++)update(1/60)',b.c);assert(!b.api.collides(b.api.player),'gravity stays outside ground');assert(vm.runInContext('ground',b.c));console.log('PASS: finite mesh, safe spawn, bedrock, boundary collision, save/reload, gravity landing');

assert(a.api.cows.length>=3,'new world has wildlife');
for(const cow of a.api.cows)assert(Math.hypot(cow.x-a.api.player.x,cow.z-a.api.player.z)>3,'cow spawn clears player');
vm.runInContext('paused=false;canvas.width=1200;canvas.height=700;drawWorldDetails();drawTool();frame(16)',a.c);
// Legacy saves must keep their old terrain generator and edits.
const legacy=JSON.stringify({version:1,seed:73219,changes:[[30+64*(30+64*30),8]],inventory:{4:7}});
const old=boot(legacy);assert.equal(vm.runInContext('terrainVersion',old.c),1);assert.equal(old.api.get(30,30,30),8);assert.equal(old.api.inventory[4],7);
// Raycast, mining, and placement should use the upgraded mesh without changing mechanics.
vm.runInContext('paused=false;player.x=1024.5;player.y=50;player.z=1024.5;yaw=0;pitch=0;edit(1024,51,1027,3)',a.c);
assert.equal(a.api.ray().z,1027);const count=a.api.inventory[3]||0;vm.runInContext('mine()',a.c);assert.equal(a.api.get(1024,51,1027),0);assert.equal(a.api.inventory[3],count+1);
vm.runInContext('edit(1024,51,1027,3);selected=1;place()',a.c);assert.equal(a.api.get(1024,51,1026),2);
for(let i=0;i<120;i++)a.api.animateWorld(1/60);for(const cow of a.api.cows)assert([cow.x,cow.y,cow.z].every(Number.isFinite));
console.log('PASS: wildlife placement, render paths, legacy terrain/save compatibility, raycast mining/placement, animal movement');

// Browser focus/visibility changes must not switch to title or retain movement inputs.
vm.runInContext('play();keys.KeyW=true',a.c);a.c.onblur();assert.equal(vm.runInContext('paused',a.c),false);assert(a.nodes.menu.classList.contains('hidden'));assert.equal(vm.runInContext('!!keys.KeyW',a.c),false);
a.c.document.hidden=true;a.events.visibilitychange();assert.equal(vm.runInContext('suspended',a.c),true);assert.equal(vm.runInContext('paused',a.c),false);const beforeHidden=a.api.player.z;vm.runInContext('frame(32)',a.c);assert.equal(a.api.player.z,beforeHidden);
a.c.document.hidden=false;a.events.visibilitychange();assert.equal(vm.runInContext('suspended',a.c),false);assert(a.nodes.menu.classList.contains('hidden'));
// Flight ascends, hovers, descends, and respects solid blocks and altitude ceiling.
vm.runInContext('player.x=100.5;player.z=100.5;player.y=50;toggleFlight();keys.Space=true;for(let i=0;i<60;i++)update(1/60);delete keys.Space',a.c);
assert(Math.abs(a.api.player.y-57)<.001);vm.runInContext('for(let i=0;i<60;i++)update(1/60)',a.c);assert(Math.abs(a.api.player.y-57)<.001);
vm.runInContext('keys.KeyQ=true;for(let i=0;i<60;i++)update(1/60);delete keys.KeyQ',a.c);assert(Math.abs(a.api.player.y-50)<.001);
vm.runInContext('edit(100,52,100,3);keys.Space=true;for(let i=0;i<60;i++)update(1/60);delete keys.Space',a.c);assert(a.api.player.y<50.22);assert(!a.api.collides(a.api.player));
vm.runInContext('player.x=110.5;player.y=93;keys.Space=true;for(let i=0;i<60;i++)update(1/60);delete keys.Space',a.c);assert(a.api.player.y<94.21);assert(!a.api.collides(a.api.player));
// Newly accessible world areas save/load using the larger coordinate stride.
a.api.edit(1400,45,1400,8);assert.equal(a.api.get(1400,45,1400),8);a.api.save();const wide=boot(a.storage['nisekura-v1'],{'nisekura-playing':'1'});assert.equal(wide.api.get(1400,45,1400),8);assert.equal(vm.runInContext('flying',wide.c),true);assert.equal(vm.runInContext('paused',wide.c),false);assert(wide.nodes.menu.classList.contains('hidden'));assert.equal(JSON.parse(a.storage['nisekura-v1']).worldWidth,2048);
vm.runInContext('player.x=1400.5;player.z=1400.5;streamChunks(true);for(let i=0;i<260;i++)streamChunks()',wide.c);assert(vm.runInContext('chunks.has("175,175")',wide.c));assert(vm.runInContext('chunks.size<=220',wide.c));assert(vm.runInContext('blocks.size<=450',wide.c));
vm.runInContext('pause()',wide.c);assert.equal(vm.runInContext('paused',wide.c),true);assert(!wide.nodes.menu.classList.contains('hidden'));assert.equal(wide.session['nisekura-playing'],'0');
console.log('PASS: focus/background resume, flight ascent/hover/descent/collision/ceiling, 2048-wide save roundtrip, bounded chunk streaming, explicit menu');

// Preserve edits originally made in the intermediate 256-wide version.
const old256=JSON.stringify({version:1,worldWidth:256,worldHeight:96,terrainVersion:2,seed:73219,changes:[[140+256*(140+256*24),8]],inventory:{7:5}});
const migrated=boot(old256);assert.equal(migrated.api.get(140,24,140),8);assert.equal(migrated.api.inventory[7],5);
assert.equal(vm.runInContext('W',a.c),2048);assert.equal(vm.runInContext('terrainVersion',a.c),3);
assert.equal(a.api.get(1024+500,10,1024),10,'distant ocean');
assert(!a.api.collides(a.api.player),'center spawn is safe');
console.log('PASS: old 256-wide saves, streamed 2048-square world, distant ocean, center spawn');
