# テキーラから逃げろ！ CARD MODE 開発者向け仕様書

## 対象

この仕様書は `card-mode.html` / `card-mode.js` / `card-mode.css` の現行実装に基づく。旧 `GAME_GUIDE.md` や `HANDOFF.md` には酔い・疑惑・空気・MOOD ゲージ制の説明が一部残っているが、現行 CARD MODE は HP/ノリ制で実装されているため、本書ではコードを正とする。

## 実装ファイル

| ファイル | 役割 |
|---|---|
| `card-mode.html` | イントロ、ゲーム画面、手札、リザルト、演出レイヤーの DOM |
| `card-mode.js` | ゲームロジック、FSM、AI、予告、リザルト、実績、共有文生成 |
| `card-mode.css` | 縦画面 UI、カード演出、ゲージ、カットイン、リザルトのスタイル |
| `assets/optimized/ware_*.webp` | プレイヤー側カード画像 |
| `assets/optimized/aite_*.webp` | みるく側カード画像 |
| `assets/optimized/tuzyou.webp` など | みるく表情差分 |

外部フレームワークは使わず、バニラ HTML/CSS/JavaScript で動作する。スマホ縦画面を主対象とし、`#app` は最大幅 460px。

## ゲーム概要

プレイヤーと CPU みるくが、各ターン同時に 1 枚ずつカードを出す。最大 10 ターン。双方は HP とノリを持ち、HP が 0 になった側が敗北する。10ターン終了時は HP、次にノリの順で判定する。

## 主要定数

| 定数 | 値 | 用途 |
|---|---:|---|
| `MAX_TURNS` | 10 | 最大ターン数 |
| `LIFE_MAX` | 5 | HP 最大値 |
| `POINT_MAX` | 8 | ノリ最大値 |
| `CARD_COSTS.toast` | 0 | 乾杯する |
| `CARD_COSTS.fake` | 1 | 飲んだフリ |
| `CARD_COSTS.watch` | 2 | 見張る |
| `CARD_COSTS.chaser` | 3 | チェイサー |
| `CHASER_HEAL` | 2 | チェイサー回復量 |
| `ACHIEVEMENT_STORAGE_KEY` | `tequilaEscape.cardMode.achievements.v2` | 実績保存キー |

演出タイミング定数（ms）:

| 定数 | 値 | 用途 |
|---|---:|---|
| `FLIP_MS` | 580 | カードフリップアニメーション時間 |
| `REVEAL_HOLD_MS` | 1200 | フリップ後のカード表示保持時間 |
| `TELL_HOLD_MS` | 560 | テルフェーズの最低表示時間 |
| `COMMIT_MS` | 400 | コミット演出の表示時間 |
| `REVEAL_PRE_FLIP_MS` | 600 | フリップ前の待機時間（基準値。危険時は動的に延長） |
| `CARD_GUIDE_HOLD_MS` | 420 | 手札長押しでカード説明を出すまでの時間 |
`enterReveal()` では `REVEAL_PRE_FLIP_MS` の代わりに動的遅延を使用する。プレイヤーまたはみるくの HP が 1 以下のとき最大 1100ms、2 以下のとき 850ms、ターン 8 以降は 750ms に延長される。

## 状態モデル

`initialState()` の主要フィールド:

| フィールド | 内容 |
|---|---|
| `fsm` | 現在の FSM 状態 |
| `turn` | 現在ターン。1 始まり |
| `player` | `{ life:5, point:1 }` ← 初期値 |
| `milk` | `{ life:5, point:1 }` ← 初期値 |
| `gauges` | 旧 HUD 名称との互換用。`player.life` などを同期 |
| `playerCard` / `milkCard` | このターンのカード ID |
| `tell` | 予告結果 `{ type, honest, willPlay, chaserSpecial, honestRate }` |
| `history` | 各ターンのカード、差分、詳細 outcome |
| `cpuPattern` | プレイヤー同カード連続使用検出 |
| `peak` | 最低 HP、最高ノリの記録 |
| `counts` | プレイヤー各カードの使用回数 |
| `endReason` | 終了理由 |
| `winner` | `player` / `milk` / `draw` |
| `summary` | リザルト表示用の集約結果 |

