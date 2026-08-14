import('../../../shared/options-help.js?v=3');

const playersSelect=document.getElementById('players'),openingMinimum=document.getElementById('openingMinimum'),jokersOption=document.getElementById('jokers'),playersView=document.getElementById('playersView'),groupsElement=document.getElementById('groups'),stockButton=document.getElementById('stock'),discardButton=document.getElementById('discard'),handElement=document.getElementById('hand'),statusElement=document.getElementById('status'),selectionOrder=document.getElementById('selectionOrder'),layButton=document.getElementById('lay'),addButton=document.getElementById('addToGroup'),discardSelectedButton=document.getElementById('discardSelected'),cancelTurnButton=document.getElementById('cancelTurn'),sortButton=document.getElementById('sortHand');
const suits=[{symbol:'♠',color:'black'},{symbol:'♥',color:'red'},{symbol:'♦',color:'red'},{symbol:'♣',color:'black'}];
let game,timer,sortMode='value',autosave,lanRummyState=null,lanRummySeatOrder=[],lanRummyNames=[],lanRummyPending=false;

function shuffle(values){for(let index=values.length-1;index>0;index-=1){const target=Math.floor(Math.random()*(index+1));[values[index],values[target]]=[values[target],values[index]]}return values}
function clone(value){return structuredClone(value)}
function turnSnapshot(){const snapshot=clone(game);snapshot.turnSnapshot=null;return snapshot}
function name(index){return index===0?'Vous':`Bot ${index}`}
function makeDeck(playerCount){const copies=playerCount>2?2:1;const cards=[];for(let copy=0;copy<copies;copy+=1)suits.forEach((suit,suitIndex)=>{for(let value=1;value<=13;value+=1)cards.push({id:`${copy}-${suitIndex}-${value}`,suit:suitIndex,value})});if(jokersOption.checked)for(let index=0;index<copies*2;index+=1)cards.push({id:`joker-${index}`,joker:true,value:0});return shuffle(cards)}
function label(card){if(card.joker)return'★';return card.value===1?'A':card.value===11?'V':card.value===12?'D':card.value===13?'R':String(card.value)}
function points(card){return card.joker?0:Math.min(card.value,10)}
function cardMarkup(card,index=null,selected=false){const suit=card.joker?'':suits[card.suit].symbol;return `<button class="card ${card.joker?'joker':suits[card.suit].color}${selected?' selected':''}"${index===null?' disabled':` data-card="${index}"`}><span>${label(card)} ${suit}</span><strong>${card.joker?'JOKER':suit}</strong></button>`}
function validSet(cards){const normal=cards.filter(card=>!card.joker);return cards.length>=3&&cards.length<=4&&normal.every(card=>card.value===normal[0]?.value)&&new Set(normal.map(card=>card.suit)).size===normal.length}
function validRun(cards){if(cards.length<3)return false;const normal=cards.filter(card=>!card.joker);if(!normal.length)return false;if(new Set(normal.map(card=>card.suit)).size!==1)return false;const values=normal.map(card=>card.value).sort((left,right)=>left-right);if(new Set(values).size!==values.length)return false;const highest=values[values.length-1];const missing=highest-values[0]+1-values.length;return missing<=cards.length-normal.length&&highest-values[0]<cards.length}
function validGroup(cards){return validSet(cards)||validRun(cards)}
function selectedCards(){return game.selection.map(index=>game.people[0].hand[index]).filter(Boolean)}
function removeSelection(){const cards=selectedCards();game.selection.slice().sort((left,right)=>right-left).forEach(index=>game.people[0].hand.splice(index,1));game.selection=[];return cards}
function log(message){game.log.unshift(message);game.log=game.log.slice(0,8)}
function recycle(){if(game.stock.length||game.discard.length<2)return;const top=game.discard.pop();game.stock=shuffle(game.discard.splice(0));game.discard=[top]}
function draw(player,source='stock'){if(game.phase!=='draw'||game.turn!==player||game.over)return false;let card;if(source==='discard'&&game.discard.length)card=game.discard.pop();else{recycle();card=game.stock.pop()}if(!card)return false;game.people[player].hand.push(card);game.phase='play';if(player===0)statusElement.textContent='Composez plusieurs groupes si vous le souhaitez, puis défaussez une carte.';return true}
function openingAllowed(player,cards){return player.opened||cards.reduce((sum,card)=>sum+points(card),0)>=Number(openingMinimum.value)}
function laySelection(){if(game.turn!==0||game.phase!=='play')return;const cards=selectedCards();if(!validGroup(cards)){statusElement.textContent='La sélection doit former un groupe ou une suite d’au moins trois cartes.';return}const player=game.people[0];if(!openingAllowed(player,cards)){statusElement.textContent=`Votre première pose doit valoir au moins ${openingMinimum.value} points.`;return}removeSelection();game.groups.push(cards);player.opened=true;log(`Vous posez un groupe de ${cards.length} cartes.`);if(!player.hand.length)return win(0);render()}
function addToSelectedGroup(){if(game.turn!==0||game.phase!=='play'||game.selectedGroup===null)return;const cards=selectedCards(),combined=[...game.groups[game.selectedGroup],...cards];if(!cards.length||!game.people[0].opened||!validGroup(combined)){statusElement.textContent='Cet ajout ne conserve pas un groupe valide, ou vous n’avez pas encore ouvert.';return}removeSelection();game.groups[game.selectedGroup]=combined;log(`Vous complétez le groupe ${game.selectedGroup+1}.`);if(!game.people[0].hand.length)return win(0);render()}
function discardSelected(){if(game.turn!==0||game.phase!=='play'||game.selection.length!==1)return;const [card]=removeSelection();game.discard.push(card);log(`Vous défaussez ${label(card)}.`);if(!game.people[0].hand.length)return win(0);nextTurn()}
function chooseCombinations(hand,size,start=0,prefix=[],result=[]){if(prefix.length===size){result.push(prefix.slice());return result}for(let index=start;index<hand.length;index+=1)chooseCombinations(hand,size,index+1,[...prefix,index],result);return result}
function bestMeld(player){for(let size=Math.min(5,player.hand.length);size>=3;size-=1){const found=chooseCombinations(player.hand,size).find(indexes=>{const cards=indexes.map(index=>player.hand[index]);return validGroup(cards)&&openingAllowed(player,cards)});if(found)return found}return null}
function botTurn(){if(game.turn===0||game.over)return;const player=game.people[game.turn];draw(game.turn,'stock');let meld=bestMeld(player);while(meld){const cards=meld.slice().sort((left,right)=>right-left).map(index=>player.hand.splice(index,1)[0]).reverse();game.groups.push(cards);player.opened=true;log(`${name(game.turn)} pose ${cards.length} cartes.`);meld=bestMeld(player)}if(player.opened){for(let handIndex=player.hand.length-1;handIndex>=0;handIndex-=1){const groupIndex=game.groups.findIndex(group=>validGroup([...group,player.hand[handIndex]]));if(groupIndex<0)continue;game.groups[groupIndex].push(player.hand.splice(handIndex,1)[0]);log(`${name(game.turn)} complète un groupe.`)}}if(!player.hand.length)return win(game.turn);player.hand.sort((left,right)=>points(right)-points(left));game.discard.push(player.hand.shift());nextTurn()}
function nextTurn(){game.selection=[];game.selectedGroup=null;game.turn=(game.turn+1)%game.people.length;game.phase='draw';game.turnSnapshot=turnSnapshot();statusElement.textContent=game.turn===0?'À vous : piochez dans le paquet ou la défausse.':`${name(game.turn)} réfléchit.`;render();clearTimeout(timer);if(game.turn)timer=setTimeout(botTurn,500+Math.random()*650)}
function win(player){game.over=true;clearTimeout(timer);statusElement.textContent=`${name(player)} pose sa dernière carte et gagne !`;window.GameRecords?.finish({won:player===0});render()}
function cancelTurn(){if(game.turn!==0||!game.turnSnapshot)return;game=clone(game.turnSnapshot);statusElement.textContent='Votre tour a été restauré.';render()}
function render(){
  playersView.innerHTML=game.people.map((player,index)=>`<article class="player${index===game.turn&&!game.over?' active':''}"><strong>${name(index)}</strong><br><small>${player.hand.length} cartes · ${player.opened?'ouvert':'non ouvert'}</small></article>`).join('');
  groupsElement.innerHTML=game.groups.length?game.groups.map((group,index)=>`<div class="group${index===game.selectedGroup?' selected':''}" data-group="${index}">${group.map(card=>cardMarkup(card)).join('')}</div>`).join(''):'<span class="muted">Aucun groupe posé.</span>';
  groupsElement.querySelectorAll('[data-group]').forEach(group=>group.onclick=()=>{game.selectedGroup=Number(group.dataset.group);render()});
  const indexed=game.people[0].hand.map((card,index)=>({card,index}));
  if(sortMode==='value')indexed.sort((left,right)=>left.card.joker-right.card.joker||left.card.value-right.card.value||left.card.suit-right.card.suit);
  if(sortMode==='suit')indexed.sort((left,right)=>left.card.joker-right.card.joker||left.card.suit-right.card.suit||left.card.value-right.card.value);
  handElement.innerHTML=indexed.map(({card,index})=>cardMarkup(card,index,game.selection.includes(index))).join('');
  handElement.querySelectorAll('[data-card]').forEach(button=>button.onclick=()=>{const index=Number(button.dataset.card),position=game.selection.indexOf(index);if(position>=0)game.selection.splice(position,1);else game.selection.push(index);render()});
  selectionOrder.textContent=game.selection.length?`Ordre de sélection : ${selectedCards().map(card=>`${label(card)}${card.joker?'':suits[card.suit].symbol}`).join(' → ')}`:'Aucune carte sélectionnée.';
  stockButton.textContent=`PIOCHE ${game.stock.length}`;
  const top=game.discard[game.discard.length-1];
  discardButton.textContent=top?`${label(top)} ${top.joker?'':suits[top.suit].symbol}`:'—';
  stockButton.disabled=game.turn!==0||game.phase!=='draw'||game.over;
  discardButton.disabled=game.turn!==0||game.phase!=='draw'||game.over||!game.discard.length;
  layButton.disabled=game.turn!==0||game.phase!=='play'||game.selection.length<3;
  addButton.disabled=game.turn!==0||game.phase!=='play'||!game.selection.length||game.selectedGroup===null;
  discardSelectedButton.disabled=game.turn!==0||game.phase!=='play'||game.selection.length!==1;
  cancelTurnButton.disabled=game.turn!==0||!game.turnSnapshot;
  sortButton.textContent=sortMode==='value'?'Trier par couleur':sortMode==='suit'?'Ordre de pioche':'Trier par valeur';
  document.getElementById('log').innerHTML=game.log.map(entry=>`<li>${entry}</li>`).join('');
}
function start(){clearTimeout(timer);const count=Number(playersSelect.value),stock=makeDeck(count);game={stock,discard:[],groups:[],people:Array.from({length:count},()=>({hand:[],opened:false})),turn:0,phase:'draw',selection:[],selectedGroup:null,turnSnapshot:null,log:[],over:false};for(let card=0;card<10;card+=1)game.people.forEach(player=>player.hand.push(game.stock.pop()));game.discard.push(game.stock.pop());game.turnSnapshot=turnSnapshot();statusElement.textContent='À vous : piochez dans le paquet ou la défausse.';render();autosave?.save()}

