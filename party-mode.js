'use strict';

// ── カード定義 ──
const DECK_CARDS = [
  { id: 'safe',   label: 'セーフ',         count: 27, type: 'deck' },
  { id: 'tequila',label: 'テキーラ',        count: 10, type: 'deck' },
  { id: 'kanpai', label: '全員集合！乾杯！', count:  3, type: 'deck' },
];

const ACTION_DEFS = {
  reverse: { id:'reverse', label:'帰宅方向逆です', icon:'↺', effect:'順番を逆回りに',      accent:'--accent-reverse' },
  force:   { id:'force',   label:'とりあえず一杯', icon:'杯', effect:'次の人が強制ドロー',  accent:'--accent-force'   },
  target:  { id:'target',  label:'お前が飲め',     icon:'指', effect:'誰かに引かせる',      accent:'--accent-target'  },
  double:  { id:'double',  label:'倍プッシュだ……！',icon:'倍', effect:'次のテキーラが×2',   accent:'--accent-double'  },
  peek:    { id:'peek',    label:'嫌な予感',        icon:'視', effect:'山札の上を見る',      accent:'--accent-peek'    },
  skip:    { id:'skip',    label:'スキップ',        icon:'飛', effect:'次の人を飛ばす',      accent:'--accent-skip'    },
  dodge:   { id:'dodge',   label:'回避',            icon:'避', effect:'即終了+次被弾者+1',  accent:'--accent-dodge'   },
};

const ACTION_COUNTS = { reverse:4, force:5, target:5, double:4, peek:5, skip:4, dodge:3 };

const CPU_NAMES = ['みるく', 'りん', 'なな', 'ゆい'];
const PLAYER_AVATARS = ['assets/tuzyou.png', 'assets/utagai.png', 'assets/horoyoi.png', 'assets/fuman.png'];

const EVENT_COPY = {
  safe:    { tone:'safe',    kicker:'SAFE',   title:'セーフ',           copy:'息を止めてめくった一枚は、まだ夜を壊さない。' },
  tequila: { tone:'tequila', kicker:'HIT',    title:'テキーラ！',       copy:'卓上の空気が一瞬だけ熱く跳ねる。' },
  kanpai:  { tone:'kanpai',  kicker:'ALL IN', title:'全員集合！乾杯！', copy:'全員が山札へ手を伸ばす。逃げ場はない。' },
  action:  { tone:'action',  kicker:'ACTION', title:'アクション',       copy:'カードが卓上の流れを書き換える。' },
  waiting: { tone:'waiting', kicker:'NEXT DRAW', title:'山札',          copy:'一枚引くまで、運命は伏せられている。' },
};

// ── State ──
let state = null;

function buildDeck() {
  const deck = [];
  for (const c of DECK_CARDS) {
    for (let i = 0; i < c.count; i++) deck.push({ ...c });
  }
  return shuffle(deck);
}

function buildActionPool() {
  const pool = [];
  for (const [id, count] of Object.entries(ACTION_COUNTS)) {
    for (let i = 0; i < count; i++) pool.push({ ...ACTION_DEFS[id] });
  }
  return shuffle(pool);
}

function dealHands(players, pool) {
  for (const p of players) {
    p.hand = [];
    for (let i = 0; i < 4; i++) {
      if (pool.length > 0) p.hand.push(pool.pop());
    }
  }
}

function initState(playerName, cpuCount, maxRounds) {
  const actionPool = buildActionPool();
  const players = [];

  players.push({ id: 'p0', name: playerName || 'あなた', isHuman: true,  drunk: 0, hand: [], skipped: false, _peeked: false });
  for (let i = 0; i < cpuCount; i++) {
    players.push({ id: `cpu${i}`, name: CPU_NAMES[i], isHuman: false, drunk: 0, hand: [], skipped: false, _peeked: false });
  }
  dealHands(players, actionPool);

  return {
    players,
    actionPool,
    deck:           buildDeck(),
    deckDiscard:    [],   // 山札の捨て札（デッキカードのみ）
    actionDiscard:  [],   // アクションカードの捨て札
    turnOrder:      players.map((_, i) => i),
    currentTurnIdx: 0,
    direction:      1,
    round:          1,
    maxRounds,
    turnsTaken:     0,
    // ラウンドカウント: 方向に依存せず、完了ターン数 / 参加人数で算出する
    doublePushActive: false,
    dodgeStack:       0,
    forceDrawTarget:  null,  // 強制ドロー対象のプレイヤーid（boolean ではなく id で管理）
    forcedDrawPending: null, // { sourcePlayerName } — 人間が手動で引く待ち状態
    hasDrawnThisTurn: false,
    lastEvent: EVENT_COPY.waiting,
    // SETUP | PLAYER_TURN | CPU_TURN | RESOLVING | FORCED_DRAW | RESULT
    phase: 'SETUP',
    log:   [],
  };
}

