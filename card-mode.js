'use strict';

// ── Constants ──
const MAX_TURNS           = 10;
const FLIP_MS             = 500;
const REVEAL_HOLD_MS      = 900;
const TELL_HOLD_MS        = 220;
const COMMIT_MS           = 260;
const ACT_BANNER_MS       = 760;
const ACHIEVEMENT_STORAGE_KEY = 'tequilaEscape.cardMode.achievements.v1';
// Thresholds calibrated so each condition is reachable within 11-card, 10-turn constraints
const DRUNK_LOSE_AT       = 75;   // ~68 reachable via toast spam; 75 = tight but fair
const MOOD_WIN_AT         = 75;   // ~84 reachable; 75 = achievable with fake-heavy play

// ── Card definitions ──
const CARDS = {
  toast:  { id:'toast',  icon:'🥂', label:'乾杯する',   hint:'疑惑↓ 酔い↑',    milkLabel:'リード乾杯' },
  fake:   { id:'fake',   icon:'🎭', label:'飲んだフリ', hint:'バレると大事故',  milkLabel:'軽くフリ' },
  watch:  { id:'watch',  icon:'👁', label:'見張る',     hint:'フリをカウンター',milkLabel:'ガン見' },
  chaser: { id:'chaser', icon:'💧', label:'チェイサー', hint:'酔い↓ 場冷え注意',milkLabel:'一服' },
};
const CARD_IDS = ['toast', 'fake', 'watch', 'chaser'];
const INFINITE_CARDS = new Set(['toast']);

// ── Character expression images ──
const CHAR_IMAGES = {
  tuzyou:  'assets/tuzyou.png',   // 通常
  utagai:  'assets/utagai.png',   // 疑い
  bikkuri: 'assets/bikkuri.png',  // びっくり
  horoyoi: 'assets/horoyoi.png',  // ほろ酔い
  fuman:   'assets/fuman.png',    // 不満
  deisui:  'assets/deisui.png',   // 泥酔
};

// ── Card artwork map (ware_=player, aite_=milk) ──
const CARD_IMAGES = {
  player: {
    toast:  'assets/ware_nomu.PNG',
    fake:   'assets/ware_fake.PNG',
    watch:  'assets/ware_kanshi.PNG',
    chaser: 'assets/ware_tyeisa-.PNG',
    back:   'assets/ware_ura.PNG',
  },
  milk: {
    toast:  'assets/aite_nomu.PNG',
    fake:   'assets/aite_fake.PNG',
    watch:  'assets/aite_kanshi.PNG',
    chaser: 'assets/aite_yosumi.PNG',
    back:   'assets/aite_ura.PNG',
  },
};

// ── Compatibility matrix (base values before act multiplier) ──
// Keys: D=drunk, S=sus(suspicion), T=tens(tension/air), M=mood
const MATRIX = {
  toast: {
    toast:  { D:14, S:-10, T:10, M:10 },  // D↑ so drunk is reachable; M↑ for mood path
    fake:   { D:12, S:-4,  T:4,  M:4  },
    watch:  { D:14, S:4,   T:6,  M:2  },
    chaser: { D:12, S:-2,  T:-4, M:0  },
  },
  fake: {
    toast:  { D:0, S:-14, T:8,   M:14 },  // M↑ so mood path is achievable
    fake:   { D:0, S:0,   T:-2,  M:2  },
    watch:  { D:5, S:30,  T:-18, M:-6 },
    chaser: { D:0, S:8,   T:-6,  M:-2 },
  },
  watch: {
    toast:  { D:0, S:-6,  T:-2,  M:2  },
    fake:   { D:0, S:-22, T:6,   M:6  },
    watch:  { D:0, S:0,   T:-10, M:-4 },
    chaser: { D:0, S:0,   T:-6,  M:-2 },
  },
  chaser: {
    toast:  { D:-12, S:8,  T:-2,  M:-2 },
    fake:   { D:-12, S:0,  T:-4,  M:-2 },
    watch:  { D:-12, S:18, T:-6,  M:-4 },
    chaser: { D:-15, S:4,  T:-12, M:-4 },
  },
};

// ── SFX labels for each matchup ──
const SFX_LABELS = {
  'toast-toast':   'カンッ！乾杯成立',
  'toast-fake':    '……乾杯だけしといた',
  'toast-watch':   '見られながら飲んだ',
  'toast-chaser':  'テンポが落ちた',
  'fake-toast':    'フェイク成功！',
  'fake-fake':     '……二人ともごまかした',
  'fake-watch':    '大バレ！',
  'fake-chaser':   '軽くバレた',
  'watch-toast':   '見守りながら相手が飲む',
  'watch-fake':    'カウンター！フリを見抜いた',
  'watch-watch':   '……お互い無言',
  'watch-chaser':  'チェイサーを見届けた',
  'chaser-toast':  '相手が飲んだのに水……',
  'chaser-fake':   'お互い水分補給',
  'chaser-watch':  '水を見られた',
  'chaser-chaser': '場が冷えた',
};

const CARD_COMMIT_LABELS = {
  toast:  'いくしかない',
  fake:   'ごまかす',
  watch:  '見抜きにいく',
  chaser: '水で逃げる',
};

const MATCH_EFFECTS = {
  'toast-toast':   { tone:'toast',  kicker:'乾杯成立', title:'カンッ！', copy:'夜が一段、熱くなる。' },
  'toast-fake':    { tone:'toast',  kicker:'片側だけ本気', title:'飲み切った', copy:'疑いは薄いが、酔いは逃げない。' },
  'toast-watch':   { tone:'sus',    kicker:'視線の中で', title:'見られながら乾杯', copy:'正面突破にも圧がある。' },
  'toast-chaser':  { tone:'cold',   kicker:'テンポ差', title:'空気が少し止まる', copy:'あなたのグラスだけが進んだ。' },
  'fake-toast':    { tone:'fake',   kicker:'潜伏成功', title:'フェイク成功', copy:'場の熱だけを受け流した。' },
  'fake-fake':     { tone:'fake',   kicker:'同時に煙幕', title:'二人ともごまかした', copy:'笑顔の裏で読み合いが濃くなる。' },
  'fake-watch':    { tone:'bust',   kicker:'即死級事故', title:'大バレ！', copy:'その一瞬、グラスを見られた。' },
  'fake-chaser':   { tone:'sus',    kicker:'違和感', title:'軽くバレた', copy:'逃げた空気だけが残る。' },
  'watch-toast':   { tone:'watch',  kicker:'見守り', title:'相手は飲んだ', copy:'読みは外れたが、疑いは少し晴れる。' },
  'watch-fake':    { tone:'counter',kicker:'読み勝ち', title:'カウンター！', copy:'フリの瞬間を捕まえた。' },
  'watch-watch':   { tone:'cold',   kicker:'膠着', title:'お互い無言', copy:'視線だけが卓上でぶつかる。' },
  'watch-chaser':  { tone:'cold',   kicker:'空振り', title:'チェイサーを見届けた', copy:'疑いより先に空気が冷える。' },
  'chaser-toast':  { tone:'chaser', kicker:'逃げ腰', title:'水でかわす', copy:'酔いは引いたが、温度差が残る。' },
  'chaser-fake':   { tone:'chaser', kicker:'水面下', title:'お互い水分補給', copy:'勝負は静かに次へ流れる。' },
  'chaser-watch':  { tone:'sus',    kicker:'目撃', title:'水を見られた', copy:'疑惑の針が少し振れる。' },
  'chaser-chaser': { tone:'freeze', kicker:'場冷え', title:'場が冷えた', copy:'グラスより先に会話が止まる。' },
};

// ── Tell system ──
// TELL_OF maps milkCard → tell type ID
const TELL_OF = { watch:'glass', toast:'excite', chaser:'bored', fake:'playful' };
const TELLS = {
  glass:   { text:'「グラス、減ってないなぁ……」', icon:'視', observation:'みるくがグラスを見ている', prediction:'見張るかも' },
  excite:  { text:'「ねぇ、もっといこ？！」',       icon:'乾', observation:'笑顔が深まった',            prediction:'乾杯かも' },
  bored:   { text:'「ふぅ……」',                     icon:'水', observation:'息をついた',                prediction:'様子見かも' },
  playful: { text:'「次は……どうしよっかな？」',     icon:'偽', observation:'髪を触った',                prediction:'飲んだフリかも' },
};
const TELL_IDS = ['glass', 'excite', 'bored', 'playful'];

// ── Act structure ──
function actMultiplier(turn) {
  if (turn <= 3) return 0.75;
  if (turn <= 7) return 1.0;
  if (turn <= 9) return 1.35;
  return 1.5;
}
function actNumber(turn) {
  if (turn <= 3) return 1;
  if (turn <= 7) return 2;
  return 3;
}
function actLabel(turn) {
  if (turn <= 3) return 'ACT 1 / 探り合い';
  if (turn <= 7) return 'ACT 2 / 本番';
  if (turn <= 9) return 'ACT 3 / ラスト';
  return 'FINAL';
}
function actBannerText(turn) {
  if (turn === 4) {
    return {
      phase: 'mid',
      kicker: 'ACT 2',
      title: '本番開始',
      copy: '読み合いが濃くなる',
    };
  }
  if (turn === 8) {
    return {
      phase: 'last',
      kicker: 'ACT 3',
      title: 'ラスト',
      copy: 'ここから一手が重い',
    };
  }
  return {
    phase: 'final',
    kicker: 'FINAL',
    title: '最終ターン',
    copy: '最後の一枚で決まる',
  };
}
function tellHonestRate(turn) {
  if (turn <= 3) return 0.8;
  if (turn <= 7) return 0.7;
  if (turn <= 9) return 0.55;
  return 0.45;
}

