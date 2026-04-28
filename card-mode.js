'use strict';

// ── Constants ──
const MAX_TURNS           = 10;
const FLIP_MS             = 580;
const REVEAL_HOLD_MS      = 1200;
const TELL_HOLD_MS        = 180;
const COMMIT_MS           = 400;
const REVEAL_PRE_FLIP_MS  = 600;
const ACT_BANNER_MS       = 640;
const ACHIEVEMENT_STORAGE_KEY = 'tequilaEscape.cardMode.achievements.v2';
const RULE_HELP_STORAGE_KEY   = 'tequilaEscape.cardMode.ruleHelp.v1';
const LIFE_MAX            = 5;
const POINT_MAX           = 8;
const CHASER_HEAL         = 2;
const CARD_COSTS          = { toast:0, fake:1, watch:2, chaser:2 };

// ── Card definitions ──
const CARDS = {
  toast:  { id:'toast',  icon:'🥂', label:'乾杯する',   hint:'HP-1 / P+1',       milkLabel:'乾杯する' },
  fake:   { id:'fake',   icon:'🎭', label:'飲んだフリ', hint:'1P / HP守る',      milkLabel:'飲んだフリ' },
  watch:  { id:'watch',  icon:'👁', label:'見張る',     hint:'2P / フェイク狩り',milkLabel:'見張る' },
  chaser: { id:'chaser', icon:'💧', label:'チェイサー', hint:'2P / HP+2',        milkLabel:'チェイサー' },
};
const CARD_IDS = ['toast', 'fake', 'watch', 'chaser'];

// ── Character expression images ──
const CHAR_IMAGES = {
  tuzyou:  'assets/optimized/tuzyou.webp',   // 通常
  utagai:  'assets/optimized/utagai.webp',   // 疑い
  bikkuri: 'assets/optimized/bikkuri.webp',  // びっくり
  horoyoi: 'assets/optimized/horoyoi.webp',  // ほろ酔い
  fuman:   'assets/optimized/fuman.webp',    // 不満
  deisui:  'assets/optimized/deisui.webp',   // 泥酔
  kibishi: 'assets/optimized/kibishi.webp',  // 厳しい
  haiboku: 'assets/optimized/haiboku.webp',  // 敗北
};

// ── Expression reaction bubble text ──
const EXPR_BUBBLE = {
  utagai:  '…？',
  bikkuri: '！',
  horoyoi: '♥',
  fuman:   '…',
  deisui:  'ふわ',
  kibishi: '！！',
};

