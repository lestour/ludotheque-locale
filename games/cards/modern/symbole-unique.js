const status = document.getElementById('status');
document.title = 'Symbole Unique';
document.querySelector('h1').textContent = 'Symbole Unique';
document.querySelector('[value="tower"]').textContent = 'Pile conquérante';
document.querySelector('[value="well"]').textContent = 'Défausse centrale';
document.querySelector('[value="gift"]').textContent = 'Transfert';
document.querySelector('[value="potato"]').textContent = 'Relais';
const opponentSelect = document.getElementById('opponent');
const newGameButton = document.getElementById('newGame');
const startButton = document.getElementById('startButton');
const gameMode = document.getElementById('gameMode');
const cardsBoard = document.getElementById('cardsBoard');
const scores = document.querySelector('.scores');
const toolbar = document.querySelector('.toolbar');
const symbols = ['🍎','🐱','🚗','⭐','🎈','⚽','🌈','🐝','🍕','🚀','🎲','🎸','🌻','🐙','👑','🦊','🍀','🎯','🐬','🍩','🦄','🎁','🦋','🌙','🍉','🧩','🎨','🐸','🍪','🛸','🦖'];
const botProfiles = { easy:[2600,6100], normal:[1600,4300], hard:[800,2600] };
let game;
let botTimer = null;
const stackOffsetX = .16;
const stackOffsetY = .72;
const transferDuration = 680;

opponentSelect.closest('label').insertAdjacentHTML('afterend','<label class="muted">Joueurs <select id="playerCount"><option value="2">2</option><option value="3">3</option><option value="4">4</option></select></label>');
const playerCount = document.getElementById('playerCount');
document.head.insertAdjacentHTML('beforeend','<style>.cards.multi{position:relative;display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:28px;align-items:start}.cards.multi .center-area{grid-column:1/-1;grid-row:1;justify-self:center;border:0}.cards.multi .player-area{position:relative}.center-pile .card>span{position:absolute;line-height:1;transform:translate(-50%,-50%) rotate(var(--angle))}.round-stack{background:transparent!important}.pile-layer,.center-pile .card.back,.card-animation .back{background:radial-gradient(circle at 50% 50%,#fff 0 7%,#f59e0b 8% 10%,transparent 11%),repeating-conic-gradient(#efab24 0 12deg,#fef3c7 12deg 24deg)!important}.pile-layer{border-color:#c2410c!important}.center-pile .pile-layer.next-card{background:#fff!important}</style>');

function shuffled(values){return CardTools.shuffle(values)}
function createLayout(list){const placed=[];return list.map((symbol,index)=>{const size=33+index*5+Math.random()*3;let layout;for(let attempt=0;attempt<300;attempt+=1){const angle=Math.random()*Math.PI*2;const distance=Math.sqrt(Math.random())*(39-size/5.5);const candidate={x:50+Math.cos(angle)*distance,y:50+Math.sin(angle)*distance,size,angle:-30+Math.random()*60};if(placed.every(previous=>Math.hypot(candidate.x-previous.x,candidate.y-previous.y)>(candidate.size+previous.size)/5.1+3)){layout=candidate;break}}layout||={x:50+Math.cos(index*Math.PI/3)*27,y:50+Math.sin(index*Math.PI/3)*27,size,angle:-20+Math.random()*40};placed.push(layout);return[symbol,layout]})}
function createCard(list){return{symbols:list,layout:new Map(createLayout(shuffled(list)))}}
function buildDeck(){const order=5,point=(x,y)=>x*order+y,infinity=slope=>25+slope,vertical=30,deck=[];for(let slope=0;slope<order;slope+=1)for(let intercept=0;intercept<order;intercept+=1)deck.push([...Array(order)].map((_,x)=>point(x,(slope*x+intercept)%order)).concat(infinity(slope)));for(let x=0;x<order;x+=1)deck.push([...Array(order)].map((_,y)=>point(x,y)).concat(vertical));deck.push([...Array(order)].map((_,slope)=>infinity(slope)).concat(vertical));return shuffled(deck.map(card=>createCard(card.map(index=>symbols[index]))))}
function validateUniqueSymbolDeck(deck){for(let left=0;left<deck.length;left+=1)for(let right=left+1;right<deck.length;right+=1)if(deck[left].symbols.filter(symbol=>deck[right].symbols.includes(symbol)).length!==1)return false;return true}
function clearBot(){if(botTimer!==null)clearTimeout(botTimer);botTimer=null}
function isWell(){return game.mode==='well'}
function isPotato(){return game.mode==='potato'}
function isGift(){return game.mode==='gift'}
function topCard(){return game.centerPile.at(-1)}
function storage(player){return isWell()?game.playerPiles[player]:game.hands[player]}
function total(player){return storage(player).length+(game.playerCards[player]?1:0)}
function playerName(player){return player===0?'Vous':`Bot ${player}`}
function cardPreview(card){return card?card.symbols.map(symbol=>{const layout=card.layout.get(symbol);return`<span style="left:${layout.x}%;top:${layout.y}%;font-size:${layout.size}px;--angle:${layout.angle}deg">${symbol}</span>`}).join(''):''}
function common(first,second){return first?.symbols.find(symbol=>second?.symbols.includes(symbol))}
function comparedCard(player,target=null){if(isPotato())return game.playerCards[target??((player+1)%game.players)];return topCard()}

