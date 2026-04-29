'use strict';

// ── カード定義 ──
const DECK_CARDS = [
  { id: 'safe',          label: 'セーフ',               count: 27, type: 'deck' },
  { id: 'tequila',       label: 'テキーラ',              count: 10, type: 'deck' },
  { id: 'kanpai',        label: '全員集合！乾杯！',       count:  3, type: 'deck' },
  { id: 'tequila_party', label: '全員強制テキーラ乾杯',   count:  1, type: 'deck' },
];

const ACTION_DEFS = {
  reverse: { id:'reverse', label:'帰宅方向逆です', icon:'↺', effect:'順番を逆回りに',      accent:'--accent-reverse' },
  force:   { id:'force',   label:'とりあえず一杯', icon:'杯', effect:'強制ドロー+即終了',  accent:'--accent-force'   },
  target:  { id:'target',  label:'お前が飲め',     icon:'指', effect:'誰かに引かせる',      accent:'--accent-target'  },
  double:  { id:'double',  label:'倍プッシュだ……！',icon:'倍', effect:'次のテキーラが×2',   accent:'--accent-double'  },
  peek:    { id:'peek',    label:'嫌な予感',        icon:'視', effect:'山札の上を見る',      accent:'--accent-peek'    },
  skip:    { id:'skip',    label:'スキップ',        icon:'飛', effect:'次の人を飛ばす',      accent:'--accent-skip'    },
  dodge:   { id:'dodge',   label:'回避',            icon:'避', effect:'即終了+次被弾者+1',  accent:'--accent-dodge'   },
  guard:   { id:'guard',   label:'飲みません宣言',  icon:'拒', effect:'テキーラ回避+1枚',  accent:'--accent-guard'   },
};

const ACTION_COUNTS = { reverse:4, force:5, target:5, double:4, peek:5, skip:4, dodge:3, guard:2 };

const CHARACTERS = [
  { id: 'koji',  name: 'こーじ',  avatar: 'assets/koji.png',      gender: 'male',   cpuLevel: 'hard' },
  { id: 'ryota', name: 'りょーた', avatar: 'assets/ryota.png',     gender: 'male',   cpuLevel: 'hard' },
  { id: 'osho',  name: 'おしょー', avatar: 'assets/osho.png',      gender: 'male',   cpuLevel: 'hard' },
  { id: 'nana',  name: 'なな',     avatar: 'assets/nana.png',      gender: 'female', cpuLevel: 'easy' },
  { id: 'yapi',  name: 'やぴ',     avatar: 'assets/yapi-card.png', gender: 'female', cpuLevel: 'easy' },
  { id: 'milk',  name: 'みるく',   avatar: 'assets/milk-card.png', gender: 'female', cpuLevel: 'easy' },
];

const DEFAULT_HUMAN_CHARACTER_ID = 'yapi';
const DEFAULT_CPU_CHARACTER_IDS = ['milk', 'nana', 'koji'];

const CPU_LEVELS = {
  hard: {
    label: '手強い',
    peekChance: 0.95,
    dangerAvoidChance: 0.96,
    kanpaiAvoidChance: 0.82,
    harassChance: 0.58,
    reverseHarassChance: 0.42,
    targetBestChance: 0.88,
    safeChainChance: 0.24,
  },
  easy: {
    label: 'やさしめ',
    peekChance: 0.52,
    dangerAvoidChance: 0.62,
    kanpaiAvoidChance: 0.48,
    harassChance: 0.26,
    reverseHarassChance: 0.22,
    targetBestChance: 0.62,
    safeChainChance: 0.58,
  },
};

let selectedHumanCharacterId = DEFAULT_HUMAN_CHARACTER_ID;
let selectedCpuCharacterIds = [];

// PvP セットアップ用
let setupMode = 'vs-cpu';
let pvpCount = 2;
let pvpSeats = []; // [{ name: string, characterId: string }]

