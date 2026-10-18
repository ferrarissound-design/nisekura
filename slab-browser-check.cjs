// Real WebGL / touch-emulation regression checks. No hosting or access to a player's saves.
// Usage: node slab-browser-check.cjs [previous-index.html]
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const out=path.join(__dirname,'docs/screenshots');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 const errors=[];
 async function open(file,name){const page=await browser.newPage({viewport:{width:852,height:393},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  const html=fs.readFileSync(file,'utf8').replaceAll('requestAnimationFrame(frame)','void 0');
  await page.route('https://jocraft.test/**',r=>r.fulfill({status:200,contentType:'text/html',body:html}));await page.goto('https://jocraft.test/?quality=low');await page.waitForFunction(()=>window.Nisekura);
  await page.evaluate(()=>{paused=false;$('menu').classList.add('hidden');$('modePick').classList.add('hidden');lifeMode='off';life.length=0;timeOverride=.47;creative=true;gameMode='creative';flying=true;photoMode=false;
   window.sx=1184;window.sy=Math.floor(player.y)+2;window.sz=736;
   const l=[];for(let x=sx-2;x<sx+15;x++)for(let z=sz-2;z<sz+12;z++){l.push([x,sy-1,z,3]);for(let y=sy;y<sy+8;y++)l.push([x,y,z,0])}
   for(let x=sx;x<sx+9;x++)l.push([x,sy,sz+7,7],[x,sy+1,sz+7,41+x%4]);l.push([sx+10,sy,sz+5,83]);editMany(l);
   player.x=sx+10;player.y=sy+5;player.z=sz-7;yaw=-.37;pitch=-.38;streamChunks(true);for(let i=0;i<35&&readyR<2;i++)streamChunks();refresh()});
  await render(page);await page.locator('#world').screenshot({path:path.join(out,`v20-${name}.png`)});return page}
 async function render(page){const ok=await page.evaluate(()=>{canvas.width=innerWidth;canvas.height=innerHeight;gl.viewport(0,0,canvas.width,canvas.height);hit=ray();render({...player,y:player.y+1.62,yaw,pitch},false,canvas.width,canvas.height);gl.finish();return gl.getError()===gl.NO_ERROR});assert(ok,'WebGL has no errors')}
 try{if(process.argv[2]){const before=await open(process.argv[2],'before');await before.close()}
  const page=await open(path.join(__dirname,'index.html'),'existing-after');
  await page.evaluate(()=>{const l=[];for(let i=0;i<6;i++){const x=sx+i*2,t=91+i*3;l.push([x,sy,sz+3,t],[x,sy+1,sz+5,t+1],[x,sy,sz+7,t+2])}editMany(l);selected=slots.indexOf(91);refresh()});
  for(const [name,width,height] of [['landscape',852,393],['portrait',393,852],['ipad',1180,820]]){await page.setViewportSize({width,height});await render(page);await page.screenshot({path:path.join(out,`v20-slabs-${name}.png`)});
   await page.evaluate(()=>{$('craftBtn').click()});await page.locator('#craft_slab5').scrollIntoViewIfNeeded();
   assert(await page.locator('#craft_slab5').isVisible(),'last slab recipe reachable by scrolling');await page.screenshot({path:path.join(out,`v20-craft-${name}.png`)});
   await page.locator('#craft_slab0').scrollIntoViewIfNeeded();await page.locator('#craft_slab0').tap();assert.equal(await page.evaluate(()=>slots[selected]),91);await page.locator('#closeCraft').tap();
   assert(await page.locator('#place').isVisible());assert(await page.locator('#mine').isVisible());
   const overlap=await page.evaluate(()=>{const a=$('bar').getBoundingClientRect(),b=$('place').getBoundingClientRect();return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top});assert.equal(overlap,false,'hotbar and place control do not overlap');
  }
  // Actual touch events on the existing place and mine buttons: merge and remove just the aimed upper half.
  await page.evaluate(()=>{edit(sx,sy,sz+2,91);edit(sx,sy+1,sz+2,0);player.x=sx+.5;player.y=sy;player.z=sz+.5;yaw=0;pitch=-.6;selected=slots.indexOf(91);hit=ray();refresh()});
  await page.locator('#place').tap();assert.equal(await page.evaluate(()=>get(sx,sy,sz+2)),93);
  await page.locator('#mine').tap();assert.equal(await page.evaluate(()=>get(sx,sy,sz+2)),91);
  await page.evaluate(()=>{edit(sx+1,sy,sz+2,92);edit(sx+2,sy,sz+2,93);inventory[91]=9;selected=slots.indexOf(91);save()});
  await page.reload();await page.waitForFunction(()=>window.Nisekura);
  // sy was a test global; recover the original height from saved player coordinates.
  assert.deepEqual(await page.evaluate(()=>{const y=Math.floor(player.y);return[get(1184,y,738),get(1185,y,738),get(1186,y,738),inventory[91],slots[selected]]}),[91,92,93,9,91]);
  await page.evaluate(()=>{setQuality('high');paused=false;streamChunks(true)});await render(page);
  assert.deepEqual(errors,[],'no page or shader errors');console.log('PASS: Chromium WebGL low/high, six slab materials and all states, landscape/portrait/iPad craft scrolling and control layout, real touch merge/mine, localStorage reload; Safari/device performance not tested');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
