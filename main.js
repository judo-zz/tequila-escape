'use strict';

const CAST_NAME           = 'みるく';
const TUT_KEY             = 'tequila_tutorialSeen';
const MAX_TURNS           = 10;
const JUDGE_TIME_LIMIT_MS = 1500;
const AFFINITY_TRUE_THRESHOLD = 60;

function rand(arr)        { return arr[Math.floor(Math.random() * arr.length)]; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function $(id)            { return document.getElementById(id); }

// ── シーン ──
const scenes = [
  { id:'normal',      weight:3, line:'せーのでいこ？',               icon:'🥃', status:'いつもの乾杯ムード',       effect:'補正なし',            recommend:'状況を見て選ぼう' },
  { id:'watching',    weight:2, line:'今日はちゃんと見るからね？',   icon:'👀', status:'みるくがじっと見ている',   effect:'フェイク 成功率 DOWN', recommend:'本当に飲む / 話を逸らす', fakePenalty:15 },
  { id:'distracted',  weight:1, line:'あ、あっちの卓も盛り上がってる',icon:'📱',status:'みるくがよそ見している',   effect:'フェイク 成功率 UP',   recommend:'フェイク', fakePenalty:-15 },
  { id:'hype',        weight:1, line:'今の流れ、めっちゃ楽しい！',   icon:'✨', status:'店内が盛り上がっている',   effect:'飲むと空気ボーナス',   recommend:'本当に飲む', drinkTensBonus:5, divertFailTensPenalty:5 },
  { id:'chekiChance', weight:1, line:'今なら盛れてるかも',           icon:'📸', status:'今ならチェキに逃げやすい', effect:'チェキ効果 UP',        recommend:'チェキに逃げる', chekiSusBonus:5, chekiTensBonus:5 },
  { id:'waterWatch',  weight:1, line:'そのグラス、なに飲んでるの？', icon:'🥤', status:'みるくがグラスを見ている', effect:'水を飲むと疑惑 大幅UP', recommend:'水は危険 / 話を逸らす', waterPenalty:10 },
];

const divertSuccessPairs = [
  { you:'てか今日、髪型めっちゃ似合ってない？', milk:'え、そこ見る？……まあ、ちょっと嬉しいけど' },
  { you:'このあとチェキ撮りたいかも',           milk:'え、ほんと？ じゃあ今のうちに盛れる顔しとこ' },
  { you:'今日の店内BGM、なんか良くない？',      milk:'そこ？ でもわかる、今日ちょっと好き' },
  { you:'そのネイル、かわいすぎない？',         milk:'気づいた？ ふふ、見る目あるじゃん' },
];
const divertFailPairs = [
  { you:'てか今日、髪型めっちゃ似合ってない？', milk:'……今それ言って逃げようとした？' },
  { you:'このあとチェキ撮りたいかも',           milk:'チェキはあと。今はグラス見てる' },
  { you:'今日の店内BGM、なんか良くない？',      milk:'話題の曲がり方、急すぎない？' },
  { you:'そのネイル、かわいすぎない？',         milk:'褒めれば許されると思ってる？' },
];

const lines = {
  normal:     ['えへへ、せーのでいこ？','逃げないよね？','今日、飲める日って聞いたよ？','乾杯って信頼関係だからね？','グラス持った？ いくよ？'],
  suspicious: ['あれ？ 今ほんとに飲んだ？','グラス、減ってなくない？','口、ついてた？','今ちょっと避けたよね？','ちゃんと見てるよ？'],
  mood:       ['あれ、私の方が飲んでる？','ちょっと楽しくなってきたかも','もう一杯だけなら……たぶん','なんか今日、強いじゃん','ふふ、まだいける……かも'],
  drunk:      ['顔、赤くなってきたね','大丈夫？ 目が合ってないよ？','ちょっとふわふわしてきた？','無理してない？','終電、覚えてる？'],
  lowTension: ['あれ、急に静かじゃない？','楽しくない？','もしかして帰りたい？','ノリ悪くなってきた？','乾杯の空気、消えたね'],
  caught:     ['今、飲んでなかったよね？','グラス、見てたよ','それはさすがに雑','逃げ方、下手すぎ','はい、現行犯です'],
};
function pickLine() {
  if (state.lastAction === 'fakeFail') return rand(lines.caught);
  if (state.castDrunk >= 60)          return rand(lines.mood);
  if (state.suspicion >= 70)          return rand(lines.suspicious);
  if (state.playerDrunk >= 70)        return rand(lines.drunk);
  if (state.tension <= 30)            return rand(lines.lowTension);
  return rand(lines.normal);
}

const actionTexts = {
  toast:          ['カンッ！あなたは覚悟を決めて飲んだ。','乾杯。一瞬だけ場が温まった。','カンッ！それだけは嘘じゃなかった。'],
  ikki:           ['グイッ！ 勢いで押し切った。','その一口で空気が変わった。','ノリで全部解決した。今だけは。'],
  fakeOk:         ['セーフ……？グラスを傾ける角度だけは完璧だった。','口を少し濡らす程度でいけた。','みるくの視線がグラスから離れた。'],
  fakeFail:       ['飲んでいないことが、一瞬でバレた。','グラスを動かす手が、嘘をついた。','目が合った。その瞬間、すべてが終わった。'],
  water:          ['水で命をつないだ。けど、視線は痛い。','こっそり水を補充した。バレていないといいが。'],
  cheki:          ['チェキで時間を稼いだ。スコアは犠牲にした。','笑顔だけは本物だった。場を乗り切った。'],
  toilet:         ['トイレに逃げた。身体は助かった。信用は減った。','少しだけ酔いを流した。でも席を外しすぎた。'],
  judge_laugh_ok: ['笑い飛ばして、その場を流し切った。','ごまかしが通った。まだいける。'],
  judge_laugh_ng: ['笑い方がぎこちなかった。逆に詰められた。','笑って誤魔化せると思ったか？'],
  judge_drink:    ['みるくの目を見て、もう一口。これで文句はないだろ？','証明のために飲んだ。体には堪えるけど。'],
  j_silent:       ['黙って、視線を受け流した。','…… 何も言わないのが今の最善だった。'],
};

const resultMessages = {
  survive:   ['最後まで空気を守り抜いた。','バレそうでバレない、ギリギリの夜だった。','10ターン、立ち続けた。今夜は勝ちだ。'],
  castDrunk: ['乾杯の主導権を握った夜だった。','乾杯を制した。あなたが仕掛けた夜だった。','みるくが満足してくれた。'],
  drunk:     ['飲みすぎた。終電はもうない。','足元がふらついた瞬間、すべてが終わった。'],
  suspicion: ['グラスを見られた。それがすべてだった。','バレた。言い訳の余地は、なかった。'],
  tension:   ['空気が冷えた。乾杯は終わった。','場の温度が下がり、誰も笑わなかった。'],
};

const commandsMain = [
  { id:'toast',  icon:'🥂', label:'通常乾杯',   desc:'信頼を守るが、酔いが進む',     effect:'酔い↑ / 疑惑↓' },
  { id:'ikki',   icon:'🍻', label:'勢いで乾杯', desc:'ノリで押し切る。リスクは高い', effect:'酔い↑↑ / 疑惑↓↓', ikki:true },
  { id:'fake',   icon:'🎭', label:'フェイク',   desc:'通れば強い。バレたら判定へ',   effect:'ノリ↑ / 疑惑↑' },
  { id:'divert', icon:'💬', label:'話を逸らす', desc:'会話で空気を変える',           effect:'疑惑↓ / 連発注意' },
  { id:'other',  icon:'⋯',  label:'その他',     desc:'水・チェキ・トイレ',           effect:'' },
];
const commandsOther = [
  { id:'water',  icon:'💧', label:'水を飲む',      desc:'酔いを抑えるが怪しまれる',   effect:'酔い↓ / 疑惑↑' },
  { id:'cheki',  icon:'📸', label:'チェキに逃げる', desc:'残り{n}回 / 空気回復',      effect:'疑惑↓ / 空気↑' },
  { id:'toilet', icon:'🚻', label:'トイレ',         desc:'酔いを流すが、不審がられる', effect:'酔い↓↓ / 疑惑↑↑' },
  { id:'back',   icon:'↩',  label:'戻る',           desc:'通常コマンドへ',             effect:'', back:true },
];
const commandsJudge = [
  { id:'j_silent', icon:'🤐', label:'黙る',           desc:'状況を受け入れて黙る',          effect:'疑惑↑ / 空気↓', judge:true },
  { id:'j_laugh',  icon:'😅', label:'笑ってごまかす', desc:'空気で押し切る (空気>30)',       effect:'疑惑↓ / 空気-',  judge:true },
  { id:'j_drink',  icon:'🥂', label:'逆に一口飲む',   desc:'証拠を残す。確実に下がる',       effect:'酔い↑ / 疑惑↓↓',judge:true },
];

// ── 状態 ──
const initialState = () => ({
  fsm: 'INTRO',
  turn: 1, maxTurn: MAX_TURNS,
  playerDrunk: 0, castDrunk: 0,
  suspicion: 20, tension: 60,
  affinity: 0,
  score: 0, chekiLeft: 3, toiletCount: 0,
  lastWasToilet: false, divertStreak: 0,
  commandMode: 'main',
  lastAction: null, lastDivertPair: null,
  lastDeltas: { drunk: 0, suspicion: 0, tension: 0, castDrunk: 0 },
  endReason: null, scene: null,
  previousScene: null, scenePrev2: null,
  counts: { toast:0, ikki:0, fake:0, divert:0, water:0, cheki:0, toilet:0 },
  peakDrunk: 0, peakSus: 20, lowTens: 60,
  summary: null,
});
let state      = initialState();
let judgeTimer = null;

// ── FSM ──
function setState(next) {
  const leaves = { ACTION_SELECT: disableCmds, JUDGE_PHASE: clearJudgeTimer };
  leaves[state.fsm]?.();
  state.fsm = next;
  const enters = { TURN_START: rollScene, ACTION_SELECT: enableCmds, JUDGE_PHASE: startJudge, TURN_END: tickTurn, RESULT: showResult };
  enters[next]?.();
}

function rollScene() {
  state.scenePrev2    = state.previousScene;
  state.previousScene = state.scene ? state.scene.id : null;

  // Turn pulse
  const appEl = $('app');
  appEl.classList.remove('turn-pulse');
  void appEl.offsetWidth;
  appEl.classList.add('turn-pulse');
  setTimeout(() => appEl.classList.remove('turn-pulse'), 200);

  state.scene         = pickScene();

  // Background stage progression: ターン進行でピンクが深まる
  const bgStages = [
    'linear-gradient(160deg, #FFE9F1 0%, #FFD8E8 100%)',
    'linear-gradient(160deg, #FFDDE7 0%, #FFC8DA 100%)',
    'linear-gradient(160deg, #FFD0DC 0%, #FFB8CF 100%)',
    'linear-gradient(160deg, #FFC3D2 0%, #FFAAC4 100%)',
    'linear-gradient(160deg, #FFB8CA 0%, #FF9FBD 100%)',
    'linear-gradient(160deg, #FFADC2 0%, #FF94B7 100%)',
  ];
  document.documentElement.style.setProperty('--bg-now', bgStages[Math.min(state.turn - 1, 5)]);

  state.lastAction    = null;
  state.lastDivertPair = null;
  state.commandMode   = 'main';
  state.lastDeltas    = { drunk: 0, suspicion: 0, tension: 0, castDrunk: 0 };
  render();
  setState('ACTION_SELECT');
}
function enableCmds()  { $('commands').classList.remove('blocked'); }
function disableCmds() { $('commands').classList.add('blocked'); }

function clearJudgeTimer() {
  if (judgeTimer !== null) { clearTimeout(judgeTimer); judgeTimer = null; }
}

function startJudge() {
  render();
  const bar = $('judge-timer-bar');
  if (bar) {
    document.documentElement.style.setProperty('--judge-time', `${JUDGE_TIME_LIMIT_MS}ms`);
    bar.classList.remove('countdown');
    void bar.offsetWidth;
    bar.classList.add('countdown');
  }
  judgeTimer = setTimeout(() => resolveJudge('j_silent'), JUDGE_TIME_LIMIT_MS);
}

function tickTurn() {
  state.score += state.tension * 5 + state.castDrunk * 3 + (100 - state.suspicion) * 2;
  state.peakDrunk = Math.max(state.peakDrunk, state.playerDrunk);
  state.peakSus   = Math.max(state.peakSus,   state.suspicion);
  state.lowTens   = Math.min(state.lowTens,   state.tension);

  if (state.playerDrunk >= 100) { state.endReason = 'drunk';     return finishGame(false); }
  if (state.suspicion   >= 100) { state.endReason = 'suspicion'; return finishGame(false); }
  if (state.tension     <= 0)   { state.endReason = 'tension';   return finishGame(false); }
  if (state.castDrunk   >= 100) { state.endReason = 'castDrunk'; return finishGame(true);  }
  if (state.turn >= state.maxTurn) { state.endReason = 'survive'; return finishGame(true); }

  state.turn += 1;
  setState('TURN_START');
}

// ── シーン選択（3連続禁止）──
function pickScene() {
  const banId = (state.previousScene && state.previousScene === state.scenePrev2) ? state.previousScene : null;
  const cands = scenes.filter(s => s.id !== banId);
  const total = cands.reduce((s, c) => s + c.weight, 0);
  let r = Math.random() * total;
  for (const s of cands) { r -= s.weight; if (r <= 0) return s; }
  return cands[0];
}

// ── コマンドルーター ──
function applyCommand(id) {
  if (id === 'other') { state.commandMode = 'other'; render(); return; }
  if (id === 'back')  { state.commandMode = 'main';  render(); return; }
  if (state.fsm === 'JUDGE_PHASE')    { resolveJudge(id); return; }
  if (state.fsm !== 'ACTION_SELECT')  return;
  setState('ACTION_RESOLVE');
  settleAction(id);
}

// ── 行動適用 ──
function settleAction(id) {
  const scene = state.scene || scenes[0];
  const before = { drunk: state.playerDrunk, sus: state.suspicion, ten: state.tension, cast: state.castDrunk };
  let toiletThisTurn = false;
  let toJudge        = false;

  switch (id) {
    case 'toast':
      state.playerDrunk += 18; state.castDrunk += 8; state.suspicion -= 10; state.tension += 8;
      if (scene.id === 'hype') state.tension += (scene.drinkTensBonus || 0);
      state.affinity += 3; state.lastAction = 'toast';
      break;

    case 'ikki':
      state.playerDrunk += 34; state.castDrunk += 18; state.suspicion -= 18; state.tension += 15;
      if (scene.id === 'hype') state.tension += (scene.drinkTensBonus || 0);
      state.affinity += 6; state.lastAction = 'ikki';
      break;

    case 'fake': {
      const pen  = scene.fakePenalty || 0;
      const rate = clamp(70 - state.suspicion * 0.45 + state.tension * 0.2 - pen, 20, 90);
      if (Math.random() * 100 < rate) {
        state.castDrunk += 12; state.suspicion += 12; state.tension += 6;
        state.affinity += 1; state.lastAction = 'fakeOk';
      } else {
        state.playerDrunk += 5; state.suspicion += 35; state.tension -= 20;
        state.affinity -= 4; state.lastAction = 'fakeFail'; toJudge = true;
      }
      break;
    }

    case 'divert': {
      state.divertStreak += 1;
      const pen  = state.divertStreak === 2 ? 15 : state.divertStreak >= 3 ? 30 : 0;
      const rate = clamp(55 + state.tension * 0.35 - state.suspicion * 0.25 - pen, 25, 90);
      if (Math.random() * 100 < rate) {
        state.suspicion -= 22; state.tension += 8;
        state.affinity += 2; state.lastAction = 'divertOk';
        state.lastDivertPair = rand(divertSuccessPairs);
      } else {
        state.suspicion += 15; state.tension -= 15;
        if (scene.id === 'hype') state.tension -= (scene.divertFailTensPenalty || 0);
        state.affinity -= 3; state.lastAction = 'divertFail';
        state.lastDivertPair = rand(divertFailPairs);
      }
      break;
    }

    case 'water':
      state.playerDrunk -= 20; state.suspicion += 18; state.tension -= 5;
      if (scene.id === 'waterWatch') state.suspicion += (scene.waterPenalty || 0);
      state.affinity -= 1; state.lastAction = 'water';
      break;

    case 'cheki':
      if (state.chekiLeft <= 0) { showToast('チェキはもう使えない'); setState('ACTION_SELECT'); return; }
      state.suspicion -= 8; state.tension += 12; state.score -= 100; state.chekiLeft -= 1;
      if (scene.id === 'chekiChance') {
        state.suspicion -= (scene.chekiSusBonus || 0);
        state.tension   += (scene.chekiTensBonus || 0);
      }
      state.affinity -= 2; state.lastAction = 'cheki';
      break;

    case 'toilet':
      state.playerDrunk -= 30; state.suspicion += 25; state.tension -= 12;
      state.toiletCount += 1;
      if (state.lastWasToilet) state.suspicion += 20;
      toiletThisTurn = true;
      state.affinity -= 2; state.lastAction = 'toilet';
      break;

    default:
      setState('ACTION_SELECT'); return;
  }

  if (id !== 'divert') state.divertStreak = 0;
  if (id in state.counts) state.counts[id]++;

  state.playerDrunk = clamp(state.playerDrunk, 0, 100);
  state.castDrunk   = clamp(state.castDrunk,   0, 100);
  state.suspicion   = clamp(state.suspicion,   0, 100);
  state.tension     = clamp(state.tension,     0, 100);
  state.score       = Math.max(0, state.score);
  state.lastWasToilet = toiletThisTurn;
  state.lastDeltas    = {
    drunk:     state.playerDrunk - before.drunk,
    suspicion: state.suspicion   - before.sus,
    tension:   state.tension     - before.ten,
    castDrunk: state.castDrunk   - before.cast,
  };

  // 即死判定
  const dead = state.playerDrunk >= 100 || state.suspicion >= 100 || state.tension <= 0 || state.castDrunk >= 100;
  if (dead) {
    triggerActionFeedback(id);
    render();
    if (state.playerDrunk >= 100) state.endReason = 'drunk';
    else if (state.suspicion >= 100) state.endReason = 'suspicion';
    else if (state.tension <= 0)    state.endReason = 'tension';
    else                            state.endReason = 'castDrunk';
    return finishGame(state.endReason !== 'drunk' && state.endReason !== 'suspicion' && state.endReason !== 'tension');
  }

  triggerActionFeedback(id);

  if (toJudge) {
    render();
    $('commands').classList.add('blocked');
    setTimeout(() => {
      $('commands').classList.remove('blocked');
      setState('JUDGE_PHASE');
    }, 900);
    return;
  }

  render();
  setState('TURN_END');
}

// ── 演出 ──
function setExpr(expr) {
  const ch = document.querySelector('.character');
  if (!ch) return;
  ch.classList.remove('expr-doubt', 'expr-smile', 'expr-drunk');
  if (expr !== 'normal') ch.classList.add(`expr-${expr}`);
}

function triggerActionFeedback(id) {
  switch (id) {
    case 'toast':      triggerSfx('カンッ！',    'var(--yellow)'); setExpr('smile');  tryVibrate(20);         playSfx('toast');      break;
    case 'ikki':       triggerSfx('グイッ！',    'var(--pink)');  setExpr('drunk');  tryVibrate([30,40,30]); playSfx('ikki');       break;
    case 'fakeOk':     triggerSfx('セーフ……？', 'var(--blue)');  setExpr('normal'); tryVibrate(15);         playSfx('fakeOk');     break;
    case 'fakeFail':   triggerCutin();                            setExpr('doubt');  tryVibrate([50,60,50]); playSfx('fakeFail');   break;
    case 'divertOk':   triggerSfx('話題転換！',  'var(--blue)');  setExpr('smile');  tryVibrate(20);         playSfx('divertOk');   break;
    case 'divertFail': triggerSfx('雑すぎる！',  'var(--pink)');  setExpr('doubt');  tryVibrate(40);         playSfx('divertFail'); break;
    case 'water':      triggerSfx('命の水',       'var(--blue)');  setExpr('normal'); tryVibrate(10);         playSfx('water');      break;
    case 'cheki':      triggerSfx('パシャ！',     'var(--yellow)');setExpr('smile');  tryVibrate(20);         playSfx('cheki');      break;
    case 'toilet':     triggerSfx('退避！',       'var(--blue)');  setExpr('normal'); tryVibrate(15);         playSfx('toilet');     break;
  }
}

function tryVibrate(pattern) {
  if (navigator.vibrate) try { navigator.vibrate(pattern); } catch(_) {}
}
function playSfx(_type) { /* TODO: WebAudio */ }

// ── JUDGE解決 ──
function resolveJudge(judgeId) {
  clearJudgeTimer();
  if (judgeId === 'j_laugh' && state.tension <= 30) judgeId = 'j_silent';
  const before = { drunk: state.playerDrunk, sus: state.suspicion, ten: state.tension, cast: state.castDrunk };

  switch (judgeId) {
    case 'j_laugh': {
      const rate = clamp(60 - state.suspicion * 0.3 + state.tension * 0.2, 5, 95);
      if (Math.random() * 100 < rate) {
        state.suspicion -= 15; state.tension -= 3; state.affinity += 2;
        state.lastAction = 'judge_laugh_ok'; triggerSfx('あはは…！', 'var(--blue)'); setExpr('smile');
      } else {
        state.suspicion += 25; state.tension -= 15; state.affinity -= 3;
        state.lastAction = 'judge_laugh_ng'; triggerSfx('ダメだった', 'var(--pink)'); setExpr('doubt');
      }
      tryVibrate(20); break;
    }
    case 'j_drink':
      state.playerDrunk += 12; state.castDrunk += 6; state.suspicion -= 22; state.tension += 5;
      state.affinity += 5; state.lastAction = 'judge_drink';
      triggerSfx('…わかったよ', 'var(--yellow)'); setExpr('drunk'); tryVibrate(30); break;
    default: // j_silent + timeout
      state.suspicion += 10; state.tension -= 5; state.affinity -= 2;
      state.lastAction = 'j_silent'; setExpr('doubt'); break;
  }

  state.playerDrunk = clamp(state.playerDrunk, 0, 100);
  state.castDrunk   = clamp(state.castDrunk,   0, 100);
  state.suspicion   = clamp(state.suspicion,   0, 100);
  state.tension     = clamp(state.tension,     0, 100);
  state.score       = Math.max(0, state.score);
  state.lastDeltas  = {
    drunk:     state.playerDrunk - before.drunk,
    suspicion: state.suspicion   - before.sus,
    tension:   state.tension     - before.ten,
    castDrunk: state.castDrunk   - before.cast,
  };
  playSfx('judge');
  render();
  setState('TURN_END');
}

// ── 終了 ──
function finishGame(isWin) {
  state.score += isWin ? (state.endReason === 'castDrunk' ? 2000 : 1000) : 0;
  state.score  = Math.max(0, state.score);
  state.summary = buildSummary(isWin);
  setState('RESULT');
}

// ── エンディング ──
function resolveEnding(isWin) {
  if (!isWin) return { ending:'bad', endTag:'BAD END' };
  if (state.affinity >= AFFINITY_TRUE_THRESHOLD && state.castDrunk >= 60) return { ending:'true', endTag:'TRUE END' };
  if (state.chekiLeft === 0 || state.toiletCount >= 3 || state.playerDrunk < 30 || state.suspicion < 30) return { ending:'special', endTag:'SPECIAL END' };
  return { ending:'normal', endTag:'NORMAL END' };
}

function resolveTitle(isWin) {
  if (!isWin) {
    if (state.endReason === 'drunk')     return '無事終電消失';
    if (state.endReason === 'suspicion') return 'グラス見られおじさん';
    if (state.endReason === 'tension')   return '空気破壊おじさん';
    return '記憶喪失おじさん';
  }
  const { ending } = resolveEnding(true);
  if (ending === 'true')    return 'みるくの夜になった';
  if (ending === 'special') {
    if (state.chekiLeft === 0)  return 'チェキ避難民';
    if (state.toiletCount >= 3) return '膀胱の戦士';
    if (state.playerDrunk < 30) return '素面の策士';
    if (state.suspicion < 30)   return '自然体の逃亡者';
  }
  if (state.endReason === 'castDrunk') return '乾杯の支配者';
  return '夜の生還者';
}

// ── サマリー ──
function buildSummary(isWin) {
  const { ending } = resolveEnding(isWin);
  const title      = resolveTitle(isWin);
  const oneliner   = rand(resultMessages[state.endReason] || resultMessages.survive);

  const topEntry = Object.entries(state.counts).filter(([,v]) => v > 0).sort((a,b) => b[1]-a[1])[0];
  const labels   = { toast:'通常乾杯', ikki:'勢いで乾杯', fake:'フェイク', divert:'話を逸らす', water:'水', cheki:'チェキ', toilet:'トイレ' };
  const topAction = topEntry ? { name: labels[topEntry[0]] || topEntry[0], count: topEntry[1] } : null;

  const worst = [
    { name:'酔い', value: state.peakDrunk },
    { name:'疑惑', value: state.peakSus   },
    { name:'空気', value: 100 - state.lowTens },
  ].sort((a,b) => b.value - a.value)[0];

  return { isWin, ending, title, score: state.score, endReason: state.endReason, oneliner,
    worstGauge: worst, topAction,
    finalGauges: { drunk: state.playerDrunk, sus: state.suspicion, tens: state.tension, castDrunk: state.castDrunk },
    turn: state.turn };
}

// ── render ──
function render() {
  $('turn-display').textContent = `${state.turn} / ${state.maxTurn}`;

  setGauge('drunk',     state.playerDrunk, state.lastDeltas.drunk);
  setGauge('suspicion', state.suspicion,   state.lastDeltas.suspicion);
  setGauge('tension',   state.tension,     state.lastDeltas.tension);
  setGauge('castDrunk', state.castDrunk,   state.lastDeltas.castDrunk);

  $('drunk-fill').classList.toggle('danger',     state.playerDrunk >= 80);
  $('suspicion-fill').classList.toggle('danger', state.suspicion   >= 80);
  $('tension-fill').classList.toggle('crit',     state.tension     <= 25);
  $('castDrunk-fill').classList.toggle('near-win', state.castDrunk >= 85);
  document.querySelector('.gauge:has(#drunk-fill)')?.classList.toggle('danger-shake', state.playerDrunk >= 80);
  document.querySelector('.gauge:has(#suspicion-fill)')?.classList.toggle('danger-shake', state.suspicion >= 80);

  const castStatus = $('cast-status');
  if (state.castDrunk >= 85) {
    castStatus.textContent = 'あと少し！'; castStatus.className = 'cast-status near';
  } else if (state.castDrunk >= 60) {
    castStatus.textContent = 'ノリが上がってる'; castStatus.className = 'cast-status';
  } else {
    castStatus.textContent = ''; castStatus.className = 'cast-status';
  }

  const scene    = state.scene || scenes[0];
  const isJudge  = state.fsm === 'JUDGE_PHASE';
  const sceneCard = $('scene-card');

  if (isJudge) {
    $('scene-icon').textContent   = '⚠';
    $('scene-status').textContent = 'JUDGE — 怪しまれている';
    $('scene-eff').textContent    = '今、飲んでなかったよね？';
    $('scene-rec').textContent    = '3択で切り抜けろ';
    sceneCard.classList.add('judge-scene');
  } else {
    $('scene-icon').textContent   = scene.icon;
    $('scene-status').textContent = scene.status;
    $('scene-eff').textContent    = '効果：' + scene.effect;
    $('scene-rec').textContent    = scene.recommend;
    sceneCard.classList.remove('judge-scene');
  }

  const speechEl = $('speech');
  if (isJudge) {
    speechEl.textContent = '今、飲んでなかったよね？';
    speechEl.classList.add('judge-speech');
  } else {
    speechEl.classList.remove('judge-speech');
    speechEl.textContent = !state.lastAction ? scene.line : pickLine();
  }

  const ar = $('action-result');
  if (state.lastAction === 'divertOk' || state.lastAction === 'divertFail') {
    const p = state.lastDivertPair;
    if (p) {
      ar.textContent = `あなた「${p.you}」\nみるく「${p.milk}」`;
      ar.classList.remove('show'); void ar.offsetWidth; ar.classList.add('show');
    }
  } else if (actionTexts[state.lastAction]) {
    ar.textContent = rand(actionTexts[state.lastAction]);
    ar.classList.remove('show'); void ar.offsetWidth; ar.classList.add('show');
  } else {
    ar.classList.remove('show'); ar.textContent = '';
  }

  const app = $('app');
  app.classList.toggle('drunk-high', state.playerDrunk >= 80);
  app.classList.toggle('creepy',     state.suspicion   >= 80);
  app.classList.toggle('hype',       state.tension     >= 80);
  app.classList.toggle('cold',       state.tension     <= 25);
  app.classList.toggle('near-win',   state.castDrunk   >= 85);

  const cmdList = isJudge ? commandsJudge : (state.commandMode === 'main' ? commandsMain : commandsOther);
  const wrap    = $('commands');
  wrap.innerHTML = '';
  for (const c of cmdList) {
    const btn = document.createElement('button');
    btn.className = 'cmd-card' + (c.back ? ' back' : '') + (c.judge ? ' judge' : '') + (c.ikki ? ' ikki' : '');

    const top  = document.createElement('div');  top.className  = 'cmd-top';
    const icon = document.createElement('span'); icon.className = 'cmd-icon'; icon.textContent = c.icon;
    const name = document.createElement('span'); name.className = 'cmd-name'; name.textContent = c.label;
    top.append(icon, name);

    const desc = document.createElement('div'); desc.className = 'cmd-desc';
    desc.textContent = c.desc.replace('{n}', state.chekiLeft);

    const eff = document.createElement('div'); eff.className = 'cmd-effect';
    eff.textContent = c.effect;

    btn.append(top, desc, eff);

    if (c.id === 'cheki'   && state.chekiLeft <= 0) btn.disabled = true;
    if (c.id === 'j_laugh' && state.tension   <= 30) btn.disabled = true;

    btn.addEventListener('click', () => {
      btn.classList.remove('pressed'); void btn.offsetWidth; btn.classList.add('pressed');
      tryVibrate(15);
      applyCommand(c.id);
    });
    wrap.appendChild(btn);
  }
}

function setGauge(key, val, delta) {
  const fill = $(`${key}-fill`);
  const prev = parseFloat(fill.style.width) || 0;
  fill.style.width = val + '%';
  if (Math.abs(val - prev) > 0) {
    fill.classList.remove('flash'); void fill.offsetWidth; fill.classList.add('flash');
    setTimeout(() => fill.classList.remove('flash'), 500);
  }
  $(`${key}-value`).textContent = val;
  const d = $(`${key}-delta`);
  if (delta) {
    d.textContent = (delta > 0 ? '+' : '') + delta;
    d.className   = 'gauge-delta'; void d.offsetWidth;
    d.classList.add(delta > 0 ? 'pos' : 'neg');
  } else {
    d.className = 'gauge-delta'; d.textContent = '';
  }
}

// ── オーバーレイ演出 ──
function triggerCutin() {
  const c  = $('cutin');
  const ch = document.querySelector('.character');
  c.classList.remove('show'); ch?.classList.remove('forward');
  void c.offsetWidth;
  c.classList.add('show'); ch?.classList.add('forward');
  clearTimeout(triggerCutin._tid);
  triggerCutin._tid = setTimeout(() => { c.classList.remove('show'); ch?.classList.remove('forward'); }, 900);
}

function triggerSfx(text, color) {
  const el   = $('sfx-effect');
  const span = el.querySelector('.sfx-text');
  span.textContent      = text;
  span.style.color      = color;
  span.style.textShadow = `0 0 20px ${color}`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(el._tid);
  el._tid = setTimeout(() => el.classList.remove('show'), 700);
}

// ── 画面切替 ──
function show(id) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  $(id).classList.add('active');
  if (id !== 'game-screen') $('app').classList.remove('drunk-high','creepy','hype','cold','near-win');
}