const EVENT_COPY = {
  safe:    { tone:'safe',    kicker:'SAFE',   title:'セーフ',           copy:'息を止めてめくった一枚は、まだ夜を壊さない。' },
  tequila: { tone:'tequila', kicker:'HIT',    title:'テキーラ！',       copy:'卓上の空気が一瞬だけ熱く跳ねる。' },
  kanpai:  { tone:'kanpai',  kicker:'ALL IN', title:'全員集合！乾杯！', copy:'全員が山札へ手を伸ばす。逃げ場はない。' },
  tequilaParty: { tone:'tequila', kicker:'DANGER', title:'全員強制テキーラ乾杯', copy:'卓上全員にグラスが配られる。逃げ場は完全に消えた。' },
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

function getCharacter(id) {
  return CHARACTERS.find(c => c.id === id) || CHARACTERS[0];
}

function defaultCpuCharacters(count, humanCharacterId = selectedHumanCharacterId) {
  const preferred = DEFAULT_CPU_CHARACTER_IDS
    .map(getCharacter)
    .filter(c => c.id !== humanCharacterId);
  const rest = CHARACTERS.filter(c => c.id !== humanCharacterId && !preferred.some(p => p.id === c.id));
  return [...preferred, ...rest].slice(0, count);
}

function dealHands(players, pool) {
  for (const p of players) {
    p.hand = [];
    for (let i = 0; i < 4; i++) {
      if (pool.length > 0) p.hand.push(pool.pop());
    }
  }
}

function initState(playerName, cpuCount, maxRounds, humanCharacter, cpuCharacters) {
  const actionPool = buildActionPool();
  const players = [];
  const humanChar = humanCharacter || getCharacter(DEFAULT_HUMAN_CHARACTER_ID);
  const cpuChars = cpuCharacters?.length ? cpuCharacters : defaultCpuCharacters(cpuCount, humanChar.id);

  players.push(createPlayer('p0', playerName || 'あなた', true, humanChar));
  for (let i = 0; i < cpuCount; i++) {
    const cpuChar = cpuChars[i] || defaultCpuCharacters(cpuCount, humanChar.id)[i] || CHARACTERS[i % CHARACTERS.length];
    players.push(createPlayer(`cpu${i}`, cpuChar.name, false, cpuChar));
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
    targetPendingFrom: null, // PvP: target 使用者のturnIdx退避
    hasDrawnThisTurn: false,
    lastEvent: EVENT_COPY.waiting,
    eventSerial: 0,
    // SETUP | PLAYER_TURN | CPU_TURN | RESOLVING | FORCED_DRAW | PASS | RESULT
    phase: 'SETUP',
    log:   [],
    logSeq: 0,
    gameMode: 'vs-cpu',
  };
}

function initStatePvp(seats, maxRounds) {
  const actionPool = buildActionPool();
  const players = seats.map((s, i) => createPlayer(`p${i}`, s.name, true, s.character));
  dealHands(players, actionPool);
  return {
    players,
    actionPool,
    deck: buildDeck(),
    deckDiscard: [],
    actionDiscard: [],
    turnOrder: players.map((_, i) => i),
    currentTurnIdx: 0,
    direction: 1,
    round: 1,
    maxRounds,
    turnsTaken: 0,
    doublePushActive: false,
    dodgeStack: 0,
    forceDrawTarget: null,
    forcedDrawPending: null,
    targetPendingFrom: null,
    hasDrawnThisTurn: false,
    lastEvent: EVENT_COPY.waiting,
    eventSerial: 0,
    phase: 'SETUP',
    log: [], logSeq: 0,
    gameMode: 'pvp',
  };
}

function createPlayer(id, name, isHuman, character) {
  const cpuProfile = CPU_LEVELS[character.cpuLevel] || CPU_LEVELS.easy;
  return {
    id,
    name,
    isHuman,
    characterId: character.id,
    characterName: character.name,
    avatar: character.avatar,
    gender: character.gender,
    cpuLevel: character.cpuLevel,
    cpuLevelLabel: cpuProfile.label,
    drunk: 0,
    hand: [],
    skipped: false,
    noDrinkGuard: false,
    _peeked: false,
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
  const labels = {
    'log-tequila': 'HIT',
    'log-safe': 'SAFE',
    'log-card': 'CARD',
    'log-all': 'ALL',
  };
  const normalizedCls = cls || 'log-normal';
  state.log.push({
    msg,
    cls: normalizedCls,
    label: labels[cls] || 'LOG',
    seq: ++state.logSeq,
  });
  if (state.log.length > 40) state.log.shift();
}

function setLastEvent(kind, playerName, title = null, copy = null) {
  const base = EVENT_COPY[kind] || EVENT_COPY.action;
  state.eventSerial++;
  state.lastEvent = {
    ...base,
    title: title || base.title,
    copy: copy || (playerName ? `${playerName} — ${base.copy}` : base.copy),
    serial: state.eventSerial,
  };
}

function applyTequilaHit(player, gain, label = 'テキーラ！') {
  player.drunk += gain;
  for (let i = 0; i < gain; i++) replenishHand(player);
  const extra = gain > 1 ? ` (+${gain})` : '';
  addLog(`${player.name} → ${label}🍺 酔い${extra}`, 'log-tequila');
}

function consumeNoDrinkGuard(player, cardId) {
  if (!player.noDrinkGuard) return false;
  player.noDrinkGuard = false;

  if (cardId === 'tequila' || cardId === 'tequila_party') {
    replenishHand(player);
    const label = cardId === 'tequila_party' ? '強制テキーラ乾杯' : 'テキーラ';
    addLog(`${player.name} → 飲みません宣言で${label}回避！ 手札+1`, 'log-safe');
    setLastEvent('safe', player.name, '飲まない！', `${player.name} は${label}を受け流し、手札を1枚引いた。`);
    showSfx('飲まない！');
    return true;
  }

  addLog(`${player.name} → 飲みません宣言は空振り`, 'log-card');
  setLastEvent('action', player.name, '空振り', `${player.name} の保険は何事もなく消えた。`);
  return false;
}

// ── Draw resolution ──
// kanpaiNested: kanpaiの中から再帰的に呼ばれている場合 true（連鎖防止）
function resolveDrawCard(card, player, kanpaiNested = false) {
  if (!card) { addLog(`${player.name}: 山札が空でした`, ''); return; }

  discardCard(card);

  if (card.id !== 'tequila_party' && consumeNoDrinkGuard(player, card.id)) return;

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
    applyTequilaHit(player, gain);
    setLastEvent('tequila', player.name, 'テキーラ！', `${player.name} の酔いカウンター +${gain}。卓上がざわつく。`);
    showCutin('テキーラ！', player.name + 'が飲んだ……');
    return;
  }

  if (card.id === 'tequila_party') {
    addLog('全員強制テキーラ乾杯！ — 全員飲む！', 'log-all');
    let firstVictim = true;
    for (const p of state.players) {
      if (!consumeNoDrinkGuard(p, 'tequila_party')) {
        let gain = state.doublePushActive ? 2 : 1;
        if (firstVictim) {
          gain = state.doublePushActive ? (1 + state.dodgeStack) * 2 : 1 + state.dodgeStack;
          firstVictim = false;
        }
        applyTequilaHit(p, gain, '強制テキーラ乾杯！');
      }
    }
    if (!firstVictim) {
      state.doublePushActive = false;
      state.dodgeStack = 0;
    }
    setLastEvent('tequilaParty', player.name);
    showCutin('全員強制テキーラ乾杯！', '逃げ場なし');
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
    // doublePush / dodgeStack は resolveDrawCard 内で被弾者が出た時点でクリア済み。
    // 全員 guard / 全員 safe の場合はスタックを持ち越す（tequila_party と統一）。
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
      endTurn();
      return true;

    case 'force': {
      // 使用時点の次プレイヤーidを記録（その後reverseが来ても対象は変わらない）
      const nextPid = nextTurnPlayerIdx();
      state.forceDrawTarget = state.players[nextPid].id;
      addLog(`${player.name} → とりあえず一杯！ ${state.players[nextPid].name}に強制ドロー`, 'log-card');
      setLastEvent('action', player.name, card.label, `${state.players[nextPid].name} に強制ドロー。空気が少し荒れる。`);
      showSfx('とりあえず一杯！');
      endTurn();
      return true;
    }

    case 'target': {
      const targetPlayer = state.players[targetPlayerIdx];
      addLog(`${player.name} → お前が飲め！ → ${targetPlayer.name}`, 'log-card');
      setLastEvent('action', player.name, card.label, `${targetPlayer.name} に山札を引かせる。視線が刺さる。`);
      showSfx('お前が飲め！');
      if (state.gameMode === 'pvp') {
        // PvP: 使用者のターン位置を退避し、対象の席に移動してPASS → FORCED_DRAW → 戻る
        // targetPlayerIdx は state.players の index。state.currentTurnIdx は turnOrder の index なので変換が必要
        state.targetPendingFrom = state.currentTurnIdx;
        state.currentTurnIdx = state.turnOrder.indexOf(targetPlayerIdx);
        state.forcedDrawPending = { sourcePlayerName: player.name, reason: 'target' };
        state.phase = 'PASS';
      } else if (targetPlayer.isHuman) {
        // vs-CPU: 人間が引くフェーズに移行（手動ドロー待ち）
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
      endTurn();
      return true;
    }

    case 'guard':
      player.noDrinkGuard = true;
      addLog(`${player.name} → 飲みません宣言！ 次のテキーラを飲まない`, 'log-card');
      setLastEvent('action', player.name, card.label, `${player.name} は次のテキーラに保険をかけた。`);
      showSfx('飲みません宣言！');
      break;

    case 'dodge':
      state.dodgeStack = Math.min(state.dodgeStack + 1, 3);
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

  if (state.gameMode === 'pvp') {
    // 強制ドロー対象の場合は PASS 解決後に FORCED_DRAW へ遷移させるためフラグだけ立てる
    if (state.forceDrawTarget === cp.id) {
      state.forceDrawTarget = null;
      state.forcedDrawPending = { sourcePlayerName: null, reason: 'force' };
    }
    state.phase = 'PASS';
    renderAll();
    return;
  }

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
  const profile = cpuProfile(cpu);
  const top = peekDeck();

  // peek を持っていれば使って上を確認してから判断
  const hasPeek = cpu.hand.some(c => c.id === 'peek');
  if (hasPeek && !cpu._peeked && Math.random() < profile.peekChance) {
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
  const profile = cpuProfile(cpu);
  cpu._peeked = false;

  const topId = knownTop?.id;
  const topIsDangerSelf = topId === 'tequila' || topId === 'tequila_party';
  const topIsKanpai     = topId === 'kanpai';

  if (topIsDangerSelf && Math.random() < profile.dangerAvoidChance) {
    const hasDouble = cpu.hand.some(c => c.id === 'double');
    const hasTarget = cpu.hand.some(c => c.id === 'target');
    const hasDodge  = cpu.hand.some(c => c.id === 'dodge');
    const hasGuard  = cpu.hand.some(c => c.id === 'guard');

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

    if (hasGuard) {
      const idx = cpu.hand.findIndex(c => c.id === 'guard');
      const card = cpu.hand.splice(idx, 1)[0];
      discardCard(card);
      cpu.noDrinkGuard = true;
      addLog(`${cpu.name} → 飲みません宣言！`, 'log-card');
      setLastEvent('action', cpu.name, card.label, `${cpu.name} は次のテキーラに保険をかけた。`);
      showSfx('飲みません宣言！');
      renderAll();
      setTimeout(cpuDrawOnce, 700);
      return;
    }

    if (hasDodge) {
      const idx = cpu.hand.findIndex(c => c.id === 'dodge');
      const card = cpu.hand.splice(idx, 1)[0];
      discardCard(card);
      state.dodgeStack = Math.min(state.dodgeStack + 1, 3);
      addLog(`${cpu.name} → 回避！`, 'log-card');
      setLastEvent('action', cpu.name, card.label, `${cpu.name} が一歩引いた。次の被弾者が重くなる。`);
      showSfx('回避！');
      renderAll();
      setTimeout(endTurn, 700);
      return;
    }
  }

  if (topIsKanpai && Math.random() < profile.kanpaiAvoidChance) {
    const hasSkipK    = cpu.hand.some(c => c.id === 'skip');
    const hasForceK   = cpu.hand.some(c => c.id === 'force');
    const hasReverseK = cpu.hand.some(c => c.id === 'reverse');
    if (hasSkipK) {
      const idx = cpu.hand.findIndex(c => c.id === 'skip');
      const card = cpu.hand.splice(idx, 1)[0];
      discardCard(card);
      const skipPid = nextTurnPlayerIdx();
      state.players[skipPid].skipped = true;
      addLog(`${cpu.name} → スキップ！（全員乾杯を回避）`, 'log-card');
      setLastEvent('action', cpu.name, card.label, `${cpu.name} が乾杯の気配を察知してターンをすり抜けた。`);
      showSfx('スキップ！');
      renderAll();
      setTimeout(endTurn, 700);
      return;
    }
    if (hasForceK) {
      const idx = cpu.hand.findIndex(c => c.id === 'force');
      const card = cpu.hand.splice(idx, 1)[0];
      discardCard(card);
      const nextPid = nextTurnPlayerIdx();
      state.forceDrawTarget = state.players[nextPid].id;
      addLog(`${cpu.name} → とりあえず一杯！（全員乾杯を押しつける）`, 'log-card');
      setLastEvent('action', cpu.name, card.label, `${cpu.name} が嫌な予感をすり抜けた。`);
      showSfx('とりあえず一杯！');
      renderAll();
      setTimeout(endTurn, 700);
      return;
    }
    if (hasReverseK && Math.random() < 0.5) {
      const idx = cpu.hand.findIndex(c => c.id === 'reverse');
      const card = cpu.hand.splice(idx, 1)[0];
      discardCard(card);
      state.direction *= -1;
      addLog(`${cpu.name} → 帰宅方向逆です！（全員乾杯を先送り）`, 'log-card');
      setLastEvent('action', cpu.name, card.label, `${cpu.name} が順番を逆回りにした。`);
      showSfx('逆転！');
      renderAll();
      setTimeout(endTurn, 700);
      return;
    }
  }

  // 嫌がらせ。キャラクターごとのCPUレベルで強弱を出す。
  const hasSkip    = cpu.hand.some(c => c.id === 'skip');
  const hasForce   = cpu.hand.some(c => c.id === 'force');
  const hasReverse = cpu.hand.some(c => c.id === 'reverse');

  if (Math.random() < profile.harassChance) {
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
      setTimeout(endTurn, 700);
      return;
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
      setTimeout(endTurn, 700);
      return;
    } else if (hasReverse && Math.random() < profile.reverseHarassChance) {
      const idx = cpu.hand.findIndex(c => c.id === 'reverse');
      const card = cpu.hand.splice(idx, 1)[0];
      discardCard(card);
      state.direction *= -1;
      addLog(`${cpu.name} → 帰宅方向逆です！`, 'log-card');
      setLastEvent('action', cpu.name, card.label, `${cpu.name} が順番を逆回りにした。`);
      showSfx('逆転！');
      renderAll();
      setTimeout(endTurn, 700);
      return;
    }
  }

  cpuDrawOnce();
}

function cpuDrawOnce() {
  const cpu = currentPlayer();
  const profile = cpuProfile(cpu);
  setTimeout(() => {
    addLog(`${cpu.name} → 山札を引く`, '');
    const c = drawFromDeck();
    resolveDrawCard(c, cpu);
    state.hasDrawnThisTurn = true;
    renderAll();

    // チキンレース: やさしめCPUほど欲張ってもう1枚引きやすい
    const drewSafe = c && c.id === 'safe';
    if (drewSafe && Math.random() < profile.safeChainChance) {
      addLog(`${cpu.name} → もう1枚いく……`, '');
      setTimeout(cpuDrawOnce, 700);
    } else {
      setTimeout(endTurn, 900);
    }
  }, 600);
}

function cpuUseTarget(cpu) {
  const profile = cpuProfile(cpu);
  const candidates = state.players.filter(p => p.id !== cpu.id);
  const sorted = [...candidates].sort((a, b) => a.drunk - b.drunk);
  const target = (sorted.length < 2 || Math.random() < profile.targetBestChance)
    ? sorted[0]
    : sorted[1 + Math.floor(Math.random() * (sorted.length - 1))];
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

function cpuProfile(player) {
  return CPU_LEVELS[player?.cpuLevel] || CPU_LEVELS.easy;
}

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
  } else if (card.id === 'tequila_party') {
    cardEl.textContent = '🍻 全員強制テキーラ乾杯！！';
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
  $('tequila-num').textContent = state.deck.filter(c => c.id === 'tequila' || c.id === 'tequila_party').length;
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
  const guardedPlayers = state.players.filter(p => p.noDrinkGuard);
  for (const p of guardedPlayers) {
    const f = document.createElement('span');
    f.className = 'effect-flag flag-guard';
    f.textContent = `${p.name}:飲まない宣言`;
    el.appendChild(f);
  }
}

function renderPlayers() {
  const row = $('players-row');
  row.innerHTML = '';
  const cpIdx = state.turnOrder[state.currentTurnIdx];
  const visiblePlayers = state.gameMode === 'pvp'
    ? state.players.filter((_, i) => i !== cpIdx)
    : state.players.filter(p => !p.isHuman);
  row.style.setProperty('--player-count', String(Math.max(visiblePlayers.length, 1)));

  for (const p of visiblePlayers) {
    const i = state.players.indexOf(p);
    const chip = document.createElement('div');
    chip.className = 'player-chip'
      + (i === cpIdx ? ' is-turn' : '');
    chip.dataset.seat = String(i);

    const avatar = document.createElement('div');
    avatar.className = 'chip-avatar';
    if (p.avatar) {
      const img = document.createElement('img');
      img.src = p.avatar;
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

    if (p.skipped) {
      const b = document.createElement('div'); b.className = 'chip-badge'; b.textContent = 'SKIP'; chip.appendChild(b);
    }
    row.appendChild(chip);
  }

  renderHumanStatus(cpIdx);
}

function renderHumanStatus(currentPlayerIdx) {
  const host = $('human-status');
  if (!host) return;

  // PvP: 現在の手番者を「YOU」として表示。vs-cpu: isHuman の固定プレイヤー
  const humanIdx = state.gameMode === 'pvp' ? currentPlayerIdx : state.players.findIndex(p => p.isHuman);
  const human = state.players[humanIdx];
  if (!human) {
    host.innerHTML = '';
    return;
  }

  host.innerHTML = '';
  host.classList.toggle('is-turn', humanIdx === currentPlayerIdx);
  host.style.setProperty('--drunk-ratio', `${Math.min(100, human.drunk * 12.5)}%`);

  const avatar = document.createElement('div');
  avatar.className = 'human-avatar';
  if (human.avatar) {
    const img = document.createElement('img');
    img.src = human.avatar;
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    avatar.appendChild(img);
  }

  const main = document.createElement('div');
  main.className = 'human-status-main';

  const head = document.createElement('div');
  head.className = 'human-status-head';
  const name = document.createElement('span');
  name.className = 'human-name';
  name.textContent = human.name;
  const value = document.createElement('span');
  value.className = 'human-drunk-value';
  value.textContent = `🍺 ${human.drunk} 酔い`;
  const handCount = document.createElement('span');
  handCount.className = 'human-hand-count';
  handCount.textContent = `手札 ${human.hand.length}`;
  head.append(name, value, handCount);

  const meter = document.createElement('div');
  meter.className = 'human-drunk-meter';
  const fill = document.createElement('span');
  fill.className = 'human-drunk-fill';
  meter.appendChild(fill);
  main.append(head, meter);

  const tag = document.createElement('div');
  tag.className = 'human-status-tag';
  // PvP では常に手番者を表示するので 'YOUR TURN' 固定。vs-cpu は従来通り
  tag.textContent = human.noDrinkGuard ? 'GUARD'
    : (state.gameMode === 'pvp' ? 'YOUR TURN' : (humanIdx === currentPlayerIdx ? 'YOUR TURN' : 'YOU'));

  host.append(avatar, main, tag);
}

function renderStage() {
  const cp = currentPlayer();
  const banner = $('turn-banner');
  const board = document.querySelector('.party-board');
  const isForcedDraw = state.phase === 'FORCED_DRAW';
  const isPass = state.phase === 'PASS';

  // パスオーバーレイの表示制御（PvP 専用）
  const passOverlay = $('pass-overlay');
  if (passOverlay) {
    if (isPass && state.gameMode === 'pvp') {
      $('pass-name').textContent = cp.name;
      const avatarEl = $('pass-avatar');
      if (avatarEl) {
        avatarEl.src = cp.avatar || '';
        avatarEl.style.display = cp.avatar ? '' : 'none';
      }
      // 強制ドロー待ちの場合は note を変更
      const noteEl = $('pass-note');
      if (noteEl && state.forcedDrawPending) {
        const src = state.forcedDrawPending.sourcePlayerName;
        const reason = state.forcedDrawPending.reason;
        noteEl.textContent = reason === 'target'
          ? `${src} から「お前が飲め！」— 山札を引かされます。`
          : '「とりあえず一杯」— 山札を引かされます。';
      } else if (noteEl) {
        noteEl.textContent = '他の人に見られてないか確認したら、めくろう。';
      }
      passOverlay.classList.remove('hidden');
    } else {
      passOverlay.classList.add('hidden');
    }
  }

  if (isForcedDraw) {
    const fp = state.forcedDrawPending;
    if (fp?.reason === 'target') {
      banner.textContent = `${fp.sourcePlayerName} から「お前が飲め！」🍺`;
    } else {
      banner.textContent = '「とりあえず一杯」— 引かされます！';
    }
  } else if (isPass) {
    banner.textContent = `${cp.name} のターンへ`;
  } else if (state.phase === 'RESOLVING') {
    banner.textContent = '処理中…';
  } else if (state.phase === 'CPU_TURN') {
    banner.textContent = `${cp.name} のターン…`;
  } else {
    banner.textContent = state.gameMode === 'pvp' ? `${cp.name} のターン` : 'あなたのターン';
  }

  board?.classList.toggle('is-forced-draw', isForcedDraw);

  renderEventCard();

  // ログ（最新順）
  const logEl = $('game-log');
  logEl.innerHTML = '';
  for (const [i, entry] of [...state.log].reverse().slice(0, 4).entries()) {
    const div = document.createElement('div');
    div.className = 'log-entry ' + (entry.cls || '') + (i === 0 ? ' is-latest' : '');
    const label = document.createElement('span');
    label.className = 'log-label';
    label.textContent = entry.label || 'LOG';
    const text = document.createElement('span');
    text.className = 'log-text';
    text.textContent = entry.msg;
    div.append(label, text);
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
  const serial = String(event.serial || 0);
  if (card.dataset.eventSerial !== serial) {
    card.dataset.eventSerial = serial;
    card.classList.remove('is-flipping');
    void card.offsetWidth;
    card.classList.add('is-flipping');
  }
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
  badge.setAttribute('aria-label', state.deck.length > 0 ? `山札 残り ${state.deck.length} 枚` : '山札は空');

  // 古いDOMの直書きテキストが残ってもボタン文言が二重にならないよう整える。
  for (const node of [...drawBtn.childNodes]) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) node.remove();
  }

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

    // PvP では currentPlayer() がすでに引かされるプレイヤーに切替済み
    const drawPlayer = state.gameMode === 'pvp'
      ? currentPlayer()
      : state.players.find(p => p.isHuman);
    const c = drawFromDeck();
    resolveDrawCard(c, drawPlayer);
    renderAll();

    if (reason === 'force') {
      // とりあえず一杯 → 現手番者のターンに戻る（pvp/vs-cpu 共通）
      state.hasDrawnThisTurn = true;
      state.phase = 'PLAYER_TURN';
      renderAll();
    } else {
      // お前が飲め
      if (state.gameMode === 'pvp' && state.targetPendingFrom !== null) {
        // PvP: 使用者の席に戻り、ドロー義務を果たした状態で再開
        state.currentTurnIdx = state.targetPendingFrom;
        state.targetPendingFrom = null;
        state.hasDrawnThisTurn = true;
        state.phase = 'PLAYER_TURN';
        renderAll();
      } else {
        // vs-cpu: CPUターンに戻してターン終了
        state.phase = 'CPU_TURN';
        state.hasDrawnThisTurn = true;
        renderAll();
        setTimeout(endTurn, 900);
      }
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
  const isPvp = state.gameMode === 'pvp';
  const human = isPvp ? null : state.players.find(p => p.isHuman);
  const humanRank = human ? sorted.findIndex(p => p.id === human.id) + 1 : 0;
  const worst = sorted[sorted.length - 1];
  if (summaryEl) {
    if (isPvp) {
      summaryEl.textContent = `${worst.name} が一番飲んだ夜。お疲れさま。`;
    } else if (winners.some(p => p.isHuman)) {
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
    name.textContent = p.name + (!isPvp && p.isHuman ? ' (YOU)' : '');

    const right = document.createElement('div');
    right.style.cssText = 'display:flex;flex-direction:column;align-items:flex-end;gap:2px;';

    const drunk = document.createElement('div'); drunk.className = 'rank-drunk';       drunk.textContent = p.drunk;
    const lbl   = document.createElement('div'); lbl.className   = 'rank-drunk-label'; lbl.textContent   = '酔い';
    right.append(drunk, lbl);

    row.append(num, name, right);
    rankings.appendChild(row);
  }

  updatePartyXPostLink(sorted, human, humanRank);
}

function buildPartyResultPostText(sorted, human, humanRank) {
  const minDrunk = sorted[0].drunk;
  const winners  = sorted.filter(p => p.drunk === minDrunk);
  const winLabel = winners.length === 1 ? winners[0].name : winners.map(p => p.name).join(' & ');
  if (state.gameMode === 'pvp') {
    const scoreLine = sorted.map(p => `${p.name}🍺${p.drunk}`).join(' / ');
    return [
      'テキーラから逃げろ！PARTY MODE（ローカル対人）',
      `${state.maxRounds}R × ${state.players.length}人`,
      `勝者: ${winLabel}`,
      `最終: ${scoreLine}`,
    ].join('\n');
  }
  const worst = sorted[sorted.length - 1];
  return [
    'テキーラから逃げろ！PARTY MODE',
    `${state.maxRounds}R × ${state.players.length}人`,
    `勝者: ${winLabel}`,
    human ? `あなた: ${humanRank}位 / 酔い${human.drunk}` : null,
    `最大被弾: ${worst.name} 酔い${worst.drunk}`,
  ].filter(Boolean).join('\n');
}

function updatePartyXPostLink(sorted, human, humanRank) {
  const link = $('post-x-btn');
  if (!link) return;
  const text = buildPartyResultPostText(sorted, human, humanRank);
  const params = new URLSearchParams({ text, hashtags: 'テキーラから逃げろ' });
  link.href = `https://twitter.com/intent/tweet?${params.toString()}`;
}

// ── Start / Restart ──
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(screenId).classList.add('active');
}

function showSetup() {
  showScreen('setup-screen');
}

function openHelp() {
  $('help-overlay').classList.remove('hidden');
}

function closeHelp() {
  $('help-overlay').classList.add('hidden');
}

function selectedCpuCount() {
  return parseInt(document.querySelector('.cpu-count-btn.active')?.dataset.count || '2');
}

function ensureCpuCharacterSelection(fillMissing = true) {
  const count = selectedCpuCount();
  selectedCpuCharacterIds = selectedCpuCharacterIds.filter(id => id !== selectedHumanCharacterId);

  if (fillMissing) {
    for (const c of defaultCpuCharacters(count, selectedHumanCharacterId)) {
      if (selectedCpuCharacterIds.length >= count) break;
      if (!selectedCpuCharacterIds.includes(c.id)) selectedCpuCharacterIds.push(c.id);
    }
  }

  if (selectedCpuCharacterIds.length > count) {
    selectedCpuCharacterIds = selectedCpuCharacterIds.slice(0, count);
  }
}

function renderCharacterSetup(fillMissing = false) {
  const humanList = $('human-character-list');
  const cpuList = $('cpu-character-list');
  if (!humanList || !cpuList) return;

  ensureCpuCharacterSelection(fillMissing);
  humanList.innerHTML = '';
  cpuList.innerHTML = '';

  for (const character of CHARACTERS) {
    humanList.appendChild(createCharacterButton(character, 'human'));
    cpuList.appendChild(createCharacterButton(character, 'cpu'));
  }
}

function createCharacterButton(character, role) {
  const isHumanRole = role === 'human';
  const selected = isHumanRole
    ? selectedHumanCharacterId === character.id
    : selectedCpuCharacterIds.includes(character.id);
  const disabled = !isHumanRole && selectedHumanCharacterId === character.id;
  const profile = CPU_LEVELS[character.cpuLevel] || CPU_LEVELS.easy;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'character-btn';
  btn.dataset.characterId = character.id;
  btn.dataset.selectRole = role;
  btn.style.setProperty('--char-accent', character.gender === 'male' ? '#8E55FF' : '#FF2D6F');
  btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
  if (isHumanRole) btn.setAttribute('role', 'radio');
  if (disabled) btn.disabled = true;

  const portrait = document.createElement('span');
  portrait.className = 'character-portrait';
  const img = document.createElement('img');
  img.src = character.avatar;
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  portrait.appendChild(img);

  const name = document.createElement('span');
  name.className = 'character-name';
  name.textContent = character.name;

  const meta = document.createElement('span');
  meta.className = 'character-meta';
  meta.textContent = isHumanRole ? 'プレイヤー' : profile.label;

  btn.append(portrait, name, meta);

  btn.addEventListener('click', () => {
    if (isHumanRole) {
      selectedHumanCharacterId = character.id;
      renderCharacterSetup(true);
      return;
    }

    if (character.id === selectedHumanCharacterId) {
      showToast('自分のキャラはCPUにできません');
      return;
    }

    const count = selectedCpuCount();
    if (selectedCpuCharacterIds.includes(character.id)) {
      if (selectedCpuCharacterIds.length <= 1) return;
      selectedCpuCharacterIds = selectedCpuCharacterIds.filter(id => id !== character.id);
    } else if (selectedCpuCharacterIds.length < count) {
      selectedCpuCharacterIds.push(character.id);
    } else {
      selectedCpuCharacterIds = [...selectedCpuCharacterIds.slice(0, count - 1), character.id];
    }

    ensureCpuCharacterSelection(false);
    renderCharacterSetup();
  });

  return btn;
}

function startGame() {
  const maxRounds = parseInt(document.querySelector('.round-btn.active')?.dataset.rounds || '10');

  if (setupMode === 'pvp') {
    const seats = pvpSeats.slice(0, pvpCount).map((s, i) => ({
      name: (s.name?.trim() || `P${i + 1}`).slice(0, 8),
      character: getCharacter(s.characterId || pvpFallbackCharacter(i)),
    }));
    state = initStatePvp(seats, maxRounds);
    state.phase = 'PASS';
  } else {
    const name = $('player-name').value.trim() || 'あなた';
    const cpuCount = selectedCpuCount();
    ensureCpuCharacterSelection(true);
    const humanCharacter = getCharacter(selectedHumanCharacterId);
    const cpuCharacters = selectedCpuCharacterIds.slice(0, cpuCount).map(getCharacter);
    state = initState(name, cpuCount, maxRounds, humanCharacter, cpuCharacters);
    state.phase = 'PLAYER_TURN';
  }

  showScreen('game-screen');
  renderAll();
}

function pvpFallbackCharacter(seatIndex) {
  const usedIds = pvpSeats.slice(0, seatIndex).map(s => s.characterId).filter(Boolean);
  const available = CHARACTERS.filter(c => !usedIds.includes(c.id));
  return (available[0] || CHARACTERS[seatIndex % CHARACTERS.length]).id;
}

function onPassRevealClick() {
  if (state.phase !== 'PASS') return;
  if (state.forcedDrawPending) {
    const cp = currentPlayer();
    const reason = state.forcedDrawPending.reason;
    const src = state.forcedDrawPending.sourcePlayerName;
    addLog(`${cp.name} → 強制ドロー（${reason === 'target' ? `${src} のお前が飲め` : 'とりあえず一杯'}の効果）— 山札を引いてください`, 'log-card');
    state.phase = 'FORCED_DRAW';
  } else {
    state.phase = 'PLAYER_TURN';
  }
  renderAll();
}

// ── PvP Setup UI ──
function renderPvpPlayerSetup() {
  const container = $('pvp-player-setup');
  if (!container) return;

  // pvpSeats を pvpCount に合わせてリサイズ（既存の値は保持、不足分はデフォルトキャラを割り当て）
  while (pvpSeats.length < pvpCount) {
    const idx = pvpSeats.length;
    const usedIds = pvpSeats.map(s => s.characterId).filter(Boolean);
    const available = CHARACTERS.filter(c => !usedIds.includes(c.id));
    pvpSeats.push({ name: '', characterId: (available[0] || CHARACTERS[idx % CHARACTERS.length]).id });
  }
  pvpSeats = pvpSeats.slice(0, pvpCount);

  container.innerHTML = '';
  const labels = ['P1', 'P2', 'P3', 'P4'];

  for (let i = 0; i < pvpCount; i++) {
    const seat = pvpSeats[i];
    const seatEl = document.createElement('div');
    seatEl.className = 'pvp-seat';

    const head = document.createElement('div');
    head.className = 'pvp-seat-head';

    const label = document.createElement('span');
    label.className = 'pvp-seat-label';
    label.textContent = labels[i];

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 8;
    input.placeholder = labels[i];
    input.value = seat.name;
    input.autocomplete = 'off';
    input.addEventListener('input', () => { pvpSeats[i].name = input.value; });

    head.append(label, input);

    // キャラ選択グリッド
    const grid = document.createElement('div');
    grid.className = 'character-grid pvp-character-grid';
    grid.setAttribute('role', 'radiogroup');
    grid.setAttribute('aria-label', `${labels[i]} のキャラクター`);

    const usedByOthers = pvpSeats
      .filter((_, j) => j !== i)
      .map(s => s.characterId)
      .filter(Boolean);

    for (const char of CHARACTERS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'character-btn';
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-pressed', seat.characterId === char.id ? 'true' : 'false');
      btn.style.setProperty('--char-accent', char.gender === 'male' ? '#8E55FF' : '#FF2D6F');
      if (usedByOthers.includes(char.id)) {
        btn.disabled = true;
        btn.setAttribute('aria-disabled', 'true');
      }

      const portrait = document.createElement('span');
      portrait.className = 'character-portrait';
      const img = document.createElement('img');
      img.src = char.avatar;
      img.alt = '';
      img.setAttribute('aria-hidden', 'true');
      portrait.appendChild(img);

      const name = document.createElement('span');
      name.className = 'character-name';
      name.textContent = char.name;

      btn.append(portrait, name);
      btn.addEventListener('click', () => {
        pvpSeats[i].characterId = char.id;
        renderPvpPlayerSetup();
      });
      grid.appendChild(btn);
    }

    seatEl.append(head, grid);
    container.appendChild(seatEl);
  }
}

function switchSetupMode(mode) {
  setupMode = mode;
  document.querySelectorAll('[data-mode-section]').forEach(el => {
    el.hidden = el.dataset.modeSection !== mode;
  });
  document.querySelectorAll('.mode-btn').forEach(btn => {
    const active = btn.dataset.mode === mode;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  if (mode === 'pvp') renderPvpPlayerSetup();
}

function clearTransientUI() {
  clearTimeout(showSfx._tid);
  clearTimeout(showCutin._tid);
  clearTimeout(showToast._tid);
  $('peek-overlay').classList.add('hidden');
  $('target-overlay').classList.add('hidden');
  $('pass-overlay')?.classList.add('hidden');
  $('help-overlay').classList.add('hidden');
  $('cutin').classList.add('hidden');
  $('cutin').classList.remove('show');
  $('sfx-text').classList.remove('show');
  $('toast-msg').classList.remove('show');
}

function restartGame() {
  clearTransientUI();
  state = null;
  showScreen('guide-screen');
}

function playAgain() {
  if (!state) return;
  const maxRounds = state.maxRounds;
  clearTransientUI();
  if (state.gameMode === 'pvp') {
    const seats = state.players.map(p => ({
      name: p.name,
      character: getCharacter(p.characterId),
    }));
    state = initStatePvp(seats, maxRounds);
    state.phase = 'PASS';
  } else {
    const human = state.players.find(p => p.isHuman);
    const name = human?.name || 'あなた';
    const cpuCount = state.players.length - 1;
    const humanCharacter = getCharacter(human?.characterId || selectedHumanCharacterId);
    const cpuCharacters = state.players.filter(p => !p.isHuman).map(p => getCharacter(p.characterId));
    state = initState(name, cpuCount, maxRounds, humanCharacter, cpuCharacters);
    state.phase = 'PLAYER_TURN';
  }
  showScreen('game-screen');
  renderAll();
}

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  $('guide-start-btn').addEventListener('click', showSetup);
  $('game-help-btn').addEventListener('click', openHelp);
  $('help-close-btn').addEventListener('click', closeHelp);
  $('help-start-btn').addEventListener('click', () => {
    closeHelp();
    showSetup();
  });
  $('help-overlay').addEventListener('click', event => {
    if (event.target === $('help-overlay')) closeHelp();
  });
  $('start-btn').addEventListener('click', startGame);
  $('retry-btn').addEventListener('click', restartGame);
  $('play-again-btn').addEventListener('click', playAgain);
  $('top-btn').addEventListener('click', restartGame);
  $('draw-btn').addEventListener('click', onDrawClick);
  $('end-turn-btn').addEventListener('click', onEndTurnClick);
  $('peek-close').addEventListener('click', () => $('peek-overlay').classList.add('hidden'));
  $('target-cancel').addEventListener('click', () => $('target-overlay').classList.add('hidden'));
  $('pass-reveal-btn').addEventListener('click', onPassRevealClick);

  // モード切替
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => switchSetupMode(btn.dataset.mode));
  });

  // PvP 人数ボタン
  document.querySelectorAll('.pvp-count-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pvp-count-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      pvpCount = parseInt(btn.dataset.count || '2');
      renderPvpPlayerSetup();
    });
  });

  document.querySelectorAll('.cpu-count-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cpu-count-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateChoiceAria('.cpu-count-btn');
      renderCharacterSetup(true);
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
  renderCharacterSetup(true);
});

function updateChoiceAria(selector) {
  document.querySelectorAll(selector).forEach(btn => {
    btn.setAttribute('aria-pressed', btn.classList.contains('active') ? 'true' : 'false');
  });
}