function currentPlayer() {
  return state.players[state.turnOrder[state.currentTurnIdx]];
}

function nextTurnPlayerIdx(offset = 1) {
  const len = state.turnOrder.length;
  return state.turnOrder[((state.currentTurnIdx + state.direction * offset) % len + len) % len];
}

// ── Deck helpers ──
function drawFromDeck() {
  if (state.deck.length === 0) {
    if (state.deckDiscard.length === 0) return null;
    state.deck = shuffle(state.deckDiscard);
    state.deckDiscard = [];
    addLog('山札をシャッフルしました', 'log-card');
  }
  return state.deck.pop();
}

function peekDeck() {
  return state.deck.length > 0 ? state.deck[state.deck.length - 1] : null;
}

function replenishHand(player) {
  if (state.actionPool.length === 0) {
    // プールが空なら捨て札をシャッフルして復活
    if (state.actionDiscard.length === 0) return;
    state.actionPool = shuffle(state.actionDiscard);
    state.actionDiscard = [];
    addLog('アクションカードをシャッフルしました', 'log-card');
  }
  player.hand.push({ ...state.actionPool.pop() });
}

function discardCard(card) {
  if (card.type === 'deck') {
    state.deckDiscard.push(card);
  } else {
    state.actionDiscard.push(card);
  }
}

// ── Log ──
function addLog(msg, cls = '') {
  state.log.push({ msg, cls });
  if (state.log.length > 40) state.log.shift();
}

function setLastEvent(kind, playerName, title = null, copy = null) {
  const base = EVENT_COPY[kind] || EVENT_COPY.action;
  state.lastEvent = {
    ...base,
    title: title || base.title,
    copy: copy || (playerName ? `${playerName} — ${base.copy}` : base.copy),
  };
}

// ── Draw resolution ──
// kanpaiNested: kanpaiの中から再帰的に呼ばれている場合 true（連鎖防止）
function resolveDrawCard(card, player, kanpaiNested = false) {
  if (!card) { addLog(`${player.name}: 山札が空でした`, ''); return; }

  discardCard(card);

  if (card.id === 'safe') {
    addLog(`${player.name} → セーフ ✅`, 'log-safe');
    setLastEvent('safe', player.name);
    showSfx('セーフ！');
    return;
  }

  if (card.id === 'tequila') {
    // dodgeStack + double は最初の被弾者に適用して即クリア
    let gain = 1 + state.dodgeStack;
    if (state.doublePushActive) gain *= 2;
    state.doublePushActive = false;
    state.dodgeStack = 0;
    player.drunk += gain;
    for (let i = 0; i < gain; i++) replenishHand(player);
    const extra = gain > 1 ? ` (+${gain})` : '';
    addLog(`${player.name} → テキーラ！🍺 酔い${extra}`, 'log-tequila');
    setLastEvent('tequila', player.name, 'テキーラ！', `${player.name} の酔いカウンター +${gain}。卓上がざわつく。`);
    showCutin('テキーラ！', player.name + 'が飲んだ……');
    return;
  }

  if (card.id === 'kanpai' && !kanpaiNested) {
    addLog('🥂 全員集合！乾杯！ — 全員引く！', 'log-all');
    setLastEvent('kanpai', player.name);
    showCutin('全員集合！乾杯！', 'みんな引け！');
    for (const p of state.players) {
      const c = drawFromDeck();
      if (!c) continue;
      // 各ドローを通常解決（ただし連鎖しない）
      resolveDrawCard(c, p, /* kanpaiNested= */ true);
    }
    // doublePush は resolveDrawCard 内で最初の被弾者に適用済み → 無条件クリア
    // dodgeStack は「誰かがテキーラを引いた場合のみ」クリア（引かれなければ持ち越し）
    state.doublePushActive = false;
    return;
  }

  // kanpai内でkanpaiを引いた場合はセーフ扱い
  if (card.id === 'kanpai' && kanpaiNested) {
    addLog(`${player.name} → セーフ（kanpai連鎖スキップ）✅`, 'log-safe');
    setLastEvent('safe', player.name, 'セーフ', `${player.name} は乾杯連鎖をすり抜けた。`);
  }
}

