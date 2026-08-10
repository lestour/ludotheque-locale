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

opponentSelect.closest('label').insertAdjacentHTML('afterend','<label class="muted">Joueurs <select id="playerCount"><option value="2">2</option><option value="3">3</option><option value="4">4</option></select></label>');
const playerCount = document.getElementById('playerCount');
document.head.insertAdjacentHTML('beforeend','<style>.cards.multi{position:relative;display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:28px;align-items:start}.cards.multi .center-area{grid-column:1/-1;grid-row:1;justify-self:center;border:0}.cards.multi .player-area{position:relative}.center-pile .card>span{position:absolute;line-height:1;transform:translate(-50%,-50%) rotate(var(--angle))}.round-stack{background:transparent!important}.pile-layer,.center-pile .card.back,.card-animation .back{background:radial-gradient(circle at 50% 50%,#fff 0 7%,#f59e0b 8% 10%,transparent 11%),repeating-conic-gradient(#efab24 0 12deg,#fef3c7 12deg 24deg)!important}.pile-layer{border-color:#c2410c!important}.center-pile .pile-layer.next-card{background:#fff!important}</style>');

function shuffled(values){return CardTools.shuffle(values)}
function createLayout(list){const placed=[];return list.map((symbol,index)=>{const size=33+index*5+Math.random()*3;let layout;for(let attempt=0;attempt<300;attempt+=1){const angle=Math.random()*Math.PI*2;const distance=Math.sqrt(Math.random())*(39-size/5.5);const candidate={x:50+Math.cos(angle)*distance,y:50+Math.sin(angle)*distance,size,angle:-30+Math.random()*60};if(placed.every(previous=>Math.hypot(candidate.x-previous.x,candidate.y-previous.y)>(candidate.size+previous.size)/5.1+3)){layout=candidate;break}}layout||={x:50+Math.cos(index*Math.PI/3)*27,y:50+Math.sin(index*Math.PI/3)*27,size,angle:-20+Math.random()*40};placed.push(layout);return[symbol,layout]})}
function createCard(list){return{symbols:list,layout:new Map(createLayout(shuffled(list)))}}
function buildDeck(){const order=5,point=(x,y)=>x*order+y,infinity=slope=>25+slope,vertical=30,deck=[];for(let slope=0;slope<order;slope+=1)for(let intercept=0;intercept<order;intercept+=1)deck.push([...Array(order)].map((_,x)=>point(x,(slope*x+intercept)%order)).concat(infinity(slope)));for(let x=0;x<order;x+=1)deck.push([...Array(order)].map((_,y)=>point(x,y)).concat(vertical));deck.push([...Array(order)].map((_,slope)=>infinity(slope)).concat(vertical));return shuffled(deck.map(card=>createCard(card.map(index=>symbols[index]))))}
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

function animateCard(from,to,card,callback){if(!from||!to||!card){callback?.();return}const start=from.getBoundingClientRect(),end=to.getBoundingClientRect(),ghost=document.createElement('div');ghost.className='card-animation';ghost.innerHTML=`<div class="flip-inner flip-horizontal revealed"><div class="face back"></div><div class="face front">${cardPreview(card)}</div></div>`;ghost.style.left=`${start.left+start.width/2-125}px`;ghost.style.top=`${start.top+start.height/2-125}px`;document.body.append(ghost);requestAnimationFrame(()=>{ghost.style.transform=`translate(${end.left+end.width/2-start.left-start.width/2}px,${end.top+end.height/2-start.top-start.height/2}px) rotate(8deg)`});setTimeout(()=>{ghost.remove();callback?.()},600)}
function revealCenter(){if(game.started||game.over)return;game.started=true;status.textContent=isPotato()?'Cliquez le symbole commun sur la carte d’un adversaire.':'Trouvez l’unique symbole commun avec la pile centrale.';render();scheduleBot()}
function finish(winner=null){game.over=true;clearBot();if(winner===null){const ranking=[...Array(game.players)].map((_,player)=>({player,total:total(player)})).sort((a,b)=>b.total-a.total);winner=ranking[0].total===ranking[1]?.total?null:ranking[0].player}status.textContent=winner===null?'Égalité !':`${playerName(winner)} gagne !`;render()}

