'use strict';

// ── Constants ──
const MAX_TURNS           = 10;
const FLIP_MS             = 500;
const REVEAL_HOLD_MS      = 1000;
const TELL_HOLD_MS        = 1600;
const TELL_HONEST_RATE    = 0.7;
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

// ── Tell system ──
// TELL_OF maps milkCard → tell type ID
const TELL_OF = { watch:'glass', toast:'excite', chaser:'bored', fake:'playful' };
const TELLS = {
  glass:   { text:'「グラス、減ってないなぁ……」', icon:'👀', observation:'みるくがグラスを見ている', prediction:'見張るかも' },
  excite:  { text:'「ねぇ、もっといこ？！」',       icon:'🙂', observation:'笑顔が深まった',            prediction:'乾杯かも' },
  bored:   { text:'「ふぅ……」',                     icon:'💧', observation:'息をついた',                prediction:'様子見かも' },
  playful: { text:'「次は……どうしよっかな？」',     icon:'🎭', observation:'髪を触った',                prediction:'飲んだフリかも' },
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
  const honest = Math.random() < TELL_HONEST_RATE;
  const tellCard = honest ? willPlay : pickAnyOther(willPlay);
  const type = TELL_OF[tellCard] || 'playful';

  // Chaser special: if player's previous card was chaser and tell is bored, swap text
  const chaserSpecial = (state.history.length > 0 &&
    state.history[state.history.length - 1].p === 'chaser' &&
    type === 'bored');

  return { type, honest, willPlay, chaserSpecial };
}

// ── State ──
const initialState = () => ({
  fsm: 'INTRO',
  turn: 1,
  hand: { toast:4, fake:3, watch:2, chaser:2 },
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
  showScreen('intro-screen');
}

function enterTurnStart() {
  showScreen('game-screen');
  // Ensure clean DOM state (handles retry & first turn)
  clearReveal();
  clearSfx();
  updateHUD();
  updateActBadge();
  requestAnimationFrame(() => setState('TELL_PHASE'));
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

  // みるく表情をテルに連動
  const FACE_OF = { glass:'doubt', excite:'smile', bored:'normal', playful:'mood' };
  const charEl = $('character');
  if (charEl) charEl.dataset.face = FACE_OF[state.tell.type] || 'normal';

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
  if (CARD_IDS.every(id => state.hand[id] === 0)) {
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
    const n = state.hand[id];
    slot.querySelector('.card-count').textContent = `×${n}`;
    slot.setAttribute('aria-label', `${CARDS[id].label} 残り${n}枚`);

    if (n === 0) {
      slot.disabled = true;
      slot.setAttribute('aria-disabled', 'true');
      slot.classList.add('empty');
      slot.classList.remove('last-one');
    } else {
      slot.disabled = false;
      slot.removeAttribute('aria-disabled');
      slot.classList.remove('empty');
      slot.classList.toggle('last-one', n === 1);
    }
  });
}