// ── Action card effects ──
// 戻り値: true = ターン終了済み
function applyAction(cardId, targetPlayerIdx = null) {
  const player = currentPlayer();

  const handIdx = player.hand.findIndex(c => c.id === cardId);
  if (handIdx === -1) return false;
  const card = player.hand.splice(handIdx, 1)[0];
  discardCard(card);

  switch (cardId) {
    case 'reverse':
      state.direction *= -1;
      addLog(`${player.name} → 帰宅方向逆です！ 順番逆転`, 'log-card');
      setLastEvent('action', player.name, card.label, '順番が逆回りになる。隣の顔色が変わった。');
      showSfx('逆転！');
      break;

    case 'force': {
      // 使用時点の次プレイヤーidを記録（その後reverseが来ても対象は変わらない）
      const nextPid = nextTurnPlayerIdx();
      state.forceDrawTarget = state.players[nextPid].id;
      addLog(`${player.name} → とりあえず一杯！ ${state.players[nextPid].name}に強制ドロー`, 'log-card');
      setLastEvent('action', player.name, card.label, `${state.players[nextPid].name} に強制ドロー。空気が少し荒れる。`);
      showSfx('とりあえず一杯！');
      break;
    }

    case 'target': {
      const targetPlayer = state.players[targetPlayerIdx];
      addLog(`${player.name} → お前が飲め！ → ${targetPlayer.name}`, 'log-card');
      setLastEvent('action', player.name, card.label, `${targetPlayer.name} に山札を引かせる。視線が刺さる。`);
      showSfx('お前が飲め！');
      if (targetPlayer.isHuman) {
        // 人間が引くフェーズに移行（手動ドロー待ち）
        state.forcedDrawPending = { sourcePlayerName: player.name, reason: 'target' };
        state.phase = 'FORCED_DRAW';
      } else {
        const c = drawFromDeck();
        resolveDrawCard(c, targetPlayer);
        state.hasDrawnThisTurn = true; // 相手に引かせた = 自分のドロー義務を果たした
      }
      break;
    }

    case 'double':
      state.doublePushActive = true;
      addLog(`${player.name} → 倍プッシュだ……！ 次のテキーラが×2`, 'log-card');
      setLastEvent('action', player.name, card.label, '次のテキーラが重くなる。卓上に嫌な沈黙。');
      showSfx('倍プッシュ！');
      break;

    case 'peek': {
      const top = peekDeck();
      addLog(`${player.name} → 嫌な予感（山札の上を確認）`, 'log-card');
      setLastEvent('action', player.name, card.label, '山札の気配を盗み見る。次の一手が変わる。');
      if (player.isHuman) showPeek(top);
      break;
    }

    case 'skip': {
      const skipPid = nextTurnPlayerIdx();
      state.players[skipPid].skipped = true;
      addLog(`${player.name} → スキップ！ ${state.players[skipPid].name}が飛ばされる`, 'log-card');
      setLastEvent('action', player.name, card.label, `${state.players[skipPid].name} のターンを飛ばす。流れが跳ねた。`);
      showSfx('スキップ！');
      break;
    }

    case 'dodge':
      state.dodgeStack++;
      addLog(`${player.name} → 回避！ 次の被弾者+${state.dodgeStack}スタック`, 'log-card');
      setLastEvent('action', player.name, card.label, '身をかわした分、次の誰かにしわ寄せが行く。');
      showSfx('回避！');
      endTurn();
      return true;
  }

  return false;
}

// ── Turn management ──
function advanceTurnIdx() {
  const len = state.turnOrder.length;
  return ((state.currentTurnIdx + state.direction) % len + len) % len;
}

function endTurn() {
  state.turnsTaken++;
  if (state.turnsTaken >= state.maxRounds * state.players.length) {
    finishGame();
    return;
  }

  const nextTurnIdx = advanceTurnIdx();
  state.round = Math.floor(state.turnsTaken / state.players.length) + 1;

  state.currentTurnIdx = nextTurnIdx;

  // スキップ処理（再帰だがラウンドカウントを進めない専用関数で処理）
  resolveSkips(0);

}

// スキップをラウンドカウントなしで解消する。全員スキップ状態の無限ループ防止のため上限あり。
function resolveSkips(depth) {
  const cp = currentPlayer();
  if (cp.skipped) {
    if (depth >= state.players.length) {
      // 全員スキップの異常状態: フラグを強制クリアして続行
      state.players.forEach(p => { p.skipped = false; });
      addLog('全員スキップ状態を検出。フラグをリセットします', 'log-card');
    } else {
      cp.skipped = false;
      addLog(`${cp.name} — スキップ`, 'log-card');
      // ラウンドカウントなしでターンを送る
      state.currentTurnIdx = advanceTurnIdx();
      resolveSkips(depth + 1);
      return;
    }
  }

  state.hasDrawnThisTurn = false;
  state.phase = cp.isHuman ? 'PLAYER_TURN' : 'CPU_TURN';

  renderAll();

  if (!cp.isHuman) {
    setTimeout(runCpuTurn, 800);
  } else {
    // 強制ドローが自分あてなら手動ドロー待ちフェーズへ（自動引き禁止）
    if (state.forceDrawTarget === cp.id) {
      state.forceDrawTarget = null;
      state.forcedDrawPending = { sourcePlayerName: null, reason: 'force' };
      state.phase = 'FORCED_DRAW';
      addLog(`${cp.name} → 強制ドロー（とりあえず一杯の効果）— 山札を引いてください`, 'log-card');
      renderAll();
    }
  }
}