function claimTower(player){const central=topCard(),old=game.playerCards[player],recipient=isGift()?(player+1)%game.players:player;const center=document.getElementById('cardCenter'),active=document.querySelector(`[data-player="${player}"] .card`),stack=document.querySelector(`[data-player="${recipient}"] .round-stack`);game.transitioning=true;animateCard(center,active,central,()=>{game.centerPile.pop();game.hands[recipient].push(old);game.playerCards[player]=central;game.lastFinder=player;game.transitioning=false;if(!game.centerPile.length)finish();else{status.textContent=`${playerName(player)} récupère la carte. Nouvelle carte centrale.`;render();scheduleBot()}});if(old)animateCard(active,stack,old)}
function claimWell(player){const active=game.playerCards[player],next=game.playerPiles[player].pop()||null;game.transitioning=true;animateCard(document.querySelector(`[data-player="${player}"] .card`),document.getElementById('cardCenter'),active,()=>{game.centerPile.push(active);game.playerCards[player]=next;game.transitioning=false;if(!next&&!game.playerPiles[player].length)finish(player);else{status.textContent=`${playerName(player)} pose sa carte dans le Puits.`;render();scheduleBot()}})}
function claimPotato(player,target){const left=game.playerCards[player],right=game.playerCards[target];game.playerCards[player]=right;game.playerCards[target]=left;game.exchanges+=1;game.lastFinder=player;status.textContent=`${playerName(player)} échange sa carte avec ${playerName(target)}.`;render();scheduleBot()}
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
function renderCard(card,owner){if(!card)return'<div class="card empty">Terminé</div>';return`<div class="card">${card.symbols.map(symbol=>{const layout=card.layout.get(symbol);return`<button class="symbol" data-symbol="${symbol}" data-owner="${owner}" style="left:${layout.x}%;top:${layout.y}%;font-size:${layout.size}px;--angle:${layout.angle}deg">${symbol}</button>`}).join('')}</div>`}
function stackMarkup(cards){return`<div class="round-stack${cards.length?'':' empty'}" style="--stack-height:${cards.length?250+cards.length*.72:0}px">${cards.map((_,index)=>`<div class="pile-layer" style="--layer:${index}"></div>`).join('')}${cards.length?`<strong class="pile-count">${cards.length}</strong>`:''}</div>`}
function centerMarkup(){if(isPotato())return'';const top=topCard(),layers=game.centerPile.slice(0,-1).map((_,index)=>`<div class="pile-layer" style="--layer:${index}"></div>`).join('');return`<section class="center-area"><h2>${isWell()?'Le Puits':'Pile centrale'}</h2><div id="centerPile" class="center-pile">${layers}<div id="cardCenter" class="card${game.started?'':' back'}">${game.started?cardPreview(top):'↻'}</div></div></section>`}
function render(){scores.innerHTML=[...Array(game.players)].map((_,player)=>`<div class="score">${playerName(player)}<strong>${total(player)}</strong></div>`).join('')+`<div class="score">${isPotato()?'Échanges':'Centre'}<strong>${isPotato()?game.exchanges:game.centerPile.length}</strong></div>`;cardsBoard.className=`cards multi${isPotato()?' potato-mode':''}`;cardsBoard.innerHTML=centerMarkup()+[...Array(game.players)].map((_,player)=>`<section class="player-area" data-player="${player}"><h2>${playerName(player)}</h2>${renderCard(game.playerCards[player],player)}${stackMarkup(storage(player))}</section>`).join('');if(!game.started&&!isPotato())document.getElementById('cardCenter')?.addEventListener('click',revealCenter,{once:true});cardsBoard.querySelectorAll('[data-symbol]').forEach(button=>{const owner=Number(button.dataset.owner);const humanAction=isPotato()?owner!==0:owner===0;if(!humanAction||opponentSelect.value!=='human'&&owner!==0)return;button.onclick=()=>claim(isPotato()?0:owner,button.dataset.symbol,isPotato()?owner:null)});startButton.hidden=!isPotato()||game.started;scheduleBot()}
function createGame(){clearBot();const deck=buildDeck(),players=Number(playerCount.value);game={mode:gameMode.value,players,centerPile:[],playerCards:Array(players).fill(null),hands:Array.from({length:players},()=>[]),playerPiles:Array.from({length:players},()=>[]),over:false,transitioning:false,started:false,exchanges:0,lastFinder:null};if(isPotato()){for(let player=0;player<players;player+=1)game.playerCards[player]=deck.pop()}else if(isWell()){game.centerPile.push(deck.pop());deck.forEach((card,index)=>game.playerPiles[index%players].push(card));for(let player=0;player<players;player+=1)game.playerCards[player]=game.playerPiles[player].pop()||null}else{for(let player=0;player<players;player+=1)game.playerCards[player]=deck.pop();game.centerPile=deck}status.textContent='Retournez la carte centrale pour commencer.';render()}

opponentSelect.addEventListener('change',createGame);playerCount.addEventListener('change',createGame);gameMode.addEventListener('change',createGame);newGameButton.addEventListener('click',createGame);startButton.addEventListener('click',revealCenter);localStorage.setItem('game-hub:last-game','symbole-unique');createGame();