// ── Character face ──
function setCharFace(exprKey) {
  const charEl = $('character');
  const imgEl  = $('char-art');
  // data-face drives CSS aura; exprKey is now the direct image key
  const faceMap = { tuzyou:'normal', utagai:'doubt', bikkuri:'smile', horoyoi:'mood', fuman:'cold', deisui:'mood' };
  if (charEl) charEl.dataset.face = faceMap[exprKey] || 'normal';
  const src = CHAR_IMAGES[exprKey];
  if (imgEl && src && imgEl.src !== new URL(src, document.baseURI).href) {
    imgEl.src = src;
  }
}

// Pick expression from current gauge values (called at TURN_START)
function faceFromGauges() {
  const g = state.gauges;
  if (g.drunk >= 50)     return 'deisui';
  if (g.sus   >= 70)     return 'utagai';
  if (g.tens  <= 20)     return 'fuman';
  if (g.mood  >= 50)     return 'horoyoi';
  return 'tuzyou';
}

// Pick reaction expression from this turn's deltas (called in RESOLVE)
function faceFromDeltas(deltas, playerCard, milkCard) {
  if (playerCard === 'watch' && milkCard === 'fake') return 'bikkuri'; // player caught milk's fake
  if (playerCard === 'fake'  && milkCard === 'watch') return 'bikkuri'; // both surprised at reveal
  if (deltas.M >= 6)   return 'horoyoi';  // みるくノリ上昇
  if (deltas.T <= -10) return 'fuman';    // 空気が冷えた
  if (deltas.S >= 15)  return 'utagai';   // 疑惑上昇
  if (deltas.M < 0)    return 'fuman';    // みるくノリ下降
  return 'tuzyou';
}

// ── Utility ──
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function $(id) { return document.getElementById(id); }

// ── CPU AI ──
function pickMilkCard() {
  const weights = { toast:1, fake:1, watch:1, chaser:1 };

  // If player used same card 2+ turns in a row, heavily boost watch (pattern reading)
  if (state.cpuPattern.sameStreak >= 2) {
    weights.watch = Math.min(weights.watch + 0.5, 2.0);
  }
  // Late game: if player has 2+ fake left, boost watch to catch it
  if (state.turn >= 8 && state.hand.fake >= 2) {
    weights.watch = Math.min(weights.watch + 0.4, 2.0);
  }

  const total = CARD_IDS.reduce((s, id) => s + weights[id], 0);
  let r = Math.random() * total;
  for (const id of CARD_IDS) {
    r -= weights[id];
    if (r <= 0) return id;
  }
  return 'toast';
}

function pickAnyOther(except) {
  const others = CARD_IDS.filter(id => id !== except);
  return others[Math.floor(Math.random() * others.length)];
}

function rollTell() {
  const willPlay = pickMilkCard();
  const honest = Math.random() < tellHonestRate(state.turn);
  const tellCard = honest ? willPlay : pickAnyOther(willPlay);
  const type = TELL_OF[tellCard] || 'playful';

  // Chaser special: if player's previous card was chaser and tell is bored, swap text
  const chaserSpecial = (state.history.length > 0 &&
    state.history[state.history.length - 1].p === 'chaser' &&
    type === 'bored');

  return { type, honest, willPlay, chaserSpecial, honestRate: tellHonestRate(state.turn) };
}

// ── State ──
const initialState = () => ({
  fsm: 'INTRO',
  turn: 1,
  hand: { toast:Infinity, fake:3, watch:2, chaser:2 },
  gauges: { drunk:0, sus:20, tens:60, mood:0 },
  playerCard: null,
  milkCard:   null,
  tell:       null,
  history:    [],
  cpuPattern: { lastCard: null, sameStreak: 0 },
  peak:       { drunk:0, sus:20, lowTens:60 },
  counts:     { toast:0, fake:0, watch:0, chaser:0 },
  endReason:  null,
  summary:    null,
});
let state = initialState();

// ── FSM ──
function setState(next) {
  // Tell bubble stays visible through CARD_SELECT so player reads it while choosing.
  // It's hidden when they tap a card (CARD_SELECT leave).
  // Reveal area stays visible into RESOLVE so player sees the result; it's
  // cleared by a timed setTimeout inside enterResolve.
  const leaves = {
    CARD_SELECT: () => { disableHand(); clearTell(); },
  };
  leaves[state.fsm]?.();
  state.fsm = next;
  const enters = {
    INTRO:       enterIntro,
    TURN_START:  enterTurnStart,
    TELL_PHASE:  enterTell,
    CARD_SELECT: enterCardSelect,
    COMMIT:      enterCommit,
    REVEAL:      enterReveal,
    RESOLVE:     enterResolve,
    TURN_END:    enterTurnEnd,
    RESULT:      enterResult,
  };
  enters[next]?.();
}

// ── Screen management ──
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.setAttribute('aria-hidden', 'true');
    s.inert = true;
  });
  const el = $(id);
  el.classList.add('active');
  el.removeAttribute('aria-hidden');
  el.inert = false;
}

// ── State handlers ──

function enterIntro() {
  clearImpact();
  updateTurnHistory();
  showScreen('intro-screen');
}

function enterTurnStart() {
  showScreen('game-screen');
  // Ensure clean DOM state (handles retry & first turn)
  clearImpact();
  clearReveal();
  clearSfx();
  updateHUD();
  updateActBadge();
  updateTurnHistory();
  const bannerDelay = maybeShowActBanner();
  setTimeout(() => {
    if (state.fsm === 'TURN_START') setState('TELL_PHASE');
  }, bannerDelay);
}

function enterTell() {
  state.tell = rollTell();

  const el = $('tell-bubble');
  const tellData = TELLS[state.tell.type];
  el.textContent = state.tell.chaserSpecial ? '「ぐびぐび、つまんないな〜」' : tellData.text;
  el.hidden = false;
  el.classList.remove('tell-in');
  void el.offsetWidth;
  el.classList.add('tell-in');

  // テルヒントカードを更新
  const hint = $('tell-hint');
  if (hint) {
    hint.querySelector('.hint-icon').textContent        = tellData.icon;
    hint.querySelector('.hint-observation').textContent = tellData.observation;
    hint.querySelector('.hint-prediction').textContent  = tellData.prediction;
    hint.hidden = false;
  }

  // みるく表情をテルに連動（実画像ファイルで切替）
  const EXPR_OF = { glass:'utagai', excite:'bikkuri', bored:'tuzyou', playful:'horoyoi' };
  setCharFace(EXPR_OF[state.tell.type] || 'tuzyou');

  setTimeout(() => {
    if (state.fsm === 'TELL_PHASE') setState('CARD_SELECT');
  }, TELL_HOLD_MS);
}

function clearTell() {
  const el = $('tell-bubble');
  el.classList.remove('tell-in');
  el.hidden = true;
  const hint = $('tell-hint');
  if (hint) hint.hidden = true;
}

function enterCardSelect() {
  // Guard: if somehow all cards exhausted, end as survive rather than deadlock
  if (CARD_IDS.every(id => INFINITE_CARDS.has(id) || state.hand[id] === 0)) {
    state.endReason = 'survive';
    setState('RESULT');
    return;
  }
  const hand = $('hand');
  hand.classList.remove('blocked');
  refreshHandSlots();
}

function disableHand() {
  $('hand').classList.add('blocked');
  // Also disable all slots
  CARD_IDS.forEach(id => {
    const slot = document.querySelector(`.card-slot[data-card="${id}"]`);
    if (slot) slot.disabled = true;
  });
}

function refreshHandSlots() {
  CARD_IDS.forEach(id => {
    const slot = document.querySelector(`.card-slot[data-card="${id}"]`);
    if (!slot) return;
    const infinite = INFINITE_CARDS.has(id);
    const n = state.hand[id];
    slot.querySelector('.card-count').textContent = infinite ? '∞' : `×${n}`;
    slot.setAttribute('aria-label', infinite ? `${CARDS[id].label} 無限` : `${CARDS[id].label} 残り${n}枚`);

    if (!infinite && n === 0) {
      slot.disabled = true;
      slot.setAttribute('aria-disabled', 'true');
      slot.classList.add('empty');
      slot.classList.remove('last-one');
    } else {
      slot.disabled = false;
      slot.removeAttribute('aria-disabled');
      slot.classList.remove('empty');
      slot.classList.toggle('last-one', !infinite && n === 1);
    }
  });
}

function onCardTap(cardId) {
  if (state.fsm !== 'CARD_SELECT') return;
  const infinite = INFINITE_CARDS.has(cardId);
  if (!infinite && state.hand[cardId] <= 0) return;

  state.playerCard = cardId;
  if (!infinite) state.hand[cardId]--;
  state.counts[cardId]++;
  refreshHandSlots(); // Immediately update count display and disabled state

  // Update CPU pattern tracking (player's card streak)
  if (state.cpuPattern.lastCard === cardId) {
    state.cpuPattern.sameStreak++;
  } else {
    state.cpuPattern.lastCard = cardId;
    state.cpuPattern.sameStreak = 1;
  }

  setState('COMMIT');
}

