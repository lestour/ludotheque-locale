'use strict';

const canvas = document.getElementById('screen');
const context = canvas.getContext('2d');
const difficultySelect = document.getElementById('difficulty');
const sizeSelect = document.getElementById('size');
const modeSelect = document.getElementById('mode');
const statusElement = document.getElementById('status');
const directions = { up: [0,-1], down: [0,1], left: [-1,0], right: [1,0] };
const opposites = { up:'down', down:'up', left:'right', right:'left' };
const keyDirections = { ArrowUp:'up', z:'up', w:'up', ArrowDown:'down', s:'down', ArrowLeft:'left', q:'left', a:'left', ArrowRight:'right', d:'right' };
const settings = {
  easy:{ ghostSpeed:.64, thinking:.28 }, normal:{ ghostSpeed:.81, thinking:.52 },
  hard:{ ghostSpeed:.96, thinking:.76 }, extreme:{ ghostSpeed:1.08, thinking:.94 }
};
const formats = { small:[17,17], medium:[21,21], large:[27,23] };
let game = null, running = false, paused = false, frame = 0, lastTime = 0;

function cellKey(x,y){ return `${x},${y}`; }
function seededRandom(seed){ return window.GameRuntime?.createRandom(`glouton:${seed}`) || Math.random; }
function shuffle(values, random){ return window.GameRuntime?.shuffle(values, random) || values.sort(()=>random()-.5); }

function generateMaze(width,height,random){
  const cells = Array.from({length:height},()=>Array(width).fill(1));
  const stack = [[1,1]]; cells[1][1]=0;
  while(stack.length){
    const [x,y]=stack.at(-1); const choices=[];
    for(const [dx,dy] of [[2,0],[-2,0],[0,2],[0,-2]]){ const nx=x+dx,ny=y+dy;if(nx>0&&ny>0&&nx<width-1&&ny<height-1&&cells[ny][nx])choices.push([nx,ny,dx/2,dy/2]); }
    if(!choices.length){stack.pop();continue;}
    const [nx,ny,mx,my]=choices[Math.floor(random()*choices.length)];cells[y+my][x+mx]=0;cells[ny][nx]=0;stack.push([nx,ny]);
  }
  const loopCount=Math.floor(width*height*.055);
  for(let index=0;index<loopCount;index++){const x=1+Math.floor(random()*(width-2)),y=1+Math.floor(random()*(height-2));if(cells[y][x]&&((!cells[y][x-1]&&!cells[y][x+1])||(!cells[y-1][x]&&!cells[y+1][x])))cells[y][x]=0;}
  const midX=Math.floor(width/2)|1,midY=Math.floor(height/2)|1;
  for(let y=midY-1;y<=midY+1;y++)for(let x=midX-2;x<=midX+2;x++)cells[y][x]=0;
  cells[midY-2][midX]=0;cells[midY+2][midX]=0;
  return cells;
}

function nearestOpen(maze,x,y){
  if(!maze[y]?.[x])return{x,y};
  const queue=[[x,y]],seen=new Set([cellKey(x,y)]);
  while(queue.length){const [cx,cy]=queue.shift();for(const [dx,dy] of Object.values(directions)){const nx=cx+dx,ny=cy+dy,key=cellKey(nx,ny);if(seen.has(key)||!maze[ny])continue;if(!maze[ny][nx])return{x:nx,y:ny};seen.add(key);queue.push([nx,ny]);}}
  return{x:1,y:1};
}

function reachableCount(maze,start={x:1,y:1}){const queue=[start],seen=new Set([cellKey(start.x,start.y)]);while(queue.length){const cell=queue.shift();for(const [dx,dy] of Object.values(directions)){const x=cell.x+dx,y=cell.y+dy,key=cellKey(x,y);if(maze[y]?.[x]===0&&!seen.has(key)){seen.add(key);queue.push({x,y});}}}return seen.size;}