`gauges.drunk/sus/tens/mood` は表示 ID 互換のため残っており、現行ではそれぞれ「あなた HP」「あなたノリ」「みるく HP」「みるくノリ」を表す。

## カード定義

カード ID は `toast` / `fake` / `watch` / `chaser` の 4 種。`CARD_IDS` の順序は手札更新、集計、シード生成などで使われる。

| ID | 表示名 | コスト | 基本効果 | 選択可否 |
|---|---|---:|---|---|
| `toast` | 乾杯する | 0 | 使用者 HP-1 / ノリ+1 | 常に可。ノリ最大時も選べるがノリは増えない |
| `fake` | 飲んだフリ | 1 | HP を失わずターンを流す。相手が `toast` なら追加で自分ノリ+1 | ノリが 1 以上 |
| `watch` | 見張る | 2 | 相手の fake をカウンター（相手 HP-2 / 自分ノリ+1） | ノリが 2 以上 |
| `chaser` | チェイサー | 3 | 使用者 HP+2 | ノリが 3 以上、かつ HP が最大未満 |

コストは `resolveBattleTurn()` 冒頭で双方とも先に支払われる。その後、乾杯、チェイサー、カウンター効果を順に適用する。HP/ノリは `clamp()` により 0 から最大値に収まる。

手札は通常タップで選択、長押しまたはコンテキストメニューでカード説明トーストを表示する。限界コール中は各カードのヒント表示が強化後の追加効果に差し替わる。

## 組み合わせ効果

以下は上限/下限にかからない通常時の差分。`あなた` と `みるく` はそれぞれ HP/ノリ差分を表す。

| あなた \\ みるく | 乾杯する | 飲んだフリ | 見張る | チェイサー |
|---|---|---|---|---|
| 乾杯する | あなた HP-1 ノリ+1 / みるく HP-1 ノリ+1 | あなた HP-1 ノリ+1 / みるく 変化なし | あなた HP-1 ノリ+1 / みるく ノリ-2 | あなた HP-1 ノリ+1 / みるく HP+2 ノリ-3 |
| 飲んだフリ | あなた 変化なし / みるく HP-1 ノリ+1 | あなた ノリ-1 / みるく ノリ-1 | あなた HP-2 ノリ-1 / みるく ノリ-1 | あなた ノリ-1 / みるく HP+2 ノリ-3 |
| 見張る | あなた ノリ-2 / みるく HP-1 ノリ+1 | あなた ノリ-1 / みるく HP-2 ノリ-1 | あなた ノリ-2 / みるく ノリ-2 | あなた ノリ-2 / みるく HP+2 ノリ-3 |
| チェイサー | あなた HP+2 ノリ-3 / みるく HP-1 ノリ+1 | あなた HP+2 ノリ-3 / みるく ノリ-1 | あなた HP+2 ノリ-3 / みるく ノリ-2 | あなた HP+2 ノリ-3 / みるく HP+2 ノリ-3 |

補足:

- `watch` が `fake` を捕まえた場合、watch 側はノリ+1、fake 側は HP-2。
- `watch` のコスト 2 は先払いのため、カウンター成功時の実質差分はノリ-1（cost-2 + counter+1）。
- `fake` vs `toast` は追加で自分ノリ+1。コスト 1 と相殺され、HP 保護のみが実質的なリターンとなる。
- `fake` vs `watch` / `fake` / `chaser` の場合は追加ノリ+1 は発生しない。
- `chaser` は HP 最大時には選べない。

## 予告システム

毎ターン `rollTell()` が実行される。先に `pickMilkCard()` で実際に出すカード `willPlay` を決定し、その後 `tellHonestRate(turn)` に基づき正直な予告か嘘の予告かを決める。