function onCardTap(cardId) {
  if (state.fsm !== 'CARD_SELECT') return;
  if (state.hand[cardId] <= 0) return;

  state.playerCard = cardId;
  state.hand[cardId]--;
  state.counts[cardId]++;
  refreshHandSlots(); // Immediately update count display and disabled state

  // Update CPU pattern tracking (player's card streak)
  if (state.cpuPattern.lastCard === cardId) {
    state.cpuPattern.sameStreak++;
  } else {
    state.cpuPattern.lastCard = cardId;
    state.cpuPattern.sameStreak = 1;
  }

  setState('REVEAL');
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

  // Switch label to VS for dramatic reveal
  const vsEl = $('vs-label');
  if (vsEl) vsEl.textContent = 'VS';

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

  // Flip, then chain to RESOLVE — nested setTimeout keeps the two phases coupled
  setTimeout(() => {
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
  // Reset vs-label for next turn
  const vsEl = $('vs-label');
  if (vsEl) vsEl.textContent = 'せーの！';
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

  // Show SFX label
  const sfxKey = `${state.playerCard}-${state.milkCard}`;
  showSfx(SFX_LABELS[sfxKey] || '');

  updateHUD();

  // Hide reveal cards halfway through (guard: don't touch DOM if FSM moved on)
  const resolveTurn = state.turn;
  setTimeout(() => { if (state.turn === resolveTurn) clearReveal(); }, REVEAL_HOLD_MS * 0.6);

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

  // Continue
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

function buildSummaryTexts({ ending, isWin }) {
  const g = state.gauges;
  const decisive = state.history[state.history.length - 1];

  // Top card
  let topCard = { id: 'toast', count: 0 };
  for (const id of CARD_IDS) {
    if (state.counts[id] > topCard.count) topCard = { id, count: state.counts[id] };
  }

  // Objective
  const objective = [
    `最終ゲージ: 酔い ${g.drunk} / 疑惑 ${g.sus} / 空気 ${g.tens} / みるく ${g.mood}`,
    `総ターン: ${state.turn} / ${MAX_TURNS}`,
    `最多カード: ${CARDS[topCard.id].icon} ${CARDS[topCard.id].label} ×${topCard.count}`,
    `ピンチ最大: 疑惑 ${state.peak.sus} / 酔い ${state.peak.drunk} / 空気最低 ${state.peak.lowTens}`,
    decisive
      ? `決定打: T${decisive.turn} ${CARDS[decisive.p].icon}×${CARDS[decisive.m].icon}`
      : '—',
  ];

  // Monologue (based on most-used card)
  const monoMap = {
    toast:  '正面から行きすぎたな。次はもう少し読みを使う。',
    fake:   'ごまかし続けて、最後にバレた。心臓が持たなかった。',
    watch:  '読み切ろうとしすぎて、自分が動けなかった。',
    chaser: '水で逃げ続けたら、空気が冷えていた。',
  };
  const monologue = monoMap[topCard.id] || '今夜はここまでだった。';

  // Cast POV (no "酔わせた" / "飲ませた" / "潰した")
  let cast = '';
  if (ending === 'true') {
    cast = '今日のひと、ちゃんとノってくれた。また来てほしいな。';
  } else if (ending === 'special') {
    cast = 'そんなふうに来てくれるひと、久しぶりかも。';
  } else if (ending === 'normal') {
    cast = 'うーん、なんか、距離あったかも。';
  } else {
    const r = state.endReason;
    if (r === 'drunk')  cast = '飲みすぎちゃったね。気をつけて帰ってね。';
    else if (r === 'sus') cast = 'やっぱり、ずっとごまかしてたんだ。';
    else                  cast = '……今日はもう、おひらきかな。';
  }

  return { objective, monologue, cast, topCard };
}

function buildSummary() {
  const { ending, title, isWin } = resolveEnding();
  const texts = buildSummaryTexts({ ending, isWin });

  state.summary = {
    isWin, ending, endReason: state.endReason,
    title,
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

function enterResult() {
  buildSummary();
  showScreen('result-screen');
  const s = state.summary;

  const frame = $('result-frame');
  frame.className = `result-frame ${s.ending}-end`;

  $('result-verdict').textContent   = `— ${VERDICT_LABELS[s.ending]} —`;
  $('result-title-big').textContent = s.title;

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
      img.onerror = () => preview.remove();
      preview.appendChild(img);
    }
  }

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
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Copy result ──
function copyResult() {
  const s = state.summary;
  const g = s.finalGauges;
  const d = s.decisive;
  const lines = [
    `🥂 テキーラから逃げろ！（カードモード）`,
    `結果: ${s.title} / ${VERDICT_LABELS[s.ending]}`,
    `🍸${g.drunk} 👀${g.sus} ✨${g.tens} 💗${g.mood}`,
    `最多: ${CARDS[s.topCard.id].icon}×${s.topCard.count}`,
    d ? `決定打: T${d.turn} ${CARDS[d.p].icon}×${CARDS[d.m].icon}` : null,
    `「${s.texts.monologue}」`,
    ``,
    `#テキーラから逃げろ`,
  ].filter(Boolean); // filter(Boolean) removes null, empty string, undefined

  const text = lines.join('\n');
  const btn  = $('copy-btn');

  function resetCopyBtn() { setTimeout(() => { btn.textContent = '結果をコピー'; }, 2000); }

  (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
    .then(() => { btn.textContent = 'コピーしました！'; resetCopyBtn(); })
    .catch(() => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.top = '-9999px';
        document.body.appendChild(ta); ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        btn.textContent = ok ? 'コピーしました！' : 'コピーできませんでした';
      } catch {
        btn.textContent = 'コピーできませんでした';
      }
      resetCopyBtn();
    });
}

// ── HUD update ──
function updateHUD() {
  const g = state.gauges;
  setGauge('drunk', g.drunk);
  setGauge('sus',   g.sus);
  setGauge('tens',  g.tens);
  setGauge('mood',  g.mood);
  $('turn-display').textContent = `${state.turn} / ${MAX_TURNS}`;
}

function setGauge(key, val) {
  const fill = $(`${key}-fill`);
  const num  = $(`${key}-value`);
  if (fill) fill.style.width = `${val}%`;
  if (num)  num.textContent  = `${val}`;
}

function updateActBadge() {
  $('act-badge').textContent = actLabel(state.turn);
  const app = $('app');
  app.dataset.act   = String(actNumber(state.turn));
  app.dataset.final = state.turn === MAX_TURNS ? 'true' : '';
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

// ── Toast notification ──
let toastTimer = null;
function showToast(msg) {
  const el = $('toast-msg');
  el.textContent = msg;
  el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
}

// ── Init ──
function init() {
  // Mark all screens as hidden initially (intro is activated by setState('INTRO'))
  document.querySelectorAll('.screen').forEach(s => {
    s.setAttribute('aria-hidden', 'true');
    s.inert = true;
  });

  // Start button
  $('start-btn').addEventListener('click', () => setState('TURN_START'));

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
  $('retry-btn').addEventListener('click', () => {
    state = initialState();
    setState('INTRO');
  });

  // Copy
  $('copy-btn').addEventListener('click', copyResult);

  setState('INTRO');
}

document.addEventListener('DOMContentLoaded', init);