function enterCommit() {
  playCommitEffect(state.playerCard);
  setTimeout(() => {
    if (state.fsm === 'COMMIT') setState('REVEAL');
  }, COMMIT_MS);
}

// CSS emoji+text fallback for flip-back (face-up side)
function setFlipBack(el, icon, label) {
  const iconEl  = document.createElement('span');
  iconEl.className   = 'card-face-icon';
  iconEl.textContent = icon;
  const labelEl = document.createElement('span');
  labelEl.className   = 'card-face-label';
  labelEl.textContent = label;
  el.querySelector('.flip-back').replaceChildren(iconEl, labelEl);
}

// Set flip-back (face-up) to artwork image; falls back to emoji+text
function setFlipFace(flipCardEl, imgSrc, fallbackIcon, fallbackLabel) {
  if (!imgSrc) { setFlipBack(flipCardEl, fallbackIcon, fallbackLabel); return; }
  const img = document.createElement('img');
  img.className = 'card-reveal-img';
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  img.onerror = () => setFlipBack(flipCardEl, fallbackIcon, fallbackLabel);
  img.src = imgSrc;
  flipCardEl.querySelector('.flip-back').replaceChildren(img);
}

// Set flip-front (face-down) to back-of-card artwork; falls back to ？ CSS
function setFlipFront(flipCardEl, imgSrc) {
  if (!imgSrc) return;
  const front = flipCardEl.querySelector('.flip-front');
  const img = document.createElement('img');
  img.className = 'card-reveal-img';
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  img.onerror = () => {
    const icon = document.createElement('span');
    icon.className = 'card-back-icon';
    icon.textContent = '？';
    front.replaceChildren(icon);
  };
  img.src = imgSrc;
  front.replaceChildren(img);
}

function enterReveal() {
  // Table area is always visible — no hidden toggle needed
  // milkCard was decided in TELL_PHASE; store it now for RESOLVE
  state.milkCard = state.tell.willPlay;

  // Hide vs-label during reveal so card names take center stage
  const vsEl = $('vs-label');
  if (vsEl) vsEl.classList.add('reveal-hide');

  const playerEl = $('card-player');
  const milkEl   = $('card-milk');

  // Reset to face-down
  playerEl.classList.remove('flipped');
  milkEl.classList.remove('flipped');

  // Populate card faces — artwork image preferred, emoji+text as fallback
  const pCard = CARDS[state.playerCard];
  const mCard = CARDS[state.milkCard];
  setFlipFront(playerEl, CARD_IMAGES.player.back);
  setFlipFront(milkEl,   CARD_IMAGES.milk.back);
  setFlipFace(playerEl, CARD_IMAGES.player[state.playerCard], pCard.icon, pCard.label);
  setFlipFace(milkEl,   CARD_IMAGES.milk[state.milkCard],   mCard.icon, mCard.milkLabel);

  // Show card names in caption area
  const pCapEl = playerEl.parentElement.querySelector('.reveal-caption');
  const mCapEl = milkEl.parentElement.querySelector('.reveal-caption');
  if (pCapEl) pCapEl.textContent = pCard.label;
  if (mCapEl) mCapEl.textContent = mCard.milkLabel;

  const matchKey = `${state.playerCard}-${state.milkCard}`;
  const app = $('app');
  app.dataset.match = matchKey;

  // Flip, then chain to RESOLVE — nested setTimeout keeps the two phases coupled
  setTimeout(() => {
    if (state.fsm !== 'REVEAL') return;
    playerEl.classList.add('flipped');
    milkEl.classList.add('flipped');
    setTimeout(() => {
      if (state.fsm === 'REVEAL') setState('RESOLVE');
    }, FLIP_MS);
  }, 180);
}

function clearReveal() {
  $('card-player').classList.remove('flipped');
  $('card-milk').classList.remove('flipped');
  // Restore vs-label and reset captions
  const vsEl = $('vs-label');
  if (vsEl) vsEl.classList.remove('reveal-hide');
  const playerEl = $('card-player');
  const milkEl   = $('card-milk');
  const pCapEl = playerEl.parentElement.querySelector('.reveal-caption');
  const mCapEl = milkEl.parentElement.querySelector('.reveal-caption');
  if (pCapEl) pCapEl.textContent = 'あなた';
  if (mCapEl) mCapEl.textContent = 'みるく';
  const app = $('app');
  delete app.dataset.match;
  delete app.dataset.tone;
}

function enterResolve() {
  const base = MATRIX[state.playerCard][state.milkCard];
  const mult = actMultiplier(state.turn);

  const deltas = {
    D: Math.round(base.D * mult),
    S: Math.round(base.S * mult),
    T: Math.round(base.T * mult),
    M: Math.round(base.M * mult),
  };

  // Apply gauges
  state.gauges.drunk = clamp(state.gauges.drunk + deltas.D, 0, 100);
  state.gauges.sus   = clamp(state.gauges.sus   + deltas.S, 0, 100);
  state.gauges.tens  = clamp(state.gauges.tens  + deltas.T, 0, 100);
  state.gauges.mood  = clamp(state.gauges.mood  + deltas.M, 0, 100);

  // Track peaks
  if (state.gauges.drunk > state.peak.drunk)   state.peak.drunk  = state.gauges.drunk;
  if (state.gauges.sus   > state.peak.sus)     state.peak.sus    = state.gauges.sus;
  if (state.gauges.tens  < state.peak.lowTens) state.peak.lowTens = state.gauges.tens;

  // Record history
  state.history.push({ turn: state.turn, p: state.playerCard, m: state.milkCard, deltas });
  updateTurnHistory();

  // Show SFX label
  const sfxKey = `${state.playerCard}-${state.milkCard}`;
  showSfx(SFX_LABELS[sfxKey] || '');

  updateHUD();

  // みるくの表情をターン結果に反応させる
  const reactionFace = faceFromDeltas(deltas, state.playerCard, state.milkCard);
  setCharFace(reactionFace);
  playMatchImpact(sfxKey, reactionFace);

  // Hide reveal cards halfway through (guard: don't touch DOM if FSM moved on)
  const resolveTurn = state.turn;
  setTimeout(() => { if (state.turn === resolveTurn) clearReveal(); }, REVEAL_HOLD_MS * 0.72);

  setTimeout(() => {
    if (state.fsm === 'RESOLVE') setState('TURN_END');
  }, REVEAL_HOLD_MS);
}

function enterTurnEnd() {
  clearSfx();

  // Check lose conditions
  if (state.gauges.drunk >= DRUNK_LOSE_AT) { state.endReason = 'drunk';  return setState('RESULT'); }
  if (state.gauges.sus   >= 100)           { state.endReason = 'sus';    return setState('RESULT'); }
  if (state.gauges.tens  <= 0)             { state.endReason = 'tens';   return setState('RESULT'); }

  // Check win: mood reaches threshold
  if (state.gauges.mood  >= MOOD_WIN_AT)   { state.endReason = 'mood100'; return setState('RESULT'); }

  // 10 turns survived
  if (state.turn >= MAX_TURNS)   { state.endReason = 'survive'; return setState('RESULT'); }

  // Continue — update face to reflect current gauge state before next tell
  setCharFace(faceFromGauges());
  state.turn++;
  setState('TURN_START');
}

// ── Ending logic ──
function resolveEnding() {
  const g  = state.gauges;
  const r  = state.endReason;
  const isWin = r !== 'drunk' && r !== 'sus' && r !== 'tens';

  let ending = 'bad';
  let title  = '';

  if (!isWin) {
    ending = 'bad';
    if (r === 'drunk')  title = '無事終電消失';
    else if (r === 'sus') title = 'グラス見られおじさん';
    else                  title = '空気破壊おじさん';
  } else if (r === 'mood100') {
    ending = 'special';
    title  = '乾杯の支配者';
  } else if (r === 'survive' && g.mood >= 60 && g.sus < 40) {
    ending = 'true';
    title  = 'みるくの夜になった';
  } else if (r === 'survive' && g.drunk < 30) {
    ending = 'special';
    title  = '素面の策士';
  } else if (r === 'survive' && g.sus < 30) {
    ending = 'special';
    title  = '自然体の逃亡者';
  } else {
    ending = 'normal';
    title  = '夜の生還者';
  }

  return { ending, title, isWin };
}

function countMatch(p, m) {
  return state.history.filter(h => h.p === p && h.m === m).length;
}

function playedInAct3(cardId) {
  return state.history.some(h => h.turn >= 8 && h.p === cardId);
}

function resultContext({ ending, isWin, topCard }) {
  return {
    ending,
    isWin,
    topCard,
    g: state.gauges,
    peak: state.peak,
    counts: state.counts,
    history: state.history,
    endReason: state.endReason,
    turn: state.turn,
  };
}

