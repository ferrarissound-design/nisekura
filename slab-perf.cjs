// Slab-specific mesh/CPU comparison; Node VM with mocked WebGL, never a device FPS measurement.
const fs=require('node:fs'),{performance}=require('node:perf_hooks');
const harness=fs.readFileSync(__dirname+'/check.cjs','utf8').split('// ---- New GRAND')[0];
const {boot,run}=new Function('require','__dirname',harness+';return {boot,run}')(require,__dirname);
const d=boot(JSON.stringify({version:1,terrainVersion:3,worldWidth:2048,worldHeight:96,seed:73219,changes:[],inventory:{}}));
run(d,'lifeMode="off";life.length=0;for(let x=960;x<976;x++)for(let z=960;z<976;z++)for(let y=80;y<85;y++)set(x,y,z,0)');
const result={environment:'Node VM / mocked WebGL; CPU timings vary, no Safari or device FPS claim',scenes:{}};
for(const [name,t] of [['cube',7],['lower',91],['upper',92],['double',93]]){
 run(d,`for(let x=960;x<976;x++)for(let z=960;z<976;z++)set(x,82,z,${t});rebuild(60,60)`);
 const samples=[];for(let j=0;j<5;j++){const start=performance.now();run(d,'for(let i=0;i<10;i++)rebuild(60,60)');samples.push((performance.now()-start)/10)}
 samples.sort((a,b)=>a-b);result.scenes[name]={medianRebuildCpuMs:+samples[2].toFixed(3),opaqueFloats:run(d,'opaqueW.n'),waterFloats:run(d,'waterW.n'),voxelBytes:run(d,'blocks.get("60,60").byteLength')};
}
console.log(JSON.stringify(result,null,2));