function animateTransfers(transfers,{onStart,onArrival,onFinish}){
  const prepared=transfers.filter(transfer=>transfer.from&&transfer.to&&transfer.card).map((transfer,index)=>{
    const start=transfer.from.getBoundingClientRect(),target=transfer.to.getBoundingClientRect(),deltaX=transfer.deltaX||0,deltaY=transfer.deltaY||0,ghost=document.createElement('div');
    const endLeft=target.left+deltaX,endTop=target.top+deltaY;
    ghost.className='card-animation';
    ghost.innerHTML=`<div class="flip-inner flip-horizontal revealed"><div class="face back"></div><div class="face front">${cardPreview(transfer.card)}</div></div>`;
    ghost.style.left=`${start.left}px`;
    ghost.style.top=`${start.top}px`;
    ghost.style.transform='translate(0,0) rotate(0deg)';
    document.body.append(ghost);
    return{ghost,translateX:endLeft-start.left,translateY:endTop-start.top,rotation:index%2?'-6deg':'6deg'};
  });
  onStart?.();
  render();
  requestAnimationFrame(()=>requestAnimationFrame(()=>prepared.forEach(item=>{item.ghost.style.transform=`translate(${item.translateX}px,${item.translateY}px) rotate(${item.rotation})`})));
  window.setTimeout(()=>{onArrival?.();render()},transferDuration-115);
  window.setTimeout(()=>{prepared.forEach(item=>item.ghost.remove());onFinish?.()},transferDuration+20);
}
function revealCenter(){if(game.started||game.over)return;game.started=true;status.textContent=isPotato()?'Cliquez le symbole commun sur la carte d’un adversaire.':'Trouvez l’unique symbole commun avec la pile centrale.';render();scheduleBot()}
function finish(winner=null){game.over=true;clearBot();if(winner===null){const ranking=[...Array(game.players)].map((_,player)=>({player,total:total(player)})).sort((a,b)=>b.total-a.total);winner=ranking[0].total===ranking[1]?.total?null:ranking[0].player}status.textContent=winner===null?'Égalité !':`${playerName(winner)} gagne !`;window.GameRecords?.finish({won:winner===0});render()}

function claimTower(player){
  const central=topCard(),old=game.playerCards[player],recipient=isGift()?(player+1)%game.players:player;
  const center=document.getElementById('cardCenter'),active=document.querySelector(`[data-player="${player}"]>.card`),recipientActive=document.querySelector(`[data-player="${recipient}"]>.card`);
  const activeDelta=recipient===player?{deltaX:stackOffsetX,deltaY:stackOffsetY}:{deltaX:0,deltaY:0};
  game.transitioning=true;
  animateTransfers([{from:center,to:active,card:central,...activeDelta},{from:active,to:recipientActive,card:old,deltaX:stackOffsetX,deltaY:stackOffsetY}],{
    onStart(){game.centerPile.pop();game.playerCards[player]=null;status.textContent=`${playerName(player)} récupère la carte…`},
    onArrival(){if(old)game.hands[recipient].push(old);game.playerCards[player]=central;game.lastFinder=player},
    onFinish(){game.transitioning=false;if(!game.centerPile.length)finish();else{status.textContent=`${playerName(player)} récupère la carte. Nouvelle carte centrale.`;render();scheduleBot()}}
  });
}
function claimWell(player){
  const active=game.playerCards[player],source=document.querySelector(`[data-player="${player}"]>.card`),center=document.getElementById('cardCenter');
  game.transitioning=true;
  animateTransfers([{from:source,to:center,card:active,deltaX:stackOffsetX,deltaY:stackOffsetY}],{
    onStart(){game.playerCards[player]=null;status.textContent=`${playerName(player)} pose sa carte…`},
    onArrival(){game.centerPile.push(active);game.playerCards[player]=game.playerPiles[player].pop()||null},
    onFinish(){game.transitioning=false;if(!game.playerCards[player]&&!game.playerPiles[player].length)finish(player);else{status.textContent=`${playerName(player)} pose sa carte dans le Puits.`;render();scheduleBot()}}
  });
}
function claimPotato(player,target){
  const left=game.playerCards[player],right=game.playerCards[target],leftElement=document.querySelector(`[data-player="${player}"]>.card`),rightElement=document.querySelector(`[data-player="${target}"]>.card`);
  game.transitioning=true;
  animateTransfers([{from:leftElement,to:rightElement,card:left},{from:rightElement,to:leftElement,card:right}],{
    onStart(){game.playerCards[player]=null;game.playerCards[target]=null;status.textContent='Échange en cours…'},
    onArrival(){game.playerCards[player]=right;game.playerCards[target]=left;game.exchanges+=1;game.lastFinder=player},
    onFinish(){game.transitioning=false;status.textContent=`${playerName(player)} échange sa carte avec ${playerName(target)}.`;render();scheduleBot()}
  });
}
function claim(player,symbol,target=null){if(game.over||!game.started||game.transitioning)return;const compared=comparedCard(player,target);if(symbol!==common(game.playerCards[player],compared))return;clearBot();if(isPotato())claimPotato(player,target);else if(isWell())claimWell(player);else claimTower(player)}