| ターン | 正直率 | 表示ラベル |
|---|---:|---|
| 1-3 | 0.80 | 信頼度 高 |
| 4-7 | 0.70 | 信頼度 中 |
| 8-9 | 0.55 | 信頼度 低 |
| 10 | 0.45 | 信頼度 博打 |

表示上は「たまに嘘」「嘘あり」「疑って」「ほぼ罠」を付け、予告が確定情報ではないことを初見にも伝える。

`TELL_OF` はカードから予告タイプへの対応:

| カード | Tell type | セリフ | 観察 | 予測 |
|---|---|---|---|---|
| `watch` | `glass` | 「グラス、減ってないなぁ……」 | みるくがグラスを見ている | 見張るかも |
| `toast` | `excite` | 「ねぇ、もっといこ？！」 | 笑顔が深まった | 乾杯かも |
| `chaser` | `bored` | 「ふぅ……」 | 息をついた | チェイサーかも |
| `fake` | `playful` | 「次は……どうしよっかな？」 | 髪を触った | 飲んだフリかも |

直前ターンにプレイヤーが `chaser` を使い、今回の tell type が `bored` の場合、セリフのみ「ぐびぐび、つまんないな〜」に差し替わる。

## CPU AI

`pickMilkCard()` は合法手の重み付きランダム。

基本仕様:

- 合法手は `actorCanPlay()` に従う。
- 全合法手に初期重み 1 を付与する。
- みるくのノリが 1 以下なら `toast` を強める。
- みるく HP が 3 以下なら `fake` を強める。
- プレイヤーのノリが 1 以上なら `watch` を少し強め、2 以上、4 以上で段階的に警戒を強める。
- みるく HP が 2 以下なら `chaser` を大きく強める。
- プレイヤーが同じカードを 2 回以上連続使用すると、`watch` を最大 2.0 まで加算補正する。
- 8ターン目以降、プレイヤーが `fake` を出せるノリを持つ場合も `watch` を最大 2.0 まで加算補正する。
- 直近 2 ターンでプレイヤーが `fake` を使用し、かつみるくが `watch` を出していない場合、`watch` 重みを最大 2.8 まで大きく加算する（記憶メカニズム）。
- 10% の確率で重み計算を無視して合法手からランダム選択する（パターン読みへの対策）。
- 最終ターン（ターン 10）では 60% の確率で完全ランダムに選択する。

## FSM とターン進行

FSM 状態:

```text
INTRO
  -> TURN_START
  -> TELL_PHASE
  -> CARD_SELECT
  -> COMMIT
  -> REVEAL
  -> RESOLVE
  -> TURN_END
  -> RESULT または次 TURN_START
```

各状態の主な責務:

| 状態 | 処理 |
|---|---|
| `INTRO` | イントロ画面表示、演出クリア |
| `TURN_START` | ゲーム画面表示、HUD/履歴/ACT 更新、即座に予告フェーズへ |
| `TELL_PHASE` | 予告生成、吹き出しとヒント表示、みるく表情更新 |
| `CARD_SELECT` | 手札を有効化、コスト/状態に応じてボタン更新 |
| `COMMIT` | 選択カードのコミット演出 |
| `REVEAL` | 双方カードを確定し、伏せカードから表にフリップ |
| `RESOLVE` | `resolveBattleTurn()`、履歴記録、SFX/カットイン/HUD 更新 |
| `TURN_END` | HP0 または10ターン判定。継続時は turn++ |
| `RESULT` | サマリー、称号、実績、X投稿 URL、タブ表示を生成 |

`CARD_SELECT` から離れる際は `disableHand()` と `clearTell()` が実行される。

5ターン目は `mid_show`（中間チェック）が必ず出る。フェイク成功報酬と見張り成功ダメージが上がり、中盤にも山場を作る。

