'use strict';

// ── カード定義 ──
const DECK_CARDS = [
  { id: 'safe',          label: 'セーフ',               count: 19, type: 'deck' },
  { id: 'tequila',       label: 'テキーラ',              count:  6, type: 'deck' },
  { id: 'kanpai',        label: '全員集合！乾杯！',       count:  2, type: 'deck' },
  { id: 'tequila_party', label: '全員強制テキーラ乾杯',   count:  1, type: 'deck' },
];

const ACTION_DEFS = {
  reverse: { id:'reverse', label:'帰宅方向逆です', icon:'↺', effect:'順番を逆回りに',      accent:'--accent-reverse', art:'assets/generated/hand-card-reverse.webp' },
  force:   { id:'force',   label:'とりあえず一杯', icon:'杯', effect:'強制ドロー+即終了',  accent:'--accent-force',   art:'assets/generated/hand-card-force.webp'   },
  target:  { id:'target',  label:'お前が飲め',     icon:'指', effect:'誰かに引かせる',      accent:'--accent-target',  art:'assets/generated/hand-card-target.webp'  },
  double:  { id:'double',  label:'倍プッシュだ……！',icon:'倍', effect:'次のテキーラが×2',   accent:'--accent-double',  art:'assets/generated/hand-card-double.webp'  },
  peek:    { id:'peek',    label:'嫌な予感',        icon:'視', effect:'山札の上を見る',      accent:'--accent-peek',    art:'assets/generated/hand-card-peek.webp'    },
  skip:    { id:'skip',    label:'スキップ',        icon:'飛', effect:'次の人を飛ばす',      accent:'--accent-skip',    art:'assets/generated/hand-card-skip.webp'    },
  dodge:   { id:'dodge',   label:'回避',            icon:'避', effect:'即終了+次被弾者+1',  accent:'--accent-dodge',   art:'assets/generated/hand-card-dodge.webp'   },
  guard:   { id:'guard',   label:'飲みません宣言',  icon:'拒', effect:'テキーラ回避+1枚',  accent:'--accent-guard',   art:'assets/generated/hand-card-guard.webp'   },
};

const ACTION_COUNTS = { reverse:4, force:4, target:4, double:4, peek:4, skip:4, dodge:4, guard:4 };
const SIMPLE_ACTION_COUNTS = { force:6, target:6, peek:6, guard:6 };

const DEFAULT_ELIMINATION_HP = 5;

const CHARACTERS = [
  { id: 'aiA',   name: 'アイA',    avatar: 'assets/aiA.png',       gender: 'female', cpuLevel: 'normal', skill: 'aiA_player'    },
  { id: 'aiB',   name: 'アイB',    avatar: 'assets/aiB.png',       gender: 'male',   cpuLevel: 'normal', skill: 'aiB_player'    },
  { id: 'koji',  name: 'こーじ',  avatar: 'assets/koji.png',      gender: 'male',   cpuLevel: 'hard',   skill: 'koji_cold'     },
  { id: 'ryota', name: 'りょーた', avatar: 'assets/ryota.png',     gender: 'male',   cpuLevel: 'normal', skill: 'ryota_yolo'    },
  { id: 'osho',  name: 'おしょー', avatar: 'assets/osho.png',      gender: 'male',   cpuLevel: 'hard',   skill: 'osho_tricky'   },
  { id: 'nana',  name: 'なな',     avatar: 'assets/nana.png',      gender: 'female', cpuLevel: 'easy',   skill: 'nana_helpless' },
  { id: 'yapi',  name: 'やぴ',     avatar: 'assets/yapi-card.png', gender: 'female', cpuLevel: 'normal', skill: 'yapi_whimsy'   },
  { id: 'milk',  name: 'みるく',   avatar: 'assets/milk-card.png', gender: 'female', cpuLevel: 'easy',   skill: 'milk_reserve'  },
];