// ── CPU AI ──
function runCpuTurn() {
  const cpu = currentPlayer();
  if (!cpu || cpu.isHuman) return;

  // 強制ドローが自分あてなら先に処理、その後引いたことにして終了
  if (state.forceDrawTarget === cpu.id) {
    state.forceDrawTarget = null;
    addLog(`${cpu.name} → 強制ドロー（とりあえず一杯の効果）`, 'log-card');
    const c = drawFromDeck();
    resolveDrawCard(c, cpu);
    state.hasDrawnThisTurn = true;
    renderAll();
    // 強制ドローはそのターンのドロー扱い → 通常の判断フェーズへは進まない
    setTimeout(endTurn, 900);
    return;
  }

  runCpuDecide();
}

function runCpuDecide() {
  const cpu = currentPlayer();
  const top = peekDeck();

  // peek を持っていれば使って上を確認してから判断
  const hasPeek = cpu.hand.some(c => c.id === 'peek');
  if (hasPeek && !cpu._peeked) {
    cpu._peeked = true;
    const handIdx = cpu.hand.findIndex(c => c.id === 'peek');
    const card = cpu.hand.splice(handIdx, 1)[0];
    discardCard(card);
    addLog(`${cpu.name} → 嫌な予感（山札の上を確認）`, 'log-card');
    setLastEvent('action', cpu.name, card.label, `${cpu.name} が山札の気配を読んだ。`);
    showSfx('嫌な予感');
    renderAll();
    setTimeout(() => runCpuDecideAfterPeek(peekDeck()), 700);
    return;
  }

  runCpuDecideAfterPeek(top);
}

function runCpuDecideAfterPeek(knownTop) {
  const cpu = currentPlayer();
  cpu._peeked = false;

  const topIsTequila = knownTop?.id === 'tequila';

  if (topIsTequila) {
    const hasDouble = cpu.hand.some(c => c.id === 'double');
    const hasTarget = cpu.hand.some(c => c.id === 'target');
    const hasDodge  = cpu.hand.some(c => c.id === 'dodge');

    if (hasDouble && hasTarget) {
      const doubleIdx = cpu.hand.findIndex(c => c.id === 'double');
      const card = cpu.hand.splice(doubleIdx, 1)[0];
      discardCard(card);
      state.doublePushActive = true;
      addLog(`${cpu.name} → 倍プッシュだ……！`, 'log-card');
      setLastEvent('action', cpu.name, card.label, `${cpu.name} が次の一杯を重くした。`);
      showSfx('倍プッシュ！');
      renderAll();
      setTimeout(() => cpuUseTarget(cpu), 700);
      return;
    }

    if (hasTarget) { cpuUseTarget(cpu); return; }

    if (hasDodge) {
      const idx = cpu.hand.findIndex(c => c.id === 'dodge');
      const card = cpu.hand.splice(idx, 1)[0];
      discardCard(card);
      state.dodgeStack++;
      addLog(`${cpu.name} → 回避！`, 'log-card');
      setLastEvent('action', cpu.name, card.label, `${cpu.name} が一歩引いた。次の被弾者が重くなる。`);
      showSfx('回避！');
      renderAll();
      setTimeout(endTurn, 700);
      return;
    }
  }

  // 嫌がらせ（40%）
  const hasSkip    = cpu.hand.some(c => c.id === 'skip');
  const hasForce   = cpu.hand.some(c => c.id === 'force');
  const hasReverse = cpu.hand.some(c => c.id === 'reverse');

  if (Math.random() < 0.4) {
    if (hasSkip) {
      const idx = cpu.hand.findIndex(c => c.id === 'skip');
      const card = cpu.hand.splice(idx, 1)[0];
      discardCard(card);
      const skipPid = nextTurnPlayerIdx();
      state.players[skipPid].skipped = true;
      addLog(`${cpu.name} → スキップ！ ${state.players[skipPid].name}が飛ばされる`, 'log-card');
      setLastEvent('action', cpu.name, card.label, `${state.players[skipPid].name} のターンが飛ばされた。`);
      showSfx('スキップ！');
      renderAll();
    } else if (hasForce) {
      const idx = cpu.hand.findIndex(c => c.id === 'force');
      const card = cpu.hand.splice(idx, 1)[0];
      discardCard(card);
      const nextPid = nextTurnPlayerIdx();
      state.forceDrawTarget = state.players[nextPid].id;
      addLog(`${cpu.name} → とりあえず一杯！ ${state.players[nextPid].name}に強制ドロー`, 'log-card');
      setLastEvent('action', cpu.name, card.label, `${state.players[nextPid].name} に強制ドロー。卓上がにやつく。`);
      showSfx('とりあえず一杯！');
      renderAll();
    } else if (hasReverse && Math.random() < 0.3) {
      const idx = cpu.hand.findIndex(c => c.id === 'reverse');
      const card = cpu.hand.splice(idx, 1)[0];
      discardCard(card);
      state.direction *= -1;
      addLog(`${cpu.name} → 帰宅方向逆です！`, 'log-card');
      setLastEvent('action', cpu.name, card.label, `${cpu.name} が順番を逆回りにした。`);
      showSfx('逆転！');
      renderAll();
    }
  }

  cpuDrawOnce();
}

