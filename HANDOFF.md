# テキーラから逃げろ！— 他AI向け引き継ぎ資料

**ローカル起動**: `python3 -m http.server 8000` → `http://localhost:8000/`
**公開URL**: `https://nagopine.net/tequila-escape/`
**git管理**: あり（`main` ブランチ）

---

## ゲーム概要

コンカフェ（コンセプトカフェ）で、ピンクツインテールのキャスト「みるく」と隣り合った客（プレイヤー）が、テキーラ乾杯を10ターン切り抜けるカード対戦ゲーム。

**世界観**: みるくが毎ターン1枚カードを同時出しし、HP と P（ポイント）の増減で勝敗が決まる読み合いゲーム。「みるくの HP を削り切るか、10ターン後に HP/P 差で上回る」のが目標。

**ジャンル**: 読み合い / 心理戦 / スマホ縦画面ブラウザゲーム（外部ライブラリなし）

---

## ファイル構成

```
tequila-escape/
├── index.html               ← 公開ルート用モード選択（card-mode / party-mode）
├── card-mode.html    414行  ← カードモードのHTML（メイン）
├── card-mode.css    3288行  ← カードモードのCSS
├── card-mode.js     2041行  ← カードモードのJS（ゲームロジック全て）
├── party-mode.html          ← パーティモード
├── party-mode.css           ← パーティモードCSS
├── party-mode.js            ← パーティモードJS
├── normal-mode.html  148行  ← 通常モード（旧版・コマンド選択型）
├── main.js                  ← 通常モードのJS
├── style.css                ← 通常モードのCSS
├── CARD_MODE_SPEC.md        ← カードモード設計仕様書（詳細・最新）
├── CARD_MODE_MANUAL.md      ← カードモードユーザー向け説明書
├── HANDOFF.md               ← 本ファイル（他AI向け引き継ぎ）
└── assets/                  ← 全画像素材（下記詳細）
```

**カードモード本体を編集する場合は `card-mode.*` の3ファイルのみ触る。**

---

## assets/ 素材一覧

### キャラクター立ち絵（透過PNG・約1254×1280px・各2MB前後）

ゲーム画面中央に表示される「みるく」の表情差分。  
`card-mode.js` の `CHAR_IMAGES` オブジェクトでキーと対応。

| ファイル名 | 表情キー | 使われる場面 |
|---|---|---|
| `assets/tuzyou.png` | `tuzyou` | 通常・ゲーム開始時デフォルト |
| `assets/utagai.png` | `utagai` | プレイヤーP多め・見張り警戒時 |
| `assets/bikkuri.png` | `bikkuri` | 乾杯テル・見張り成功/失敗の演出 |
| `assets/horoyoi.png` | `horoyoi` | みるくHP余裕あり・飲んだフリテル |
| `assets/fuman.png` | `fuman` | みるくHP低め |
| `assets/deisui.png` | `deisui` | プレイヤーHP危機的・終盤など |
| `assets/kibishi.png` | `kibishi` | ファイナルターン・危機演出 |

各表情には `EXPR_BUBBLE` で吹き出し文字（`…？` `！` `♥` `…` `ふわ` `！！`）が対応し、`setCharFace()` 呼び出し時に `.expr-bubble` 要素へ表示される。

### イントロ画面専用キャラ（タイトル画面のみ）

| ファイル名 | 説明 |
|---|---|
| `assets/intro_milk.png` | AI生成・銀ショートボブ・赤ゴスロリ衣装・カード1枚持ち（1024×1536px RGBA） |
| `assets/intro_milk_crop.png` | 上記から左側透過余白160pxをトリミングした版（864×1475px）← **HTMLで実際に使っているのはこちら** |

### カード画像（縦長PNG・約1060×1484px・3MB前後）

**自分側（`ware_`プレフィックス）**: 手札スロット・フリップカード・イントロプレビューに使用  
**みるく側（`aite_`プレフィックス）**: みるくのフリップカードに使用  
**裏面（`_ura`）**: フリップ前の伏せ状態