const TITLE_RULES = [
  {
    id: 'final_true',
    name: '最終ターンのTRUE',
    description: '最後の最後でTRUEを決めた',
    test: c => c.turn === MAX_TURNS && c.ending === 'true',
  },
  {
    id: 'mood_blitz',
    name: '快速攻略',
    description: '6ターン以内に好感度でSPECIAL',
    test: c => c.endReason === 'mood100' && c.turn <= 6,
  },
  {
    id: 'triple_fake_win',
    name: '完璧なる嘘つき',
    description: '3回全てごまかして勝利した',
    test: c => c.counts.fake >= 3 && c.isWin,
  },
  {
    id: 'total_sobriety',
    name: '完全素面',
    description: '一滴も飲まずに夜を切り抜けた',
    test: c => c.g.drunk === 0 && c.isWin,
  },
  {
    id: 'perfect_innocence',
    name: '完全無実',
    description: '最後まで疑惑が一桁だった',
    test: c => c.g.sus <= 9 && c.isWin,
  },
  {
    id: 'high_wire_true',
    name: '綱渡りTRUE',
    description: '酔い危険域からTRUEを掴み取った',
    test: c => c.ending === 'true' && c.peak.drunk >= 55,
  },
  {
    id: 'late_counter',
    name: 'ラストの読み',
    description: 'ACT3で見張るカウンターを決めた',
    test: c => c.history.some(h => h.turn >= 8 && h.p === 'watch' && h.m === 'fake'),
  },
  {
    id: 'sus_survivor',
    name: '疑惑綱渡り',
    description: '疑惑85以上から生き還った',
    test: c => c.peak.sus >= 85 && c.isWin,
  },
  {
    id: 'air_guardian',
    name: '空気の番人',
    description: '最後まで空気を80以上に保った',
    test: c => c.g.tens >= 80 && c.isWin,
  },
  {
    id: 'cold_winner',
    name: '冷戦勝者',
    description: 'みるくを温めずに生き残った',
    test: c => c.isWin && c.g.mood <= 5,
  },
  {
    id: 'mood_blitz_alt',
    name: '心の征服者',
    description: '好感度で勝負を決めた',
    test: c => c.endReason === 'mood100',
  },
  {
    id: 'speed_loss',
    name: '電光石火の散り様',
    description: '4ターン以内に夜が終わった',
    test: c => c.turn <= 4 && c.ending === 'bad',
  },
  {
    id: 'drunk_no_water',
    name: '水断ちの末路',
    description: 'チェイサーなしで酔い敗北した',
    test: c => c.endReason === 'drunk' && c.counts.chaser === 0,
  },
  {
    id: 'sus_blind',
    name: '見張れなかった代償',
    description: '一度も見張らずに疑惑敗北した',
    test: c => c.endReason === 'sus' && c.counts.watch === 0,
  },
  {
    id: 'freeze_specialist',
    name: '場冷えスペシャリスト',
    description: 'チェイサー多用で場を凍らせた',
    test: c => c.endReason === 'tens' && c.counts.chaser >= 2,
  },
  {
    id: 'double_bust',
    name: '二回バレた人',
    description: 'フリを2回も見抜かれた',
    test: () => countMatch('fake', 'watch') >= 2,
  },
  {
    id: 'counter_twice',
    name: '二重読み',
    description: 'フリを2回以上カウンターした',
    test: () => countMatch('watch', 'fake') >= 2,
  },
  {
    id: 'all_cards_used',
    name: '万能型',
    description: '全カードを1回以上使った',
    test: c => c.counts.toast >= 1 && c.counts.fake >= 1 && c.counts.watch >= 1 && c.counts.chaser >= 1,
  },
  {
    id: 'no_chaser_win',
    name: '水なし完走',
    description: 'チェイサーなしで勝ち切った',
    test: c => c.counts.chaser === 0 && c.isWin,
  },
  {
    id: 'all_in_watch',
    name: '偵察全投入',
    description: '見張るを両方使い切った',
    test: c => c.counts.watch >= 2,
  },
  {
    id: 'act3_bluff',
    name: '土壇場のブラフ',
    description: 'ACT3でフリを仕掛けた',
    test: () => playedInAct3('fake'),
  },
  {
    id: 'act1_toast_rush',
    name: '序盤全開',
    description: '探り合いフェーズを全力乾杯で駆けた',
    test: c => c.history.filter(h => h.turn <= 3 && h.p === 'toast').length >= 3,
  },
  {
    id: 'full_course',
    name: 'フルコース完走',
    description: '10ターン全てを走り切った',
    test: c => c.turn === MAX_TURNS && c.endReason === 'survive',
  },
  {
    id: 'special_quirk',
    name: '曲者の勝ち方',
    description: '尖った数値で特殊勝利を決めた',
    test: c => c.ending === 'special' && c.endReason === 'survive',
  },
  {
    id: 'drunk_abyss',
    name: 'テキーラの淵',
    description: '酔い70以上の領域まで踏み込んだ',
    test: c => c.peak.drunk >= 70,
  },
  {
    id: 'faker_exhausted',
    name: '嘘の底値',
    description: '3枚全てのごまかしを使い切った',
    test: c => c.counts.fake >= 3,
  },
  {
    id: 'toast_supremacist',
    name: '乾杯一家',
    description: '乾杯以外の選択肢が見えていなかった',
    test: c => c.counts.toast >= 7,
  },
  {
    id: 'chaser_philosopher',
    name: '水の民',
    description: '水でしか逃げない流儀がある',
    test: c => c.counts.chaser >= 2 && c.counts.toast <= 2,
  },
  {
    id: 'busted_once',
    name: '大バレ経験者',
    description: 'フリを見事に見抜かれた',
    test: () => countMatch('fake', 'watch') >= 1,
  },
  {
    id: 'honest_gambler',
    name: '嘘なしの夜',
    description: '一度もごまかさなかった',
    test: c => c.counts.fake === 0,
  },
  {
    id: 'no_retreat',
    name: '退路なし',
    description: '一度もチェイサーを使わなかった',
    test: c => c.counts.chaser === 0,
  },
  {
    id: 'night_survivor',
    name: '夜の生還者',
    description: 'どうにか夜を乗り切った',
    test: () => true,
  },
];

const ACHIEVEMENT_RULES = [
  { id:'ACH_FIRST_TRUE', name:'みるくの夜', description:'飲む・かわす・読む。全部が噛み合った夜だった。', test:c=>c.ending==='true' },
  { id:'ACH_MOOD100', name:'心の征服者', description:'好感度で勝負を決めた。これは逃げじゃなくて攻略。', test:c=>c.endReason==='mood100' },
  { id:'ACH_FIRST_COUNTER', name:'読みの一撃', description:'フリの瞬間を見抜いた。みるくも少し驚いていた。', test:()=>countMatch('watch','fake')>=1 },
  { id:'ACH_FIRST_BUST', name:'洗礼', description:'大バレ。これを経験しないと次のフリは磨かれない。', test:()=>countMatch('fake','watch')>=1 },
  { id:'ACH_DRUNK_EDGE', name:'際どい素面', description:'ギリギリのところで踏みとどまった。次は早めに水を。', test:c=>c.peak.drunk>=70&&c.isWin },
  { id:'ACH_SUS_CRITICAL', name:'完全マーク', description:'みるくの目線がずっとグラスに向いていた。', test:c=>c.peak.sus>=90 },
  { id:'ACH_NO_FAKE_WIN', name:'正面突破', description:'ごまかしゼロで勝ち切った。これは純粋に強い。', test:c=>c.counts.fake===0&&c.isWin },
  { id:'ACH_ALL_FAKE', name:'嘘の全張り', description:'ごまかせるだけごまかした夜。バレなかった？', test:c=>c.counts.fake>=3 },
  { id:'ACH_FREEZE_END', name:'完全凍結', description:'空気が完全に死んだ。静かすぎる終わり方。', test:c=>c.endReason==='tens' },
  { id:'ACH_FAST_LOSS', name:'電光石火', description:'早い。夜が始まる前に終わった。', test:c=>c.turn<=4&&c.ending==='bad' },
  { id:'ACH_FULL_COURSE', name:'生存証明', description:'最後まで席を守り切った。それだけで十分すごい。', test:c=>c.turn===MAX_TURNS&&c.endReason==='survive' },
  { id:'ACH_NO_CHASER_WIN', name:'水なし完走', description:'逃げ道を封印して勝ち切った。', test:c=>c.counts.chaser===0&&c.isWin },
  { id:'ACH_ALL_CARDS', name:'全カード採用', description:'4枚全部使った柔軟なプレイ。', test:c=>c.counts.toast>=1&&c.counts.fake>=1&&c.counts.watch>=1&&c.counts.chaser>=1 },
  { id:'ACH_TOAST_HEAVY', name:'乾杯の求道者', description:'乾杯という選択を信じ続けた夜。', test:c=>c.counts.toast>=7 },
  { id:'ACH_DRUNK_ZERO', name:'完全素面クリア', description:'一滴も飲まずに夜を完走した。完璧な逃げ切り。', test:c=>c.g.drunk===0&&c.isWin },
  { id:'ACH_SUS_LOW', name:'信頼の夜', description:'最後まで何も疑われなかった。', test:c=>c.g.sus<=10&&c.isWin },
  { id:'ACH_DOUBLE_COUNTER', name:'完璧読み', description:'2回以上フリを見抜いた。みるくは今日は読まれすぎ。', test:()=>countMatch('watch','fake')>=2 },
  { id:'ACH_CHASER_NEVER', name:'逃げ道封印', description:'一度も水に逃げずに10ターン走った。', test:c=>c.counts.chaser===0&&c.turn===MAX_TURNS },
  { id:'ACH_TENS_HIGH', name:'場の番人', description:'空気を高いまま保ち続けた夜。', test:c=>c.g.tens>=80&&c.isWin },
  { id:'ACH_MOOD_EARLY', name:'早期攻略', description:'序盤から好感度を積み上げた。', test:c=>c.endReason==='mood100'&&c.turn<=6 },
  { id:'ACH_LATE_WATCH', name:'最終盤の読み', description:'最後まで読む力が残っていた。', test:c=>c.history.some(h=>h.turn>=8&&h.p==='watch'&&h.m==='fake') },
  { id:'ACH_DRUNK_LOSS_DRY', name:'水断ちの末路', description:'水があれば変わっていた。次回は逃げ道も持て。', test:c=>c.endReason==='drunk'&&c.counts.chaser===0 },
  { id:'ACH_SUS_BLIND', name:'見張れなかった', description:'視線を向けなかった代償。フリはずっと積まれていた。', test:c=>c.endReason==='sus'&&c.counts.watch===0 },
  { id:'ACH_SPECIAL_SOBER', name:'シラフの特殊勝利', description:'酔わずに特殊勝利。管理が上手い。', test:c=>c.g.drunk<=20&&c.ending==='special' },
  { id:'ACH_COMEBACK', name:'大逆転', description:'疑惑が限界を超えかけてから、最後にTRUEを掴んだ。', test:c=>c.peak.sus>=85&&c.ending==='true' },
];