function cpuDrawOnce() {
  const cpu = currentPlayer();
  setTimeout(() => {
    addLog(`${cpu.name} → 山札を引く`, '');
    const c = drawFromDeck();
    resolveDrawCard(c, cpu);
    state.hasDrawnThisTurn = true;
    renderAll();

    // チキンレース: セーフを引いた場合 40% の確率でもう1枚引く
    const drewSafe = c && c.id === 'safe';
    if (drewSafe && Math.random() < 0.4) {
      addLog(`${cpu.name} → もう1枚いく……`, '');
      setTimeout(cpuDrawOnce, 700);
    } else {
      setTimeout(endTurn, 900);
    }
  }, 600);
}

function cpuUseTarget(cpu) {
  // 酔いが最も少ない（素面な）相手を狙う
  const candidates = state.players.filter(p => p.id !== cpu.id);
  const target = candidates.reduce((a, b) => a.drunk <= b.drunk ? a : b);
  const targetIdx = state.players.indexOf(target);

  const handIdx = cpu.hand.findIndex(c => c.id === 'target');
  const card = cpu.hand.splice(handIdx, 1)[0];
  discardCard(card);
  addLog(`${cpu.name} → お前が飲め！ → ${target.name}`, 'log-card');
  setLastEvent('action', cpu.name, card.label, `${target.name} に山札を引かせる。場の視線が集まった。`);
  showSfx('お前が飲め！');
  renderAll();

  if (target.isHuman) {
    // 人間が手動で引くのを待つ
    state.forcedDrawPending = { sourcePlayerName: cpu.name, reason: 'target' };
    state.phase = 'FORCED_DRAW';
    renderAll();
  } else {
    setTimeout(() => {
      const c = drawFromDeck();
      resolveDrawCard(c, target);
      state.hasDrawnThisTurn = true;
      renderAll();
      setTimeout(endTurn, 900);
    }, 700);
  }
}

// ── Game finish ──
function finishGame() {
  state.phase = 'RESULT';
  const sorted = [...state.players].sort((a, b) => a.drunk - b.drunk);
  showResultScreen(sorted);
}

// ── Utilities ──
function $(id) { return document.getElementById(id); }

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function showSfx(text) {
  const el = $('sfx-text');
  el.textContent = text;
  announce(text);
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(showSfx._tid);
  showSfx._tid = setTimeout(() => el.classList.remove('show'), 900);
}

function showCutin(title, kicker) {
  const el = $('cutin');
  el.classList.remove('hidden');
  $('cutin-title').textContent  = title;
  $('cutin-kicker').textContent = kicker;
  announce(`${kicker} ${title}`);
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(showCutin._tid);
  showCutin._tid = setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.classList.add('hidden'), 200);
  }, 1400);
}

function showPeek(card) {
  const el = $('peek-overlay');
  const cardEl = $('peek-card');
  el.classList.remove('hidden');
  if (!card) {
    cardEl.textContent = '（山札が空）';
    cardEl.className = 'peek-card';
  } else if (card.id === 'tequila') {
    cardEl.textContent = '🍺 テキーラ！！';
    cardEl.className = 'peek-card tequila-card';
  } else if (card.id === 'kanpai') {
    cardEl.textContent = '🥂 全員集合！乾杯！';
    cardEl.className = 'peek-card kanpai-card';
  } else {
    cardEl.textContent = '✅ セーフ';
    cardEl.className = 'peek-card';
  }
}