テンションが最大の時に限界コールを使うと、次に選んだ1枚だけ強化される。乾杯はみるくHP-1追加、フェイクは見張られなければノリ+1追加、見張るはフェイクを刺した時にみるくHP-1追撃、チェイサーはHP+1追加。空振りした場合はプレイヤーHP-1。

## ACT 表示

| ターン | 表示 |
|---|---|
| 1-3 | 探り合い |
| 4-7 | 本番 |
| 8-9 | ラスト |
| 10 | FINAL |

ACT バッジ（`#act-badge`）のみを表示する。旧 ACT バナー DOM / CSS / `maybeShowActBanner()` は削除済み。

## 勝敗判定

`enterTurnEnd()` の優先順:

1. 双方 HP 0 以下: `endReason = double_life0`, `winner = draw`
2. プレイヤー HP 0 以下: `endReason = player_life0`, `winner = milk`
3. みるく HP 0 以下: `endReason = milk_life0`, `winner = player`
4. `turn >= MAX_TURNS`: `endReason = turn_limit`
5. 10ターン判定では HP 高い側が勝ち、HP 同値ならノリが高い側が勝ち、ノリも同値なら draw

`resolveEnding()` の分類:

| 条件 | `ending` | タイトル |
|---|---|---|
| draw + `double_life0` | `normal` | 相打ちテキーラ |
| draw | `normal` | 読み合いドロー |
| プレイヤー敗北 + `player_life0` | `bad` | ライフ尽きた |
| プレイヤー敗北 | `bad` | 判定負け |
| みるく HP0 | `true` | 飲ませ切り勝利 |
| 10ターン HP 差勝ち | `true` | ライフ差逃げ切り |
| 10ターン ノリ差勝ち | `special` | ノリ判定勝ち |
| その他プレイヤー勝利 | `normal` | 判定勝ち |

## リザルト

`buildSummary()` が以下を集約し、`state.summary` に保存する。

- 勝敗、エンディング種別、終了理由
- 勝因/敗因/分岐点
- 最終 HP/ノリ
- 最多使用カード
- 最低 HP / 最高ノリ
- 決定打ターン
- 称号
- 実績
- 「みるくの今夜」「今夜の記録」タブ用テキスト

リザルト画面は `VERDICT_LABELS` に基づき TRUE/SPECIAL/NORMAL/BAD END を表示する。代表カード画像は決定打のプレイヤーカード、なければ最多使用カードを表示する。

## 称号

`TITLE_RULES` は上から最初に一致した 1 件を採用する。主な称号:

| ID | 名称 | 条件 |
|---|---|---|
| `final_true` | 最終ターンのTRUE | 10ターン目に TRUE |
| `perfect_life_win` | 無傷の読み勝ち | HP 満タンで勝利 |
| `milk_knockout` | 飲ませ切り勝者 | みるく HP0 |
| `life_judge_win` | ライフ差の逃亡者 | 10ターン HP 差勝ち |
| `point_judge_win` | ショット銀行 | 10ターン HP 同点からノリ差勝ち |
| `draw_title` | 同卓ドロー | draw |
| `life_zero_loss` | 飲み切らされた人 | プレイヤー HP0 |
| `triple_fake_win` | 完璧なる嘘つき | fake 3回以上かつ勝利 |
| `late_counter` | ラストの読み | 8ターン以降に watch vs fake 成功 |
| `all_cards_used` | 万能型 | 4カードすべて使用 |
| `night_survivor` | 夜の生還者 | フォールバック |

条件文の一部に「3枚全て」「両方使い切った」という表現があるが、現行実装ではカード枚数制ではなく使用回数カウントで判定している。

## 実績

`ACHIEVEMENT_RULES` は、そのプレイで条件に一致したものをすべて返す。解除済み ID は localStorage に保存される。リザルトでは新規解除がある場合は新規解除を優先し、なければ該当実績を最大 3 件表示する。

主な実績:

| ID | 名称 | 条件 |
|---|---|---|
| `ACH_LIFE_RULE_WIN` | 初勝利 | プレイヤー勝利 |
| `ACH_MILK_KO` | 飲ませ切り | みるく HP0 |
| `ACH_POINT_WIN` | 判定の支配者 | 10ターン HP 同点からノリ差勝ち |
| `ACH_PERFECT_HP` | 無傷生還 | HP 満タン勝利 |
| `ACH_COUNTER_HIT` | 見張り成功 | watch vs fake 成功 |
| `ACH_GOT_COUNTERED` | 見張られた夜 | fake vs watch を受ける |
| `ACH_FULL_COURSE` | 生存証明 | 10ターン完走 |
| `ACH_ALL_CARDS` | 全カード採用 | 4カードすべて使用 |
| `ACH_DOUBLE_COUNTER` | 完璧読み | watch vs fake 2回以上 |
| `ACH_LATE_WATCH` | 最終盤の読み | 8ターン以降に watch vs fake 成功 |

## 操作仕様

| UI | DOM | 動作 |
|---|---|---|
| 対戦開始 | `#start-btn` | `TURN_START` へ |
| TOP | `#top-btn` | 進行中は確認後、状態初期化して `INTRO` へ |
| 手札 | `.card-slot[data-card]` | `onCardTap(cardId)` |
| もう一度 | `#retry-btn` | 状態初期化して `INTRO` へ |
| Xでポスト | `#post-x-btn` | `twitter.com/intent/tweet` へ |
| リザルトタブ | `.tab-btn[data-tab]` | `setResultTab(tab)` |

進行中に TOP を押した場合は `window.confirm()` が出る。リザルト後のリトライは確認なし。

## 表情・演出

表情画像:

| キー | ファイル | 用途 |
|---|---|---|
| `tuzyou` | `assets/optimized/tuzyou.webp` | 通常 |
| `utagai` | `assets/optimized/utagai.webp` | プレイヤー低 HP、被カウンターなど |
| `bikkuri` | `assets/optimized/bikkuri.webp` | みるく低 HP、見張り成功など |
| `horoyoi` | `assets/optimized/horoyoi.webp` | プレイヤーのノリ高め、みるくのノリ増加など |
| `fuman` | `assets/optimized/fuman.webp` | みるくのノリ高め、プレイヤーのノリ大幅消費など |
| `deisui` | `assets/optimized/deisui.webp` | みるく低 HP 時の反応。将来の重酔い演出用にも保留 |

`faceFromGauges()` はターン開始時の状態表情、`faceFromDeltas()` は結果反応表情を決める。カード組み合わせごとのコピーやトーンは `MATCH_EFFECTS`、SFX テキストは `SFX_LABELS` に定義されている。手札上の「みるく」チップは表情・状態の読み筋を短文で出す。

表情が変化した際（`setCharFace()` で `img.src` が変わった時）、以下の演出が同時に発生する:

- `face-swap` クラスで `.char-art` が `scale(1.08)` バウンスアニメーション
- `EXPR_BUBBLE` マップから感情テキスト（`！` `♥` `…？` など）を取得し、`#expr-bubble` に表示（1秒でフェードアウト）

`EXPR_BUBBLE` のキーは `utagai` / `bikkuri` / `horoyoi` / `fuman` / `deisui` / `kibishi`。`tuzyou`（通常）は表示しない。

## 画像読み込み

画面で使うカード、表情、タイトルまわりの画像は `assets/optimized/` の WebP/軽量 PNG を参照する。オリジナル PNG は制作素材として残っているが、通常プレイ中の DOM/CSS/JS からは直接読まない。

`preloadImage()` は一度読んだ画像を `imageCache` に記録し、同じ画像の二重デコードを避ける。`warmGameImagesSoon()` は対戦開始時に伏せカード、通常表情、初回テル用表情、乾杯カードを先に読み、それ以外は `requestIdleCallback` で少しずつ温める。カード選択直前には、選んだカードとみるくの予定カードだけを追加で先読みする。

