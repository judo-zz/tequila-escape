# テキーラから逃げろ！— 他AI向け引き継ぎ資料

**ローカル起動**: `python3 -m http.server 8000` → `http://localhost:8000/`  
**公開URL**: `https://judo-zz.github.io/tequila-escape/`  
**git管理**: あり（`main` ブランチ）  

---

## ゲーム概要

コンカフェ（コンセプトカフェ）で、ピンクツインテールのキャスト「みるく」と隣り合った客（プレイヤー）が、テキーラ乾杯を10ターン切り抜けるカード対戦ゲーム。

**世界観**: みるくが毎ターン1枚カードを同時出しし、その組み合わせ（4×4=16パターン）でゲージが増減する。「飲みすぎず・疑われすぎず・空気を冷やさず・みるくのノリを上げながら」10ターン生き残るのが目標。

**ジャンル**: 読み合い / 心理戦 / スマホ縦画面ブラウザゲーム（外部ライブラリなし）

---

## ファイル構成

```
tequila-escape/
├── index.html              ← 公開ルート用モード選択（card-mode / party-mode）
├── card-mode.html   317行  ← カードモードのHTML（メイン）
├── card-mode.css   1671行  ← カードモードのCSS
├── card-mode.js     829行  ← カードモードのJS（ゲームロジック全て）
├── normal-mode.html 148行  ← 通常モード（旧版・コマンド選択型）
├── main.js                 ← 通常モードのJS
├── style.css               ← 通常モードのCSS
├── GAME_GUIDE.md           ← カードモードのゲーム内ガイド文書
├── README.md               ← 通常モードの仕様書
└── assets/                 ← 全画像素材（下記詳細）
```

**カードモード本体を編集する場合は `card-mode.*` の3ファイルのみ触る。** `index.html` は公開ルートのモード選択、`party-mode.*` はパーティモード、`normal-mode.html / main.js / style.css` は通常モード（旧版）。

---

## assets/ 素材一覧

### キャラクター立ち絵（透過PNG・約1254×1280px・各2MB前後）

ゲーム画面中央に表示される「みるく」の表情差分。  
`card-mode.js` の `CHAR_IMAGES` オブジェクトでキーと対応。

| ファイル名 | 表情キー | 使われる場面 |
|---|---|---|
| `assets/tuzyou.png` | `tuzyou` | 通常・ゲーム開始時デフォルト |
| `assets/utagai.png` | `utagai` | 疑惑が高いとき / テル「グラス見てる」 |
| `assets/bikkuri.png` | `bikkuri` | フリ見破り / 乾杯テル |
| `assets/horoyoi.png` | `horoyoi` | みるくMOOD高いとき / テル「飲んだフリかも」 |
| `assets/fuman.png` | `fuman` | 空気が冷えたとき / MOOD低下時 |
| `assets/deisui.png` | `deisui` | プレイヤー酔い≥50 |
| `assets/milk.png` | (未使用) | 別ポーズ、通常モード用だった |

### イントロ画面専用キャラ（タイトル画面のみ）

| ファイル名 | 説明 |
|---|---|
| `assets/intro_milk.png` | AI生成・銀ショートボブ・赤ゴスロリ衣装・カード1枚持ち（1024×1536px RGBA） |
| `assets/intro_milk_crop.png` | 上記から左側透過余白160pxをトリミングした版（864×1475px）← **HTMLで実際に使っているのはこちら** |

### カード画像（縦長PNG・約1060×1484px・3MB前後）

**自分側（`ware_`プレフィックス）**: 手札スロット・フリップカード・イントロプレビューに使用  
**みるく側（`aite_`プレフィックス）**: みるくのフリップカードに使用  
**裏面（`_ura`）**: フリップ前の伏せ状態

