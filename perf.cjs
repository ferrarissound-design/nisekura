// Deterministic CPU/command-count comparison. No real GPU and no device FPS claim.
// Usage: node perf.cjs [path-to-index.html]
const fs=require('node:fs'),path=require('node:path'),{performance}=require('node:perf_hooks');
let harness=fs.readFileSync(__dirname+'/check.cjs','utf8').split('// ---- New GRAND')[0];
if(process.argv[2])harness=harness.replace("__dirname+'/index.html'",JSON.stringify(path.resolve(process.argv[2])));
harness=harness.replace('const c={console,Math,','let randomSeed=42;const seededMath=Object.create(Math);seededMath.random=()=>((randomSeed=Math.imul(randomSeed,1664525)+1013904223>>>0)/4294967296);const c={console,Math:seededMath,');
const {boot,run}=new Function('require','__dirname',harness+';return {boot,run}')(require,__dirname);
const legacy=JSON.stringify({version:1,terrainVersion:3,worldWidth:2048,worldHeight:96,seed:73219,changes:[],inventory:{}});
const d=boot(legacy);run(d,'readyR=8;life.length=0;lifeMode="off";for(let i=0;i<60;i++)lifeNew(LIFE_SPECIES[i%2],player.x+(i%8)-4,player.y,player.z+12+Math.floor(i/8),true,1)');
let binds=0,pointers=0,draws=0;d.gl.bindBuffer=()=>binds++;d.gl.vertexAttribPointer=()=>pointers++;d.gl.drawElements=()=>draws++;
const t=performance.now();run(d,'const perfCam={...player,y:player.y+1.62,yaw:0,pitch:0};for(let i=0;i<120;i++)drawLife(perfCam,makeFrustum(perfCam,1.5),skyEnv(sunFromTime(.5)),[500,700,900,0],1.5,.1,250)');const renderMs=performance.now()-t;
let poseCalls=0;const originalPose=run(d,'lifePose');d.c.perfPose=c=>{poseCalls++;originalPose(c)};run(d,'lifePose=perfPose');
const distantStart=performance.now();run(d,'for(const c of life)c.z=player.z+70;for(let i=0;i<120;i++){for(const c of life)c.t+=1/60;drawLife(perfCam,makeFrustum(perfCam,1.5),skyEnv(sunFromTime(.5)),[500,700,900,0],1.5,.1,250)}');
const distantMs=performance.now()-distantStart,commands={binds,pointers,draws};
run(d,'for(let i=0;i<life.length;i++){const c=life[i];c.x=player.x+(i%5);c.z=player.z+2+Math.floor(i/5);c.y=player.y;c.dormant=false}');
const aiStart=performance.now();run(d,'for(let i=0;i<240;i++)updateLife(1/60,player)');const aiMs=performance.now()-aiStart;
run(d,'var titleRenderCount=0,titleStreamCount=0;render=()=>titleRenderCount++;streamChunks=()=>titleStreamCount++;lodWork=()=>{};updateLife=()=>{};paused=true;last=0;renderScale=1;for(let i=1;i<=120;i++)frame(i*1000/60)');
let icons=0;d.c.perfIcon=()=>{icons++;return d.c.document.createElement('canvas')};run(d,'lifeIcon=perfIcon;openEggs()');
let allocations=0,subUploads=0;d.gl.bufferData=()=>allocations++;d.gl.bufferSubData=()=>subUploads++;
run(d,'dyn.n=36;for(let i=0;i<20;i++)drawData(dynamicBuffer,dyn)');const dynamic={allocations,subUploads};allocations=0;
run(d,'hit={x:30,y:30,z:30};for(let i=0;i<60;i++)drawOutline()');
console.log(JSON.stringify({environment:'Node VM / mocked WebGL, deterministic seed 42',near120CpuMs:+renderMs.toFixed(2),distant120CpuMs:+distantMs.toFixed(2),creatureCommands240Frames:commands,distantPoseCalls:poseCalls,nearAI240Ms:+aiMs.toFixed(2),title120Callbacks:{renders:run(d,'titleRenderCount'),streamCalls:run(d,'titleStreamCount'),renderScale:run(d,'renderScale')},synchronousEggIcons:icons,dynamic20Frames:dynamic,outlineUploads60Frames:allocations},null,2));
