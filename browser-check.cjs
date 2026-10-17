// Optional: install playwright in a development environment and run node browser-check.cjs.
// Intercept HTML locally so screenshots never access real player saves or require hosting.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 try{const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8').replaceAll('requestAnimationFrame(frame)','void 0');
 await page.route('https://jocraft.test/**',r=>r.fulfill({status:200,contentType:'text/html',body:html}));await page.goto('https://jocraft.test/?quality=low&mode=survival');await page.waitForFunction(()=>window.Nisekura);assert(await page.evaluate(()=>renderReady&&!!mainProg&&!!lifeProg),'WebGL programs initialized');
 await page.evaluate(()=>{paused=false;$('menu').classList.add('hidden');$('modePick').classList.add('hidden');timeOverride=.47;window.testR=ruins.find(r=>r.kind==='forest');
  const r=testR,p=ruinWorld(r,16,-20);player.x=p.x+.5;player.z=p.z+.5;player.y=r.base+17;flying=true;yaw=Math.atan2(r.x-player.x,r.z-player.z);pitch=-.48;
  streamChunks(true);for(let i=0;i<90&&readyR<2;i++)streamChunks();updateCompass();canvas.width=1280;canvas.height=800;gl.viewport(0,0,1280,800);render({...player,y:player.y+1.62,yaw,pitch},false,1280,800)});
 await page.screenshot({path:path.join(__dirname,'docs/screenshots/v17-temple.png')});
 await page.evaluate(()=>{const r=testR,p=ruinWorld(r,0,40);player.x=p.x+.5;player.z=p.z+.5;player.y=r.f+1;flying=false;unlockRuin(r);streamChunks(true);for(let i=0;i<90&&readyR<2;i++)streamChunks();dungeonTick(1);
  const b=life.find(c=>c.sp.id==='guardian');b.yaw=Math.atan2(player.x-b.x,player.z-b.z);b.mode='guardianTell';b.skill='slam';b.timer=1.4;items.ironSword=1;lastStrikeT=time;refresh();lifePose(b);yaw=Math.atan2(b.x-player.x,b.z-player.z);pitch=.08;caveF=.95;$('find').classList.add('hidden');updateBossHUD();updateCompass();render({...player,y:player.y+1.62,yaw,pitch},false,1280,800)});
 await page.screenshot({path:path.join(__dirname,'docs/screenshots/v17-guardian.png')});
 const result=await page.evaluate(()=>{const r=testR,b=life.find(c=>c.sp.id==='guardian');b.mhp=1;ruinState(r).hp=1;const p=ruinWorld(r,0,43);player.x=p.x+.5;player.z=p.z+.5;player.y=r.f+1;yaw=Math.atan2(b.x-player.x,b.z-player.z);items.ironSword=1;atkCD=0;strike(true);
  const q=ruinWorld(r,0,52);player.x=q.x+.5;player.z=q.z+.5;const chest=ruinWorld(r,0,53);openChest(chest.x,r.f+1,chest.z);return{defeated:ruinState(r).defeated,claimed:ruinState(r).claimed,sword:items.ancientSword,saved:save()}});
 assert(result.defeated&&result.claimed&&result.sword===1&&result.saved,'rendered encounter supports victory/reward/save');
 await page.reload();await page.waitForFunction(()=>window.Nisekura);assert.equal(await page.evaluate(()=>Object.values(adventure.ruins).some(r=>r.claimed)),true);
 for(const viewport of [{width:393,height:852},{width:852,height:393},{width:820,height:1180}]){await page.setViewportSize(viewport);assert.equal(await page.evaluate(()=>{paused=false;$('menu').classList.add('hidden');survivalUI();$('openChest').classList.remove('hidden');const a=$('attack').getBoundingClientRect(),b=$('openChest').getBoundingClientRect();return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top}),false,'attack/chest controls do not overlap')}
 assert.deepEqual(errors,[]);console.log('PASS: Chromium WebGL exterior/guardian screenshots, combat/reward/save/reload, mobile viewport layouts; physical Safari/touch/FPS untested');
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