function scheduleBot() {
  clearBot();
  if (game.over || game.transitioning || !game.started || opponentSelect.value === 'human') return;
  const [minimum, maximum] = botProfiles[opponentSelect.value];
  const bots = [...Array(game.players - 1)].map((_, index) => index + 1);
  const player = bots[Math.floor(Math.random() * bots.length)];
  const target = isPotato() ? (player + 1 + Math.floor(Math.random() * (game.players - 1))) % game.players : null;
  const symbol = common(game.playerCards[player], comparedCard(player, target));
  const familiarity = game.lastFinder === player ? .7 : 1.15;
  botTimer = setTimeout(() => { botTimer = null; claim(player, symbol, target); }, (minimum + Math.random() * (maximum - minimum)) * familiarity);
}
function layerStyle(index){return`transform:translate(${(index*stackOffsetX).toFixed(2)}px,${(index*stackOffsetY).toFixed(2)}px);z-index:${index}`}
function renderCard(card,owner,storedCount){const position=`--active-x:${(storedCount*stackOffsetX).toFixed(2)}px;--active-y:${(storedCount*stackOffsetY).toFixed(2)}px`;if(!card)return`<div class="card empty" style="${position}">${game.transitioning?'En transit…':'Terminé'}</div>`;return`<div class="card" style="${position}">${card.symbols.map(symbol=>{const layout=card.layout.get(symbol);return`<button class="symbol" data-symbol="${symbol}" data-owner="${owner}" style="left:${layout.x}%;top:${layout.y}%;font-size:${layout.size}px;--angle:${layout.angle}deg">${symbol}</button>`}).join('')}</div>`}
function stackMarkup(cards){const height=cards.length?250+Math.max(0,cards.length-1)*stackOffsetY:0;return`<div class="round-stack${cards.length?'':' empty'}" style="--stack-height:${height.toFixed(2)}px">${cards.map((_,index)=>`<div class="pile-layer" style="${layerStyle(index)}"></div>`).join('')}${cards.length?`<strong class="pile-count">${cards.length}</strong>`:''}</div>`}
function centerMarkup(){
  if(isPotato())return'';
  const top=topCard(),count=game.centerPile.length;
  if(!top)return`<section class="center-area"><h2>${isWell()?'Le Puits':'Pile centrale'}</h2><div id="centerPile" class="center-pile empty"></div></section>`;
  const layers=game.centerPile.slice(0,-1).map((card,index,cards)=>{const revealNext=game.started&&index===cards.length-1;return`<div class="pile-layer${revealNext?' next-card':''}" style="${layerStyle(index)}">${revealNext?cardPreview(card):''}</div>`}).join('');
  const topIndex=count-1,topX=(topIndex*stackOffsetX).toFixed(2),topY=(topIndex*stackOffsetY).toFixed(2),height=250+topIndex*stackOffsetY;
  return`<section class="center-area"><h2>${isWell()?'Le Puits':'Pile centrale'}</h2><div id="centerPile" class="center-pile" style="--center-height:${height.toFixed(2)}px"><div class="center-layers">${layers}</div><div id="cardCenter" class="card${game.started?'':' back'}" style="--top-x:${topX}px;--top-y:${topY}px">${game.started?cardPreview(top):'↻'}</div></div></section>`
}
function render(){scores.innerHTML=[...Array(game.players)].map((_,player)=>`<div class="score">${playerName(player)}<strong>${total(player)}</strong></div>`).join('')+`<div class="score">${isPotato()?'Échanges':'Centre'}<strong>${isPotato()?game.exchanges:game.centerPile.length}</strong></div>`;cardsBoard.className=`cards multi${isPotato()?' potato-mode':''}`;cardsBoard.innerHTML=centerMarkup()+[...Array(game.players)].map((_,player)=>{const cards=storage(player);return`<section class="player-area" data-player="${player}"><h2>${playerName(player)}</h2>${renderCard(game.playerCards[player],player,cards.length)}${stackMarkup(cards)}</section>`}).join('');if(!game.started&&!isPotato())document.getElementById('cardCenter')?.addEventListener('click',revealCenter,{once:true});cardsBoard.querySelectorAll('[data-symbol]').forEach(button=>{const owner=Number(button.dataset.owner);const humanAction=isPotato()?owner!==0:owner===0;if(!humanAction||opponentSelect.value!=='human'&&owner!==0)return;button.onclick=()=>claim(isPotato()?0:owner,button.dataset.symbol,isPotato()?owner:null)});startButton.hidden=!isPotato()||game.started;scheduleBot()}
function createGame(){clearBot();const deck=buildDeck(),players=Number(playerCount.value);game={mode:gameMode.value,players,centerPile:[],playerCards:Array(players).fill(null),hands:Array.from({length:players},()=>[]),playerPiles:Array.from({length:players},()=>[]),over:false,transitioning:false,started:false,exchanges:0,lastFinder:null};if(isPotato()){for(let player=0;player<players;player+=1)game.playerCards[player]=deck.pop()}else if(isWell()){game.centerPile.push(deck.pop());deck.forEach((card,index)=>game.playerPiles[index%players].push(card));for(let player=0;player<players;player+=1)game.playerCards[player]=game.playerPiles[player].pop()||null}else{for(let player=0;player<players;player+=1)game.playerCards[player]=deck.pop();game.centerPile=deck}status.textContent='Retournez la carte centrale pour commencer.';render()}