| カードID | 自分側 | みるく側 | 表示名 | 効果 |
|---|---|---|---|---|
| `toast` | `assets/ware_nomu.PNG` | `assets/aite_nomu.PNG` | 乾杯する / リード乾杯 | 酔いUP・疑惑DOWN |
| `fake` | `assets/ware_fake.PNG` | `assets/aite_fake.PNG` | 飲んだフリ / 軽くフリ | バレると大事故 |
| `watch` | `assets/ware_kanshi.PNG` | `assets/aite_kanshi.PNG` | 見張る / ガン見 | フリをカウンター |
| `chaser` | `assets/ware_tyeisa-.PNG` | `assets/aite_yosumi.PNG` | チェイサー / 一服 | 酔いDOWN・場冷え |
| (裏面) | `assets/ware_ura.PNG` | `assets/aite_ura.PNG` | — | フリップ前の伏せ面 |

### 背景

| ファイル名 | 説明 |
|---|---|
| `assets/bg.jpg` | 1080×1920 JPEG・暗いコンカフェ系背景（現在のカードモードでは未使用） |

---

## ゲームシステム詳細

### 手札構成（固定）

| カード | 枚数 | 戦略的役割 |
|---|---|---|
| 乾杯する | ×4 | 安定して疑惑を下げる。酔いが上がるリスクあり |
| 飲んだフリ | ×3 | 酔いを増やさないが「見張る」にカウンターされると大ダメージ |
| 見張る | ×2 | みるくの「飲んだフリ」を捕捉。空気が冷えるリスク |
| チェイサー | ×2 | 酔いを下げる回復カード。乱用すると場が冷える |

### ゲージ（初期値）

| ゲージ | 初期値 | 敗北条件 |
|---|---|---|
| 酔い（drunk） | 0 | **≥75** で即敗北 |
| 疑惑（sus） | 20 | **≥100** で即敗北 |
| 空気（tens） | 60 | **≤0** で即敗北 |
| みるくMOOD | 0 | **≥75** で即勝利（SPECIAL END） |

### ターンの流れ（FSM）

```
INTRO
  → [対戦開始ボタン]
TURN_START（HUD更新・みるく表情設定）
  → TELL_PHASE（みるくがセリフを出す・1.6秒）
  → CARD_SELECT（プレイヤーが手札を選ぶ）
  → REVEAL（両カードをフリップ）
  → RESOLVE（MATRIXでゲージ計算・SFX表示）
  → TURN_END（敗北/勝利チェック → 次ターンまたはRESULT）
RESULT（エンディング表示・スコアコピー）
```

### MATRIX（カード組み合わせの効果値）

`MATRIX[playerCard][milkCard] = {D, S, T, M}` で定義（ACT乗数適用前）

- D = 酔い変化、S = 疑惑変化、T = 空気変化、M = MOOD変化
- ACT乗数: ACT1(T1-3)=×0.75、ACT2(T4-7)=×1.0、ACT3(T8-9)=×1.35、FINAL(T10)=×1.5

代表的な組み合わせ（×ACT乗数）:

| プレイヤー→みるく | 大きな影響 |
|---|---|
| fake → watch | S+30（バレ！疑惑大幅上昇） |
| watch → fake | S-22（カウンター成功・疑惑大幅減） |
| toast → toast | D+14 M+10（両者乾杯・酔いとMOOD上昇） |
| chaser → chaser | D-15 T-12（回復するが場が冷える） |

### テル（みるくのヒント）システム

毎ターン開始時、みるくが「次に出すカード」を70%の確率で正直にほのめかす（30%は嘘）。

| テル種別 | セリフ | アイコン | 予測 |
|---|---|---|---|
| glass（watch） | 「グラス、減ってないなぁ……」 | 👀 | 見張るかも |
| excite（toast） | 「ねぇ、もっといこ？！」 | 🙂 | 乾杯かも |
| bored（chaser） | 「ふぅ……」 | 💧 | 様子見かも |
| playful（fake） | 「次は……どうしよっかな？」 | 💇‍♀️ | 飲んだフリかも |

### AI（みるくのカード選択）