function createLevel(level=1,seed=`${Date.now()}:${Math.random()}`){
  const random=seededRandom(seed),[width,height]=formats[sizeSelect.value],maze=generateMaze(width,height,random);
  const spawn=nearestOpen(maze,1,height-2),home=nearestOpen(maze,Math.floor(width/2)|1,Math.floor(height/2)|1);
  const pellets=new Set();for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++)if(!maze[y][x])pellets.add(cellKey(x,y));
  pellets.delete(cellKey(spawn.x,spawn.y));
  const powers=[nearestOpen(maze,1,1),nearestOpen(maze,width-2,1),nearestOpen(maze,1,height-2),nearestOpen(maze,width-2,height-2)];
  powers.forEach(cell=>pellets.delete(cellKey(cell.x,cell.y)));
  const ghostData=[['hunter','#ef4444'],['ambusher','#ec4899'],['patrol','#22d3ee'],['shy','#f59e0b']];
  const ghosts=ghostData.map(([kind,color],index)=>({kind,color,x:home.x+(index%2)*.18,y:home.y+Math.floor(index/2)*.18,dir:index%2?'left':'right',nextDir:'left',releasedAt:1.5+index*2,eyes:0}));
  const powerSet=new Set(powers.map(cell=>cellKey(cell.x,cell.y)));
  return {random,level,width,height,maze,spawn,home,pellets,initialPellets:pellets.size,initialTargets:pellets.size+powerSet.size,powers:powerSet,ghosts,player:{x:spawn.x,y:spawn.y,dir:'right',nextDir:'right',mouth:0},score:0,lives:modeSelect.value==='survival'?1:3,time:0,timeLeft:modeSelect.value==='timed'?120:Infinity,frightened:0,ghostChain:0,fruit:null,fruitTimer:0,completed:false,particles:[]};
}

function startGame(){try{cancelAnimationFrame(frame);game=createLevel(1,new URLSearchParams(location.search).get('seed')||undefined);running=true;paused=false;document.getElementById('overlay').hidden=true;document.getElementById('pause').textContent='Pause';statusElement.textContent='Toutes les lumières sont accessibles. Anticipez les esprits.';window.GameRecords?.reset();lastTime=performance.now();updateHud();draw();canvas.focus();frame=requestAnimationFrame(loop);}catch(error){running=false;statusElement.textContent=`Impossible de lancer la partie : ${error.message}`;}}
function tileOpen(x,y){return game?.maze[Math.round(y)]?.[Math.round(x)]===0;}
function centerDistance(value){return Math.abs(value-Math.round(value));}
function atCellCenter(entity,tolerance=.055){return centerDistance(entity.x)<tolerance&&centerDistance(entity.y)<tolerance;}
function canTurn(entity,dir){if(!directions[dir]||!atCellCenter(entity,.16))return false;const [dx,dy]=directions[dir];return tileOpen(Math.round(entity.x)+dx,Math.round(entity.y)+dy);}
function moveEntity(entity,dir,speed,delta){const [dx,dy]=directions[dir];if(atCellCenter(entity,.055)){entity.x=Math.round(entity.x);entity.y=Math.round(entity.y);if(!tileOpen(entity.x+dx,entity.y+dy))return false;}const targetX=dx>0?Math.floor(entity.x+.001)+1:dx<0?Math.ceil(entity.x-.001)-1:Math.round(entity.x);const targetY=dy>0?Math.floor(entity.y+.001)+1:dy<0?Math.ceil(entity.y-.001)-1:Math.round(entity.y);const distance=Math.abs(dx?targetX-entity.x:targetY-entity.y),travel=Math.min(distance,speed*delta);entity.x+=dx*travel;entity.y+=dy*travel;if(dx)entity.y=Math.round(entity.y);else entity.x=Math.round(entity.x);if(distance<=speed*delta+.0001){entity.x=targetX;entity.y=targetY;}return true;}

function targetFor(ghost){
  const player=game.player,thinking=settings[difficultySelect.value].thinking;
  if(ghost.kind==='hunter')return{x:player.x,y:player.y};
  if(ghost.kind==='ambusher'){const [dx,dy]=directions[player.dir];return{x:player.x+dx*(2+thinking*3),y:player.y+dy*(2+thinking*3)};}
  if(ghost.kind==='patrol'){return game.time%12<7?{x:player.x,y:player.y}:{x:game.width-2,y:1};}
  const distanceToPlayer=Math.hypot(ghost.x-player.x,ghost.y-player.y);return distanceToPlayer<5+thinking*2?{x:1,y:game.height-2}:{x:player.x,y:player.y};
}

