const state = {
  screen:'base', stamina:118, coins:125360, gems:1280, partnerPose:0,
  quest:{kills:0,crystals:0}, clearedNodes:new Set(), playerNode:1, nextNode:1, pendingBattleNode:null, pendingBattleKills:0,
  party:[
    {name:'夜嵐',img:'assets/char1.png',hp:1842,maxHp:1842,rage:40,role:'刃',skills:['斷流','追擊']},
    {name:'凌川',img:'assets/char2.png',hp:1620,maxHp:1620,rage:100,role:'療',skills:['急救','脈衝治療']},
    {name:'祁曜',img:'assets/char3.png',hp:1903,maxHp:1903,rage:65,role:'盾',skills:['壓制','掩護']}
  ], active:0, enemyHp:2400, enemyMaxHp:2400, turn:1,
  characterCards:[
    {id:'police',rarity:'SR',name:'陸承安',job:'警察',img:'assets/card_police.png'},
    {id:'doctor',rarity:'SR',name:'黎昀',job:'醫生',img:'assets/card_doctor.png'},
    {id:'firefighter',rarity:'SR',name:'周凱',job:'消防員',img:'assets/card_firefighter.png'}
  ],
  cards:['police','doctor','firefighter']
};
const screens=[...document.querySelectorAll('.screen')];
const $=s=>document.querySelector(s);
const NODE_POS_KEY='urbanDungeonNodePositionsV2';
let nodeEditMode=false;
function loadNodePositions(){
  let saved=null;
  try{saved=JSON.parse(localStorage.getItem(NODE_POS_KEY)||'null')}catch(_){}
  if(!saved)return;
  document.querySelectorAll('.node').forEach(node=>{
    const p=saved[node.dataset.node];
    if(!p)return;
    node.style.left=`${p.x}%`;
    node.style.top=`${p.y}%`;
    if(node.classList.contains('n10')) node.style.right='auto';
  });
}
function saveNodePositions(){
  const map=$('#map-nodes');
  if(!map)return;
  const rect=map.getBoundingClientRect();
  const out={};
  document.querySelectorAll('.node').forEach(node=>{
    const r=node.getBoundingClientRect();
    out[node.dataset.node]={x:+(((r.left+r.width/2-rect.left)/rect.width)*100).toFixed(2),y:+(((r.top+r.height/2-rect.top)/rect.height)*100).toFixed(2)};
  });
  localStorage.setItem(NODE_POS_KEY,JSON.stringify(out));
}
function setNodeEditMode(on){
  nodeEditMode=on;
  $('#dungeon-screen')?.classList.toggle('node-editing',on);
  const toggle=$('#node-edit-toggle');
  const reset=$('#node-edit-reset');
  if(toggle){toggle.classList.toggle('active',on);toggle.textContent=on?'完成調整':'調整節點'}
  reset?.classList.toggle('hidden',!on);
  renderDungeon();
}
function resetNodePositions(){
  localStorage.removeItem(NODE_POS_KEY);
  document.querySelectorAll('.node').forEach(node=>{node.style.left='';node.style.top='';node.style.right='' });
  toast('節點位置已重設');
}
function initNodeEditor(){
  loadNodePositions();
  $('#node-edit-toggle')?.addEventListener('click',e=>{e.stopPropagation();setNodeEditMode(!nodeEditMode)});
  $('#node-edit-reset')?.addEventListener('click',e=>{e.stopPropagation();resetNodePositions()});
  const map=$('#map-nodes');
  if(!map)return;
  let drag=null;
  map.addEventListener('pointerdown',e=>{
    if(!nodeEditMode)return;
    const node=e.target.closest('.node');
    if(!node)return;
    e.preventDefault();e.stopPropagation();
    const rect=map.getBoundingClientRect();
    drag={node,rect,pointerId:e.pointerId};
    node.classList.add('dragging');
    node.setPointerCapture?.(e.pointerId);
  });
  map.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.pointerId)return;
    e.preventDefault();
    let x=((e.clientX-drag.rect.left)/drag.rect.width)*100;
    let y=((e.clientY-drag.rect.top)/drag.rect.height)*100;
    x=Math.max(4,Math.min(96,x));y=Math.max(4,Math.min(96,y));
    drag.node.style.left=`${x}%`;drag.node.style.top=`${y}%`;drag.node.style.right='auto';
  });
  const end=e=>{
    if(!drag||e.pointerId!==drag.pointerId)return;
    drag.node.classList.remove('dragging');
    drag.node.releasePointerCapture?.(e.pointerId);
    saveNodePositions();
    drag=null;
  };
  map.addEventListener('pointerup',end);map.addEventListener('pointercancel',end);
}
function show(name){state.screen=name;screens.forEach(s=>s.classList.toggle('active',s.id===`${name}-screen`)); if(name==='battle') renderBattle(); if(name==='bag') renderBag('items'); if(name==='dungeon') renderDungeon(); sync();}
function sync(){ $('#stamina').textContent=`${state.stamina}/120`; $('#dungeon-stamina').textContent=`${state.stamina}/120`; $('#coins').textContent=state.coins.toLocaleString(); $('#gems').textContent=state.gems.toLocaleString(); $('#quest-kills').textContent=`${state.quest.kills}/3`; $('#quest-crystals').textContent=`${state.quest.crystals}/1`; const progress=$('#dungeon-progress'); if(progress) progress.textContent=`${state.clearedNodes.size}/10`; }
function toast(t){const el=$('#toast');el.textContent=t;el.classList.remove('hidden');setTimeout(()=>el.classList.add('hidden'),1400)}
const partnerPoses=[
  {img:'assets/partner_idle_1.png',line:'今天的巡查，交給我。'},
  {img:'assets/partner_idle_2.png',line:'收到。這一帶我來盯著。'},
  {img:'assets/partner_idle_3.png',line:'走吧，跟緊我。'}
];
partnerPoses.forEach(p=>{const preload=new Image();preload.src=p.img});
let partnerBubbleTimer=0;
let partnerReactTimer=0;
function partnerTalk(button){
  if(!button?.classList.contains('base-partner-card')){toast('我在。');return}
  state.partnerPose=(state.partnerPose+1)%partnerPoses.length;
  const pose=partnerPoses[state.partnerPose];
  const img=$('#base-partner-image');
  const b=$('#partner-bubble');
  img.src=pose.img;
  b.textContent=pose.line;
  b.classList.remove('hidden');
  button.classList.remove('reacting');
  void button.offsetWidth;
  button.classList.add('reacting');
  clearTimeout(partnerReactTimer);
  clearTimeout(partnerBubbleTimer);
  partnerReactTimer=setTimeout(()=>button.classList.remove('reacting'),480);
  partnerBubbleTimer=setTimeout(()=>b.classList.add('hidden'),2000);
}
let revealQueue=[];
let revealIndex=0;
function showGachaReveal(){
  const card=revealQueue[revealIndex];
  if(!card){$('#gacha-reveal')?.classList.add('hidden');return}
  $('#gacha-reveal-card').src=card.img;
  $('#gacha-reveal-card').alt=`${card.rarity} ${card.name}`;
  $('#gacha-reveal-name').textContent=`${card.rarity} · ${card.name}`;
  $('#gacha-reveal-count').textContent=revealQueue.length>1?`${revealIndex+1} / ${revealQueue.length}`:'';
  $('#gacha-reveal').classList.remove('hidden');
}
function nextGachaReveal(){
  if($('#gacha-reveal')?.classList.contains('hidden'))return;
  revealIndex++;
  if(revealIndex>=revealQueue.length){$('#gacha-reveal').classList.add('hidden');toast('招募完成');return}
  showGachaReveal();
}
function pull(count){
  const cost=count===10?1600:160;
  if(state.gems<cost){toast('鑽石不足');return}
  state.gems-=cost;
  revealQueue=[];revealIndex=0;
  for(let i=0;i<count;i++){
    const pick=state.characterCards[Math.floor(Math.random()*state.characterCards.length)];
    revealQueue.push(pick);
    if(!state.cards.includes(pick.id))state.cards.push(pick.id);
  }
  sync();showGachaReveal();
}
function renderDungeon(){
  document.querySelectorAll('.node').forEach(node=>{
    const n=+node.dataset.node;
    node.classList.toggle('cleared',state.clearedNodes.has(n));
    node.classList.toggle('available',n===state.nextNode);
    node.classList.toggle('locked',n!==state.nextNode&&!state.clearedNodes.has(n));
    node.classList.toggle('current-position',n===state.playerNode&&state.clearedNodes.has(n));
    node.disabled=nodeEditMode?false:n!==state.nextNode;
    const symbol=node.querySelector('.node-symbol');
    if(symbol){
      if(n===10) symbol.textContent='BOSS';
      else if(state.clearedNodes.has(n)) symbol.textContent='✓';
      else if(n===state.nextNode) symbol.textContent='⚔';
      else symbol.textContent='?';
    }
    node.querySelector('.player-marker')?.remove();
    if(n===state.playerNode){
      const marker=document.createElement('span');
      marker.className='player-marker';
      marker.setAttribute('aria-label','目前位置');
      node.appendChild(marker);
    }
  });
}
function spendActionPoint(){if(state.stamina<=0){toast('行動點不足');return false}state.stamina--;sync();return true}
function clearNode(n){state.clearedNodes.add(n);state.playerNode=n;state.nextNode=n>=10?11:n+1;renderDungeon();sync()}
function enterNode(n){
  if(n!==state.nextNode){toast(state.clearedNodes.has(n)?'這一格已完成':'請先完成前一格');return}
  if(!spendActionPoint())return;
  state.pendingBattleNode=n;
  state.pendingBattleKills=n===10?3:1;
  state.enemyMaxHp=n===10?5200:2400+Math.max(0,n-1)*140;
  state.enemyHp=state.enemyMaxHp;
  state.turn=1;
  state.active=0;
  state.currentEnemyName=n===10?'裂境守門者':'裂骸獸';
  show('battle');
}