function resolveResultTitle(ctx) {
  return TITLE_RULES.find(rule => rule.test(ctx)) || TITLE_RULES[TITLE_RULES.length - 1];
}

function resolveAchievements(ctx) {
  return ACHIEVEMENT_RULES.filter(rule => rule.test(ctx));
}

function loadUnlockedAchievements() {
  try {
    return new Set(JSON.parse(localStorage.getItem(ACHIEVEMENT_STORAGE_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function saveUnlockedAchievements(ids) {
  try {
    localStorage.setItem(ACHIEVEMENT_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // localStorage can be unavailable in privacy modes; the run result still works.
  }
}

function buildSummaryTexts({ ending, isWin }) {
  const g = state.gauges;
  const decisive = state.history[state.history.length - 1];

  // Top card
  let topCard = { id: 'toast', count: 0 };
  for (const id of CARD_IDS) {
    if (state.counts[id] > topCard.count) topCard = { id, count: state.counts[id] };
  }

  const review = buildResultReview({ ending, isWin, topCard, decisive });
  const style = buildPlayStyleLine({ topCard });

  // Objective
  const objective = [
    `総評: ${review}`,
    `プレイ傾向: ${style}`,
    `最終ゲージ: 酔い ${g.drunk} / 疑惑 ${g.sus} / 空気 ${g.tens} / みるく ${g.mood}`,
    `総ターン: ${state.turn} / ${MAX_TURNS}`,
    `最多カード: ${CARDS[topCard.id].icon} ${CARDS[topCard.id].label} ×${topCard.count}`,
    `ピンチ最大: 疑惑 ${state.peak.sus} / 酔い ${state.peak.drunk} / 空気最低 ${state.peak.lowTens}`,
    decisive
      ? `決定打: T${decisive.turn} ${CARDS[decisive.p].icon}×${CARDS[decisive.m].icon}`
      : '—',
  ];

  const monologue = buildPlayerMonologue({ ending, topCard });
  const cast = buildMilkLine({ ending, topCard, decisive });

  return { objective, monologue, cast, topCard };
}

function resultSeed(salt = 0) {
  const g = state.gauges;
  const counts = CARD_IDS.reduce((sum, id, idx) => sum + state.counts[id] * (idx + 3), 0);
  const history = state.history.reduce((sum, h) => {
    return sum + h.turn * 13 + CARD_IDS.indexOf(h.p) * 17 + CARD_IDS.indexOf(h.m) * 19;
  }, 0);
  return Math.abs(
    state.turn * 23 +
    g.drunk * 3 +
    g.sus * 5 +
    g.tens * 7 +
    g.mood * 11 +
    counts +
    history +
    salt
  );
}

function pickVariant(list, salt = 0) {
  return list[resultSeed(salt) % list.length];
}

function buildResultReview({ ending, isWin, topCard, decisive }) {
  const g = state.gauges;
  const r = state.endReason;
  const common = {
    true: [
      '飲む・かわす・読むのリズムがかなり良い。疑われすぎず、場も冷やさず、最後まで主導権を持てていた。',
      'かなり綺麗な逃げ切り。強く出るところと引くところの切り替えがうまく、みるく側の温度も落としていない。',
      'これは勝ち。グラスの進み方より、会話のテンポを管理できていたのが大きい。',
      '危ない橋を渡りつつも、最後はちゃんと楽しい夜に見せ切った。カード運より判断勝ち。',
      '結局、最後は場の読み方で決まった夜だった。強引さも慎重さも、ちょうどいい量だった。',
      'どこで熱を出してどこで退くか、その判断が今日はほぼ正解だった。綺麗な勝ち方。',
      '疑われず、冷えず、飲みすぎず。三つ全部を保ったのは普通に難しい。よくやった。',
      '力で押したわけじゃないが、最後まで主導権は手元にあった。それが全て。',
      'みるくが今夜の相手を気に入っているとしたら、それはこういうプレイをしたから。',
      '完璧ではないが、ちゃんと楽しい夜になった。それ以上は必要ない。',
      '逃げ切りというより、うまく乗り切った。結果は一緒だが、体感はだいぶ違う。',
      'フリも乾杯も見張りも、どれかに寄りすぎていない。バランス型の良いTRUE。',
      '冷静さと勢いのどちらも捨てなかった。今夜の夜、あなたが作った。',
      '危ないところもあったはずだが、最後には収まるべきところに収まった。',
    ],
    special: [
      '普通の逃げ切りではなく、かなり癖のある勝ち筋。安全運転というより、読み合いで押し切った。',
      '勝ってはいるけど、かなり尖った内容。どこか一歩ズレていたら事故っていた。',
      '結果だけ見ると上手いが、途中の圧は高め。勝負師のプレイ。',
      'みるくの間合いに入りながら、自分のペースを捨てなかった。特殊勝利らしい濃い夜。',
      '尖った勝ち方だが、これはこれで正解。普通の夜じゃなかった分、残るものがある。',
      '普通の攻略じゃない。でも、それを一本通せたのは本物の読みがあったから。',
      'ひとつの数値を突き抜けた結果の勝利。バランスより先に方向性で押し切った。',
      '癖のある夜だった。でも振り返ると筋が通っている。それが特殊勝利らしい。',
      'みるくの目には少し奇妙に映ったかもしれない。でも記憶には残る。',
      '安全策ではなく、ひとつの賭けを通した結果。そういう勝ち方もある。',
      '普通に逃げるより、攻めて勝った夜。好き嫌いは分かれるが、強い内容。',
      'どこかひとつが際立っていた夜。それが勝因で、それが個性でもある。',
      '正道じゃない。でも、それが刺さったのなら結果は十分。',
      '読み合いの外側から攻めて勝った。みるくが一番驚いているかもしれない。',
    ],
    normal: [
      '生還はした。ただ、場の温度か疑惑のどちらかにずっと小さな火種が残っていた。',
      '逃げ切り成功。けれど余裕勝ちではなく、最後までグラスと視線に追われる展開だった。',
      '負けてはいない。だが、みるくから見ると少し読みにくい客だったかもしれない。',
      '堅実な夜。盛り上がり切りはしないが、致命傷も避けた現実的な勝ち方。',
      '生還した。ただ、ずっと小さなひっかかりが残ったままの夜だった。',
      '負けていない。ただし、今夜は点数で言うとギリギリの及第点。',
      'みるくから見ると、何を考えているか少し読みにくい客だったかも。',
      '逃げ切り成功。でも余裕ではなく、最後まで綱渡りだった。',
      '危機は来た。避けた。盛り上がりも来た。それほどでもなかった。そういう夜。',
      '悪くはない。ただ、何かひとつが噛み合っていたらもっと違う結末があった。',
      '判断は概ね正しかったが、どこかで一手、惜しい選択があった。',
      '終わってみれば生き残り。それ以上でも以下でもない、現実的な夜。',
      '場の温度か疑惑か、どちらかに小さな火種が残ったまま10ターン経った。',
      '堅実。もう少し攻めても良かったが、攻めなかったことも正解だったかもしれない。',
    ],
    bad: [
      '完全に事故。どこかのゲージだけを見すぎて、別の危険が膨らんでいた。',
      '読み合い以前に、場の制御が崩れた。次は一番危ないゲージを早めに潰したい。',
      '悪い終わり方ではあるが、敗因はわかりやすい。欲張った瞬間がちゃんと刺さっている。',
      '途中までは形になっていたが、最後に一線を越えた。守るカードを切るタイミングが鍵。',
      '一つのゲージに集中しすぎて、別の危険が静かに積み上がっていた。',
      '敗因は見えやすい。次にどう修正するかだけ、持ち帰ればいい。',
      '悪い終わり方ではあるが、どこで崩れたかはわかる。それは次への財産。',
      '守りたいものを守ろうとした結果、別の何かが崩れた。よくある事故の形。',
      '読み合い以前に、場の管理が先に限界を迎えた。戦略より先に基盤が必要。',
      'ひとつの選択が連鎖した夜。逆に言えば、そこを変えれば全部変わる。',
      'みるくに渡す前に、ゲージが先に結論を出してしまった。',
      '欲張ったか、臆病すぎたか。どちらかが敗因。たいていどちらか一方。',
      '途中まで形になっていた。崩れたのはほんの一手か二手のタイミング。',
      '負け方は綺麗ではないが、理由は単純。次は同じ橋を渡らなければいい。',
    ],
  };

  if (!isWin && r === 'drunk') {
    return pickVariant([
      '酔いが先に限界へ行った。正面突破は強いが、チェイサーを混ぜる判断がもう少し早く欲しかった。',
      '勢いはあった。でも勢いだけで夜を走ると、最後に身体がついてこない。',
      '乾杯の説得力は十分。ただ、説得力と安全圏は別物だった。',
      '疑惑を下げるための乾杯が、そのまま敗因になった。かなり皮肉な負け方。',
    ], 101);
  }
  if (!isWin && r === 'sus') {
    return pickVariant([
      '疑惑が積み上がりすぎた。ごまかすなら、見張る・乾杯するで視線を散らす必要があった。',
      'みるくに「見られている」時間が長かった。小さな違和感の回収を怠ったのが痛い。',
      'フェイクの回数より、フェイク後のフォロー不足が敗因。疑われた後の一手が重い。',
      '逃げ方は悪くないが、逃げていること自体が見えすぎた。',
    ], 102);
  }
  if (!isWin && r === 'tens') {
    return pickVariant([
      '空気が先に死んだ。安全を取りすぎると、みるくとの勝負そのものが終わってしまう。',
      '場を冷やすカードが重なった。酔いは守れても、会話の温度を守れなかった。',
      '沈黙が長すぎた夜。チェイサーや見張るの後に、どこかで乾杯の熱が欲しかった。',
      '慎重さが裏目に出た。負け方としてはいちばん静かで、いちばん痛い。',
    ], 103);
  }
  if (ending === 'special' && state.endReason === 'mood100') {
    return pickVariant([
      'みるくの好感度を押し切った勝ち。危険もあったが、会話の主導権がかなり強かった。',
      '距離の詰め方がうまい。疑惑や酔いより、場の親密さで勝負を決めた。',
      'これは逃げ切りというより攻略。読み合いの先にちゃんと好感触を残している。',
      '攻めたプレイなのに嫌な圧になっていない。かなり良い特殊勝利。',
    ], 104);
  }

  if (g.drunk >= 60) {
    return pickVariant(common[ending].concat([
      '終盤の酔いがかなり危険域。勝っていても、次回は水の差し込みが勝率を上げる。',
      '終わり際はかなりギリギリ。勝利の余韻より先に深呼吸したい内容。',
    ]), 105);
  }
  if (g.sus >= 65) {
    return pickVariant(common[ending].concat([
      '疑惑が高めに残った。勝っていても、みるくの記憶には少し引っかかりが残る。',
      '視線の圧が最後まで消えなかった。勝ち筋としては薄氷。',
    ]), 106);
  }
  if (g.tens <= 25) {
    return pickVariant(common[ending].concat([
      '空気の残量が少ない。勝ちではあるが、次の一杯につなげる余白は薄い。',
      '安全寄りの判断が続いて、場の熱が削れた。もう少し大胆でもよかった。',
    ]), 107);
  }
  if (topCard.id === 'toast' && decisive?.p === 'toast') {
    return pickVariant(common[ending].concat([
      '最後まで正面突破。分かりやすいぶん強いが、酔いゲージとの相談は必須。',
    ]), 108);
  }

  return pickVariant(common[ending], 109);
}

function buildPlayStyleLine({ topCard }) {
  const styleMap = {
    toast: [
      '正面突破型。疑惑を下げる力は強いが、酔いの管理が勝負。',
      '乾杯で場を動かすタイプ。攻めの説得力はある。',
      '迷ったら前に出るプレイ。空気は作れるが、限界管理が課題。',
    ],
    fake: [
      '煙幕型。ハマると強いが、見張られた瞬間に一気に崩れる。',
      '危険を飲まずに熱だけ拾うタイプ。読み負けだけは絶対に避けたい。',
      'ごまかしで勝負を伸ばすプレイ。成功時のリターンは大きい。',
    ],
    watch: [
      '読みに寄せた防御型。相手のフリには強いが、空気を冷やしやすい。',
      '視線で勝つタイプ。決まると気持ちいいが、空振り時の沈黙が重い。',
      '疑惑処理がうまい反面、攻めの温度はやや控えめ。',
    ],
    chaser: [
      '生存重視型。酔い管理は強いが、場の温度を削りやすい。',
      '引き際を作るタイプ。使いすぎると「逃げてる感」が出る。',
      '守りの判断は良い。あとはどこで熱を戻すか。',
    ],
  };
  return pickVariant(styleMap[topCard.id], 201);
}

function buildPlayerMonologue({ ending, topCard }) {
  const map = {
    toast: [
      '正面から行きすぎたな。次はもう少し読みを使う。',
      '乾杯で押せばなんとかなると思った。なんとかなった場面も、ならなかった場面もある。',
      'グラスを合わせるたびに疑惑は薄れた。でも、こっちの余裕も一緒に削れていった。',
      '勢いは作れた。あとは、勢いに飲まれないこと。',
    ],
    fake: [
      'ごまかし続けるの、思ったより心臓に悪い。',
      'バレてない顔をするのが一番難しい。たぶん、顔に出てた。',
      '飲んだフリは強い。でも一回見られたら、全部が怪しくなる。',
      '勝ったとしても、背中に汗をかくタイプの勝ち方だった。',
    ],
    watch: [
      '読み切ろうとしすぎて、自分が動けなかった。',
      '見る側に回ると、見られる怖さもわかる。',
      '一手読むたびに、会話が少し止まる。そこが難しい。',
      'カウンターは気持ちいい。でも空振りの静けさが怖い。',
    ],
    chaser: [
      '水で逃げ続けたら、空気が冷えていた。',
      '助かったターンは多い。でも、盛り上がりを置いてきた気もする。',
      'チェイサーは命綱。命綱を握りしめすぎると、身動きが取れない。',
      '酔いは守れた。次は場の温度も守りたい。',
    ],
  };
  const base = pickVariant(map[topCard.id], 301);
  if (ending === 'bad') {
    return `${base} どこかで一手、守る場所を間違えた。`;
  }
  if (ending === 'true') {
    return `${base} それでも今日は、最後までちゃんと楽しかった。`;
  }
  return base;
}

function buildMilkLine({ ending, topCard, decisive }) {
  const r = state.endReason;
  const pools = {
    true: [
      '今日のひと、ちゃんとノってくれた。また来てほしいな。',
      'ふふ、最後まで目が離せなかった。こういう勝負、嫌いじゃないよ。',
      'ちゃんと楽しかった。無理してる感じも、逃げすぎてる感じもなかったし。',
      '次もこの感じで来てくれたら、ちょっと嬉しいかも。',
      '今日はみるくの負けかな。いや、楽しかったから勝ちでもいいけど。',
      '今日のひと、ちゃんとノってくれてた。うれしかった。',
      '最後まで目が離せなかった。こういう勝負、嫌いじゃない。',
      '無理してる感じも、遠い感じもなかった。それが一番よかったかも。',
      'また来てくれたら、次はもう少し本気で読み合いたいな。',
      'ちゃんと空気作れる人だった。それって、すごく大事なことだよ。',
      'グラスより先に会話が見えた。そういうの、きちんと気づいてた。',
      '乾杯のタイミング、ここぞってところで来てた。それ、嬉しかった。',
      '今夜はみるく、少し本気で向き合ってたかも。それってそういうことだよ。',
      'また一緒に勝負したいな、って思ってる。言わないけど。',
    ],
    special: [
      'そんなふうに来てくれるひと、久しぶりかも。',
      '変な勝ち方するね。でも、そういうの嫌いじゃない。',
      '途中ちょっと怪しかったけど、最後はちゃんと持っていったね。',
      '読んでたの？ それともたまたま？ どっちでも、ちょっと面白かった。',
      '今日の勝負、あとで思い出しちゃうかも。',
      '途中ちょっと怪しかったけど、最後はちゃんと持っていったね。',
      'そんなふうに来るひと、久しぶりかも。',
      '正直、予想と違う展開だった。それが一番印象に残ってる。',
      '今日の勝負、あとで思い出しちゃいそう。なんかそういう夜だった。',
      '普通じゃない来方してたのに、ちゃんと締めた。それはえらい。',
      'みるくのこと、少し研究してきた？ してたとしたら、ちゃんと効いてたよ。',
      '一本、軸があったよね。それで最後まで崩れなかった。',
      'また来たら、もっとちゃんと読もうって思う。今日は少し油断してた。',
    ],
    normal: [
      'うーん、なんか、距離あったかも。',
      '悪くはなかったよ。でも、もう一歩だけ来てほしかったかな。',
      '最後まで無事だったのはえらい。けど、ちょっと読めない人だった。',
      '楽しかったような、探り合いだったような。ふしぎな夜。',
      '次はもう少しだけ、素直に来てもいいんじゃない？',
      '何考えてたか、最後までわからなかった。それが正解なのかな。',
      '遠くもなかったし、近くもなかった。ちょうど真ん中の夜だった。',
      'まあ、悪い夜じゃなかったよ。ただ、盛り上がるには少し何かが足りなかった。',
      'またそのうち来てくれたら、もう少し分かるかも。',
      '今日のこと、印象に残ってるかって言われたら……うーん。微妙なところ。',
    ],
    drunk: [
      '飲みすぎちゃったね。気をつけて帰ってね。',
      '顔、だいぶ赤いよ。今日はもうここまで。',
      '勢いは嬉しいけど、無理するのは違うからね。',
      'はい、お水。勝負より先に休憩しよ。',
      '楽しかったけど、次はもう少しゆっくりね。',
      '飲みすぎちゃったね。お水、飲んで。',
      '顔、だいぶ赤いよ。今日はここまでにしよっか。',
      '勢いは嬉しいけど、無理はちょっと違うよ。',
      '今夜は楽しかったね。でも帰りは気をつけて。',
      '次に来るときは、もう少し自分のペース守ってね。',
      '勝負より先に、休んで。ゆっくりね。',
      '楽しんでくれてたのは分かったよ。でも、もういいよ。',
      'ペース、はやかったね。みるくも少し心配してた。',
      'ちゃんと帰れる？ 大丈夫そうならよかった。',
      'また来てね。次は飲みすぎないでね、ほんとに。',
    ],
    sus: [
      'やっぱり、ずっとごまかしてたんだ。',
      '今のは見えてたよ。みるく、そういうの気づくから。',
      'ふーん……そういう勝負するんだ。',
      'ごまかすなら、もう少し上手にやらなきゃ。',
      '目が泳いでた。そこ、かわいいけどアウト。',
      '最初から少し、変だと思ってた。やっぱりね。',
      'グラスの動きより、顔の方が正直だったよ。',
      '次はもっとうまくやれるといいね。研究しといて。',
      '全部は見てないけど、半分くらいは見てた。それで十分。',
      'みるくを甘く見すぎてたかも。それが敗因だよ。',
    ],
    tens: [
      '……今日はもう、おひらきかな。',
      '空気、ちょっと冷えちゃったね。',
      '安全なのはいいけど、会話まで止まっちゃった。',
      'んー、今日はここまでにしよっか。',
      '嫌いじゃないけど、ちょっと遠かったかも。',
      '水ばっかり飲んでたら、勝負じゃなくなっちゃうよ。',
      '静かな夜だったね。静かすぎたかも。',
      'みるく、話しかけるタイミング難しかった。ちょっと困ってた。',
      '次来るときは、もう少し場に入ってきてほしいな。',
      '今夜の感想、まだうまく言葉にできてないや。',
    ],
  };

  if (ending === 'bad') return pickVariant(pools[r] || pools.tens, 401);

  const extras = {
    toast: [
      '乾杯のタイミング、けっこう上手かったよ。',
      '勢いある人だなって思った。ちょっと危なかったけど。',
    ],
    fake: [
      'ごまかす顔、わりと出てたよ。ふふ。',
      '全部は見逃してないからね？',
    ],
    watch: [
      'そんなに見られると、こっちも意識しちゃうじゃん。',
      '読み合い、楽しかった。ちょっと緊張したけど。',
    ],
    chaser: [
      'ちゃんと水はさむの、えらいと思う。',
      '冷静なのはいいところ。でも、たまには勢いも見たいな。',
    ],
  };

  if (decisive && decisive.p === topCard.id && resultSeed(402) % 3 === 0) {
    return pickVariant(extras[topCard.id], 403);
  }
  return pickVariant(pools[ending], 404);
}

function buildSummary() {
  const { ending, title, isWin } = resolveEnding();
  const texts = buildSummaryTexts({ ending, isWin });
  const ctx = resultContext({ ending, isWin, topCard: texts.topCard });
  const resultTitle = resolveResultTitle(ctx);
  const achievements = resolveAchievements(ctx);
  const unlocked = loadUnlockedAchievements();
  const newAchievements = achievements.filter(a => !unlocked.has(a.id));
  achievements.forEach(a => unlocked.add(a.id));
  saveUnlockedAchievements(unlocked);
  texts.objective.unshift(`称号: ${resultTitle.name} - ${resultTitle.description}`);

  state.summary = {
    isWin, ending, endReason: state.endReason,
    title,
    resultTitle,
    achievements,
    newAchievements,
    finalGauges: { ...state.gauges },
    topCard: texts.topCard,
    peak: { ...state.peak },
    decisive: state.history[state.history.length - 1] || null,
    turn: state.turn,
    texts: { objective: texts.objective, monologue: texts.monologue, cast: texts.cast },
  };
}

// ── Result screen ──
const VERDICT_LABELS = { true:'TRUE END', special:'SPECIAL END', normal:'NORMAL END', bad:'BAD END' };
const X_POST_TEMPLATES = [
  {
    id: 'true_proud',
    test: s => s.ending === 'true',
    line: '疑われず、飲みすぎず、空気も守った。',
  },
  {
    id: 'true_soft',
    test: s => s.ending === 'true',
    line: 'なんか、いい夜だったな。',
  },
  {
    id: 'special_proud',
    test: s => s.ending === 'special',
    line: '癖の強い勝ち方だけど、通ったからいい。',
  },
  {
    id: 'special_mood',
    test: s => s.ending === 'special' && s.endReason === 'mood100',
    line: 'みるくの好感度で押し切った。これが一番気持ちいい。',
  },
  {
    id: 'normal_dry',
    test: s => s.ending === 'normal',
    line: 'どうにか生き残った。今夜はこれで十分。',
  },
  {
    id: 'normal_self',
    test: s => s.ending === 'normal',
    line: '勝ちとは言えないかもだけど、負けでもないので。',
  },
  {
    id: 'bad_report',
    test: s => s.ending === 'bad',
    line: '無事に事故った。でも原因はわかった。',
  },
  {
    id: 'bad_rematch',
    test: s => s.ending === 'bad',
    line: 'みるくに全部見透かされた。次は騙してみせる。',
  },
  {
    id: 'top_card',
    test: () => true,
    line: s => `${CARDS[s.topCard.id].label}だけで${s.topCard.count}ターン戦った。`,
  },
  {
    id: 'decisive',
    test: s => Boolean(s.decisive),
    line: s => `T${s.decisive.turn}の${CARDS[s.decisive.p].label} vs ${CARDS[s.decisive.m].milkLabel}で全てが決まった。`,
  },
];

function enterResult() {
  buildSummary();
  showScreen('result-screen');
  const s = state.summary;

  const frame = $('result-frame');
  frame.className = `result-frame ${s.ending}-end`;

  $('result-verdict').textContent   = `— ${VERDICT_LABELS[s.ending]} —`;
  $('result-title-big').textContent = s.title;
  $('result-title-badge').textContent = `称号：${s.resultTitle.name}`;

  const achievementWrap = $('result-achievements');
  if (achievementWrap) {
    achievementWrap.replaceChildren();
    const visibleAchievements = (s.newAchievements.length ? s.newAchievements : s.achievements).slice(0, 3);
    visibleAchievements.forEach(a => {
      const chip = document.createElement('div');
      chip.className = 'achievement-chip';
      chip.classList.toggle('is-new', s.newAchievements.some(n => n.id === a.id));
      const name = document.createElement('strong');
      name.className = 'achievement-name';
      name.textContent = a.name;
      const desc = document.createElement('span');
      desc.className = 'achievement-desc';
      desc.textContent = a.description;
      chip.append(name, desc);
      achievementWrap.appendChild(chip);
    });
  }

  // Show representative card image (decisive card, fallback to top card)
  const preview = $('result-card-img');
  if (preview) {
    preview.innerHTML = '';
    const cardId = s.decisive ? s.decisive.p : s.topCard.id;
    const imgSrc = CARD_IMAGES.player[cardId];
    if (imgSrc) {
      const img = document.createElement('img');
      img.src = imgSrc;
      img.alt = CARDS[cardId].label;
      img.className = 'result-card-art';
      img.onerror = () => preview.replaceChildren();
      preview.appendChild(img);
    }
  }

  updateXPostLink();

  // Default tab (listeners are bound once in init())
  setResultTab('objective');
}

function setResultTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
    b.setAttribute('aria-selected', b.dataset.tab === tab ? 'true' : 'false');
  });

  const pov = $('result-pov');
  const s   = state.summary;

  if (tab === 'objective') {
    pov.innerHTML = s.texts.objective
      .map(l => `<div class="pov-line">${escHtml(l)}</div>`)
      .join('');
  } else if (tab === 'monologue') {
    pov.innerHTML = `<div class="pov-monologue">${escHtml(s.texts.monologue)}</div>`;
  } else {
    pov.innerHTML = `<div class="pov-cast">${escHtml(s.texts.cast)}</div>`;
  }
}

function escHtml(str) {
  return str
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

// ── X post intent ──
function buildResultPostText() {
  const s = state.summary;
  const g = s.finalGauges;
  const d = s.decisive;
  const top = CARDS[s.topCard.id];
  const candidates = X_POST_TEMPLATES.filter(t => t.test(s));
  const template = candidates[resultSeed(501) % candidates.length] || X_POST_TEMPLATES[0];
  const resultLine = typeof template.line === 'function' ? template.line(s) : template.line;
  const lines = [
    `テキーラから逃げろ！CARD MODE`,
    `「${s.resultTitle.name}」/ ${VERDICT_LABELS[s.ending]}`,
    resultLine,
    `酔い${g.drunk} / 疑惑${g.sus} / 空気${g.tens} / みるく${g.mood}`,
    `最多カード: ${top.icon} ${top.label}×${s.topCard.count}`,
    d ? `決定打 T${d.turn}: ${CARDS[d.p].label} vs ${CARDS[d.m].milkLabel}` : null,
  ].filter(Boolean); // filter(Boolean) removes null, empty string, undefined

  return lines.join('\n');
}

function updateXPostLink() {
  const link = $('post-x-btn');
  if (!link || !state.summary) return;
  const params = new URLSearchParams({
    text: buildResultPostText(),
    hashtags: 'テキーラから逃げろ',
  });
  link.href = `https://twitter.com/intent/tweet?${params.toString()}`;
}

// ── HUD update ──
function updateHUD() {
  const g = state.gauges;
  setGauge('drunk', g.drunk);
  setGauge('sus',   g.sus);
  setGauge('tens',  g.tens);
  setGauge('mood',  g.mood);
  $('turn-display').textContent = `${state.turn} / ${MAX_TURNS}`;
  updateDangerState();
}

function historyTone(entry) {
  const key = `${entry.p}-${entry.m}`;
  if (key === 'fake-watch') return 'bust';
  if (key === 'watch-fake') return 'counter';
  if (key === 'toast-toast') return 'toast';
  if (entry.deltas.T <= -10) return 'freeze';
  if (entry.deltas.D > 0) return 'drink';
  if (entry.deltas.M > 0) return 'mood';
  return 'neutral';
}

function updateTurnHistory() {
  const el = $('turn-history');
  if (!el) return;
  el.replaceChildren();
  for (let i = 1; i <= MAX_TURNS; i++) {
    const entry = state.history.find(h => h.turn === i);
    const dot = document.createElement('span');
    dot.className = 'turn-dot';
    dot.dataset.turn = String(i);
    if (entry) {
      const tone = historyTone(entry);
      dot.classList.add('played', `tone-${tone}`);
      dot.title = `T${i}: ${CARDS[entry.p].label} vs ${CARDS[entry.m].milkLabel}`;
    } else if (i === state.turn && state.fsm !== 'INTRO' && state.fsm !== 'RESULT') {
      dot.classList.add('current');
      dot.title = `T${i}: 現在`;
    } else {
      dot.title = `T${i}`;
    }
    el.appendChild(dot);
  }
}

function setGauge(key, val) {
  const fill = $(`${key}-fill`);
  const num  = $(`${key}-value`);
  if (fill) fill.style.width = `${val}%`;
  if (num) {
    num.textContent = `${val}`;
    const stat = num.closest('.hud-stat');
    if (stat) {
      const danger =
        (key === 'drunk' && val >= 50) ||
        (key === 'sus'   && val >= 70) ||
        (key === 'tens'  && val <= 20) ||
        (key === 'mood'  && val >= 50);
      stat.classList.toggle('is-danger', danger);
      stat.classList.toggle('is-critical',
        (key === 'drunk' && val >= 65) ||
        (key === 'sus'   && val >= 88) ||
        (key === 'tens'  && val <= 10) ||
        (key === 'mood'  && val >= 65)
      );
    }
  }
}

function updateActBadge() {
  $('act-badge').textContent = actLabel(state.turn);
  const app = $('app');
  app.dataset.act   = String(actNumber(state.turn));
  app.dataset.final = state.turn === MAX_TURNS ? 'true' : '';
}

function maybeShowActBanner() {
  if (![4, 8, 10].includes(state.turn)) return 0;
  const text = actBannerText(state.turn);
  const banner = $('act-banner');
  const kicker = $('act-banner-kicker');
  const title = $('act-banner-title');
  const copy = $('act-banner-copy');
  if (!banner || !kicker || !title || !copy) return 0;
  banner.dataset.phase = text.phase;
  kicker.textContent = text.kicker;
  title.textContent = text.title;
  copy.textContent = text.copy;
  banner.classList.remove('act-banner-in');
  void banner.offsetWidth;
  banner.classList.add('act-banner-in');
  return ACT_BANNER_MS;
}

function updateDangerState() {
  const app = $('app');
  if (!app) return;
  const g = state.gauges;
  let danger = 'none';
  if (g.sus >= 70) danger = 'sus';
  else if (g.drunk >= 50) danger = 'drunk';
  else if (g.tens <= 20) danger = 'cold';
  else if (g.mood >= 50) danger = 'mood';
  app.dataset.danger = danger;
}

function playCommitEffect(cardId) {
  const app = $('app');
  const hand = $('hand');
  const slot = document.querySelector(`.card-slot[data-card="${cardId}"]`);
  const ghost = $('commit-card');
  const img = $('commit-card-img');
  const label = $('commit-card-label');
  if (app) app.dataset.commit = cardId;
  if (hand) hand.classList.add('committing');
  if (slot) slot.classList.add('chosen');
  if (ghost && img && label) {
    img.src = CARD_IMAGES.player[cardId];
    label.textContent = CARD_COMMIT_LABELS[cardId] || CARDS[cardId].label;
    ghost.classList.remove('commit-in');
    void ghost.offsetWidth;
    ghost.classList.add('commit-in');
  }
}

function playMatchImpact(matchKey, reactionFace) {
  const effect = MATCH_EFFECTS[matchKey];
  const cutin = $('match-cutin');
  const kicker = $('match-cutin-kicker');
  const title = $('match-cutin-title');
  const copy = $('match-cutin-copy');
  const burst = $('reaction-burst');
  const img = $('reaction-img');
  const app = $('app');
  if (effect && cutin && kicker && title && copy) {
    kicker.textContent = effect.kicker;
    title.textContent = effect.title;
    copy.textContent = effect.copy;
    cutin.className = `match-cutin match-${effect.tone}`;
    cutin.classList.remove('cutin-in');
    void cutin.offsetWidth;
    cutin.classList.add('cutin-in');
  }
  if (burst && img) {
    img.src = CHAR_IMAGES[reactionFace] || CHAR_IMAGES.tuzyou;
    burst.className = `reaction-burst face-${reactionFace}`;
    burst.classList.remove('reaction-in');
    void burst.offsetWidth;
    burst.classList.add('reaction-in');
  }
  if (matchKey === 'fake-watch') playBustCutin();
  if (app) {
    delete app.dataset.tone;
    void app.offsetWidth;
    app.dataset.tone = effect?.tone || 'neutral';
    app.classList.remove('impact-pulse');
    void app.offsetWidth;
    app.classList.add('impact-pulse');
  }
}

function playBustCutin() {
  const cutin = $('bust-cutin');
  const img = $('bust-cutin-img');
  if (!cutin || !img) return;
  img.src = CHAR_IMAGES.utagai;
  cutin.classList.remove('bust-cutin-in');
  void cutin.offsetWidth;
  cutin.classList.add('bust-cutin-in');
}

function clearImpact() {
  const app = $('app');
  if (app) {
    delete app.dataset.commit;
    delete app.dataset.match;
    delete app.dataset.tone;
    app.dataset.danger = 'none';
    app.classList.remove('impact-pulse');
  }
  const hand = $('hand');
  if (hand) hand.classList.remove('committing');
  document.querySelectorAll('.card-slot.chosen').forEach(slot => slot.classList.remove('chosen'));
  $('commit-card')?.classList.remove('commit-in');
  $('match-cutin')?.classList.remove('cutin-in');
  $('reaction-burst')?.classList.remove('reaction-in');
  $('bust-cutin')?.classList.remove('bust-cutin-in');
  $('act-banner')?.classList.remove('act-banner-in');
}

// ── SFX ──
let sfxTimer = null;
function showSfx(text) {
  const el = $('sfx-text');
  if (!el || !text) return;
  el.textContent = text;
  el.classList.remove('sfx-show');
  void el.offsetWidth;
  el.classList.add('sfx-show');
  if (sfxTimer) clearTimeout(sfxTimer);
  sfxTimer = setTimeout(() => el.classList.remove('sfx-show'), 800);
}
function clearSfx() {
  const el = $('sfx-text');
  if (el) el.classList.remove('sfx-show');
  if (sfxTimer) clearTimeout(sfxTimer);
}

function resetToIntro() {
  const needsConfirm = state.fsm !== 'INTRO' && state.fsm !== 'RESULT';
  if (needsConfirm && !window.confirm('進行中の勝負を終了してTOPに戻りますか？')) return;
  clearSfx();
  clearTell();
  clearReveal();
  clearImpact();
  disableHand();
  state = initialState();
  updateHUD();
  setState('INTRO');
}

// ── Toast notification ──
let toastTimer = null;
function showToast(msg) {
  const el = $('toast-msg');
  el.textContent = msg;
  el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
}

// ── Preload all images for instant switching ──
function preloadImages() {
  const srcs = [
    ...Object.values(CHAR_IMAGES),
    ...Object.values(CARD_IMAGES.player),
    ...Object.values(CARD_IMAGES.milk),
  ];
  srcs.forEach(src => { const i = new Image(); i.src = src; });
}

// ── Init ──
function init() {
  preloadImages();

  // Mark all screens as hidden initially (intro is activated by setState('INTRO'))
  document.querySelectorAll('.screen').forEach(s => {
    s.setAttribute('aria-hidden', 'true');
    s.inert = true;
  });

  // Start button
  $('start-btn').addEventListener('click', () => setState('TURN_START'));
  $('top-btn').addEventListener('click', resetToIntro);

  // Card slot tap handlers
  CARD_IDS.forEach(id => {
    const slot = document.querySelector(`.card-slot[data-card="${id}"]`);
    if (slot) slot.addEventListener('click', () => onCardTap(id));
  });

  // Tab buttons — bound once, reused across replays
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => setResultTab(btn.dataset.tab));
  });

  // Retry
  $('retry-btn').addEventListener('click', resetToIntro);

  setState('INTRO');
}

document.addEventListener('DOMContentLoaded', init);
