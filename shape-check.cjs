// Focused game-level regression using the existing VM harness in check.cjs.
const fs=require('node:fs');
const suite=fs.readFileSync(__dirname+'/check.cjs','utf8');
const setup=suite.split('// ---- New GRAND')[0];
const checks=String.raw`
{const d=boot(),R=c=>run(d,c),X=1188,Y=160,Z=740;
 R("paused=false;flying=true;lifeMode='off';life.length=0");
 R("(()=>{const l=[];for(let x=1187;x<=1189;x++)for(let z=737;z<=743;z++){l.push([x,159,z,3]);for(let y=160;y<=165;y++)l.push([x,y,z,0])}editMany(l)})()");
 const put=t=>R("edit(1188,160,740,"+t+")"),los=y=>R("segmentBlocked(1188.5,"+y+",738,1188.5,"+y+",742)");
 put(91);assert.equal(los(160.75),false,"lower slab open above");assert.equal(los(160.25),true,"lower slab blocks below");
 assert.equal(R("groundAt(1188.5,740.5,161.1,3)"),160.5);
 assert.equal(R("peek(1188,160.5,740)"),91,"fractional peek rounds down");
 assert.equal(R("standAt({sp:LIFE_BY_ID.cow,size:1,y:160.5},1188.5,740.5)"),160.5);
 R("window.cow2={sp:LIFE_BY_ID.cow,x:1188.5,y:160.5,z:740.5,size:1,vy:0,ground:true,sq:0}");
 R("lifeGravity(window.cow2,1/60)");assert.equal(R("window.cow2.y"),160.5,"animal stays on half slab");
 put(92);assert.equal(los(160.25),false,"upper slab open below");assert.equal(los(160.75),true,"upper slab blocks above");
 assert.equal(R("groundAt(1188.5,740.5,161.1,3)"),161);
 put(93);assert.equal(los(160.25),true);assert.equal(los(160.75),true);
 put(51);assert.equal(los(160.75),true,"closed door occludes");
 put(53);assert.equal(los(160.75),false,"open door allows sight");
 put(49);assert.equal(los(160.75),true,"thin window blocks sight");
 put(3);assert.equal(los(160.75),true,"full block still blocks sight");
 put(91);R("window.viewer={x:1188.5,y:160,z:738,sp:{top:.9375},size:1}");
 assert.equal(R("canSee(window.viewer,1188.5,160.75,742)"),true,"enemy sees over lower slab");
 put(92);assert.equal(R("canSee(window.viewer,1188.5,160.75,742)"),false,"upper slab hides target");
 put(53);R("arrows.length=0;arrows.push({x:1188.5,y:160.85,z:739.1,vx:0,vy:0,vz:30,life:3,stuck:false,dmg:1});updateArrows(.06)");
 assert.equal(R("arrows[0].stuck"),false,"arrow flies through open door");
 put(51);R("arrows.length=0;arrows.push({x:1188.5,y:160.85,z:739.1,vx:0,vy:0,vz:30,life:3,stuck:false,dmg:1});updateArrows(.06)");
 assert.equal(R("arrows[0].stuck"),true,"arrow hits closed door");
 put(91);assert.equal(R("standAt({sp:LIFE_BY_ID.cow,size:1,y:160},1188.5,740.5)"),160.5,"animal can climb half step");
 put(41);assert.equal(R("groundAt(1188.5,740.25,161.1,3)"),160.5,"stair low tread");
 assert.equal(R("groundAt(1188.5,740.75,161.1,3)"),161,"stair high tread");
 console.log("PASS: part-shaped combat rays and arrows; animals on slab/stair heights and gravity");
}
`;
new Function('require','__dirname',setup+'\n'+checks)(require,__dirname);