function renderBattle(){const row=$('#party-row');row.innerHTML=state.party.map((p,i)=>`<div class="fighter ${i===state.active?'active':''}"><img src="${p.img}"><div class="name">${p.name}</div><div class="mini-bar"><i style="width:${p.hp/p.maxHp*100}%"></i></div><div class="mini-bar rage"><i style="width:${p.rage}%"></i></div>${p.rage>=100?`<button class="ult-ready" data-ult="${i}">ULT</button>`:''}</div>`).join('');const enemyName=$('.enemy-name');if(enemyName)enemyName.textContent=state.currentEnemyName||'裂骸獸';$('#enemy-hp').textContent=Math.max(0,state.enemyHp);const maxLabel=$('.enemy-hp');if(maxLabel)maxLabel.innerHTML=`<span id="enemy-hp">${Math.max(0,state.enemyHp)}</span>/${state.enemyMaxHp}`;$('#enemy-hp-bar').style.width=`${Math.max(0,state.enemyHp/state.enemyMaxHp*100)}%`;$('#turn-count').textContent=state.turn;document.querySelectorAll('[data-ult]').forEach(b=>b.onclick=()=>ultimate(+b.dataset.ult));}
function damage(amount,txt){state.enemyHp=Math.max(0,state.enemyHp-amount);$('#battle-log').textContent=txt;state.party[state.active].rage=Math.min(100,state.party[state.active].rage+20);renderBattle();if(state.enemyHp<=0){const cleared=state.pendingBattleNode;state.quest.kills=Math.min(3,state.quest.kills+(state.pendingBattleKills||1));if(cleared===6)state.quest.crystals=1;state.pendingBattleNode=null;state.pendingBattleKills=0;if(cleared)clearNode(cleared);setTimeout(()=>{toast('戰鬥勝利');show('dungeon')},700);return}setTimeout(enemyTurn,450)}
function enemyTurn(){const p=state.party[state.active];p.hp=Math.max(1,p.hp-120);state.active=(state.active+1)%state.party.length;state.turn++;$('#battle-log').textContent='敵人反擊';renderBattle()}
function battleAction(type){if(type==='attack')damage(260,'普通攻擊 · 260');if(type==='guard'){state.party[state.active].rage=Math.min(100,state.party[state.active].rage+12);$('#battle-log').textContent='進入防禦';setTimeout(enemyTurn,350)}if(type==='item'){state.party[state.active].hp=Math.min(state.party[state.active].maxHp,state.party[state.active].hp+380);$('#battle-log').textContent='使用急救包 · +380';renderBattle();setTimeout(enemyTurn,350)}if(type==='skill'){const p=state.party[state.active];const m=$('#skill-menu');m.innerHTML=p.skills.map((s,i)=>`<button data-skill="${i}">${s}<small style="float:right;color:#8fa7c4">${i? '強效':'快速'}</small></button>`).join('');m.classList.remove('hidden');m.querySelectorAll('button').forEach(b=>b.onclick=()=>{m.classList.add('hidden');damage(+b.dataset.skill?520:360,`${p.skills[+b.dataset.skill]} · ${+b.dataset.skill?520:360}`)})}}
function ultimate(i){const p=state.party[i];if(p.rage<100)return;const o=$('#ultimate-overlay');$('#ultimate-image').src=p.img;$('#ultimate-title')?.remove?.();o.querySelector('.ultimate-title').textContent=`${p.name} · 覺醒技`;o.classList.remove('hidden');setTimeout(()=>{o.classList.add('hidden');p.rage=0;state.active=i;damage(i===1?720:880,i===1?'脈衝領域 · 720':'終焉斬擊 · 880')},1250)}
function renderBag(tab){
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===tab));
  const c=$('#bag-content');
  if(tab==='items')c.innerHTML=`<div class="inventory-grid"><div class="slot">急救包<br>×6</div><div class="slot">裂晶<br>×${state.quest.crystals}</div><div class="slot">煙霧彈<br>×2</div><div class="slot">空</div><div class="slot">空</div><div class="slot">空</div></div>`;
  if(tab==='cards'){
    const owned=state.cards.map(id=>state.characterCards.find(card=>card.id===id)).filter(Boolean);
    c.innerHTML=`<div class="card-grid card-book-grid">${owned.map(card=>`<button class="card-thumb card-book-card" type="button" data-card-id="${card.id}"><img src="${card.img}" alt="${card.name}"><span>${card.rarity} · ${card.name}</span></button>`).join('')}</div>`;
  }
  if(tab==='journal')c.innerHTML=`<div class="journal-item"><strong>D1 裂境清掃</strong>🐺 ${state.quest.kills}/3<br>◆ ${state.quest.crystals}/1<small>完成後開放 Boss 節點</small></div>`;
  if(tab==='gear')c.innerHTML=`<div class="inventory-grid"><div class="slot">戰術刃<br>+12</div><div class="slot">醫療模組<br>+8</div><div class="slot">防護背心<br>+10</div></div>`;
}