// ── ゲーム開始 ──
function startGame() {
  state = initialState();
  clearJudgeTimer();
  $('cutin').classList.remove('show');
  $('sfx-effect').classList.remove('show');
  const ch = document.querySelector('.character');
  ch?.classList.remove('forward','expr-doubt','expr-smile','expr-drunk');
  $('action-result').classList.remove('show');
  $('action-result').textContent = '';
  $('commands').classList.remove('blocked');
  document.querySelector('.result-frame')?.classList.remove('true-end','special-end','bad-end');
  show('game-screen');
  setState('TURN_START');
  let seen = false;
  try { seen = localStorage.getItem(TUT_KEY) === '1'; } catch(_) {}
  if (!seen) showTutorial();
}

// ── 結果画面 ──
function showResult() {
  const s = state.summary;
  if (!s) return;
  const { ending, endTag } = resolveEnding(s.isWin);

  const verdictEl = $('result-verdict');
  verdictEl.textContent = s.isWin ? '— 生還 —' : '— 撃沈 —';
  verdictEl.classList.toggle('win',  s.isWin);
  verdictEl.classList.toggle('lose', !s.isWin);

  // ending tag（既存があれば置換、なければ挿入）
  let tagEl = document.querySelector('.result-ending-tag');
  if (!tagEl) { tagEl = document.createElement('div'); verdictEl.after(tagEl); }
  tagEl.className   = `result-ending-tag ${ending}`;
  tagEl.textContent = endTag;

  $('result-title').textContent    = s.title;
  $('result-oneliner').textContent = s.oneliner;

  const loseNote = $('lose-note');
  if (loseNote) loseNote.hidden = s.isWin;

  $('result-score').textContent = s.score.toLocaleString();

  const frame = document.querySelector('.result-frame');
  if (frame) {
    frame.classList.remove('true-end','special-end','bad-end');
    if (ending === 'true')    frame.classList.add('true-end');
    if (ending === 'special') frame.classList.add('special-end');
    if (ending === 'bad')     frame.classList.add('bad-end');
  }

  const statsData = [
    ['酔い',    s.finalGauges.drunk    + '%'],
    ['疑惑',    s.finalGauges.sus      + '%'],
    ['空気',    s.finalGauges.tens     + '%'],
    ['みるく',  s.finalGauges.castDrunk + '%'],
    ['ターン',  `${s.turn} / ${MAX_TURNS}`],
  ];
  const statsEl = $('result-stats');
  statsEl.innerHTML = '';
  for (const [k,v] of statsData) {
    const row = document.createElement('div'); row.className = 'stats-row';
    const ks  = document.createElement('span'); ks.className = 'stats-key'; ks.textContent = k;
    const vs  = document.createElement('span'); vs.className = 'stats-val'; vs.textContent = v;
    row.append(ks, vs); statsEl.appendChild(row);
  }

  let summaryEl = $('result-summary-box');
  if (!summaryEl) {
    summaryEl = document.createElement('div');
    summaryEl.id        = 'result-summary-box';
    summaryEl.className = 'result-summary';
    statsEl.after(summaryEl);
  }
  const rows = [];
  if (s.topAction) rows.push([`最多行動`, `${s.topAction.name} ×${s.topAction.count}`]);
  rows.push([`最大ピンチ`, `${s.worstGauge.name} ${s.worstGauge.value}`]);
  rows.push([`最終ノリ`,   `みるく ${s.finalGauges.castDrunk}`]);
  summaryEl.innerHTML = rows.map(([k,v]) =>
    `<div class="summary-row"><span class="summary-key">${k}</span><span class="summary-val">${v}</span></div>`
  ).join('');

  $('copy-btn').dataset.win   = s.isWin ? '1' : '0';
  $('copy-btn').dataset.title = s.title;

  show('result-screen');
}