| カードID | 自分側 | みるく側 | 表示名 |
|---|---|---|---|
| `toast` | `assets/ware_nomu.PNG` | `assets/aite_nomu.PNG` | 乾杯する |
| `fake` | `assets/ware_fake.PNG` | `assets/aite_fake.PNG` | 飲んだフリ |
| `watch` | `assets/ware_kanshi.PNG` | `assets/aite_kanshi.PNG` | 見張る |
| `chaser` | `assets/ware_tyeisa-.PNG` | `assets/aite_yosumi.PNG` | チェイサー |
| (裏面) | `assets/ware_ura.PNG` | `assets/aite_ura.PNG` | — |

### 背景

| ファイル名 | 説明 |
|---|---|
| `assets/bg.png` | 暗いコンカフェ系背景（パーティモードで使用） |

---

## ゲームシステム詳細

### HP と P（初期値）

| 項目 | 初期値 | 最大値 | 意味 |
|---|---:|---:|---|
| HP | 5 | 5 | なくなると負け |
| P | 1 | 8 | カード使用コスト。最初から1あるため1ターン目から fake/watch を選択可能 |

### カード効果

| カードID | コスト | 基本効果 | 備考 |
|---|---:|---|---|
| toast（乾杯する） | 0P | 自分 HP-1 / 自分 P+1 | コスト0で必ず選べる |
| fake（飲んだフリ） | 1P | HP を減らさずターンを流す | vs toast 成立時 P+1 ボーナス |
| watch（見張る） | 2P | 相手が fake なら 相手 HP-2 / 自分 P+1 | 外すと 2P 消費のみ |
| chaser（チェイサー） | 2P | 自分 HP+2 | HP 満タン時は選べない |

#### 特殊な組み合わせ効果

| プレイヤー→みるく | 結果 |
|---|---|
| watch → fake | 見張り成功。みるく HP-2 / プレイヤー P+1 |
| fake → watch | 大バレ。プレイヤー HP-2 / みるく P+1 |
| fake → toast | 隙を突いた。プレイヤー P+1（コスト相殺） |
| toast → toast | 両者 HP-1 / P+1 |
| chaser → chaser | 両者 HP+2 |

`resolveBattleTurn()` で計算。コスト先払い後に効果適用。

### 勝敗判定

| 条件 | 結果 |
|---|---|
| みるく HP≤0 | プレイヤー勝利（TRUE END「飲ませ切り勝利」） |
| 10ターン後、プレイヤー HP > みるく HP | プレイヤー勝利（TRUE END「ライフ差逃げ切り」） |
| 10ターン後、HP 同点 かつ プレイヤー P > みるく P | プレイヤー勝利（SPECIAL END「ポイント判定勝ち」） |
| プレイヤー HP≤0 | BAD END「ライフ尽きた」 |
| 10ターン後、みるく HP または P ≥ プレイヤー | BAD END「判定負け」 |
| HP も P も同点 | NORMAL END（ドロー） |

### ターンの流れ（FSM）

```
INTRO
  → [対戦開始ボタン]
TURN_START（HUD更新・みるく表情設定）
  → TELL_PHASE（みるくのセリフ・ヒント表示）
  → CARD_SELECT（プレイヤーがカードを選ぶ）
  → COMMIT（確定演出）
  → REVEAL（両カードをフリップ）
  → RESOLVE（HP/P 計算・SFX表示）
  → TURN_END（勝敗チェック → 次ターンまたは fadeToResult()）
RESULT（エンディング・称号・実績表示）
```

`fadeToResult()` はブラック幕フェードイン後に `setState('RESULT')` を呼ぶ。直接 setState せずこの関数を経由する。

### アニメーション定数（`card-mode.js` 上部）