function chooseGhostDirection(ghost){
  const options=Object.keys(directions).filter(dir=>dir!==opposites[ghost.dir]&&canTurn(ghost,dir));
  if(!options.length)return canTurn(ghost,opposites[ghost.dir])?opposites[ghost.dir]:ghost.dir;
  if(game.frightened>0)return shuffle(options,game.random)[0];
  const target=targetFor(ghost);
  return options.sort((left,right)=>{const [lx,ly]=directions[left],[rx,ry]=directions[right];return Math.hypot(ghost.x+lx-target.x,ghost.y+ly-target.y)-Math.hypot(ghost.x+rx-target.x,ghost.y+ry-target.y);})[0];
}

function collectAtPlayer(){
  const x=Math.round(game.player.x),y=Math.round(game.player.y),key=cellKey(x,y);
  if(game.pellets.delete(key)){game.score+=10;if(game.pellets.size===Math.floor(game.initialPellets*.64)||game.pellets.size===Math.floor(game.initialPellets*.28))spawnFruit();}
  if(game.powers.delete(key)){game.score+=50;game.frightened=7;game.ghostChain=0;statusElement.textContent='Surcharge ! Les esprits sont vulnérables.';}
  if(game.fruit&&game.fruit.x===x&&game.fruit.y===y){const value=500*game.level;game.score+=value;game.particles.push({x,y,text:`+${value}`,life:1});game.fruit=null;statusElement.textContent='Fruit rare récupéré !';}
  if(!game.pellets.size&&!game.powers.size)nextLevel();
}

function spawnFruit(){const open=[];for(let y=1;y<game.height-1;y++)for(let x=1;x<game.width-1;x++)if(!game.maze[y][x]&&Math.hypot(x-game.player.x,y-game.player.y)>6)open.push({x,y});game.fruit=open[Math.floor(game.random()*open.length)]||game.home;game.fruitTimer=12;statusElement.textContent='Un fruit rare apparaît pour douze secondes !';}
function nextLevel(){const previous=game,seed=`level:${previous.level+1}:${previous.random()}`;game=createLevel(previous.level+1,seed);game.score=previous.score+1000*previous.level;game.lives=previous.lives;running=true;statusElement.textContent=`Niveau ${game.level} : les esprits accélèrent.`;}
function loseLife(){game.lives--;if(game.lives<=0)return finish(false,'Les esprits ont récupéré toutes vos vies.');game.player={x:game.spawn.x,y:game.spawn.y,dir:'right',nextDir:'right',mouth:0};game.ghosts.forEach((ghost,index)=>Object.assign(ghost,{x:game.home.x+(index%2)*.18,y:game.home.y+Math.floor(index/2)*.18,dir:index%2?'left':'right',releasedAt:game.time+1+index}));game.frightened=0;statusElement.textContent=`Collision ! ${game.lives} vie${game.lives>1?'s':''} restante${game.lives>1?'s':''}.`;}

function update(delta){
  if(!game||game.completed)return;game.time+=delta;if(modeSelect.value==='timed'){game.timeLeft-=delta;if(game.timeLeft<=0)return finish(false,'Le temps est écoulé.');}
  game.frightened=Math.max(0,game.frightened-delta);if(!game.frightened)game.ghostChain=0;
  if(canTurn(game.player,game.player.nextDir))game.player.dir=game.player.nextDir;
  const playerSpeed=4.75+Math.min(1.05,(game.level-1)*.07);moveEntity(game.player,game.player.dir,playerSpeed,delta);game.player.mouth+=delta*13;collectAtPlayer();
  const ghostSpeed=(4.35+Math.min(1.35,(game.level-1)*.1))*settings[difficultySelect.value].ghostSpeed*(game.frightened>0?.69:1);
  for(const ghost of game.ghosts){if(game.time<ghost.releasedAt)continue;if(atCellCenter(ghost,.075))ghost.dir=chooseGhostDirection(ghost);moveEntity(ghost,ghost.dir,ghostSpeed,delta);if(Math.hypot(ghost.x-game.player.x,ghost.y-game.player.y)<.48){if(game.frightened>0){game.ghostChain++;const points=200*2**Math.min(3,game.ghostChain-1);game.score+=points;ghost.x=game.home.x;ghost.y=game.home.y;ghost.releasedAt=game.time+2;game.particles.push({x:ghost.x,y:ghost.y,text:`+${points}`,life:1});}else{loseLife();break;}}}
  if(game.fruit){game.fruitTimer-=delta;if(game.fruitTimer<=0)game.fruit=null;}
  game.particles.forEach(p=>p.life-=delta);game.particles=game.particles.filter(p=>p.life>0);updateHud();
}