function showTargetSelect(cardId, label) {
  const el = $('target-overlay');
  $('target-label').textContent = label;
  const list = $('target-list');
  list.innerHTML = '';

  const player = currentPlayer();
  const candidates = state.players.filter(p => p.id !== player.id);

  for (const p of candidates) {
    const btn = document.createElement('button');
    btn.className = 'target-btn';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = p.name;
    const drunkSpan = document.createElement('span');
    drunkSpan.className = 'target-btn-drunk';
    drunkSpan.textContent = `🍺 ${p.drunk}`;
    btn.append(nameSpan, drunkSpan);
    btn.addEventListener('click', () => {
      el.classList.add('hidden');
      const turnEnded = applyAction(cardId, state.players.indexOf(p));
      if (!turnEnded) renderAll();
    });
    list.appendChild(btn);
  }

  el.classList.remove('hidden');
}

function showToast(msg) {
  const t = $('toast-msg');
  t.textContent = msg;
  announce(msg);
  t.classList.add('show');
  clearTimeout(showToast._tid);
  showToast._tid = setTimeout(() => t.classList.remove('show'), 1800);
}

function announce(msg) {
  const live = $('sr-live');
  if (!live) return;
  live.textContent = '';
  requestAnimationFrame(() => {
    live.textContent = msg;
  });
}

// ── Render ──
function renderAll() {
  if (!state) return;
  renderHud();
  renderEffectFlags();
  renderPlayers();
  renderStage();
  renderHand();
  renderActionBar();
}

function renderHud() {
  $('round-display').textContent = `${Math.min(state.round, state.maxRounds)} / ${state.maxRounds}`;
  $('deck-num').textContent = state.deck.length;
  $('tequila-num').textContent = state.deck.filter(c => c.id === 'tequila').length;
}

function renderEffectFlags() {
  const el = $('effect-flags');
  el.innerHTML = '';
  if (state.doublePushActive) {
    const f = document.createElement('span');
    f.className = 'effect-flag flag-double'; f.textContent = '倍プッシュ中';
    el.appendChild(f);
  }
  if (state.dodgeStack > 0) {
    const f = document.createElement('span');
    f.className = 'effect-flag flag-dodge'; f.textContent = `回避×${state.dodgeStack}`;
    el.appendChild(f);
  }
  if (state.forceDrawTarget) {
    const tp = state.players.find(p => p.id === state.forceDrawTarget);
    const f = document.createElement('span');
    f.className = 'effect-flag flag-force';
    f.textContent = `${tp?.name ?? '?'}に強制ドロー`;
    el.appendChild(f);
  }
}

function renderPlayers() {
  const row = $('players-row');
  row.innerHTML = '';
  row.style.setProperty('--player-count', String(state.players.length));
  const cpIdx = state.turnOrder[state.currentTurnIdx];

  for (let i = 0; i < state.players.length; i++) {
    const p = state.players[i];
    const chip = document.createElement('div');
    chip.className = 'player-chip'
      + (p.isHuman ? ' is-human' : '')
      + (i === cpIdx ? ' is-turn' : '');
    chip.dataset.seat = String(i);

    const avatar = document.createElement('div');
    avatar.className = 'chip-avatar';
    if (PLAYER_AVATARS[i]) {
      const img = document.createElement('img');
      img.src = PLAYER_AVATARS[i];
      img.alt = '';
      img.setAttribute('aria-hidden', 'true');
      avatar.appendChild(img);
    } else {
      avatar.textContent = p.name.slice(0, 1);
    }

    const name  = document.createElement('div'); name.className = 'chip-name';        name.textContent = p.name;
    const drunk = document.createElement('div'); drunk.className = 'chip-drunk';       drunk.textContent = p.drunk;
    const lbl   = document.createElement('div'); lbl.className   = 'chip-drunk-label'; lbl.textContent = '酔い';

    chip.append(avatar, name, drunk, lbl);

    if (p.isHuman) {
      const b = document.createElement('div'); b.className = 'chip-badge'; b.textContent = 'YOU'; chip.appendChild(b);
    }
    if (p.skipped) {
      const b = document.createElement('div'); b.className = 'chip-badge'; b.textContent = 'SKIP'; chip.appendChild(b);
    }
    row.appendChild(chip);
  }
}

function renderStage() {
  const cp = currentPlayer();
  const banner = $('turn-banner');

  if (state.phase === 'FORCED_DRAW') {
    const fp = state.forcedDrawPending;
    if (fp?.reason === 'target') {
      banner.textContent = `${fp.sourcePlayerName} から「お前が飲め！」🍺`;
    } else {
      banner.textContent = '「とりあえず一杯」— 引かされます！';
    }
  } else if (state.phase === 'RESOLVING') {
    banner.textContent = '処理中…';
  } else if (state.phase === 'CPU_TURN') {
    banner.textContent = `${cp.name} のターン…`;
  } else {
    banner.textContent = 'あなたのターン';
  }

  renderEventCard();

  // ログ（最新順）
  const logEl = $('game-log');
  logEl.innerHTML = '';
  for (const entry of [...state.log].reverse().slice(0, 3)) {
    const div = document.createElement('div');
    div.className = 'log-entry ' + (entry.cls || '');
    div.textContent = entry.msg;
    logEl.appendChild(div);
  }
}