| 定数 | 値 | 意味 |
|---|---:|---|
| `FLIP_MS` | 580 | カードフリップにかかるミリ秒 |
| `REVEAL_HOLD_MS` | 1200 | リベール後の静止時間 |
| `TELL_HOLD_MS` | 180 | テルバブル表示後の待機 |
| `COMMIT_MS` | 400 | コミット演出の長さ |
| `ACT_BANNER_MS` | 640 | ACT バナー表示時間 |
| `POINT_MAX` | 8 | P の上限 |

`enterReveal()` では危機度に応じて静止時間を動的変更（HP≤1 なら +1100ms など）。

### テル（みるくのヒント）システム

毎ターン開始時、みるくが「次に出すカード」をほのめかす。信頼度はターンが進むにつれて下がる。

| ターン | 信頼度表示 | 正直な確率 |
|---|---|---:|
| 1-3 | 信頼度 高 | 80% |
| 4-7 | 信頼度 中 | 70% |
| 8-9 | 信頼度 低 | 55% |
| 10 | 信頼度 博打 | 45% |

| テル種別 | セリフ | 予測 |
|---|---|---|
| glass（watch） | 「グラス、減ってないなぁ……」 | 見張るかも |
| excite（toast） | 「ねぇ、もっといこ？！」 | 乾杯かも |
| bored（chaser） | 「ふぅ……」 | チェイサーかも |
| playful（fake） | 「次は……どうしよっかな？」 | 飲んだフリかも |

### AI（みるくのカード選択）

`pickMilkCard()` で実装。基本は重み付きランダム。以下で調整：

| 状況 | 傾向 |
|---|---|
| みるく P 少ない | toast 重み増加 |
| みるく HP 低い | fake / chaser 重み増加 |
| プレイヤー P ≥ 2 | watch 重み増加 |
| プレイヤー P ≥ 4 | watch をさらに強化 |
| 同カードを2ターン連続 | watch 重み増加 |
| ターン8以降かつプレイヤーが fake 可能 | watch 重み増加 |
| 直近2ターン以内に fake → toast（P+1）成立 | watch を大幅強化（記憶） |
| 常に10%の確率で | 重みに関係なく完全ランダム（ワイルドカード） |
| ターン10 | 約60%の確率で完全ランダム |

### エンディング種別

| 種別 | 主な条件 |
|---|---|
| TRUE END | みるく HP0 / 10ターン後 HP 差で勝利 |
| SPECIAL END | 10ターン後 HP 同点かつ P 差で勝利 |
| NORMAL END | ドロー（HP・P 完全同点） |
| BAD END | プレイヤー HP0 / 判定負け |

---

## 画面構成（card-mode.html）

### 1. イントロ画面（`#intro-screen`）

```
[左半分] intro_milk_crop.png（キャラ大きく）
[右上]   スピーチバブル「みるくと駆け引き勝負！♥」
[右下]   タイトル「テキーラから / 逃げろ！」+ CARD MODE バッジ
[スクロール可能エリア]
  - コピー文「みるくと同時にカードを出して…」
  - カード4枚プレビュー（ware_*.PNG縦型・4列）
  - ルールメモ（HP/P/乾杯/飲んだフリ/見張る/チェイサー説明）
[画面下固定]
  - 「対戦開始！」ボタン（#start-btn）
  - 「🏆 実績一覧」ボタン（#ach-open-btn）
```

### 2. ゲーム画面（`#game-screen`）

```
[HUD] みるく HP / プレイヤー HP / プレイヤー P / みるく P（4ゲージ）
      + TURN表示 + ACTバッジ + #turn-history（ターンアイコン列）
[直近履歴] #recent-history（直近3ターンのカード組合せとHP増減）
[ステージ上] みるく立ち絵（表情差分・#char-art）
            + 表情吹き出し（#expr-bubble）
            + テルバブル（#tell-bubble / #tell-hint）
[テーブル]  YOUR CARD フリップ ｜ せーの！｜ MILK フリップ + #sfx-text
[手札] 4種カード（コスト・残P表示付き、選択不能なものはグレーアウト）
```