let baseActionLocked=false;
function runBaseAction(button){
  if(baseActionLocked)return;
  const x=button.dataset.action;
  baseActionLocked=true;
  document.querySelectorAll('.base-action.revealing').forEach(el=>el.classList.remove('revealing'));
  button.classList.add('revealing');
  setTimeout(()=>{
    button.classList.remove('revealing');
    if(x==='gacha')show('gacha');
    if(x==='dungeon')show('dungeon');
    if(x==='shop')toast('商店放第二階段');
    if(x==='guild')toast('協會放第二階段');
    if(x==='medical')toast('醫療放第二階段');
    if(x==='mission')toast('任務中心放第二階段');
    baseActionLocked=false;
  },650);
}
document.addEventListener('click',e=>{if(e.target.closest('[data-gacha-next]')){nextGachaReveal();return}const a=e.target.closest('[data-action]');if(a){const x=a.dataset.action;if(a.classList.contains('base-action')){runBaseAction(a)}else{if(['base','gacha','dungeon','bag'].includes(x))show(x);if(x==='partner')partnerTalk(a);if(x==='pull1')pull(1);if(x==='pull10')pull(10);if(x==='shop')toast('商店放第二階段');if(x==='guild')toast('協會放第二階段');if(x==='medical')toast('醫療放第二階段');if(x==='mission')toast('任務中心放第二階段');if(x==='settings')toast('設定');}}const node=e.target.closest('[data-node]');if(node&&!nodeEditMode)enterNode(+node.dataset.node);const b=e.target.closest('[data-battle]');if(b)battleAction(b.dataset.battle);const tab=e.target.closest('[data-tab]');if(tab)renderBag(tab.dataset.tab);const card=e.target.closest('[data-card-id]');if(card){const found=state.characterCards.find(x=>x.id===card.dataset.cardId);if(found)toast(`${found.rarity} · ${found.name} · ${found.job}`)}});
initNodeEditor();
if('serviceWorker' in navigator && (location.protocol==='http:' || location.protocol==='https:')) navigator.serviceWorker.register('sw.js').catch(()=>{});renderDungeon();sync();