window.RamiCartesTestAPI=Object.freeze({diagnostics:()=>{
  const set=[{suit:0,value:8},{suit:1,value:8},{suit:2,value:8}];
  const run=[{suit:0,value:4},{joker:true},{suit:0,value:6}];
  const duplicate=[{suit:0,value:8},{suit:0,value:8},{suit:2,value:8}];
  return{oneDeck:makeDeck(2).length,twoDecks:makeDeck(4).length,setValid:validGroup(set),jokerRunValid:validGroup(run),duplicateSuitRejected:!validGroup(duplicate)};
}});

stockButton.onclick=()=>{if(draw(0,'stock'))render()};discardButton.onclick=()=>{if(draw(0,'discard'))render()};layButton.onclick=laySelection;addButton.onclick=addToSelectedGroup;discardSelectedButton.onclick=discardSelected;cancelTurnButton.onclick=cancelTurn;sortButton.onclick=()=>{sortMode=sortMode==='value'?'suit':sortMode==='suit'?'draw':'value';render()};document.getElementById('newGame').onclick=start;playersSelect.onchange=start;openingMinimum.onchange=start;jokersOption.onchange=start;localStorage.setItem('game-hub:last-game','rami-cartes');autosave=window.GameRuntime?.createAutosave('partie',{capture:()=>game,validate:value=>Array.isArray(value?.stock)&&Array.isArray(value?.people),restore:value=>{game=value;render();if(game.turn&&!game.over)timer=setTimeout(botTurn,500)}});if(!autosave?.restore())start();