function renderEventCard() {
  const event = state.lastEvent || EVENT_COPY.waiting;
  const card = $('event-card');
  if (!card) return;
  card.className = `event-card event-${event.tone}`;
  $('event-card-kicker').textContent = event.kicker;
  $('event-card-title').textContent = event.title;
  $('event-card-copy').textContent = event.copy;
}

function renderHand() {
  const area = $('hand-area');
  const isPlayerTurn  = state.phase === 'PLAYER_TURN';
  const isForcedDraw  = state.phase === 'FORCED_DRAW';
  area.classList.toggle('hidden', !isPlayerTurn && !isForcedDraw);
  if (!isPlayerTurn && !isForcedDraw) return;

  const player = currentPlayer();
  const subtitle = $('hand-subtitle');

  if (isForcedDraw) {
    subtitle.textContent = '山札を引くボタンを押してください';
    $('hand-cards').innerHTML =
      '<div class="forced-note">手札は使えません。山札を引かされます。</div>';
    return;
  }

  if (!state.hasDrawnThisTurn) {
    subtitle.textContent = 'カードを使うか、山札を引く';
  } else {
    subtitle.textContent = 'さらにカードを使うか、ターン終了';
  }

  const grid = $('hand-cards');
  grid.innerHTML = '';

  if (player.hand.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-hand';
    empty.textContent = '手札がありません';
    grid.appendChild(empty);
    return;
  }

  for (const card of player.hand) {
    const def = ACTION_DEFS[card.id];
    if (!def) continue;

    const el = document.createElement('button');
    el.className = 'action-card';
    el.style.setProperty('--card-accent', `var(${def.accent})`);

    const iconEl = document.createElement('div'); iconEl.className = 'card-icon';   iconEl.textContent = def.icon;
    const nameEl = document.createElement('div'); nameEl.className = 'card-name';   nameEl.textContent = def.label;
    const effEl  = document.createElement('div'); effEl.className  = 'card-effect'; effEl.textContent  = def.effect;
    el.append(iconEl, nameEl, effEl);

    el.addEventListener('click', () => onPlayerCardClick(card.id));
    grid.appendChild(el);
  }
}

function renderActionBar() {
  const isPlayerTurn = state.phase === 'PLAYER_TURN';
  const drawBtn = $('draw-btn');
  const endBtn  = $('end-turn-btn');
  const badge   = $('draw-badge');
  const bar     = $('action-bar');

  const isForcedDraw = state.phase === 'FORCED_DRAW';
  bar.classList.toggle('is-forced', isForcedDraw);
  bar.classList.toggle('can-end', isPlayerTurn && state.hasDrawnThisTurn);
  drawBtn.disabled = !isPlayerTurn && !isForcedDraw;
  endBtn.disabled  = !isPlayerTurn || !state.hasDrawnThisTurn;
  badge.textContent = state.deck.length > 0 ? `残${state.deck.length}` : '空';

  // FORCED_DRAW 中はボタンラベルで状況を明示
  const drawLabel = $('draw-label-text');
  if (drawLabel) drawLabel.textContent = isForcedDraw ? '引かされる……' : '山札を引く';
}

// ── Player interaction ──
function onPlayerCardClick(cardId) {
  if (state.phase !== 'PLAYER_TURN') return;

  if (cardId === 'target') {
    showTargetSelect('target', '誰に飲ませる？ 🍺');
    return;
  }

  const turnEnded = applyAction(cardId);
  if (!turnEnded) renderAll();
}

function onDrawClick() {
  if (state.phase === 'FORCED_DRAW' && state.forcedDrawPending) {
    const reason = state.forcedDrawPending.reason;
    state.forcedDrawPending = null;

    const human = state.players.find(p => p.isHuman);
    const c = drawFromDeck();
    resolveDrawCard(c, human);
    renderAll();

    if (reason === 'force') {
      // とりあえず一杯 → 自分のターンに戻る（hasDrawnThisTurn = true で引いた扱い）
      state.hasDrawnThisTurn = true;
      state.phase = 'PLAYER_TURN';
      renderAll();
    } else {
      // お前が飲め（CPU のターン中） → CPUターンに戻してターン終了
      state.phase = 'CPU_TURN';
      state.hasDrawnThisTurn = true;
      renderAll();
      setTimeout(endTurn, 900);
    }
    return;
  }

  if (state.phase !== 'PLAYER_TURN') return;
  const player = currentPlayer();
  const c = drawFromDeck();
  resolveDrawCard(c, player);
  state.hasDrawnThisTurn = true;
  renderAll();
}