基本はランダム重み付け（各1）。以下で調整：
- プレイヤーが同じカードを2ターン以上連続で使っていたら `watch` を大幅強化
- ターン8以降・プレイヤーのfake残2枚以上で `watch` 強化

### エンディング一覧

| 種別 | タイトル | 条件 |
|---|---|---|
| BAD END | 無事終電消失 | 酔い≥75 |
| BAD END | グラス見られおじさん | 疑惑≥100 |
| BAD END | 空気破壊おじさん | 空気≤0 |
| SPECIAL END | 乾杯の支配者 | MOOD≥75（途中勝利） |
| TRUE END | みるくの夜になった | 10ターン生存 + MOOD≥60 + 疑惑<40 |
| SPECIAL END | 素面の策士 | 10ターン生存 + 酔い<30 |
| SPECIAL END | 自然体の逃亡者 | 10ターン生存 + 疑惑<30 |
| NORMAL END | 夜の生還者 | 10ターン生存（上記条件なし） |

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
  - ルールメモ（♥ 酔いすぎず ♥ 疑われすぎず ♥ 空気を冷やさず）
[画面下固定] 「対戦開始！」ボタン（常時表示）
```

### 2. ゲーム画面（`#game-screen`）

```
[HUD] 酔い / 疑惑 / 空気 / みるく の4ゲージ + TURN表示 + ACTバッジ
[ステージ上] みるく立ち絵（表情差分） + テルバブル + ヒントカード
[テーブル]  YOUR CARD フリップ ｜ せーの！｜ MILK フリップ + SFX文字
[手札] 4種カード × 4列縦型（ware_*.PNG画像・枚数バッジ・使い切りで売切）
```

### 3. リザルト画面（`#result-screen`）

```
[結果枠]
  - BAD/NORMAL/SPECIAL/TRUE END バッジ
  - 称号大文字
  - タブ3つ: 「事実」（最終ゲージ等）/ 「モノローグ」/ 「みるく視点」
  - カード画像（決定打のカード）
[アクション] もう一度 / 結果をコピー（SNS用テキスト）
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
   - `#hand`（手札セクション）
   - `.card-slot[data-card="toast|fake|watch|chaser"]`（手札スロット）
   - `.card-count`（枚数バッジ）
   - `#drunk-fill`, `#sus-fill`, `#tens-fill`, `#mood-fill`（ゲージバー）
   - `#drunk-value`, `#sus-value`, `#tens-value`, `#mood-value`（ゲージ数値）
   - `#turn-display`, `#act-badge`（ターン・ACT表示）
   - `#char-art`（キャラ画像）
   - `#card-player`, `#card-milk`（フリップカード）
   - `#tell-bubble`, `#tell-hint`（テルUI）
   - `#sfx-text`（SFX表示）
   - `#result-frame`, `#result-verdict`, `#result-title-big`, `#result-pov`（リザルト）
   - `#retry-btn`, `#copy-btn`（リトライ・コピーボタン）
   - `.tab-btn[data-tab="objective|monologue|cast"]`（リザルトタブ）

2. **`assets/ware_*.PNG` `assets/aite_*.PNG` `assets/*.png` を削除しない**

3. **`:root` の CSS 変数を削除しない**（ゲーム画面・リザルト画面が共有）

4. **`#game-screen` と `#result-screen` のHTML構造を変更するときはJS仕様を必ず確認**

5. **ターゲットはスマホ縦画面** `width: min(100%, 460px)` が `#app` の最大幅。最小幅320pxまで対応。

6. **`prefers-reduced-motion` 対応** を壊さないこと。

---

## カードモードで使っていない素材（削除不要・今後の拡張用）

- `assets/bg.jpg` — ゲーム背景（現在のカードモードでは未使用）
- `assets/milk.png` — 別ポーズの立ち絵（通常モード時代の素材）
- `assets/intro_milk.png` — トリミング前の元画像（`intro_milk_crop.png` の元データ）