### 3. リザルト画面（`#result-screen`）

```
[結果枠]
  - BAD/NORMAL/SPECIAL/TRUE END バッジ
  - 称号大文字
  - タブ4つ: 「事実」/ 「履歴」/ 「モノローグ」/ 「みるく視点」
  - 実績バッジ（新解除分・最大3件）
[アクション] もう一度（#retry-btn）/ 「Xでポスト」（SNSシェア）
```

### 4. 実績モーダル（`#ach-modal`）

```
タイトル画面の「🏆 実績一覧」ボタンで開く
解除済み実績はカード表示、未解除は「？？？」でロック表示
#ach-close-btn で閉じる
```

---

## CSS変数（`:root`）

```css
--pink:       #FF2D6F   /* メインピンク */
--pink-deep:  #D4005A   /* 濃いピンク */
--yellow:     #FFE600   /* 黄色アクセント */
--gold:       #F7C75F   /* ゴールド */
--wine:       #3E1230   /* ダークワイン */
--white:      #FFFDF7   /* クリーム白 */
--text:       #1A1A1A   /* テキスト黒 */
--font-en:    'Bagel Fat One'     /* Google Fonts・英字装飾 */
--font-jp:    'Zen Maru Gothic'   /* Google Fonts・日本語 */
```

---

## 編集時の厳守ルール

1. **`card-mode.js` のゲームロジックは変更しない** ことを前提に HTML/CSS を触る場合、以下のセレクタ・IDは壊してはいけない：
   - `#start-btn`（対戦開始ボタン）
   - `#ach-open-btn`, `#ach-modal`, `#ach-close-btn`, `#ach-list`（実績モーダル）
   - `#hand`（手札セクション）
   - `.card-slot[data-card="toast|fake|watch|chaser"]`（手札スロット）
   - `#player-life-fill`, `#milk-life-fill`（HP ゲージバー）
   - `#player-point-fill`, `#milk-point-fill`（P ゲージバー）
   - `#player-life-val`, `#milk-life-val`（HP 数値）
   - `#player-point-val`, `#milk-point-val`（P 数値）
   - `#turn-display`, `#act-badge`（ターン・ACT表示）
   - `#turn-history`（ターン履歴アイコン列）
   - `#recent-history`（直近3ターン履歴）
   - `#char-art`（キャラ画像）
   - `#expr-bubble`（表情吹き出し）
   - `#card-player`, `#card-milk`（フリップカード）
   - `#tell-bubble`, `#tell-hint`（テルUI）
   - `#sfx-text`（SFX表示）
   - `#result-frame`, `#result-verdict`, `#result-title-big`（リザルト）
   - `#retry-btn`（リトライボタン）
   - `.tab-btn[data-tab="objective|history|monologue|cast"]`（リザルトタブ）

2. **`assets/ware_*.PNG` `assets/aite_*.PNG` `assets/*.png` を削除しない**

3. **`:root` の CSS 変数を削除しない**（ゲーム画面・リザルト画面が共有）

4. **`#game-screen` と `#result-screen` のHTML構造を変更するときはJS仕様を必ず確認**

5. **ターゲットはスマホ縦画面** `width: min(100%, 460px)` が `#app` の最大幅。最小幅320pxまで対応。

6. **`prefers-reduced-motion` 対応** を壊さないこと。

7. **party-mode.* には未コミットの変更が存在する可能性がある** — `card-mode.*` のみを staging してコミットすること。

---

## カードモードで使っていない素材（削除不要・今後の拡張用）

- `assets/bg.png` — ゲーム背景（パーティモードで使用）
- `assets/milk.png` — 別ポーズの立ち絵（通常モード時代の素材）
- `assets/intro_milk.png` — トリミング前の元画像（`intro_milk_crop.png` の元データ）