## DOM/ID 互換で注意する箇所

JS が直接参照する主な ID/クラス:

- `#start-btn`
- `#top-btn`
- `#hand`
- `.card-slot[data-card="toast|fake|watch|chaser"]`
- `#limit-btn`, `#limit-effect`
- `#drunk-fill`, `#sus-fill`, `#tens-fill`, `#mood-fill`
- `#drunk-value`, `#sus-value`, `#tens-value`, `#mood-value`
- `#turn-display`, `#act-badge`, `#turn-history`, `#recent-history`
- `#tell-bubble`, `#tell-hint`
- `#card-player`, `#card-milk`, `#vs-label`
- `#sfx-text`
- `#impact-layer`, `#commit-card`, `#reaction-burst`, `#match-cutin`, `#bust-cutin`
- `#result-frame`, `#result-verdict`, `#result-title-big`, `#result-title-badge`, `#result-reason`, `#result-achievements`, `#result-card-img`, `#result-pov`
- `.tab-btn[data-tab]`
- `#retry-btn`, `#post-x-btn`
- `#toast-msg`
- `#expr-bubble`（キャラ表情変化時の感情バブル）
- `#ach-modal`, `#ach-list`, `#ach-open-btn`, `#ach-close-btn`（実績一覧モーダル）

HTML 構造を変える場合は、`querySelector()` が親子関係に依存している箇所にも注意する。特に reveal caption は `flipCardEl.parentElement.querySelector('.reveal-caption')` で取得している。

## バランス意図

現行バランスは、HP とノリの交換を中心にした短期戦。

- `toast`: 無料でノリを作るが HP を失うため、序盤の選択肢拡張と終盤の自滅リスクを同時に持つ。
- `fake`: ノリ1で HP を守れるが、`watch` に当たると HP-2 で大きく崩れる。`toast` と合わせるとノリコストが実質相殺されるため、「みるくが飲む」と読んだターンは積極的に機能する。
- `watch`: ノリ2でカウンター。成功時は相手 HP-2 と自分ノリ+1、実質差分ノリ-1。空振りでも損失はノリ2に留まる。
- `chaser`: ノリ3で HP+2。生存力を大きく戻すが、勝利判定用のノリを減らす。序盤から連発できないご褒美カード寄りの位置づけ。
- 初期ノリ = 1: 1ターン目から `fake` が選べるため、序盤から択が発生する。
- 予告: 序盤は学習補助、終盤はブラフ混じりの読み合いとして機能する。
- CPU: プレイヤーの連打・直近の fake 成功・終盤の fake 可能性に対して watch を強め、さらにランダム性（ワイルドカード 10%・最終ターン 60%）で単純なパターン読みを抑制する。

## 今後の調整候補

- カード枚数制を入れるか、現行の無制限コスト制に合わせて称号文言から「使い切った」「3枚全て」を外す。
- 予告の信頼度を固定ターン制だけでなく、みるくのノリ/HP、連続行動、直前の予告的中状況に連動させる。
- 10ターン判定の負け理由をリザルトタイトルで HP 差負け/ノリ差負けに分ける。
- 実績一覧のリセット機能を追加する。
- CPU ワイルドカード（10%）や最終ターンランダム（60%）の確率を調整し、難易度バランスを最適化する。
- `#recent-history` の表示内容を拡充する（みるく側 HP/ノリ変化も含める、または展開するインタラクション）。

## 保留中の素材

- `deisui.webp` は削除せず保持する。現行ではみるく低 HP 時の反応に使いつつ、将来の重酔い演出候補として残す。

## 起動・確認

ローカル確認はリポジトリ直下で以下を実行する。

```sh
python3 -m http.server 8000
```

ブラウザで `http://localhost:8000/card-mode.html` を開く。静的ファイルのみで動作する。