function onEndTurnClick() {
  if (state.phase !== 'PLAYER_TURN' || !state.hasDrawnThisTurn) return;
  endTurn();
}

// ── Result screen ──
function showResultScreen(sorted) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $('result-screen').classList.add('active');

  // 同率考慮
  const minDrunk = sorted[0].drunk;
  const winners  = sorted.filter(p => p.drunk === minDrunk);
  const titleEl  = $('result-title');
  const summaryEl = $('result-party-summary');
  if (winners.length === 1) {
    titleEl.textContent = `${winners[0].name} の勝ち！`;
  } else {
    titleEl.textContent = `${winners.map(p => p.name).join(' & ')} の引き分け！`;
  }
  const human = state.players.find(p => p.isHuman);
  const humanRank = sorted.findIndex(p => p.id === human?.id) + 1;
  const worst = sorted[sorted.length - 1];
  if (summaryEl) {
    if (winners.some(p => p.isHuman)) {
      summaryEl.textContent = '一番しらふで夜を抜けた。卓上の空気まで読めていた。';
    } else if (humanRank === sorted.length) {
      summaryEl.textContent = `${worst.name} が一番飲んだ夜。次は山札の気配をもっと疑おう。`;
    } else {
      summaryEl.textContent = `あなたは ${humanRank} 位。勝ち筋は見えたけど、最後の一杯が重かった。`;
    }
  }

  const rankings = $('result-rankings');
  rankings.innerHTML = '';
  const medals = ['gold', 'silver', 'bronze'];

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const row = document.createElement('div');
    row.className = 'rank-row' + (p.drunk === minDrunk ? ' winner' : '');

    const num = document.createElement('div');
    num.className = 'rank-num ' + (medals[i] || '');
    num.textContent = `${i + 1}`;

    const name = document.createElement('div');
    name.className = 'rank-name';
    name.textContent = p.name + (p.isHuman ? ' (YOU)' : '');

    const right = document.createElement('div');
    right.style.cssText = 'display:flex;flex-direction:column;align-items:flex-end;gap:2px;';

    const drunk = document.createElement('div'); drunk.className = 'rank-drunk';       drunk.textContent = p.drunk;
    const lbl   = document.createElement('div'); lbl.className   = 'rank-drunk-label'; lbl.textContent   = '酔い';
    right.append(drunk, lbl);

    row.append(num, name, right);
    rankings.appendChild(row);
  }
}

// ── Start / Restart ──
function startGame() {
  const name      = $('player-name').value.trim() || 'あなた';
  const cpuCount  = parseInt(document.querySelector('.cpu-count-btn.active')?.dataset.count || '2');
  const maxRounds = parseInt(document.querySelector('.round-btn.active')?.dataset.rounds || '10');

  state = initState(name, cpuCount, maxRounds);
  state.phase = 'PLAYER_TURN';

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $('game-screen').classList.add('active');

  renderAll();
}

function restartGame() {
  // 残存タイムアウトをクリア
  clearTimeout(showSfx._tid);
  clearTimeout(showCutin._tid);
  clearTimeout(showToast._tid);

  // オーバーレイを閉じる
  $('peek-overlay').classList.add('hidden');
  $('target-overlay').classList.add('hidden');
  $('cutin').classList.add('hidden');
  $('cutin').classList.remove('show');
  $('sfx-text').classList.remove('show');
  $('toast-msg').classList.remove('show');

  state = null;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $('setup-screen').classList.add('active');
}

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  $('start-btn').addEventListener('click', startGame);
  $('retry-btn').addEventListener('click', restartGame);
  $('draw-btn').addEventListener('click', onDrawClick);
  $('end-turn-btn').addEventListener('click', onEndTurnClick);
  $('peek-close').addEventListener('click', () => $('peek-overlay').classList.add('hidden'));
  $('target-cancel').addEventListener('click', () => $('target-overlay').classList.add('hidden'));

  document.querySelectorAll('.cpu-count-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cpu-count-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateChoiceAria('.cpu-count-btn');
    });
  });

  document.querySelectorAll('.round-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.round-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateChoiceAria('.round-btn');
    });
  });

  updateChoiceAria('.cpu-count-btn');
  updateChoiceAria('.round-btn');
});

function updateChoiceAria(selector) {
  document.querySelectorAll(selector).forEach(btn => {
    btn.setAttribute('aria-pressed', btn.classList.contains('active') ? 'true' : 'false');
  });
}