function finish(won,reason){game.completed=true;running=false;document.getElementById('overlayTitle').textContent=won?'Labyrinthe maîtrisé':'Partie terminée';document.getElementById('overlayText').textContent=`${reason} Score : ${game.score.toLocaleString('fr-FR')}.`;document.getElementById('overlay').hidden=false;window.GameRecords?.finish({score:game.score,scoreLabel:`${game.score.toLocaleString('fr-FR')} points`,won});}
function updateHud(){document.getElementById('score').textContent=game.score.toLocaleString('fr-FR');document.getElementById('level').textContent=game.level;document.getElementById('lives').textContent=game.lives;document.getElementById('time').textContent=modeSelect.value==='timed'?`${Math.ceil(game.timeLeft)} s`:`${Math.floor(game.time/60)}:${String(Math.floor(game.time%60)).padStart(2,'0')}`;document.getElementById('pellets').textContent=game.pellets.size+game.powers.size;document.getElementById('progress').style.width=`${100*(1-(game.pellets.size+game.powers.size)/Math.max(1,game.initialTargets))}%`;}

function drawEntity(entity,color,ghost=false){const cell=Math.min(canvas.width/game.width,canvas.height/game.height),offsetX=(canvas.width-cell*game.width)/2,offsetY=(canvas.height-cell*game.height)/2,x=offsetX+(entity.x+.5)*cell,y=offsetY+(entity.y+.5)*cell,r=cell*.39;context.save();context.translate(x,y);if(ghost){context.fillStyle=game.frightened>0?'#6366f1':color;context.beginPath();context.arc(0,-r*.16,r,Math.PI,0);context.lineTo(r,r);for(let i=0;i<4;i++)context.lineTo(r-i*r*.55,r-(i%2)*r*.3);context.lineTo(-r,r);context.closePath();context.fill();context.fillStyle='#fff';context.beginPath();context.arc(-r*.34,-r*.2,r*.22,0,Math.PI*2);context.arc(r*.34,-r*.2,r*.22,0,Math.PI*2);context.fill();context.fillStyle='#111827';context.beginPath();context.arc(-r*.31,-r*.16,r*.09,0,Math.PI*2);context.arc(r*.37,-r*.16,r*.09,0,Math.PI*2);context.fill();}else{const angle={right:0,down:Math.PI/2,left:Math.PI,up:-Math.PI/2}[entity.dir],mouth=.15+Math.abs(Math.sin(entity.mouth))*.32;context.rotate(angle);context.fillStyle='#facc15';context.beginPath();context.arc(0,0,r,mouth,Math.PI*2-mouth);context.lineTo(0,0);context.fill();}context.restore();}