// ── Card artwork map (ware_=player, aite_=milk) ──
const CARD_IMAGES = {
  player: {
    toast:  'assets/optimized/ware_nomu.webp',
    fake:   'assets/optimized/ware_fake.webp',
    watch:  'assets/optimized/ware_kanshi.webp',
    chaser: 'assets/optimized/ware_tyeisa-.webp',
    back:   'assets/optimized/ware_ura.webp',
  },
  milk: {
    toast:  'assets/optimized/aite_nomu.webp',
    fake:   'assets/optimized/aite_fake.webp',
    watch:  'assets/optimized/aite_kanshi.webp',
    chaser: 'assets/optimized/aite_tyeisa-.webp',
    back:   'assets/optimized/aite_ura.webp',
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
  'fake-chaser':   '軽く流れた',
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
  'toast-fake':    { tone:'toast',  kicker:'片側だけ本気', title:'飲み切った', copy:'HPを払って、次の一手のPを作る。' },
  'toast-watch':   { tone:'sus',    kicker:'視線の中で', title:'見られながら乾杯', copy:'正面突破にも圧がある。' },
  'toast-chaser':  { tone:'cold',   kicker:'テンポ差', title:'空気が少し止まる', copy:'あなたのグラスだけが進んだ。' },
  'fake-toast':    { tone:'fake',   kicker:'潜伏成功', title:'フェイク成功', copy:'場の隙を突いてP+1。相手の視線は読めているか？' },
  'fake-fake':     { tone:'fake',   kicker:'同時に煙幕', title:'二人ともごまかした', copy:'笑顔の裏で読み合いが濃くなる。' },
  'fake-watch':    { tone:'bust',   kicker:'カウンター被弾', title:'大バレ！', copy:'フェイクを読まれてHPが削れる。' },
  'fake-chaser':   { tone:'sus',    kicker:'すれ違い', title:'軽く流れた', copy:'守ったが、相手は回復を選んでいた。' },
  'watch-toast':   { tone:'watch',  kicker:'空振り', title:'相手は飲んだ', copy:'フェイクではない。見張りは何も起こさない。' },
  'watch-fake':    { tone:'counter',kicker:'読み勝ち', title:'カウンター！', copy:'フリの瞬間を捕まえた。' },
  'watch-watch':   { tone:'cold',   kicker:'膠着', title:'お互い無言', copy:'視線だけが卓上でぶつかる。' },
  'watch-chaser':  { tone:'cold',   kicker:'空振り', title:'チェイサーを見届けた', copy:'読みに行ったが、相手は回復を選んだ。' },
  'chaser-toast':  { tone:'chaser', kicker:'回復優先', title:'水でかわす', copy:'HPを戻して、次の読み合いへ残る。' },
  'chaser-fake':   { tone:'chaser', kicker:'水面下', title:'お互い水分補給', copy:'勝負は静かに次へ流れる。' },
  'chaser-watch':  { tone:'sus',    kicker:'目撃', title:'水を見られた', copy:'相手の見張りは空振り。HPだけ戻る。' },
  'chaser-chaser': { tone:'freeze', kicker:'場冷え', title:'場が冷えた', copy:'グラスより先に会話が止まる。' },
};

// ── Tell system ──
// TELL_OF maps milkCard → tell type ID
const TELL_OF = { watch:'glass', toast:'excite', chaser:'bored', fake:'playful' };
const TELLS = {
  glass:   { text:'「グラス、減ってないなぁ……」', icon:'視', observation:'みるくがグラスを見ている', prediction:'見張るかも' },
  excite:  { text:'「ねぇ、もっといこ？！」',       icon:'乾', observation:'笑顔が深まった',            prediction:'乾杯かも' },
  bored:   { text:'「ふぅ……」',                     icon:'水', observation:'息をついた',                prediction:'チェイサーかも' },
  playful: { text:'「次は……どうしよっかな？」',     icon:'偽', observation:'髪を触った',                prediction:'飲んだフリかも' },
};
const TELL_IDS = ['glass', 'excite', 'bored', 'playful'];

// ── Act structure ──
function actNumber(turn) {
  if (turn <= 3) return 1;
  if (turn <= 7) return 2;
  return 3;
}
function actLabel(turn) {
  if (turn <= 3) return '探り合い';
  if (turn <= 7) return '本番';
  if (turn <= 9) return 'ラスト';
  return 'FINAL';
}
function actBannerText(turn) {
  if (turn === 4) {
    return {
      phase: 'mid',
      kicker: 'PHASE',
      title: '本番開始',
      copy: '読み合いが濃くなる',
    };
  }
  if (turn === 8) {
    return {
      phase: 'last',
      kicker: 'PHASE',
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
function tellTrustLabel(rate) {
  if (rate >= 0.75) return '信頼度 高';
  if (rate >= 0.65) return '信頼度 中';
  if (rate >= 0.55) return '信頼度 低';
  return '信頼度 博打';
}

// ── Character face ──
function setCharFace(exprKey) {
  const charEl = $('character');
  const imgEl  = $('char-art');
  // data-face drives CSS aura; exprKey is now the direct image key
  const faceMap = {
    tuzyou:'normal',
    utagai:'doubt',
    bikkuri:'smile',
    horoyoi:'mood',
    fuman:'cold',
    deisui:'mood',
    kibishi:'doubt',
    haiboku:'mood',
  };
  if (charEl) charEl.dataset.face = faceMap[exprKey] || 'normal';
  const src = CHAR_IMAGES[exprKey];
  if (imgEl && src && imgEl.src !== new URL(src, document.baseURI).href) {
    imgEl.src = src;
    imgEl.classList.remove('face-swap');
    void imgEl.offsetWidth;
    imgEl.classList.add('face-swap');

    const bubble = $('expr-bubble');
    const bubbleText = EXPR_BUBBLE[exprKey];
    if (bubble && bubbleText) {
      bubble.textContent = bubbleText;
      bubble.classList.remove('expr-show');
      void bubble.offsetWidth;
      bubble.classList.add('expr-show');
    }
  }
}

// Pick expression from current gauge values (called at TURN_START)
function faceFromGauges() {
  const p = state.player;
  const m = state.milk;
  if (m.life <= 1)       return 'deisui';
  if (m.life <= 2)       return 'bikkuri';
  if (p.life <= 2)       return 'utagai';
  if (m.point >= 4)      return 'kibishi';
  if (m.point >= 3)      return 'fuman';
  if (p.point >= 3)      return 'horoyoi';
  return 'tuzyou';
}

// Pick reaction expression from this turn's deltas (called in RESOLVE)
function faceFromDeltas(deltas, playerCard, milkCard, outcome = {}) {
  if (playerCard === 'watch' && milkCard === 'fake') return 'bikkuri'; // player caught milk's fake
  if (playerCard === 'fake'  && milkCard === 'watch') return 'kibishi'; // milk caught player's fake
  if (outcome.milkLifeDelta <= -2) return 'bikkuri';
  if (outcome.playerLifeDelta <= -2) return 'utagai';
  if (outcome.milkPointDelta > 0) return 'horoyoi';
  if (outcome.playerPointDelta < -1) return 'kibishi';
  return 'tuzyou';
}

// ── Utility ──
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function $(id) { return document.getElementById(id); }

// ── CPU AI ──
function actorCanPlay(actor, cardId) {
  if (actor.point < CARD_COSTS[cardId]) return false;
  if (cardId === 'chaser' && actor.life >= LIFE_MAX) return false;
  return true;
}

function legalCardsFor(actor) {
  const legal = CARD_IDS.filter(id => actorCanPlay(actor, id));
  return legal.length ? legal : ['toast'];
}

function pickMilkCard() {
  const legal = legalCardsFor(state.milk);
  const weights = { toast:0, fake:0, watch:0, chaser:0 };
  legal.forEach(id => { weights[id] = 1; });

  // みるくもポイントを読んで動く。序盤は飲んで資源を作り、中盤以降は読み合いに寄る。
  weights.toast += state.milk.point <= 1 ? 1.4 : 0.35;
  if (actorCanPlay(state.milk, 'fake')) {
    weights.fake += state.milk.life <= 3 ? 1.1 : 0.45;
  }
  if (actorCanPlay(state.milk, 'watch')) {
    const pointPressure =
      state.player.point >= 4 ? 1.8 :
      state.player.point >= 2 ? 1.1 :
      state.player.point >= 1 ? 0.55 : 0.2;
    weights.watch += pointPressure;
  }
  if (actorCanPlay(state.milk, 'chaser')) {
    weights.chaser += state.milk.life <= 2 ? 2.2 : 0.25;
  }

  // If player used same card 2+ turns in a row, heavily boost watch (pattern reading)
  if (state.cpuPattern.sameStreak >= 2 && actorCanPlay(state.milk, 'watch')) {
    weights.watch = Math.min(weights.watch + 0.5, 2.0);
  }
  // Late game: if player has enough points to fake, boost watch to catch it
  if (state.turn >= 8 && state.player.point >= CARD_COSTS.fake && actorCanPlay(state.milk, 'watch')) {
    weights.watch = Math.min(weights.watch + 0.4, 2.0);
  }
  // Memory: if player faked in last 2 turns without getting caught, milk gets suspicious
  const recentTwo = state.history.slice(-2);
  const playerFakedFree = recentTwo.some(h => h.p === 'fake' && h.m !== 'watch');
  if (playerFakedFree && actorCanPlay(state.milk, 'watch')) {
    weights.watch = Math.min(weights.watch + 0.9, 2.8);
  }

  // Final turn: milk goes mostly gut-instinct (harder to counter-read)
  if (state.turn >= MAX_TURNS && Math.random() < 0.6) {
    return legal[Math.floor(Math.random() * legal.length)];
  }

  // Wildcard: 10% chance to pick unpredictably so player can't pattern-exploit
  if (Math.random() < 0.1) {
    return legal[Math.floor(Math.random() * legal.length)];
  }

  const total = legal.reduce((s, id) => s + weights[id], 0);
  let r = Math.random() * total;
  for (const id of legal) {
    r -= weights[id];
    if (r <= 0) return id;
  }
  return legal[0] || 'toast';
}

function pickAnyOther(except) {
  const others = legalCardsFor(state.milk).filter(id => id !== except);
  if (!others.length) return except;
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
  player: { life:LIFE_MAX, point:1 },
  milk:   { life:LIFE_MAX, point:1 },
  gauges: { drunk:LIFE_MAX, sus:0, tens:LIFE_MAX, mood:0 },
  playerCard: null,
  milkCard:   null,
  tell:       null,
  history:    [],
  cpuPattern: { lastCard: null, sameStreak: 0 },
  peak:       { playerLowLife:LIFE_MAX, milkLowLife:LIFE_MAX, playerHighPoint:0, milkHighPoint:0 },
  counts:     { toast:0, fake:0, watch:0, chaser:0 },
  endReason:  null,
  winner:     null,
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
  const bannerDelay = 0;
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
    hint.querySelector('.hint-trust').textContent       = tellTrustLabel(state.tell.honestRate);
    hint.title = `${tellData.observation} / ${tellTrustLabel(state.tell.honestRate)}`;
    hint.hidden = false;
  }

  // みるく表情をテルに連動（実画像ファイルで切替）
  const EXPR_OF = {
    glass: state.milk.point >= 3 ? 'kibishi' : 'utagai',
    excite: 'bikkuri',
    bored: 'tuzyou',
    playful: 'horoyoi',
  };
  preloadImage(CARD_IMAGES.milk[state.tell.willPlay]);
  preloadImage(CHAR_IMAGES[EXPR_OF[state.tell.type] || 'tuzyou']);
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
  const hand = $('hand');
  hand.classList.remove('blocked');
  refreshHandSlots();
  updateHandSubtitle();
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
    const cost = CARD_COSTS[id];
    const canPlay = actorCanPlay(state.player, id);
    const count = slot.querySelector('.card-count');
    const hint = slot.querySelector('.card-hint');
    const reason = slot.querySelector('.card-blocked-reason');
    const isToastCapped = id === 'toast' && state.player.point >= POINT_MAX;
    const isFullBlocked = id === 'chaser' && state.player.life >= LIFE_MAX;
    const blockedReason = isFullBlocked ? '満タン' : (state.player.point < cost ? 'P不足' : '不可');
    if (count) count.textContent = id === 'toast' ? (isToastCapped ? 'MAX' : 'FREE') : `${cost}P`;
    if (hint) hint.textContent = isToastCapped ? 'HP-1のみ' : (isFullBlocked ? 'HP満タン' : CARDS[id].hint);
    if (reason) reason.textContent = canPlay ? '' : blockedReason;
    slot.dataset.reason = canPlay ? '' : blockedReason;
    slot.setAttribute('aria-label',
      isToastCapped ? `${CARDS[id].label} ポイント満タン。使うとHPが1減るだけ` :
        isFullBlocked ? `${CARDS[id].label} HP満タン` :
        `${CARDS[id].label} コスト${cost}ポイント`
    );
    slot.classList.toggle('blocked-full', isFullBlocked);

    if (!canPlay) {
      slot.disabled = true;
      slot.setAttribute('aria-disabled', 'true');
      slot.classList.add('empty');
      slot.classList.remove('last-one');
    } else {
      slot.disabled = false;
      slot.removeAttribute('aria-disabled');
      slot.classList.remove('empty');
      slot.classList.toggle('last-one', cost > 0 && state.player.point === cost);
    }
  });
}

function updateHandSubtitle() {
  const el = $('hand-subtitle');
  if (!el) return;
  const playable = CARD_IDS.filter(id => actorCanPlay(state.player, id));
  if (state.player.point <= 0 && playable.length === 1) {
    el.textContent = 'まず乾杯でPを作る';
  } else if (state.player.point === 1 && actorCanPlay(state.player, 'fake')) {
    el.textContent = 'フェイク可 / 見張りに注意';
  } else if (state.player.life <= 2 && actorCanPlay(state.player, 'chaser')) {
    el.textContent = '回復するか、読み切るか';
  } else if (state.player.point >= CARD_COSTS.watch) {
    el.textContent = '見張りも選べる / 読み勝負';
  } else if (actorCanPlay(state.player, 'chaser') && state.player.life < LIFE_MAX) {
    el.textContent = '守るか、Pを貯めるか';
  } else {
    el.textContent = '1枚えらんで同時に出す';
  }
}

function onCardTap(cardId) {
  if (state.fsm !== 'CARD_SELECT') return;
  if (!actorCanPlay(state.player, cardId)) {
    const cost = CARD_COSTS[cardId];
    showToast(cardId === 'chaser' && state.player.life >= LIFE_MAX ? 'HP満タン！' : `${cost}P必要`);
    refreshHandSlots();
    return;
  }

  if (navigator.vibrate) {
    navigator.vibrate(cardId === 'watch' ? [25, 10, 40] : [18]);
  }

  state.playerCard = cardId;
  state.counts[cardId]++;
  refreshHandSlots(); // Immediately update count display and disabled state
  preloadImage(CARD_IMAGES.player[cardId]);
  preloadImage(CARD_IMAGES.milk[state.tell?.willPlay]);

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

  const matchKey = `${state.playerCard}-${state.milkCard}`;
  const app = $('app');
  app.dataset.match = matchKey;

  // Dynamic reveal delay: longer when gauges are at dangerous levels
  const dangerDelay = (() => {
    if (state.player.life <= 1 || state.milk.life <= 1) return 1100;
    if (state.player.life <= 2 || state.milk.life <= 2) return 850;
    if (state.turn >= 8) return 750;
    return REVEAL_PRE_FLIP_MS;
  })();

  // Flip, then chain to RESOLVE — keep each beat readable before numbers move.
  setTimeout(() => {
    if (state.fsm !== 'REVEAL') return;
    playerEl.classList.add('flipped');
    milkEl.classList.add('flipped');
    setTimeout(() => {
      if (state.fsm === 'REVEAL') setState('RESOLVE');
    }, FLIP_MS);
  }, dangerDelay);
}

function clearReveal() {
  $('card-player').classList.remove('flipped');
  $('card-milk').classList.remove('flipped');
  // Restore vs-label.
  const vsEl = $('vs-label');
  if (vsEl) vsEl.classList.remove('reveal-hide');
  const app = $('app');
  delete app.dataset.match;
  delete app.dataset.tone;
}

function spendPoint(actor, amount) {
  actor.point = clamp(actor.point - amount, 0, POINT_MAX);
}

function addPoint(actor, amount) {
  actor.point = clamp(actor.point + amount, 0, POINT_MAX);
}

function addLife(actor, amount) {
  actor.life = clamp(actor.life + amount, 0, LIFE_MAX);
}

function syncGaugeMetrics() {
  state.gauges.drunk = state.player.life;
  state.gauges.sus   = state.player.point;
  state.gauges.tens  = state.milk.life;
  state.gauges.mood  = state.milk.point;
}

function resolveBattleTurn(playerCard, milkCard) {
  const before = {
    player: { ...state.player },
    milk:   { ...state.milk },
  };

  spendPoint(state.player, CARD_COSTS[playerCard]);
  spendPoint(state.milk, CARD_COSTS[milkCard]);

  const notes = [];

  if (playerCard === 'toast') {
    const wasPointMax = before.player.point >= POINT_MAX;
    addLife(state.player, -1);
    addPoint(state.player, 1);
    notes.push(wasPointMax ? 'あなたは飲んだがP満タン' : 'あなたは飲んで1P獲得');
  }
  if (milkCard === 'toast') {
    const wasPointMax = before.milk.point >= POINT_MAX;
    addLife(state.milk, -1);
    addPoint(state.milk, 1);
    notes.push(wasPointMax ? 'みるくは飲んだがP満タン' : 'みるくは飲んで1P獲得');
  }

  if (playerCard === 'chaser') {
    addLife(state.player, CHASER_HEAL);
    notes.push(`あなたはチェイサーでHP+${CHASER_HEAL}`);
  }
  if (milkCard === 'chaser') {
    addLife(state.milk, CHASER_HEAL);
    notes.push(`みるくはチェイサーでHP+${CHASER_HEAL}`);
  }

  const playerCounter = playerCard === 'watch' && milkCard === 'fake';
  const milkCounter = milkCard === 'watch' && playerCard === 'fake';

  if (playerCounter) {
    addLife(state.milk, -2);
    addPoint(state.player, 1);
    notes.push('見張り成功！みるくHP-2 / あなたP+1');
  }
  if (milkCounter) {
    addLife(state.player, -2);
    addPoint(state.milk, 1);
    notes.push('みるくの見張り成功！あなたHP-2 / みるくP+1');
  }

  // Fake vs toast: stayed sober while milk drank → P+1 (offset cost, reward for correct read)
  if (playerCard === 'fake' && milkCard === 'toast') {
    addPoint(state.player, 1);
    notes.push('場の隙を突いた！P+1');
  }

  syncGaugeMetrics();

  const outcome = {
    playerLifeDelta: state.player.life - before.player.life,
    playerPointDelta: state.player.point - before.player.point,
    milkLifeDelta: state.milk.life - before.milk.life,
    milkPointDelta: state.milk.point - before.milk.point,
    playerCounter,
    milkCounter,
    notes,
    before,
    after: {
      player: { ...state.player },
      milk:   { ...state.milk },
    },
  };

  outcome.deltas = {
    D: outcome.playerLifeDelta,
    S: outcome.playerPointDelta,
    T: outcome.milkLifeDelta,
    M: outcome.milkPointDelta,
  };

  return outcome;
}

function enterResolve() {
  const outcome = resolveBattleTurn(state.playerCard, state.milkCard);

  // Track peaks
  state.peak.playerLowLife = Math.min(state.peak.playerLowLife, state.player.life);
  state.peak.milkLowLife = Math.min(state.peak.milkLowLife, state.milk.life);
  state.peak.playerHighPoint = Math.max(state.peak.playerHighPoint, state.player.point);
  state.peak.milkHighPoint = Math.max(state.peak.milkHighPoint, state.milk.point);

  // Record history
  state.history.push({
    turn: state.turn,
    p: state.playerCard,
    m: state.milkCard,
    deltas: outcome.deltas,
    outcome,
  });
  updateTurnHistory();

  // Show SFX label
  const sfxKey = `${state.playerCard}-${state.milkCard}`;
  showSfx(outcome.notes[0] || SFX_LABELS[sfxKey] || '');

  updateHUD();

  // みるくの表情をターン結果に反応させる
  const reactionFace = faceFromDeltas(outcome.deltas, state.playerCard, state.milkCard, outcome);
  setCharFace(reactionFace);
  playMatchImpact(sfxKey, reactionFace);

  // Hide reveal cards halfway through (guard: don't touch DOM if FSM moved on)
  const resolveTurn = state.turn;
  setTimeout(() => { if (state.turn === resolveTurn) clearReveal(); }, REVEAL_HOLD_MS * 0.72);

  setTimeout(() => {
    if (state.fsm === 'RESOLVE') setState('TURN_END');
  }, REVEAL_HOLD_MS);
}

function fadeToResult() {
  const curtain = document.createElement('div');
  curtain.style.cssText = 'position:absolute;inset:0;background:#0A0006;opacity:0;z-index:200;pointer-events:none;transition:opacity 0.45s ease';
  $('app').appendChild(curtain);
  requestAnimationFrame(() => requestAnimationFrame(() => { curtain.style.opacity = '1'; }));
  setTimeout(() => {
    setState('RESULT');
    setTimeout(() => curtain.remove(), 320);
  }, 470);
}

function enterTurnEnd() {
  clearSfx();

  // Check life conditions
  if (state.player.life <= 0 && state.milk.life <= 0) {
    state.endReason = 'double_life0';
    state.winner = 'draw';
    return fadeToResult();
  }
  if (state.player.life <= 0) {
    state.endReason = 'player_life0';
    state.winner = 'milk';
    return fadeToResult();
  }
  if (state.milk.life <= 0) {
    state.endReason = 'milk_life0';
    state.winner = 'player';
    return fadeToResult();
  }

  // 10 turns survived
  if (state.turn >= MAX_TURNS) {
    state.endReason = 'turn_limit';
    if (state.player.life > state.milk.life) state.winner = 'player';
    else if (state.player.life < state.milk.life) state.winner = 'milk';
    else if (state.player.point > state.milk.point) state.winner = 'player';
    else if (state.player.point < state.milk.point) state.winner = 'milk';
    else state.winner = 'draw';
    return fadeToResult();
  }

  // Continue — update face to reflect current gauge state before next tell
  setCharFace(faceFromGauges());
  state.turn++;
  setState('TURN_START');
}

// ── Ending logic ──
function resolveEnding() {
  const r  = state.endReason;
  const isWin = state.winner === 'player';

  let ending = 'bad';
  let title  = '';

  if (state.winner === 'draw') {
    ending = 'normal';
    title = r === 'double_life0' ? '相打ちテキーラ' : '読み合いドロー';
  } else if (!isWin) {
    ending = 'bad';
    title = r === 'player_life0' ? 'ライフ尽きた' : '判定負け';
  } else if (r === 'milk_life0') {
    ending = 'true';
    title  = '飲ませ切り勝利';
  } else if (r === 'turn_limit' && state.player.life > state.milk.life) {
    ending = 'true';
    title  = 'ライフ差逃げ切り';
  } else if (r === 'turn_limit' && state.player.point > state.milk.point) {
    ending = 'special';
    title  = 'ポイント判定勝ち';
  } else {
    ending = 'normal';
    title  = '判定勝ち';
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
    peak: state.peak,
    player: state.player,
    milk: state.milk,
    winner: state.winner,
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
    id: 'perfect_life_win',
    name: '無傷の読み勝ち',
    description: 'HPを満タンで残して勝った',
    test: c => c.isWin && c.player.life === LIFE_MAX,
  },
  {
    id: 'milk_knockout',
    name: '飲ませ切り勝者',
    description: 'みるくのライフを0にした',
    test: c => c.endReason === 'milk_life0',
  },
  {
    id: 'life_judge_win',
    name: 'ライフ差の逃亡者',
    description: '最後に残ったHP差で勝ち切った',
    test: c => c.endReason === 'turn_limit' && c.winner === 'player' && c.player.life > c.milk.life,
  },
  {
    id: 'point_judge_win',
    name: 'ショット銀行',
    description: 'ポイント差で判定勝ちした',
    test: c => c.endReason === 'turn_limit' && c.winner === 'player' && c.player.life === c.milk.life,
  },
  {
    id: 'draw_title',
    name: '同卓ドロー',
    description: '最後まで決着がつかなかった',
    test: c => c.winner === 'draw',
  },
  {
    id: 'life_zero_loss',
    name: '飲み切らされた人',
    description: 'ライフを失って敗北した',
    test: c => c.endReason === 'player_life0',
  },
  {
    id: 'triple_fake_win',
    name: '完璧なる嘘つき',
    description: '3回全てごまかして勝利した',
    test: c => c.counts.fake >= 3 && c.isWin,
  },
  {
    id: 'late_counter',
    name: 'ラストの読み',
    description: 'ACT3で見張るカウンターを決めた',
    test: c => c.history.some(h => h.turn >= 8 && h.p === 'watch' && h.m === 'fake'),
  },
  {
    id: 'speed_loss',
    name: '電光石火の散り様',
    description: '4ターン以内に夜が終わった',
    test: c => c.turn <= 4 && c.ending === 'bad',
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
    test: c => c.turn === MAX_TURNS && c.endReason === 'turn_limit',
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
  { id:'ACH_LIFE_RULE_WIN', name:'初勝利', description:'ライフとポイントを管理して勝った。', test:c=>c.isWin },
  { id:'ACH_MILK_KO', name:'飲ませ切り', description:'みるくのライフを0にした。', test:c=>c.endReason==='milk_life0' },
  { id:'ACH_POINT_WIN', name:'判定の支配者', description:'ポイント差で勝負を持っていった。', test:c=>c.endReason==='turn_limit'&&c.winner==='player'&&c.player.life===c.milk.life },
  { id:'ACH_PERFECT_HP', name:'無傷生還', description:'ライフ満タンで勝った。', test:c=>c.isWin&&c.player.life===LIFE_MAX },
  { id:'ACH_COUNTER_HIT', name:'見張り成功', description:'みるくのフェイクを見張りで刺した。', test:()=>countMatch('watch','fake')>=1 },
  { id:'ACH_GOT_COUNTERED', name:'見張られた夜', description:'フェイクを見張りで刺された。', test:()=>countMatch('fake','watch')>=1 },
  { id:'ACH_FIRST_TRUE', name:'みるくの夜', description:'飲む・かわす・読む。全部が噛み合った夜だった。', test:c=>c.ending==='true' },
  { id:'ACH_NO_FAKE_WIN', name:'正面突破', description:'ごまかしゼロで勝ち切った。これは純粋に強い。', test:c=>c.counts.fake===0&&c.isWin },
  { id:'ACH_ALL_FAKE', name:'嘘の全張り', description:'ごまかせるだけごまかした夜。バレなかった？', test:c=>c.counts.fake>=3 },
  { id:'ACH_FAST_LOSS', name:'電光石火', description:'早い。夜が始まる前に終わった。', test:c=>c.turn<=4&&c.ending==='bad' },
  { id:'ACH_FULL_COURSE', name:'生存証明', description:'最後まで席を守り切った。それだけで十分すごい。', test:c=>c.turn===MAX_TURNS&&c.endReason==='turn_limit' },
  { id:'ACH_NO_CHASER_WIN', name:'水なし完走', description:'逃げ道を封印して勝ち切った。', test:c=>c.counts.chaser===0&&c.isWin },
  { id:'ACH_ALL_CARDS', name:'全カード採用', description:'4枚全部使った柔軟なプレイ。', test:c=>c.counts.toast>=1&&c.counts.fake>=1&&c.counts.watch>=1&&c.counts.chaser>=1 },
  { id:'ACH_TOAST_HEAVY', name:'乾杯の求道者', description:'乾杯という選択を信じ続けた夜。', test:c=>c.counts.toast>=7 },
  { id:'ACH_DOUBLE_COUNTER', name:'完璧読み', description:'2回以上フリを見抜いた。みるくは今日は読まれすぎ。', test:()=>countMatch('watch','fake')>=2 },
  { id:'ACH_CHASER_NEVER', name:'逃げ道封印', description:'一度も水に逃げず、判定までもつれ込んだ。', test:c=>c.counts.chaser===0&&c.turn===MAX_TURNS&&!c.isWin },
  { id:'ACH_LATE_WATCH', name:'最終盤の読み', description:'最後まで読む力が残っていた。', test:c=>c.history.some(h=>h.turn>=8&&h.p==='watch'&&h.m==='fake') },
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
    `最終スコア: あなた HP${state.player.life} / P${state.player.point}　みるく HP${state.milk.life} / P${state.milk.point}`,
    `総ターン: ${state.turn} / ${MAX_TURNS}`,
    `最多カード: ${CARDS[topCard.id].icon} ${CARDS[topCard.id].label} ×${topCard.count}`,
    `リソース推移: あなた最低HP ${state.peak.playerLowLife} / 最高P ${state.peak.playerHighPoint}　みるく最低HP ${state.peak.milkLowLife} / 最高P ${state.peak.milkHighPoint}`,
    decisive
      ? `決定打: T${decisive.turn} ${CARDS[decisive.p].icon}×${CARDS[decisive.m].icon}`
      : '—',
  ];

  const monologue = buildPlayerMonologue({ ending, topCard });
  const cast = buildMilkLine({ ending, topCard, decisive });

  return { objective, monologue, cast, topCard };
}

function resultSeed(salt = 0) {
  const counts = CARD_IDS.reduce((sum, id, idx) => sum + state.counts[id] * (idx + 3), 0);
  const history = state.history.reduce((sum, h) => {
    const outcome = h.outcome || {};
    return sum +
      h.turn * 13 +
      CARD_IDS.indexOf(h.p) * 17 +
      CARD_IDS.indexOf(h.m) * 19 +
      (outcome.playerLifeDelta || 0) * 23 +
      (outcome.playerPointDelta || 0) * 29 +
      (outcome.milkLifeDelta || 0) * 31 +
      (outcome.milkPointDelta || 0) * 37;
  }, 0);
  return Math.abs(
    state.turn * 23 +
    state.player.life * 3 +
    state.player.point * 5 +
    state.milk.life * 7 +
    state.milk.point * 11 +
    state.peak.playerLowLife * 41 +
    state.peak.playerHighPoint * 43 +
    state.peak.milkLowLife * 47 +
    state.peak.milkHighPoint * 53 +
    counts +
    history +
    salt
  );
}

function pickVariant(list, salt = 0) {
  return list[resultSeed(salt) % list.length];
}

function buildResultReview({ ending, isWin, topCard, decisive }) {
  const r = state.endReason;
  if (state.winner === 'player') {
    if (r === 'milk_life0') {
      return 'テキーラを飲むリスクをポイントに変えて、最後はみるくのライフを削り切った。新ルールの勝ち筋がかなり綺麗に出ている。';
    }
    if (r === 'turn_limit' && state.player.life > state.milk.life) {
      return '最後までHPを残して逃げ切った。飲むタイミングと守るタイミングの切り替えが勝因。';
    }
    return 'ライフは並んだが、ポイント管理で上回った。飲んで得た資源を最後まで腐らせなかった勝ち方。';
  }
  if (state.winner === 'draw') {
    return '読み合いは完全に拮抗。ライフもポイントも決め手にならず、次の一戦に持ち越し。';
  }
  if (r === 'player_life0') {
    return 'ライフが先に尽きた。ポイントを貯めるために飲む判断は大事だが、回復かフェイクへ切り替える一手が遅れた。';
  }
  if (state.winner === 'milk') {
    if (r === 'turn_limit' && state.player.life < state.milk.life) {
      return '10ターン走り切ったが、最後のHP差で届かなかった。飲む一手をどこかでフェイクかチェイサーに変えたい。';
    }
    return 'ライフは並んだが、ポイント管理でみるくに上回られた。乾杯で稼いだPを、最後の読み合いに変換しきれなかった。';
  }

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

  if (topCard.id === 'toast' && decisive?.p === 'toast') {
    return pickVariant(common[ending].concat([
      '最後まで正面突破。分かりやすいぶん強いが、HPの残り方だけは常に見たい。',
    ]), 108);
  }

  return pickVariant(common[ending] || common.normal, 109);
}

function buildPlayStyleLine({ topCard }) {
  const styleMap = {
    toast: [
      '正面突破型。HPを払ってポイントを作る判断が勝負。',
      '乾杯で資源を作るタイプ。攻めの説得力はある。',
      '迷ったら前に出るプレイ。Pは貯まるが、HP管理が課題。',
    ],
    fake: [
      '煙幕型。HPを守れるが、見張られた瞬間に一気に崩れる。',
      '飲まずにターンを受け流すタイプ。読み負けだけは絶対に避けたい。',
      'ごまかしで勝負を伸ばすプレイ。P1の使いどころが大事。',
    ],
    watch: [
      '読みに寄せた防御型。相手のフリには強いが、3Pの投資は重い。',
      '視線で勝つタイプ。決まると気持ちいいが、空振り時の損失が重い。',
      '一撃狙いのカウンター型。Pを貯めてからが本番。',
    ],
    chaser: [
      '生存重視型。HP回復は強いが、2Pを吐く判断が重い。',
      '引き際を作るタイプ。使いすぎると攻めるPが足りなくなる。',
      '守りの判断は良い。あとはどこで乾杯に戻すか。',
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
    player_life0: [
      'ライフ、先になくなっちゃったね。ポイントを貯めるのは大事だけど、飲みすぎ注意だよ。',
      '攻め方は分かりやすかったけど、守るタイミングが少し遅かったかも。',
      'はい、ここまで。次はチェイサーもちゃんと考えてね。',
      'フリか水に逃げる一手、どこかで欲しかったね。',
      'みるくの勝ち。けど、もう一回やったら全然変わりそう。',
    ],
    double_life0: [
      '同時に倒れるの、そんなことある？ 今日は引き分けにしよ。',
      '最後、二人とも無茶しすぎ。これはこれで面白かったけど。',
      '勝ち負けより、最後の一手が強すぎたね。',
    ],
    turn_limit_loss: [
      '最後まで座ってたのはえらい。でも、HPかポイントのどっちかで少し届かなかったね。',
      '10ターン目まで行ったのに、最後の差でみるくの勝ち。惜しかったよ。',
      '負けたけど、崩れたわけじゃない。次はポイントの使いどころで変わると思う。',
      'みるくの判定勝ち。途中のチェイサーか見張り、ひとつ違えば逆だったかも。',
    ],
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
  };

  if (r === 'double_life0') return pickVariant(pools.double_life0, 401);
  if (ending === 'bad' && r === 'turn_limit') return pickVariant(pools.turn_limit_loss, 401);
  if (ending === 'bad') return pickVariant(pools[r] || pools.player_life0, 401);

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
    player: { ...state.player },
    milk: { ...state.milk },
    winner: state.winner,
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
    line: 'HPを残して、Pも読み切った。',
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

  // Show milk's defeat portrait on player win; otherwise representative card image.
  const preview = $('result-card-img');
  if (preview) {
    preview.innerHTML = '';
    const cardId = s.decisive ? s.decisive.p : s.topCard.id;
    const imgSrc = s.isWin ? CHAR_IMAGES.haiboku : CARD_IMAGES.player[cardId];
    if (imgSrc) {
      const img = document.createElement('img');
      img.src = imgSrc;
      img.alt = s.isWin ? '敗北したみるく' : CARDS[cardId].label;
      img.className = s.isWin ? 'result-card-art result-milk-art' : 'result-card-art';
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
  } else if (tab === 'history') {
    pov.innerHTML = buildResultHistoryHtml();
  } else if (tab === 'monologue') {
    pov.innerHTML = `<div class="pov-monologue">${escHtml(s.texts.monologue)}</div>`;
  } else {
    pov.innerHTML = `<div class="pov-cast">${escHtml(s.texts.cast)}</div>`;
  }
}

function buildResultHistoryHtml() {
  if (!state.history.length) return '<div class="pov-line">履歴なし</div>';
  return state.history.map(h => {
    const p = CARDS[h.p];
    const m = CARDS[h.m];
    const note = h.outcome?.notes?.[0] || SFX_LABELS[`${h.p}-${h.m}`] || '';
    const pDelta = formatDelta(h.outcome?.playerLifeDelta, 'HP') + formatDelta(h.outcome?.playerPointDelta, 'P');
    const mDelta = formatDelta(h.outcome?.milkLifeDelta, 'HP') + formatDelta(h.outcome?.milkPointDelta, 'P');
    return [
      '<div class="history-line">',
      `<strong>T${h.turn}</strong>`,
      `<span>あなた: ${escHtml(p.label)} <small>${escHtml(pDelta || '変化なし')}</small></span>`,
      `<span>みるく: ${escHtml(m.milkLabel)} <small>${escHtml(mDelta || '変化なし')}</small></span>`,
      note ? `<em>${escHtml(note)}</em>` : '',
      '</div>',
    ].join('');
  }).join('');
}

function formatDelta(value, label) {
  if (!value) return '';
  const sign = value > 0 ? '+' : '';
  return `${label}${sign}${value} `;
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
  const d = s.decisive;
  const top = CARDS[s.topCard.id];
  const candidates = X_POST_TEMPLATES.filter(t => t.test(s));
  const template = candidates[resultSeed(501) % candidates.length] || X_POST_TEMPLATES[0];
  const resultLine = typeof template.line === 'function' ? template.line(s) : template.line;
  const lines = [
    `テキーラから逃げろ！CARD MODE`,
    `「${s.resultTitle.name}」/ ${VERDICT_LABELS[s.ending]}`,
    `${s.turn}ターン耐え抜いた！`,
    resultLine,
    `あなた HP${s.player.life} / P${s.player.point}　みるく HP${s.milk.life} / P${s.milk.point}`,
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
  syncGaugeMetrics();
  setGauge('drunk', state.player.life, LIFE_MAX);
  setGauge('sus',   state.player.point, POINT_MAX);
  setGauge('tens',  state.milk.life, LIFE_MAX);
  setGauge('mood',  state.milk.point, POINT_MAX);
  $('turn-display').textContent = `${state.turn} / ${MAX_TURNS}`;
  updateDangerState();
}

function historyTone(entry) {
  const key = `${entry.p}-${entry.m}`;
  if (key === 'fake-watch') return 'bust';
  if (key === 'watch-fake') return 'counter';
  if (key === 'toast-toast') return 'toast';
  if (entry.outcome?.milkLifeDelta <= -2) return 'counter';
  if (entry.outcome?.playerLifeDelta <= -2) return 'bust';
  if (entry.outcome?.playerLifeDelta < 0 || entry.outcome?.milkLifeDelta < 0) return 'drink';
  if (entry.outcome?.playerLifeDelta > 0 || entry.outcome?.milkLifeDelta > 0) return 'mood';
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
  updateRecentHistory();
}

function updateRecentHistory() {
  const el = $('recent-history');
  if (!el) return;
  const last3 = state.history.slice(-3).reverse();
  if (!last3.length) { el.hidden = true; return; }
  el.hidden = false;
  el.replaceChildren();
  last3.forEach(h => {
    const row = document.createElement('div');
    row.className = 'rh-row';
    const pDelta = h.outcome?.playerLifeDelta ?? 0;
    const cls = pDelta <= -2 ? 'rh-bust' : pDelta < 0 ? 'rh-bad' : pDelta > 0 ? 'rh-good' : 'rh-neutral';
    const delta = pDelta !== 0 ? `HP${pDelta > 0 ? '+' : ''}${pDelta}` : '—';
    row.innerHTML =
      `<span class="rh-turn">T${h.turn}</span>` +
      `<span class="rh-cards">${CARDS[h.p].icon}${CARDS[h.m].icon}</span>` +
      `<span class="rh-delta ${cls}">${delta}</span>`;
    el.appendChild(row);
  });
}

function setGauge(key, val, max = 100) {
  const fill = $(`${key}-fill`);
  const num  = $(`${key}-value`);
  if (fill) fill.style.width = `${clamp((val / max) * 100, 0, 100)}%`;
  if (num) {
    num.textContent = `${val}`;
    const stat = num.closest('.hud-stat');
    if (stat) {
      const danger =
        (key === 'drunk' && val <= 2) ||
        (key === 'mood'  && val >= 3);
      stat.classList.toggle('is-danger', danger);
      stat.classList.toggle('is-critical',
        (key === 'drunk' && val <= 1) ||
        (key === 'mood'  && val >= 5)
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
  let danger = 'none';
  if (state.player.life <= 1) danger = 'drunk';
  else if (state.milk.point >= 3) danger = 'sus';
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
  img.src = CHAR_IMAGES.kibishi;
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
  sfxTimer = setTimeout(() => el.classList.remove('sfx-show'), 1300);
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
  hideRuleHelp();
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

// ── First-play rule help ──
function hasSeenRuleHelp() {
  try {
    return localStorage.getItem(RULE_HELP_STORAGE_KEY) === '1';
  } catch (_) {
    return true;
  }
}

function markRuleHelpSeen() {
  try {
    localStorage.setItem(RULE_HELP_STORAGE_KEY, '1');
  } catch (_) {
    // Ignore storage failures; the game should still start.
  }
}

function beginCardModeGame() {
  warmGameImagesSoon();
  setState('TURN_START');
}

function showRuleHelp() {
  const modal = $('rule-help');
  const start = $('rule-help-start');
  if (!modal || !start) return beginCardModeGame();
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  start.focus({ preventScroll: true });
}

function hideRuleHelp() {
  const modal = $('rule-help');
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
}

function acceptRuleHelpAndStart() {
  markRuleHelpSeen();
  hideRuleHelp();
  beginCardModeGame();
}

// ── Lightweight image warmup ──
const imageCache = new Map();
function preloadImage(src) {
  if (!src || imageCache.has(src)) return imageCache.get(src);
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  const ready = img.decode ? img.decode().catch(() => {}) : Promise.resolve();
  imageCache.set(src, ready);
  return ready;
}

function scheduleIdle(fn) {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(fn, { timeout: 900 });
  } else {
    setTimeout(fn, 120);
  }
}

function warmGameImagesSoon() {
  const critical = [
    CHAR_IMAGES.tuzyou,
    CARD_IMAGES.player.back,
    CARD_IMAGES.milk.back,
    CARD_IMAGES.player.toast,
  ];
  critical.forEach(preloadImage);

  const rest = Array.from(new Set([
    ...Object.values(CHAR_IMAGES),
    ...Object.values(CARD_IMAGES.player),
    ...Object.values(CARD_IMAGES.milk),
  ])).filter(src => !critical.includes(src));

  let index = 0;
  const warmChunk = () => {
    rest.slice(index, index + 3).forEach(preloadImage);
    index += 3;
    if (index < rest.length) scheduleIdle(warmChunk);
  };
  scheduleIdle(warmChunk);
}

// ── Achievement modal ──
function openAchievements() {
  const modal = $('ach-modal');
  if (!modal) return;
  const unlocked = loadUnlockedAchievements();
  const list = $('ach-list');
  list.replaceChildren();
  ACHIEVEMENT_RULES.forEach(rule => {
    const item = document.createElement('div');
    const isUnlocked = unlocked.has(rule.id);
    item.className = `ach-item ${isUnlocked ? 'ach-unlocked' : 'ach-locked'}`;
    item.innerHTML = isUnlocked
      ? `<strong class="ach-name">${escHtml(rule.name)}</strong><span class="ach-desc">${escHtml(rule.description)}</span>`
      : `<strong class="ach-name">？？？</strong><span class="ach-desc">まだ解除されていない</span>`;
    list.appendChild(item);
  });
  modal.hidden = false;
}

function closeAchievements() {
  const modal = $('ach-modal');
  if (modal) modal.hidden = true;
}

// ── Init ──
function init() {
  // Mark all screens as hidden initially (intro is activated by setState('INTRO'))
  document.querySelectorAll('.screen').forEach(s => {
    s.setAttribute('aria-hidden', 'true');
    s.inert = true;
  });

  // Start button
  $('start-btn').addEventListener('click', () => {
    if (hasSeenRuleHelp()) {
      beginCardModeGame();
    } else {
      warmGameImagesSoon();
      showRuleHelp();
    }
  });
  $('rule-help-start')?.addEventListener('click', acceptRuleHelpAndStart);
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

  // Achievement modal
  $('ach-open-btn')?.addEventListener('click', openAchievements);
  $('ach-close-btn')?.addEventListener('click', closeAchievements);
  $('ach-modal')?.addEventListener('click', e => {
    if (e.target === $('ach-modal')) closeAchievements();
  });

  setState('INTRO');
}

document.addEventListener('DOMContentLoaded', init);