const localRummyName=name;
function sendRummyAction(action){if(!window.LanMultiplayer?.active||lanRummyPending)return;lanRummyPending=true;window.LanMultiplayer.sendPrivateAction(action).catch(error=>{statusElement.textContent=`Action refusée : ${error.message}`}).finally(()=>{lanRummyPending=false})}
function selectedRummyIds(){return game.selection.map(index=>game.people[0].hand[index]?.id).filter(Boolean)}
function applyLanRummyState(room){const snapshot=room?.gameState;if(!snapshot||snapshot.yourSeat===null||snapshot.yourSeat===undefined){if(room?.phase==='lobby')lanRummyState=null;return}lanRummyState=snapshot;lanRummyPending=false;lanRummySeatOrder=[snapshot.yourSeat,...snapshot.handCounts.map((_,index)=>index).filter(index=>index!==snapshot.yourSeat)];lanRummyNames=lanRummySeatOrder.map((seat,index)=>room.seats?.[seat]?.label||(index?'Adversaire':'Vous'));game={stock:Array.from({length:snapshot.stockCount},()=>null),discard:snapshot.discardTop?[snapshot.discardTop]:[],groups:snapshot.groups.map(group=>group.map(card=>({...card}))),people:lanRummySeatOrder.map((seat,index)=>({hand:index===0?snapshot.hand.map(card=>({...card})):Array.from({length:snapshot.handCounts[seat]},()=>({id:'hidden',suit:0,value:0})),opened:snapshot.opened[seat]})),turn:lanRummySeatOrder.indexOf(snapshot.turn),phase:snapshot.phase,selection:[],selectedGroup:null,turnSnapshot:{},log:[snapshot.message],over:snapshot.over};openingMinimum.value=String(snapshot.openingMinimum);if(snapshot.over)statusElement.textContent=snapshot.winner===snapshot.yourSeat?'Vous remportez la partie LAN !':`${room.seats?.[snapshot.winner]?.label||'Un adversaire'} remporte la partie.`;else if(snapshot.turn===snapshot.yourSeat)statusElement.textContent=snapshot.phase==='draw'?'À vous : piochez dans le paquet ou la défausse.':'Posez vos groupes puis défaussez une carte.';else statusElement.textContent=snapshot.message;render()}
name=function lanAwareRummyName(index){return lanRummyState?(lanRummyNames[index]||`Joueur ${index+1}`):localRummyName(index)};
stockButton.onclick=()=>{if(!lanRummyState){if(draw(0,'stock'))render();return}if(lanRummyState.turn===lanRummyState.yourSeat&&lanRummyState.phase==='draw')sendRummyAction({type:'draw',source:'stock'})};
discardButton.onclick=()=>{if(!lanRummyState){if(draw(0,'discard'))render();return}if(lanRummyState.turn===lanRummyState.yourSeat&&lanRummyState.phase==='draw')sendRummyAction({type:'draw',source:'discard'})};
layButton.onclick=()=>{if(!lanRummyState){laySelection();return}const cardIds=selectedRummyIds();if(cardIds.length>=3)sendRummyAction({type:'lay',cardIds})};
addButton.onclick=()=>{if(!lanRummyState){addToSelectedGroup();return}const cardIds=selectedRummyIds();if(cardIds.length&&game.selectedGroup!==null)sendRummyAction({type:'add',group:game.selectedGroup,cardIds})};
discardSelectedButton.onclick=()=>{if(!lanRummyState){discardSelected();return}const cardIds=selectedRummyIds();if(cardIds.length===1)sendRummyAction({type:'discard',cardId:cardIds[0]})};
cancelTurnButton.onclick=()=>{if(!lanRummyState){cancelTurn();return}sendRummyAction({type:'undo'})};
window.addEventListener('lan:room',event=>applyLanRummyState(event.detail?.room));
window.addEventListener('lan:left',()=>{lanRummyState=null;lanRummySeatOrder=[];lanRummyNames=[];start()});