opponentSelect.addEventListener('change',createGame);playerCount.addEventListener('change',createGame);gameMode.addEventListener('change',createGame);newGameButton.addEventListener('click',createGame);startButton.addEventListener('click',revealCenter);localStorage.setItem('game-hub:last-game','symbole-unique');createGame();

window.SymbolUniqueTestAPI=Object.freeze({diagnostics:()=>{const deck=buildDeck();return{cardCount:deck.length,symbolsPerCard:deck.every(card=>card.symbols.length===6),oneCommonSymbol:validateUniqueSymbolDeck(deck)};}});

async function runSymbolDiagnostics(){
  const checks=[],wait=milliseconds=>new Promise(resolve=>window.setTimeout(resolve,milliseconds));
  opponentSelect.value='human';
  gameMode.value='tower';createGame();game.started=true;render();
  const centerCard=document.getElementById('cardCenter'),lastLayer=document.querySelector('#centerPile .pile-layer:last-child'),centerBox=centerCard.getBoundingClientRect(),layerBox=lastLayer.getBoundingClientRect();
  checks.push(Math.abs(centerBox.left-layerBox.left-stackOffsetX)<.6&&Math.abs(centerBox.top-layerBox.top-stackOffsetY)<.6);
  const towerCentral=topCard(),towerOld=game.playerCards[0],towerCenterCount=game.centerPile.length,towerHandCount=game.hands[0].length;
  claimTower(0);
  checks.push(game.centerPile.length===towerCenterCount-1&&game.playerCards[0]===null&&document.querySelectorAll('.card-animation').length===2);
  await wait(590);
  checks.push(game.playerCards[0]===towerCentral&&game.hands[0].at(-1)===towerOld&&game.hands[0].length===towerHandCount+1);
  await wait(130);
  checks.push(!game.transitioning&&!document.querySelector('.card-animation'));

  gameMode.value='gift';createGame();game.started=true;render();
  const giftCentral=topCard(),giftOld=game.playerCards[0],recipientCount=game.hands[1].length;
  claimTower(0);checks.push(game.playerCards[0]===null&&game.hands[1].length===recipientCount);
  await wait(590);checks.push(game.playerCards[0]===giftCentral&&game.hands[1].at(-1)===giftOld);
  await wait(130);

  gameMode.value='well';createGame();game.started=true;render();
  const wellActive=game.playerCards[0],wellCenterCount=game.centerPile.length;
  claimWell(0);checks.push(game.playerCards[0]===null&&game.centerPile.length===wellCenterCount);
  await wait(590);checks.push(game.centerPile.at(-1)===wellActive&&game.playerCards[0]!==null);
  await wait(130);

  gameMode.value='potato';createGame();game.started=true;render();
  const left=game.playerCards[0],right=game.playerCards[1];
  claimPotato(0,1);checks.push(game.playerCards[0]===null&&game.playerCards[1]===null);
  await wait(590);checks.push(game.playerCards[0]===right&&game.playerCards[1]===left);
  await wait(130);checks.push(!game.transitioning&&!document.querySelector('.card-animation'));
  document.title=`SYMBOLE TEST · ${checks.filter(Boolean).length}/${checks.length}`;
}
if(new URLSearchParams(location.search).has('symbolTest'))runSymbolDiagnostics();