function draw(){
  context.fillStyle='#020617';context.fillRect(0,0,canvas.width,canvas.height);if(!game)return;
  const cell=Math.min(canvas.width/game.width,canvas.height/game.height),offsetX=(canvas.width-cell*game.width)/2,offsetY=(canvas.height-cell*game.height)/2;
  for(let y=0;y<game.height;y++)for(let x=0;x<game.width;x++){const px=offsetX+x*cell,py=offsetY+y*cell;if(game.maze[y][x]){const glow=context.createLinearGradient(px,py,px+cell,py+cell);glow.addColorStop(0,'#172554');glow.addColorStop(1,'#1e3a8a');context.fillStyle=glow;context.fillRect(px+.8,py+.8,cell-1.6,cell-1.6);context.strokeStyle='#38bdf855';context.strokeRect(px+2,py+2,cell-4,cell-4);}else{context.fillStyle=(x+y)%2?'#050b18':'#071020';context.fillRect(px,py,cell,cell);}}
  context.fillStyle='#f8fafc';for(const key of game.pellets){const[x,y]=key.split(',').map(Number);context.beginPath();context.arc(offsetX+(x+.5)*cell,offsetY+(y+.5)*cell,Math.max(1.8,cell*.085),0,Math.PI*2);context.fill();}
  context.fillStyle='#fef08a';context.shadowColor='#facc15';context.shadowBlur=10;for(const key of game.powers){const[x,y]=key.split(',').map(Number);context.beginPath();context.arc(offsetX+(x+.5)*cell,offsetY+(y+.5)*cell,cell*.22*(1+Math.sin(game.time*6)*.13),0,Math.PI*2);context.fill();}context.shadowBlur=0;
  if(game.fruit){context.fillStyle='#fb7185';context.beginPath();context.arc(offsetX+(game.fruit.x+.5)*cell,offsetY+(game.fruit.y+.5)*cell,cell*.28,0,Math.PI*2);context.fill();context.fillStyle='#4ade80';context.fillRect(offsetX+(game.fruit.x+.5)*cell,offsetY+(game.fruit.y+.12)*cell,cell*.08,cell*.25);}
  drawEntity(game.player,'#facc15');game.ghosts.forEach(ghost=>drawEntity(ghost,ghost.color,true));
  game.particles.forEach(p=>{context.globalAlpha=p.life;context.fillStyle='#fff';context.font=`900 ${Math.max(12,cell*.45)}px Arial`;context.textAlign='center';context.fillText(p.text,offsetX+(p.x+.5)*cell,offsetY+(p.y+.2)*cell);});context.globalAlpha=1;
  if(paused){context.fillStyle='#020617aa';context.fillRect(0,0,canvas.width,canvas.height);context.fillStyle='#fff';context.font='900 54px Arial';context.textAlign='center';context.fillText('PAUSE',canvas.width/2,canvas.height/2);}
}

function loop(time){const delta=Math.min(.035,(time-lastTime)/1000||0);lastTime=time;if(running&&!paused)update(delta);draw();frame=requestAnimationFrame(loop);}
function setDirection(dir){if(!directions[dir])return;if(!running||game?.completed)startGame();if(game)game.player.nextDir=dir;}
document.addEventListener('keydown',event=>{const dir=keyDirections[event.key]||keyDirections[event.key.toLowerCase?.()];if(dir){event.preventDefault();setDirection(dir);}if(event.key==='p'||event.key==='Escape'){event.preventDefault();togglePause();}});
function togglePause(){if(!game||game.completed)return;paused=!paused;document.getElementById('pause').textContent=paused?'Reprendre':'Pause';statusElement.textContent=paused?'Partie en pause.':'Partie reprise.';}
document.querySelectorAll('[data-dir]').forEach(button=>{button.addEventListener('pointerdown',event=>{event.preventDefault();setDirection(button.dataset.dir);});});
document.getElementById('start').onclick=startGame;document.getElementById('replay').onclick=startGame;document.getElementById('pause').onclick=togglePause;canvas.addEventListener('pointerdown',event=>{const rect=canvas.getBoundingClientRect(),x=event.clientX-rect.left-rect.width/2,y=event.clientY-rect.top-rect.height/2;setDirection(Math.abs(x)>Math.abs(y)?x<0?'left':'right':y<0?'up':'down');});
window.GloutonTestAPI={diagnostics(){const sample=createLevel(1,'diagnostic');const open=sample.maze.flat().filter(cell=>cell===0).length,runner={x:sample.spawn.x,y:sample.spawn.y,dir:'right'};game=sample;const available=Object.keys(directions).find(direction=>canTurn(runner,direction));if(available)moveEntity(runner,available,4.7,.2);return{connected:reachableCount(sample.maze,sample.spawn)===open,formats:Object.keys(formats),ghostBehaviors:new Set(sample.ghosts.map(ghost=>ghost.kind)).size,powerSources:sample.powers.size,movement:Math.hypot(runner.x-sample.spawn.x,runner.y-sample.spawn.y)>.2,startable:typeof startGame==='function',canvas:canvas.width===720&&canvas.height===720};}};
try{localStorage.setItem('game-hub:last-game','labyrinthe-glouton');}catch{}
game=createLevel(1,'preview');updateHud();draw();frame=requestAnimationFrame(loop);