const VS_CPU_HUMAN_CHARACTER_IDS = ['aiA', 'aiB'];
const CPU_CHARACTER_IDS = ['koji', 'ryota', 'osho', 'nana', 'yapi', 'milk'];
const DEFAULT_HUMAN_CHARACTER_ID = 'aiA';
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
  normal: {
    label: 'ふつう',
    peekChance: 0.73,
    dangerAvoidChance: 0.79,
    kanpaiAvoidChance: 0.65,
    harassChance: 0.42,
    reverseHarassChance: 0.32,
    targetBestChance: 0.75,
    safeChainChance: 0.41,
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

const CPU_SKILLS = {
  koji_cold:     { alwaysComboDoubleTarget: true, neverChainAfterSafe: true },
  ryota_yolo:    { alwaysChainAfterSafe: true, neverUseDodge: true },
  osho_tricky:   { dangerIgnoreChance: 0.05 },
  nana_helpless: { neverUseGuard: true, neverUseTarget: true },
  yapi_whimsy:   { wildcardChance: 0.35 },
  milk_reserve:  { guardAtDrunk: 3 },
};

const CPU_FLAVOR = {
  koji_cold: {
    draw:    ['「……」'],
    safe:    ['「読んでたぞ」', '「……」'],
    tequila: ['「ちっ」', '「想定内だ」'],
    guard:   ['「俺には関係ない」'],
    target:  ['「お前だ」', '「読んでたぞ」'],
    combo:   ['「詰めだ」'],
  },
  ryota_yolo: {
    draw:    ['「えいっ！」'],
    safe:    ['「もう1枚いくぜ！」', '「うぇーい🥃」'],
    tequila: ['「うっ……でもいくぜ！」'],
    chain:   ['「まだまだ！」'],
    target:  ['「お前飲め〜！」'],
  },
  osho_tricky: {
    draw:    ['「ふっ…」'],
    safe:    ['「ふっ…」', '「まだまだ」'],
    tequila: ['「想定の範囲内」'],
    skip:    ['「詰めが甘いな」', '「ふっ…」'],
    target:  ['「詰めだ」'],
  },
  nana_helpless: {
    draw:    ['「いくよ〜」'],
    safe:    ['「よかった〜！」'],
    tequila: ['「えっ……飲むの？」', '「しょうがないか〜」'],
  },
  yapi_whimsy: {
    draw:    ['「えいっ！」', '「なんとかな〜れ！」'],
    safe:    ['「やった〜！」', '「えへへ〜♪」'],
    tequila: ['「えっ〜！」', '「やぴは悪くない！」'],
    action:  ['「なんとかな〜れ！」', '「えへへ〜♪」'],
  },
  milk_reserve: {
    draw:    ['「……」'],
    safe:    ['「……（安堵）」'],
    tequila: ['「……（受け入れる）」'],
    guard:   ['「気をつけて」', '「……」'],
  },
};

let selectedHumanCharacterId = DEFAULT_HUMAN_CHARACTER_ID;
let selectedCpuCharacterIds = [];

// PvP セットアップ用
let setupMode = 'vs-cpu';
let pvpCount = 2;
let pvpSeats = []; // [{ name: string, characterId: string }]
let pvpGameType = 'standard'; // 'standard' | 'elimination'
let pvpInitialHp = DEFAULT_ELIMINATION_HP;
let pvpCardSet = 'simple'; // 'simple' | 'normal'
let pvpTequilaCount = 6;

const EVENT_COPY = {
  safe:    { tone:'safe',    kicker:'SAFE',   title:'セーフ',           copy:'息を止めてめくった一枚は、まだ夜を壊さない。' },
  tequila: { tone:'tequila', kicker:'HIT',    title:'テキーラ！',       copy:'卓上の空気が一瞬だけ熱く跳ねる。' },
  kanpai:  { tone:'kanpai',  kicker:'ALL IN', title:'全員集合！乾杯！', copy:'全員が山札へ手を伸ばす。逃げ場はない。' },
  tequilaParty: { tone:'tequila', kicker:'DANGER', title:'全員強制テキーラ乾杯', copy:'卓上全員にグラスが配られる。逃げ場は完全に消えた。' },
  action:  { tone:'action',  kicker:'ACTION', title:'アクション',       copy:'カードが卓上の流れを書き換える。' },
  waiting: { tone:'waiting', kicker:'NEXT DRAW', title:'山札',          copy:'一枚引くまで、運命は伏せられている。' },
};

const GENERATED_ASSETS = {
  eventArt: {
    safe: 'assets/generated/draw-safe.webp',
    tequila: 'assets/generated/draw-tequila.webp',
    kanpai: 'assets/generated/draw-kanpai.webp',
    tequilaParty: 'assets/generated/draw-tequila-party.webp',
  },
  cutinArt: {
    safe: 'assets/generated/effect-safe.webp',
    tequila: 'assets/generated/effect-tequila.webp',
    kanpai: 'assets/generated/effect-win.webp',
    tequilaParty: 'assets/generated/effect-tequila.webp',
    guard: 'assets/generated/effect-guard.webp',
    win: 'assets/generated/effect-win.webp',
  },
  resultBadge: {
    winner: 'assets/generated/badge-winner.webp',
    survivor: 'assets/generated/badge-survivor.webp',
    victim: 'assets/generated/badge-victim.webp',
    drunkKing: 'assets/generated/badge-drunk-king.webp',
  },
};

// ── State ──
let state = null;

function buildDeck(pvp = false, options = {}) {
  const excluded = pvp ? new Set() : new Set(['kanpai', 'tequila_party']);
  const tequilaCount = Number.isFinite(options.tequilaCount) ? options.tequilaCount : null;
  const tequilaPartyCount = Number.isFinite(options.tequilaPartyCount) ? options.tequilaPartyCount : null;
  const deck = [];
  for (const c of DECK_CARDS) {
    if (excluded.has(c.id)) continue;
    let count = c.count;
    if (c.id === 'tequila' && tequilaCount !== null) count = tequilaCount;
    if (c.id === 'tequila_party' && tequilaPartyCount !== null) count = tequilaPartyCount;
    for (let i = 0; i < count; i++) deck.push({ ...c });
  }
  return shuffle(deck);
}

function buildActionPool(playerCount = Infinity, cardSet = 'normal') {
  // 2人プレイでは reverse（自分のターンに戻るだけ）と skip（相手だけ連続飛ばし）が機能しない
  const excluded = playerCount <= 2 ? new Set(['reverse', 'skip']) : new Set();
  const counts = cardSet === 'simple' ? SIMPLE_ACTION_COUNTS : ACTION_COUNTS;
  const pool = [];
  for (const [id, count] of Object.entries(counts)) {
    if (excluded.has(id)) continue;
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
  const cpuCharacters = CPU_CHARACTER_IDS.map(getCharacter);
  const rest = cpuCharacters.filter(c => c.id !== humanCharacterId && !preferred.some(p => p.id === c.id));
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

function initState(playerName, cpuCount, maxCycles, humanCharacter, cpuCharacters) {
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
    deck:           buildDeck(false),
    deckDiscard:    [],
    actionDiscard:  [],
    turnOrder:      players.map((_, i) => i),
    currentTurnIdx: 0,
    direction:      1,
    turnsTaken:     0,
    deckCycle:      0,
    maxCycles,
    gameOverPending: false,
    doublePushActive: false,
    dodgeStack:       0,
    forceDrawTarget:  null,
    forcedDrawPending: null,
    targetPendingFrom: null,
    hasDrawnThisTurn: false,
    handRevealed: true,
    kanpaiPending: [],
    lastEvent: EVENT_COPY.waiting,
    eventSerial: 0,
    // SETUP | PLAYER_TURN | CPU_TURN | RESOLVING | FORCED_DRAW | PASS | RESULT
    phase: 'SETUP',
    log:   [],
    logSeq: 0,
    gameMode: 'vs-cpu',
  };
}

function initStatePvp(seats, maxCycles, gameType = 'standard', initialHp = DEFAULT_ELIMINATION_HP, cardSet = 'normal', tequilaCount = 6) {
  const isSimple = cardSet === 'simple';
  const tequilaPartyCount = isSimple ? randomInt(2, 3) : 1;
  const effectiveTequilaCount = gameType === 'standard' ? tequilaCount : 6;
  const actionPool = isSimple ? [] : buildActionPool(seats.length, cardSet);
  const players = seats.map((s, i) => createPlayer(`p${i}`, s.name, true, s.character));
  players.forEach(p => { p.hp = initialHp; });
  if (!isSimple) dealHands(players, actionPool);
  return {
    players,
    actionPool,
    deck: buildDeck(true, { tequilaCount: effectiveTequilaCount, tequilaPartyCount }),
    deckDiscard: [],
    actionDiscard: [],
    turnOrder: players.map((_, i) => i),
    currentTurnIdx: 0,
    direction: 1,
    turnsTaken: 0,
    deckCycle: 0,
    maxCycles,
    gameOverPending: false,
    doublePushActive: false,
    dodgeStack: 0,
    forceDrawTarget: null,
    forcedDrawPending: null,
    targetPendingFrom: null,
    hasDrawnThisTurn: false,
    handRevealed: false,
    kanpaiPending: [],
    eliminationCount: 0,
    lastEvent: EVENT_COPY.waiting,
    eventSerial: 0,
    phase: 'SETUP',
    log: [], logSeq: 0,
    gameMode: 'pvp',
    gameType,
    initialHp,
    cardSet,
    tequilaCount: effectiveTequilaCount,
    tequilaPartyCount,
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
    hp: DEFAULT_ELIMINATION_HP,
    eliminated: false,
    eliminationRank: 0,
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
  let idx = ((state.currentTurnIdx + state.direction * offset) % len + len) % len;
  if (state.gameType === 'elimination') {
    for (let i = 0; i < len; i++) {
      if (!state.players[state.turnOrder[idx]]?.eliminated) break;
      idx = ((idx + state.direction) % len + len) % len;
    }
  }
  return state.turnOrder[idx];
}

// ── Deck helpers ──
function drawFromDeck() {
  if (state.deck.length === 0) {
    if (state.gameOverPending) return null;
    const canContinue = onDeckCycleEnd();
    if (!canContinue) return null;
  }
  return state.deck.pop();
}

function onDeckCycleEnd() {
  state.deckCycle++;

  if (state.gameType !== 'elimination' && state.deckCycle >= state.maxCycles) {
    state.gameOverPending = true;
    addLog(`デッキが${state.maxCycles}周しました。ゲーム終了！`, 'log-card');
    return false;
  }

  // 捨て札 + テキーラ2枚追加でデッキ再構築
  const extra = [
    { id: 'tequila', label: 'テキーラ', count: 1, type: 'deck' },
    { id: 'tequila', label: 'テキーラ', count: 1, type: 'deck' },
  ];
  state.deck = shuffle([...state.deckDiscard, ...extra]);
  state.deckDiscard = [];
  if (!isSimplePvpState()) state.players.forEach(p => replenishHand(p));
  const refillText = isSimplePvpState() ? '' : ' 全員手札+1';
  addLog(`▶ ${state.deckCycle}周目終了！ テキーラ+2${refillText} → ${state.deckCycle + 1}周目スタート`, 'log-card');
  showCutin(`${state.deckCycle + 1}周目スタート`, 'テキーラが増えた……');
  return true;
}

function peekDeck() {
  return state.deck.length > 0 ? state.deck[state.deck.length - 1] : null;
}

function replenishHand(player) {
  if (isSimplePvpState()) return;
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
    kind,
    title: title || base.title,
    copy: copy || (playerName ? `${playerName} — ${base.copy}` : base.copy),
    serial: state.eventSerial,
  };
}

function applyTequilaHit(player, gain, label = 'テキーラ！') {
  player.drunk += gain;
  if (!isSimplePvpState()) {
    for (let i = 0; i < gain; i++) replenishHand(player);
  }
  const extra = gain > 1 ? ` (+${gain})` : '';
  addLog(`${player.name} → ${label}🥃 酔い${extra}`, 'log-tequila');

  if (state.gameType === 'elimination') {
    player.hp = Math.max(0, player.hp - gain);
    if (player.hp <= 0 && !player.eliminated) eliminatePlayer(player);
  }
}

function eliminatePlayer(player) {
  player.eliminated = true;
  state.eliminationCount = (state.eliminationCount || 0) + 1;
  player.eliminationRank = state.eliminationCount;
  addLog(`💀 ${player.name} 脱落！`, 'log-tequila');
  showCutin('脱落！', `${player.name} が倒れた`);
}

function checkEliminationGameOver() {
  if (state.gameType !== 'elimination') return false;
  const alive = state.players.filter(p => !p.eliminated);
  if (alive.length <= 1) {
    state.gameOverPending = true;
    return true;
  }
  return false;
}

function isSimplePvpState() {
  return state?.gameMode === 'pvp' && state.cardSet === 'simple';
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
  if (!card) {
    if (state.gameOverPending) {
      addLog('山札が尽きました。ターン終了でゲーム終了！', 'log-card');
    } else {
      addLog(`${player.name}: 山札が空でした`, '');
    }
    return;
  }

  discardCard(card);

  if (card.id !== 'tequila_party' && consumeNoDrinkGuard(player, card.id)) return;

  if (card.id === 'safe') {
    state.dodgeStack = 0;
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
    if (checkEliminationGameOver()) { finishGame(); return; }
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
    state.doublePushActive = false;
    state.dodgeStack = 0;
    if (checkEliminationGameOver()) { finishGame(); return; }
    setLastEvent('tequilaParty', player.name);
    showSfx('全員飲めー！！', 1400);
    triggerBoardImpact();
    showCutin('全員強制テキーラ乾杯！', '全員、逃げ場なし！！', 2200, 'mega');
    return;
  }

  if (card.id === 'kanpai' && !kanpaiNested) {
    // 乾杯はテキーラではないのでdodgeStackをリセット
    state.dodgeStack = 0;
    addLog('🥂 全員集合！乾杯！ — 全員引く！', 'log-all');
    setLastEvent('kanpai', player.name);
    showCutin('全員集合！乾杯！', 'みんな引け！');
    if (state.gameMode === 'pvp') {
      // PvP: 全員が順番にクリックで引く（脱落済みは除外）
      state.kanpaiPending = state.turnOrder.filter(pi => !state.players[pi]?.eliminated);
      state.phase = 'KANPAI_DRAW';
      renderAll();
      return;
    }
    for (const p of state.players) {
      const c = drawFromDeck();
      if (!c) continue;
      resolveDrawCard(c, p, /* kanpaiNested= */ true);
    }
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
  let next = ((state.currentTurnIdx + state.direction) % len + len) % len;
  if (state.gameType === 'elimination') {
    for (let i = 0; i < len; i++) {
      if (!state.players[state.turnOrder[next]]?.eliminated) break;
      next = ((next + state.direction) % len + len) % len;
    }
  }
  return next;
}

function endTurn() {
  state.turnsTaken++;
  if (state.gameOverPending) {
    finishGame();
    return;
  }

  const nextTurnIdx = advanceTurnIdx();
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
  state.handRevealed = state.gameMode !== 'pvp';

  if (state.gameMode === 'pvp') {
    // 強制ドロー対象の場合は PASS 解決後に FORCED_DRAW へ遷移させるためフラグだけ立てる
    if (state.forceDrawTarget === cp.id) {
      state.forceDrawTarget = null;
      state.forcedDrawPending = { sourcePlayerName: null, reason: 'force' };
    }
    state.phase = isSimplePvpState() ? 'PLAYER_TURN' : 'PASS';
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
  const skill = cpuSkill(cpu);
  cpu._peeked = false;

  const topId = knownTop?.id;
  const topIsDangerSelf = topId === 'tequila' || topId === 'tequila_party';
  const topIsKanpai     = topId === 'kanpai';

  // milk_reserve: drunk が閾値以上ならガードを最優先
  if (skill.guardAtDrunk !== undefined && cpu.drunk >= skill.guardAtDrunk) {
    const hasGuardMilk = cpu.hand.some(c => c.id === 'guard');
    if (hasGuardMilk && !cpu.noDrinkGuard) {
      const idx = cpu.hand.findIndex(c => c.id === 'guard');
      const card = cpu.hand.splice(idx, 1)[0];
      discardCard(card);
      cpu.noDrinkGuard = true;
      const f = cpuFlavor(cpu, 'guard') || '';
      addLog(`${cpu.name} → 飲みません宣言！${f ? `　${f}` : ''}`, 'log-card');
      setLastEvent('action', cpu.name, card.label, `${cpu.name} は次のテキーラに保険をかけた。`);
      showSfx('飲みません宣言！');
      renderAll();
      setTimeout(cpuDrawOnce, 700);
      return;
    }
  }

  // yapi_whimsy: wildcardChance の確率で判断を捨てて突っ込む
  if (skill.wildcardChance && Math.random() < skill.wildcardChance) {
    const f = cpuFlavor(cpu, 'action') || '';
    if (f) addLog(`${cpu.name}　${f}`, 'log-card');
    cpuDrawOnce();
    return;
  }

  // osho_tricky: 危険が見えても dangerIgnoreChance で無視して引く
  if (skill.dangerIgnoreChance && topIsDangerSelf && Math.random() < skill.dangerIgnoreChance) {
    const f = cpuFlavor(cpu, 'draw') || '';
    if (f) addLog(`${cpu.name}　${f}`, '');
    cpuDrawOnce();
    return;
  }

  if (topIsDangerSelf && Math.random() < profile.dangerAvoidChance) {
    const hasDouble = cpu.hand.some(c => c.id === 'double');
    const hasTarget = cpu.hand.some(c => c.id === 'target') && !skill.neverUseTarget;
    const hasDodge  = cpu.hand.some(c => c.id === 'dodge')  && !skill.neverUseDodge;
    const hasGuard  = cpu.hand.some(c => c.id === 'guard')  && !skill.neverUseGuard;

    // koji_cold: double+target コンボを確定で撃つ
    const comboGuaranteed = skill.alwaysComboDoubleTarget && hasDouble && cpu.hand.some(c => c.id === 'target');
    if (comboGuaranteed || (hasDouble && hasTarget)) {
      const doubleIdx = cpu.hand.findIndex(c => c.id === 'double');
      const card = cpu.hand.splice(doubleIdx, 1)[0];
      discardCard(card);
      state.doublePushActive = true;
      const f = cpuFlavor(cpu, 'combo') || '';
      addLog(`${cpu.name} → 倍プッシュだ……！${f ? `　${f}` : ''}`, 'log-card');
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
      const f = cpuFlavor(cpu, 'guard') || '';
      addLog(`${cpu.name} → 飲みません宣言！${f ? `　${f}` : ''}`, 'log-card');
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
  const skill = cpuSkill(cpu);
  setTimeout(() => {
    const df = cpuFlavor(cpu, 'draw') || '';
    addLog(`${cpu.name} → 山札を引く${df ? `　${df}` : ''}`, '');
    const c = drawFromDeck();
    resolveDrawCard(c, cpu);
    state.hasDrawnThisTurn = true;

    // ドロー結果のフレーバー
    if (c?.id === 'safe') {
      const f = cpuFlavor(cpu, 'safe');
      if (f) setTimeout(() => { addLog(`${cpu.name}　${f}`, 'log-safe'); renderAll(); }, 250);
    } else if (c?.id === 'tequila' || c?.id === 'tequila_party') {
      const f = cpuFlavor(cpu, 'tequila');
      if (f) setTimeout(() => { addLog(`${cpu.name}　${f}`, 'log-tequila'); renderAll(); }, 250);
    }

    renderAll();

    const drewSafe = c?.id === 'safe';
    if (drewSafe && skill.alwaysChainAfterSafe) {
      // ryota_yolo: セーフなら必ず突っ込む
      const cf = cpuFlavor(cpu, 'chain') || 'もう1枚いく……';
      addLog(`${cpu.name} → ${cf}`, '');
      setTimeout(cpuDrawOnce, 700);
    } else if (drewSafe && !skill.neverChainAfterSafe && Math.random() < profile.safeChainChance) {
      // 通常のチキンレース（koji_cold はここに来ない）
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
  const tf = cpuFlavor(cpu, 'target') || '';
  addLog(`${cpu.name} → お前が飲め！ → ${target.name}${tf ? `　${tf}` : ''}`, 'log-card');
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
  let sorted;
  if (state.gameType === 'elimination') {
    // 生存者 > 脱落者（脱落が遅いほど上位）
    sorted = [...state.players].sort((a, b) => {
      if (!a.eliminated && b.eliminated) return -1;
      if (a.eliminated && !b.eliminated) return 1;
      if (a.eliminated && b.eliminated) return b.eliminationRank - a.eliminationRank;
      return a.drunk - b.drunk;
    });
  } else {
    sorted = [...state.players].sort((a, b) => a.drunk - b.drunk);
  }
  showResultScreen(sorted);
}

// ── Utilities ──
function $(id) { return document.getElementById(id); }

function cpuProfile(player) {
  return CPU_LEVELS[player?.cpuLevel] || CPU_LEVELS.easy;
}

function cpuSkill(player) {
  return CPU_SKILLS[player?.character?.skill] || {};
}

function cpuFlavor(cpu, situation) {
  const lines = CPU_FLAVOR[cpu?.character?.skill]?.[situation];
  if (!lines?.length) return null;
  return lines[Math.floor(Math.random() * lines.length)];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function showSfx(text, duration = 900) {
  const el = $('sfx-text');
  el.textContent = text;
  announce(text);
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(showSfx._tid);
  showSfx._tid = setTimeout(() => el.classList.remove('show'), duration);
}

function showCutin(title, kicker, duration = 1400, variant = '') {
  const el = $('cutin');
  el.classList.remove('hidden');
  el.classList.toggle('is-mega', variant === 'mega');
  $('cutin-title').textContent  = title;
  $('cutin-kicker').textContent = kicker;
  const art = cutinArtForTitle(title);
  if (art) el.style.setProperty('--cutin-art', `url("${art}")`);
  announce(`${kicker} ${title}`);
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(showCutin._tid);
  showCutin._tid = setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => {
      el.classList.add('hidden');
      el.classList.remove('is-mega');
    }, 200);
  }, duration);
}

function triggerBoardImpact() {
  const screen = $('game-screen');
  if (!screen) return;
  screen.classList.remove('impact-mega');
  void screen.offsetWidth;
  screen.classList.add('impact-mega');
  clearTimeout(triggerBoardImpact._tid);
  triggerBoardImpact._tid = setTimeout(() => screen.classList.remove('impact-mega'), 760);
}

function cutinArtForTitle(title) {
  if (title.includes('セーフ')) return GENERATED_ASSETS.cutinArt.safe;
  if (title.includes('飲まない') || title.includes('飲みません')) return GENERATED_ASSETS.cutinArt.guard;
  if (title.includes('乾杯') && !title.includes('強制テキーラ')) return GENERATED_ASSETS.cutinArt.kanpai;
  if (title.includes('勝') || title.includes('RESULT')) return GENERATED_ASSETS.cutinArt.win;
  return GENERATED_ASSETS.cutinArt.tequila;
}

function showPeek(card) {
  const el = $('peek-overlay');
  const cardEl = $('peek-card');
  el.classList.remove('hidden');
  if (!card) {
    cardEl.textContent = '（山札が空）';
    cardEl.className = 'peek-card';
  } else if (card.id === 'tequila') {
    cardEl.textContent = '🥃 テキーラ！！';
    cardEl.className = 'peek-card tequila-card';
  } else if (card.id === 'tequila_party') {
    cardEl.textContent = '🥃 全員強制テキーラ乾杯！！';
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
    drunkSpan.textContent = `🥃 ${p.drunk}`;
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
  const cycleNum = Math.min(state.deckCycle + 1, state.maxCycles);
  $('round-display').textContent = `${cycleNum} / ${state.maxCycles}`;
  $('deck-num').textContent = state.deck.length;
  const dangerCards = state.deck.filter(c => c.id === 'tequila' || c.id === 'tequila_party').length;
  $('tequila-num').textContent = dangerCards;
  const danger = state.deck.length > 0 ? Math.round((dangerCards / state.deck.length) * 100) : 0;
  const dangerNum = $('danger-num');
  const dangerFill = $('danger-fill');
  if (dangerNum) dangerNum.textContent = `${danger}%`;
  if (dangerFill) dangerFill.style.width = `${Math.min(100, danger)}%`;
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
  const visiblePlayers = state.players;
  row.style.setProperty('--player-count', String(Math.max(visiblePlayers.length, 1)));

  for (const p of visiblePlayers) {
    const i = state.players.indexOf(p);
    const isElimination = state.gameType === 'elimination';
    const chip = document.createElement('div');
    chip.className = 'player-chip'
      + (i === cpIdx ? ' is-turn' : '')
      + (p.isHuman ? ' is-human' : '')
      + (isElimination ? ' is-elimination' : '')
      + (p.eliminated ? ' is-eliminated' : '');
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
    const drunk = document.createElement('div');
    drunk.className = 'chip-drunk';
    drunk.textContent = isElimination ? `${p.drunk}/${state.initialHp || DEFAULT_ELIMINATION_HP}` : p.drunk;
    const lbl   = document.createElement('div'); lbl.className   = 'chip-drunk-label'; lbl.textContent = '酔い';
    chip.append(avatar, name, drunk, lbl);

    if (isElimination) {
      const cups = document.createElement('div');
      cups.className = 'chip-cups';
      const cupMax = state.initialHp || DEFAULT_ELIMINATION_HP;
      const cupCount = Math.min(cupMax, p.drunk);
      for (let n = 0; n < cupMax; n++) {
        const cup = document.createElement('span');
        cup.className = n < cupCount ? 'is-filled' : '';
        cup.textContent = '🥃';
        cups.appendChild(cup);
      }
      chip.appendChild(cups);
    }

    if (state.gameType === 'elimination') {
      const hpEl = document.createElement('div'); hpEl.className = 'chip-hp';
      hpEl.textContent = p.eliminated ? '💀' : `❤️${p.hp}`;
      chip.appendChild(hpEl);
    }

    if (p.skipped) {
      const b = document.createElement('div'); b.className = 'chip-badge'; b.textContent = 'SKIP'; chip.appendChild(b);
    }
    if (i === cpIdx) {
      const b = document.createElement('div'); b.className = 'chip-turn-badge'; b.textContent = 'NEXT'; chip.appendChild(b);
    }
    if (p.isHuman && (state.gameMode !== 'pvp' || i === cpIdx)) {
      const b = document.createElement('div'); b.className = 'chip-you-badge'; b.textContent = 'YOU'; chip.appendChild(b);
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
  const drunkMax = state.gameType === 'elimination' ? (state.initialHp || DEFAULT_ELIMINATION_HP) : 5;
  host.style.setProperty('--drunk-ratio', `${Math.min(100, (human.drunk / drunkMax) * 100)}%`);

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
  value.textContent = state.gameType === 'elimination'
    ? `🥃 ${human.drunk}/${state.initialHp || DEFAULT_ELIMINATION_HP}`
    : `🥃 ${human.drunk}`;
  const handCount = document.createElement('span');
  handCount.className = 'human-hand-count';
  handCount.textContent = isSimplePvpState() ? '手札なし' : `手札 ${human.hand.length}`;
  head.append(name, value, handCount);
  if (state.gameType === 'elimination') {
    const hpSpan = document.createElement('span');
    hpSpan.className = 'human-hp-value';
    hpSpan.textContent = human.eliminated ? '💀 脱落' : `❤️ HP${human.hp}`;
    head.appendChild(hpSpan);
  }

  const meter = document.createElement('div');
  meter.className = 'human-drunk-meter';
  const fill = document.createElement('span');
  fill.className = 'human-drunk-fill';
  meter.appendChild(fill);
  const mood = document.createElement('div');
  mood.className = 'human-drunk-mood';
  mood.textContent = drunkMoodText(human.drunk);
  const scale = document.createElement('div');
  scale.className = 'human-drunk-scale';
  scale.innerHTML = '<span>シラフ</span><span>限界寸前</span>';
  main.append(head, mood, meter, scale);

  const tag = document.createElement('div');
  tag.className = 'human-status-tag';
  tag.textContent = human.noDrinkGuard ? 'GUARD'
    : (state.gameMode === 'pvp' ? 'YOUR TURN' : (humanIdx === currentPlayerIdx ? 'YOUR TURN' : 'YOU'));

  host.append(avatar, main, tag);
}

function drunkMoodText(value) {
  if (value <= 0) return 'まだシラフ。ここから逃げ切ろう。';
  if (value <= 1) return 'ちょっと酔い気味。まだ余裕あり。';
  if (value <= 2) return 'かなり酔い気味……。押し付けたい。';
  if (value <= 4) return '危険水域。防御札がほしい。';
  return '限界寸前。次の一杯が重い。';
}

function renderStage() {
  const cp = currentPlayer();
  const banner = $('turn-banner');
  const board = document.querySelector('.party-board');
  const isForcedDraw = state.phase === 'FORCED_DRAW';
  const isPass = state.phase === 'PASS';

  // パスオーバーレイの表示制御（PvP 専用）
  const passOverlay = $('pass-overlay');
  const isKanpaiDraw = state.phase === 'KANPAI_DRAW';
  if (passOverlay) {
    if (isKanpaiDraw) {
      // 乾杯ドロー: 次に引くプレイヤーを表示
      const nextIdx = state.kanpaiPending[0];
      const nextP = state.players[nextIdx];
      if (nextP) {
        $('pass-kicker').textContent = '全員乾杯！';
        $('pass-name').textContent = nextP.name;
        const avatarEl = $('pass-avatar');
        if (avatarEl) {
          avatarEl.src = nextP.avatar || '';
          avatarEl.style.display = nextP.avatar ? '' : 'none';
        }
        const noteEl = $('pass-note');
        if (noteEl) noteEl.textContent = '山札から1枚引いてください。';
        const revealBtn = $('pass-reveal-btn');
        if (revealBtn) revealBtn.textContent = '🥃 引く！';
      }
      passOverlay.classList.remove('hidden');
    } else if (isPass && state.gameMode === 'pvp') {
      $('pass-kicker').textContent = 'PASS';
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
        noteEl.textContent = '他の人に見られてないか確認してね';
      }
      const revealBtn = $('pass-reveal-btn');
      if (revealBtn) revealBtn.textContent = '準備OK';
      passOverlay.classList.remove('hidden');
    } else {
      passOverlay.classList.add('hidden');
    }
  }

  if (state.phase === 'KANPAI_SETTLE') {
    banner.textContent = '乾杯の余韻…';
  } else if (isKanpaiDraw) {
    banner.textContent = '🥂 全員乾杯！';
  } else if (isForcedDraw) {
    const fp = state.forcedDrawPending;
    if (fp?.reason === 'target') {
      banner.textContent = `${fp.sourcePlayerName} から「お前が飲め！」🥃`;
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
  const canDrawFromStage = canUseStageDraw();
  card.classList.toggle('is-drawable', canDrawFromStage);
  card.setAttribute('aria-label', canDrawFromStage ? '山札を引く' : `${event.kicker} ${event.title}`);
  card.setAttribute('aria-disabled', canDrawFromStage ? 'false' : 'true');
  card.tabIndex = canDrawFromStage ? 0 : -1;
  const art = eventArtFor(event);
  card.classList.toggle('has-art', Boolean(art));
  if (art) card.style.setProperty('--event-art', `url("${art}")`);
  else card.style.removeProperty('--event-art');
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

function canUseStageDraw() {
  if (!state || state.gameOverPending) return false;
  return state.phase === 'PLAYER_TURN' || (state.phase === 'FORCED_DRAW' && Boolean(state.forcedDrawPending));
}

function eventArtFor(event) {
  if (event.kind === 'tequilaParty') return GENERATED_ASSETS.eventArt.tequilaParty;
  if (event.kind === 'kanpai') return GENERATED_ASSETS.eventArt.kanpai;
  if (event.kind === 'safe') return GENERATED_ASSETS.eventArt.safe;
  if (event.kind === 'tequila') return GENERATED_ASSETS.eventArt.tequila;
  return null;
}

function renderHand() {
  const area = $('hand-area');
  const isPlayerTurn  = state.phase === 'PLAYER_TURN';
  const isForcedDraw  = state.phase === 'FORCED_DRAW';
  const isSimplePvp = isSimplePvpState();
  area.classList.toggle('hidden', isSimplePvp || (!isPlayerTurn && !isForcedDraw));
  if (isSimplePvp || (!isPlayerTurn && !isForcedDraw)) {
    area.classList.remove('is-private');
    area.onclick = null;
    return;
  }

  const player = currentPlayer();
  const subtitle = $('hand-subtitle');

  if (isForcedDraw) {
    area.classList.remove('is-private');
    area.onclick = null;
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
  area.classList.toggle('is-private', state.gameMode === 'pvp' && !state.handRevealed);
  area.onclick = null;

  if (player.hand.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-hand';
    empty.textContent = '手札がありません';
    grid.appendChild(empty);
    return;
  }

  if (state.gameMode === 'pvp' && !state.handRevealed) {
    subtitle.textContent = '手札は伏せています。ここをタップで見る';
    area.onclick = () => {
      state.handRevealed = true;
      renderHand();
    };
    for (let i = 0; i < player.hand.length; i++) {
      const back = document.createElement('div');
      back.className = 'action-card hand-card-back';
      back.setAttribute('aria-label', '伏せられた手札');
      grid.appendChild(back);
    }
    return;
  }

  for (const card of player.hand) {
    const def = ACTION_DEFS[card.id];
    if (!def) continue;

    const el = document.createElement('button');
    el.className = 'action-card';
    el.dataset.card = card.id;
    el.style.setProperty('--card-accent', `var(${def.accent})`);
    el.style.setProperty('--card-art', `url("${def.art}")`);
    el.setAttribute('aria-label', `${def.label}。${def.effect}`);

    const nameEl = document.createElement('div'); nameEl.className = 'card-name';   nameEl.textContent = def.label;
    const effEl  = document.createElement('div'); effEl.className  = 'card-effect'; effEl.textContent  = def.effect;
    el.append(nameEl, effEl);

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
  const stageEndBtn = $('stage-end-turn-btn');

  const isForcedDraw = state.phase === 'FORCED_DRAW';
  bar.classList.toggle('is-forced', isForcedDraw);
  const isGameOver = state.gameOverPending;
  bar.classList.toggle('can-end', isPlayerTurn && state.hasDrawnThisTurn);
  drawBtn.disabled = (!isPlayerTurn && !isForcedDraw) || isGameOver;
  endBtn.disabled  = !isPlayerTurn || !state.hasDrawnThisTurn;
  if (stageEndBtn) {
    const canEnd = isPlayerTurn && state.hasDrawnThisTurn;
    stageEndBtn.disabled = !canEnd;
    stageEndBtn.classList.toggle('is-visible', canEnd);
  }
  badge.textContent = state.deck.length > 0 ? `残${state.deck.length}` : '空';
  badge.setAttribute('aria-label', state.deck.length > 0 ? `山札 残り ${state.deck.length} 枚` : '山札は空');

  // 古いDOMの直書きテキストが残ってもボタン文言が二重にならないよう整える。
  for (const node of [...drawBtn.childNodes]) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) node.remove();
  }

  const drawLabel = $('draw-label-text');
  if (drawLabel) {
    if (isGameOver) drawLabel.textContent = 'ゲーム終了';
    else if (isForcedDraw) drawLabel.textContent = '引かされる……';
    else drawLabel.textContent = '山札を引く';
  }
}

// ── Player interaction ──
function onPlayerCardClick(cardId) {
  if (state.phase !== 'PLAYER_TURN') return;

  if (cardId === 'target') {
    showTargetSelect('target', '誰に飲ませる？ 🥃');
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

  const titleEl  = $('result-title');
  const summaryEl = $('result-party-summary');
  const isPvp = state.gameMode === 'pvp';
  const isElimination = state.gameType === 'elimination';
  const human = isPvp ? null : state.players.find(p => p.isHuman);
  const humanRank = human ? sorted.findIndex(p => p.id === human.id) + 1 : 0;

  const badge = $('result-badge');

  if (isElimination) {
    const allEliminated = sorted.every(p => p.eliminated);
    const winner = sorted[0];
    if (allEliminated) {
      titleEl.textContent = '全員脱落…！';
      if (summaryEl) summaryEl.textContent = 'テキーラが全員を飲み込んだ夜。';
    } else {
      titleEl.textContent = `${winner.name} が生き残った！`;
      if (summaryEl) summaryEl.textContent = `${winner.name} はHP${state.initialHp || DEFAULT_ELIMINATION_HP}の壁を守り切った。`;
    }
    if (badge) badge.src = allEliminated ? GENERATED_ASSETS.resultBadge.drunkKing : GENERATED_ASSETS.resultBadge.winner;
  } else {
    // 同率考慮
    const minDrunk = sorted[0].drunk;
    const winners  = sorted.filter(p => p.drunk === minDrunk);
    if (winners.length === 1) {
      titleEl.textContent = `${winners[0].name} の勝ち！`;
    } else {
      titleEl.textContent = `${winners.map(p => p.name).join(' & ')} の引き分け！`;
    }
    const worst = sorted[sorted.length - 1];
    if (badge) {
      const src = !isPvp && humanRank === sorted.length
        ? GENERATED_ASSETS.resultBadge.victim
        : (winners.some(p => !isPvp && p.isHuman)
          ? GENERATED_ASSETS.resultBadge.survivor
          : (winners.length === 1 ? GENERATED_ASSETS.resultBadge.winner : GENERATED_ASSETS.resultBadge.drunkKing));
      badge.src = src;
    }
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
  }

  const rankings = $('result-rankings');
  rankings.innerHTML = '';
  const medals = ['gold', 'silver', 'bronze'];

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const row = document.createElement('div');
    row.className = 'rank-row' + (i === 0 && !p.eliminated ? ' winner' : '');

    const num = document.createElement('div');
    num.className = 'rank-num ' + (medals[i] || '');
    num.textContent = `${i + 1}`;

    const name = document.createElement('div');
    name.className = 'rank-name';
    name.textContent = p.name + (!isPvp && p.isHuman ? ' (YOU)' : '');

    const right = document.createElement('div');
    right.style.cssText = 'display:flex;flex-direction:column;align-items:flex-end;gap:2px;';

    if (isElimination) {
      const status = document.createElement('div'); status.className = 'rank-drunk';
      status.textContent = p.eliminated ? '脱落' : '生存';
      status.style.color = p.eliminated ? '#FF2D6F' : '#00c896';
      const lbl = document.createElement('div'); lbl.className = 'rank-drunk-label';
      lbl.textContent = p.eliminated ? `🥃 ${p.drunk}杯` : '❤️ 残存';
      right.append(status, lbl);
    } else {
      const drunk = document.createElement('div'); drunk.className = 'rank-drunk';       drunk.textContent = p.drunk;
      const lbl   = document.createElement('div'); lbl.className   = 'rank-drunk-label'; lbl.textContent   = '酔い';
      right.append(drunk, lbl);
    }

    row.append(num, name, right);
    rankings.appendChild(row);
  }

  updatePartyXPostLink(sorted, human, humanRank);
}

function buildPartyResultPostText(sorted, human, humanRank) {
  if (state.gameMode === 'pvp' && state.gameType === 'elimination') {
    const winner = sorted[0];
    const allEliminated = sorted.every(p => p.eliminated);
    const resultLine = allEliminated ? '全員脱落！' : `生存者: ${winner.name}`;
    const scoreLine = sorted.map(p => `${p.name}${p.eliminated ? '💀' : '❤️'}${p.drunk}`).join(' / ');
    return [
      'テキーラから逃げろ！PARTY MODE（脱落モード）',
      `${state.players.length}人 HP${state.initialHp || DEFAULT_ELIMINATION_HP}制`,
      resultLine,
      scoreLine,
    ].join('\n');
  }
  const minDrunk = sorted[0].drunk;
  const winners  = sorted.filter(p => p.drunk === minDrunk);
  const winLabel = winners.length === 1 ? winners[0].name : winners.map(p => p.name).join(' & ');
  if (state.gameMode === 'pvp') {
    const scoreLine = sorted.map(p => `${p.name}🥃${p.drunk}`).join(' / ');
    return [
      'テキーラから逃げろ！PARTY MODE（ローカル対人）',
      `${state.maxCycles}周 × ${state.players.length}人`,
      `勝者: ${winLabel}`,
      `最終: ${scoreLine}`,
    ].join('\n');
  }
  const worst = sorted[sorted.length - 1];
  return [
    'テキーラから逃げろ！PARTY MODE',
    `${state.maxCycles}周 × ${state.players.length}人`,
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

  const humanCharacters = VS_CPU_HUMAN_CHARACTER_IDS.map(getCharacter);
  const cpuCharacters = CPU_CHARACTER_IDS.map(getCharacter);

  for (const character of humanCharacters) {
    humanList.appendChild(createCharacterButton(character, 'human'));
  }
  for (const character of cpuCharacters) {
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
  const maxCycles = 2;

  if (setupMode === 'pvp') {
    const seats = pvpSeats.slice(0, pvpCount).map((s, i) => {
      const character = getCharacter(s.characterId || pvpFallbackCharacter(i));
      return { name: (s.name?.trim() || character.name).slice(0, 8), character };
    });
    state = initStatePvp(seats, maxCycles, pvpGameType, pvpInitialHp, pvpCardSet, pvpTequilaCount);
    state.phase = isSimplePvpState() ? 'PLAYER_TURN' : 'PASS';
  } else {
    const name = $('player-name').value.trim() || 'あなた';
    const cpuCount = selectedCpuCount();
    ensureCpuCharacterSelection(true);
    const humanCharacter = getCharacter(selectedHumanCharacterId);
    const cpuCharacters = selectedCpuCharacterIds.slice(0, cpuCount).map(getCharacter);
    state = initState(name, cpuCount, maxCycles, humanCharacter, cpuCharacters);
    state.phase = 'PLAYER_TURN';
  }

  showScreen('game-screen');
  renderAll();
}

function pvpFallbackCharacter(seatIndex) {
  return CHARACTERS[seatIndex % CHARACTERS.length].id;
}

function onPassRevealClick() {
  if (state.phase === 'KANPAI_DRAW') {
    const idx = state.kanpaiPending.shift();
    if (idx === undefined) {
      // キューが空（念のため）
      state.phase = 'PLAYER_TURN';
      renderAll();
      return;
    }
    const p = state.players[idx];
    const c = drawFromDeck();
    if (c) resolveDrawCard(c, p, /* kanpaiNested= */ true);
    const lastDrawKind = c?.id || 'safe';

    // 脱落でゲーム終了した場合はそのまま終わる
    if (state.gameOverPending && state.phase === 'RESULT') return;

    // 残りキューから脱落者を除いてチェック
    state.kanpaiPending = state.kanpaiPending.filter(pi => !state.players[pi]?.eliminated);

    if (state.kanpaiPending.length > 0) {
      // まだ引いていないプレイヤーがいる
      renderAll();
    } else {
      // 全員引き終わり。最後の結果を少し見せてから手番プレイヤーのターンに戻す。
      state.phase = 'KANPAI_SETTLE';
      state.handRevealed = true;
      const label = lastDrawKind === 'tequila' || lastDrawKind === 'tequila_party' ? 'ラストHIT！' : 'ラストSAFE！';
      showSfx(label, 1300);
      renderAll();
      clearTimeout(onPassRevealClick._kanpaiSettleTid);
      onPassRevealClick._kanpaiSettleTid = setTimeout(() => {
        if (!state || state.phase !== 'KANPAI_SETTLE') return;
        state.phase = 'PLAYER_TURN';
        state.handRevealed = state.gameMode !== 'pvp';
        renderAll();
      }, 1250);
    }
    return;
  }

  if (state.phase !== 'PASS') return;
  if (state.forcedDrawPending) {
    const cp = currentPlayer();
    const reason = state.forcedDrawPending.reason;
    const src = state.forcedDrawPending.sourcePlayerName;
    addLog(`${cp.name} → 強制ドロー（${reason === 'target' ? `${src} のお前が飲め` : 'とりあえず一杯'}の効果）— 山札を引いてください`, 'log-card');
    state.phase = 'FORCED_DRAW';
  } else {
    state.phase = 'PLAYER_TURN';
    state.handRevealed = state.gameMode !== 'pvp';
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
    pvpSeats.push({ name: '', characterId: CHARACTERS[idx % CHARACTERS.length].id });
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
    input.placeholder = getCharacter(seat.characterId).name;
    input.value = seat.name;
    input.autocomplete = 'off';
    input.addEventListener('input', () => { pvpSeats[i].name = input.value; });

    head.append(label, input);

    // キャラ選択グリッド
    const grid = document.createElement('div');
    grid.className = 'character-grid pvp-character-grid';
    grid.setAttribute('role', 'radiogroup');
    grid.setAttribute('aria-label', `${labels[i]} のキャラクター`);

    for (const char of CHARACTERS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'character-btn';
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-pressed', seat.characterId === char.id ? 'true' : 'false');
      btn.style.setProperty('--char-accent', char.gender === 'male' ? '#8E55FF' : '#FF2D6F');

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
  if (mode === 'pvp') {
    updatePvpRuleUi();
    renderPvpPlayerSetup();
  }
}

function updatePvpRuleUi() {
  const hpOptions = $('pvp-hp-options');
  if (hpOptions) hpOptions.hidden = pvpGameType !== 'elimination';
  const tequilaOptions = $('pvp-tequila-options');
  if (tequilaOptions) tequilaOptions.hidden = pvpGameType !== 'standard';

  const hint = $('pvp-gametype-hint');
  if (!hint) return;
  hint.textContent = pvpGameType === 'elimination'
    ? `HP${pvpInitialHp}からスタート。テキーラをHPぶん飲んだら脱落。最後まで生き残ったプレイヤーの勝ち！`
    : '2周プレイ。一番酔いが少なかったプレイヤーの勝ち。';

  const cardsetHint = $('pvp-cardset-hint');
  if (cardsetHint) {
    cardsetHint.textContent = pvpCardSet === 'simple'
      ? '手札なし。山札だけをめくる超シンプル版。強制テキーラ乾杯は毎回2〜3枚。'
      : '8種類ぜんぶ入り。方向逆・スキップ・回避・倍プッシュまで入る読み合い重視。';
  }
}

function clearTransientUI() {
  clearTimeout(showSfx._tid);
  clearTimeout(showCutin._tid);
  clearTimeout(showToast._tid);
  clearTimeout(onPassRevealClick._kanpaiSettleTid);
  clearTimeout(triggerBoardImpact._tid);
  $('peek-overlay').classList.add('hidden');
  $('target-overlay').classList.add('hidden');
  $('pass-overlay')?.classList.add('hidden');
  $('help-overlay').classList.add('hidden');
  $('cutin').classList.add('hidden');
  $('cutin').classList.remove('show', 'is-mega');
  $('sfx-text').classList.remove('show');
  $('toast-msg').classList.remove('show');
  $('game-screen')?.classList.remove('impact-mega');
}

function restartGame() {
  clearTransientUI();
  state = null;
  showScreen('guide-screen');
}

function playAgain() {
  if (!state) return;
  const maxCycles = state.maxCycles;
  clearTransientUI();
  if (state.gameMode === 'pvp') {
    const seats = state.players.map(p => ({
      name: p.name,
      character: getCharacter(p.characterId),
    }));
    state = initStatePvp(seats, maxCycles, state.gameType || pvpGameType, state.initialHp || pvpInitialHp, state.cardSet || pvpCardSet, state.tequilaCount || pvpTequilaCount);
    state.phase = isSimplePvpState() ? 'PLAYER_TURN' : 'PASS';
  } else {
    const human = state.players.find(p => p.isHuman);
    const name = human?.name || 'あなた';
    const cpuCount = state.players.length - 1;
    const humanCharacter = getCharacter(human?.characterId || selectedHumanCharacterId);
    const cpuCharacters = state.players.filter(p => !p.isHuman).map(p => getCharacter(p.characterId));
    state = initState(name, cpuCount, maxCycles, humanCharacter, cpuCharacters);
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
  $('event-card').addEventListener('click', () => {
    if (canUseStageDraw()) onDrawClick();
  });
  $('event-card').addEventListener('keydown', event => {
    if (!canUseStageDraw()) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onDrawClick();
    }
  });
  $('stage-end-turn-btn').addEventListener('click', onEndTurnClick);
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

  document.querySelectorAll('.pvp-gametype-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pvp-gametype-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      pvpGameType = btn.dataset.gametype || 'standard';
      updatePvpRuleUi();
    });
  });

  document.querySelectorAll('.pvp-cardset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pvp-cardset-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      pvpCardSet = btn.dataset.cardset || 'simple';
      updatePvpRuleUi();
    });
  });

  document.querySelectorAll('.pvp-tequila-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pvp-tequila-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      pvpTequilaCount = parseInt(btn.dataset.tequila || '6', 10);
      updatePvpRuleUi();
    });
  });

  document.querySelectorAll('.pvp-hp-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pvp-hp-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      pvpInitialHp = parseInt(btn.dataset.hp || String(DEFAULT_ELIMINATION_HP), 10);
      updatePvpRuleUi();
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
