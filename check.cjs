const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const script=fs.readFileSync(__dirname+'/index.html','utf8').match(/<script>([\s\S]*)<\/script>/)[1];
function boot(saved){const nodes={},storage={};if(saved)storage['nisekura-v1']=saved;let triangles=0;
const gl=new Proxy({getShaderParameter:()=>true,getProgramParameter:()=>true,createBuffer:()=>({}),getAttribLocation:()=>1,bufferData:(_,data)=>{assert(data.every(Number.isFinite));triangles+=data.length}}, {get:(o,k)=>k in o?o[k]:(()=>({}))});
const node=()=>({style:{},classList:{add(){},remove(){}},addEventListener(){},appendChild(){},getContext:()=>gl,setPointerCapture(){},getBoundingClientRect:()=>({left:0,top:0,width:112,height:112})});
const c={console,Math,Uint8Array,Float32Array,Map,Set,JSON,Number,Error,Date,performance:{now:()=>0},localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>storage[k]=v},document:{getElementById:id=>nodes[id]??=node(),createElement:node,querySelectorAll:()=>[],addEventListener(){}},matchMedia:()=>({matches:false}),requestAnimationFrame(){},innerWidth:800,innerHeight:600,devicePixelRatio:1};c.window=c;c.addEventListener=()=>{};vm.createContext(c);vm.runInContext(script,c);return {c,api:c.Nisekura,storage,triangles}}
const a=boot();assert(a.triangles>0);assert(!a.api.collides(a.api.player),'spawn must be clear');assert.equal(a.api.get(32,0,32),11);assert(a.api.collides({x:32.5,y:.5,z:32.5}));assert(a.api.collides({x:-1,y:25,z:30}));a.api.edit(30,30,30,8);assert(a.api.save());const b=boot(a.storage['nisekura-v1']);assert.equal(b.api.get(30,30,30),8,'world edit survives reload');assert(!b.api.collides(b.api.player));vm.runInContext('paused=false;for(let i=0;i<120;i++)update(1/60)',b.c);assert(!b.api.collides(b.api.player),'gravity stays outside ground');assert(vm.runInContext('ground',b.c));console.log('PASS: finite mesh, safe spawn, bedrock, boundary collision, save/reload, gravity landing');

assert(a.api.cows.length>=3,'new world has wildlife');
for(const cow of a.api.cows)assert(Math.hypot(cow.x-a.api.player.x,cow.z-a.api.player.z)>3,'cow spawn clears player');
vm.runInContext('paused=false;canvas.width=1200;canvas.height=700;drawWorldDetails();drawTool();frame(16)',a.c);
// Legacy saves must keep their old terrain generator and edits.
const legacy=JSON.stringify({version:1,seed:73219,changes:[[30+64*(30+64*30),8]],inventory:{4:7}});
const old=boot(legacy);assert.equal(vm.runInContext('terrainVersion',old.c),1);assert.equal(old.api.get(30,30,30),8);assert.equal(old.api.inventory[4],7);
// Raycast, mining, and placement should use the upgraded mesh without changing mechanics.
vm.runInContext('paused=false;player.x=32.5;player.y=28;player.z=32.5;yaw=0;pitch=0;edit(32,29,35,3)',a.c);
assert.equal(a.api.ray().z,35);const count=a.api.inventory[3]||0;vm.runInContext('mine()',a.c);assert.equal(a.api.get(32,29,35),0);assert.equal(a.api.inventory[3],count+1);
vm.runInContext('edit(32,29,35,3);selected=1;place()',a.c);assert.equal(a.api.get(32,29,34),2);
for(let i=0;i<120;i++)a.api.animateWorld(1/60);for(const cow of a.api.cows)assert([cow.x,cow.y,cow.z].every(Number.isFinite));
console.log('PASS: wildlife placement, render paths, legacy terrain/save compatibility, raycast mining/placement, animal movement');