// ── コピー ──
function copyResult() {
  const btn = $('copy-btn');
  if (btn.dataset.busy === '1') return;
  const s     = state.summary;
  const isWin = btn.dataset.win === '1';
  const head  = isWin ? 'テキーラから逃げろ！で生還しました🍻' : 'テキーラから逃げろ！で散りました🍻';
  const tLine = isWin ? `称号：${btn.dataset.title}` : `死因：${btn.dataset.title}`;
  const text  = [head, tLine, `スコア：${s?.score ?? 0}`,
    `酔い：${s?.finalGauges.drunk}% / 疑惑：${s?.finalGauges.sus}% / 空気：${s?.finalGauges.tens}%`,
    '#テキーラから逃げろ'].join('\n');

  const flash = (msg) => {
    btn.dataset.busy = '1'; btn.textContent = msg;
    clearTimeout(copyResult._tid);
    copyResult._tid = setTimeout(() => { btn.textContent = '結果をコピー'; btn.dataset.busy = '0'; }, 2000);
  };
  const ok = () => flash('コピーしました！');
  const ng = () => flash('コピーできませんでした');

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(ok, () => fallbackCopy(text, ok, ng));
  } else {
    fallbackCopy(text, ok, ng);
  }
}
function fallbackCopy(text, ok, ng) {
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy') ? ok() : ng(); } catch { ng(); }
  document.body.removeChild(ta);
}

// ── toast / tutorial ──
function showToast(msg) {
  const t = $('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(showToast._tid);
  showToast._tid = setTimeout(() => t.classList.remove('show'), 1500);
}
function showTutorial()    { $('tutorial-overlay').hidden = false; }
function dismissTutorial() {
  $('tutorial-overlay').hidden = true;
  try { localStorage.setItem(TUT_KEY, '1'); } catch(_) {}
}

// ── 初期化 ──
document.addEventListener('DOMContentLoaded', () => {
  $('cast-label').textContent = '💗' + CAST_NAME;
  $('start-btn').addEventListener('click',   startGame);
  $('retry-btn').addEventListener('click',   startGame);
  $('copy-btn').addEventListener('click',    copyResult);
  $('howto-btn').addEventListener('click',   showTutorial);
  $('tutorial-ok').addEventListener('click', dismissTutorial);
});
