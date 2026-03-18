# SUBJECT: MIRROR — 設計メモ

## コンセプト

- タイトル: **SUBJECT: MIRROR**
- サブコピー: その反応が、あなたです。
- 問い: あなたが守っているものは、何ですか？
- テーマ: 人は何を守るためにその選択をするのか

## 方針

- 性格を断定するゲームではない
- 反応の傾向と、守ろうとしているものを映し返す
- 9問構成（Q9 は自己認識確認用、主判定には使わない）

---

## 結果軸

### 1. 判断の軸（judgment）
| コード | 名前 | 意味 |
|--------|------|------|
| INT | 直感型 | 直感で動く |
| OBS | 観察型 | 見てから動く |
| THK | 熟考型 | 考えてから動く |

### 2. 対人距離の軸（distance）
| コード | 名前 | 意味 |
|--------|------|------|
| APP | 接近型 | 近づく |
| BND | 境界型 | 線を引く |
| LED | 主導型 | 先導する |

### 3. 守るものの軸（guard）
| コード | 名前 | 意味 |
|--------|------|------|
| SAF | 安全 | 身の安全・生存 |
| PRD | 自尊心 | 誇り・矜持 |
| REL | 関係 | 人とのつながり |
| FRM | 自由 | 束縛からの解放 |
| ORD | 秩序 | ルール・正しさ |

---

## 集計方針

- 各選択肢にスコア加点（例: `{ judgment: { INT: 1 }, guard: { SAF: 1 } }`）
- 各軸で最大値のコードを採用
- Q9 は `selfImage` として保存（判定には使わない）
- 結果は「判断軸 / 距離軸 / 守るもの」で返す（例: `OBS / BND / REL`）
- 結果文はテンプレート合成方式

### 結果テンプレート構成

```
[判断軸の説明文]
[距離軸の説明文]
[守るものの説明文]
[総合コピー]
```

各軸ごとにテンプレートを持ち、組み合わせで文章を生成する。

---

## ゲームフロー

```
タイトル画面
  ↓ 「はじめから」
ブートシーケンス（名前入力）
  ↓
導入テキスト（2-3画面）
  ↓
Q1〜Q8（各問 → 選択肢 → 次の問へ）
  ↓
Q9（自己認識確認）
  ↓
集計・結果表示
  ↓
エンディング画面
```

---

## 既存エンジンとの対応

### そのまま使える機能
| 機能 | 既存の仕組み | MIRROR での使い方 |
|------|-------------|-----------------|
| テキスト表示 | scene.text + タイプライター | 各問の状況描写 |
| 選択肢 | scene.choices + choiceId | Q1〜Q9 の回答選択肢 |
| 選択履歴 | state.choices | 各問の回答記録 |
| フラグ | state.flags | 問題通過フラグ |
| 名前入力 | ブートシーケンス | そのまま流用 |
| BGM/SE | AudioEngine | そのまま流用 |
| タイトル画面 | title-screen | 文言差し替えで流用 |
| エンディング画面 | ending-screen | 結果表示に転用 |
| メタ演出 | meta overlay | 導入/結果演出に使える |

### 差し替えが必要な部分
| 対象 | 現状 | MIRROR で必要な変更 |
|------|------|-------------------|
| story.js | CASE_01 シナリオ全体 | MIRROR の Q1〜Q9 + 導入 + 結果シーンに全面差し替え |
| story_c2.js | CASE_02 シナリオ | 削除 or 空にする（不要） |
| game.js: スコア集計 | diagnosePlayerType() | MIRROR 用の3軸スコア集計に差し替え |
| game.js: showEnding() | CASE_01/02 分岐テキスト | MIRROR 結果テンプレート合成に差し替え |
| game.js: switchToCase() | CASE_01/02 切替 | 不要（MIRROR は単一ケース） |
| game.js: state | suspicion, insight, clues 等 | mirrorScores（3軸スコア）を追加 |
| index.html: タイトル文言 | SUBJECT / CASE_01 | SUBJECT: MIRROR / サブコピー |
| index.html: 不要UI | 手がかり・疑惑・CASE切替ボタン等 | 非表示 or 削除 |

### 変更不要（そのまま維持）
- css/style.css（カラーテーマ・レイアウト・アニメーション）
- js/audio.js（音声エンジン全体）
- パーティクル演出、ビネット、ブートスプラッシュ
- セーブ/ロードの基盤（ただしスロット数やキー名は後で調整可）
- モーダル基盤（バックログ・メモは残しても良い）

---

## story.js の新構造（概要）

```javascript
const STORY = {
  // suspects は不要（空配列にする）
  suspects: [],

  chapters: [
    { id: 0, label: "導入", title: "MIRROR" },
    { id: 1, label: "検査", title: "9つの問い" },
    { id: 2, label: "結果", title: "鏡像" }
  ],

  scenes: {
    // 導入（2-3シーン）
    intro: { chapter: 0, text: [...], next: "q1" },

    // Q1〜Q8（各問: テキスト + 3択）
    q1: { chapter: 1, text: [...], choices: [
      { text: "...", next: "q2", choiceId: "q1" },  // ← choiceId で記録
      { text: "...", next: "q2", choiceId: "q1" },
      { text: "...", next: "q2", choiceId: "q1" }
    ]},
    // ...Q2〜Q8 同様...

    // Q9（自己認識確認）
    q9: { chapter: 1, text: [...], choices: [
      { text: "...", next: "result_calc", choiceId: "q9" },
      ...
    ]},

    // 結果集計 → エンディング
    result_calc: { chapter: 2, text: [...], isEnding: true, endingType: "mirror" }
  }
};
```

## game.js に追加が必要なロジック

### 1. スコア加点マップ（story.js と一緒に定義可能）

```javascript
const MIRROR_SCORES = {
  q1: {
    "q2":     { judgment: { INT: 1 }, distance: { APP: 1 }, guard: { REL: 1 } },
    "q2_alt": { judgment: { OBS: 1 }, distance: { BND: 1 }, guard: { SAF: 1 } },
    "q2_b":   { judgment: { THK: 1 }, distance: { LED: 1 }, guard: { ORD: 1 } }
  },
  // q2〜q8 同様
};
```

### 2. 集計関数

```javascript
function calcMirrorResult() {
  var scores = {
    judgment: { INT: 0, OBS: 0, THK: 0 },
    distance: { APP: 0, BND: 0, LED: 0 },
    guard:    { SAF: 0, PRD: 0, REL: 0, FRM: 0, ORD: 0 }
  };

  // state.choices から各問の選択を取り出してスコア加算
  // 各軸で最大値のコードを採用
  // Q9 は selfImage として別保存

  return {
    judgment: "OBS",   // 例
    distance: "BND",
    guard: "REL",
    selfImage: "..."   // Q9 の選択テキスト
  };
}
```

### 3. 結果テンプレート

```javascript
const MIRROR_TEMPLATES = {
  judgment: {
    INT: "あなたは直感で動く。理由は後からついてくる。",
    OBS: "あなたはまず見る。動くのは、確信を得てからだ。",
    THK: "あなたは考える。答えが出るまで、動かない。"
  },
  distance: {
    APP: "人に近づくことを恐れない。",
    BND: "適切な距離を保つことを知っている。",
    LED: "先に立ち、道を示すことを選ぶ。"
  },
  guard: {
    SAF: "あなたが守ろうとしているのは、安全だ。",
    PRD: "あなたが守ろうとしているのは、自尊心だ。",
    REL: "あなたが守ろうとしているのは、誰かとの関係だ。",
    FRM: "あなたが守ろうとしているのは、自由だ。",
    ORD: "あなたが守ろうとしているのは、秩序だ。"
  }
};
```

---

## 実装フェーズ案

### Phase 1: ストーリーデータ（story.js 差し替え）
- 導入テキスト
- Q1〜Q9 のシーン定義（テキスト + 選択肢）
- スコア加点マップ

### Phase 2: 集計ロジック（game.js 最小改修）
- mirrorScores を state に追加
- 選択肢タップ時のスコア加点処理
- calcMirrorResult() 関数
- showEnding() の MIRROR 用分岐

### Phase 3: 表示調整（index.html + style.css 最小改修）
- タイトル文言
- 不要UIの非表示
- 結果画面の表示

### Phase 4: 演出・仕上げ
- 結果画面の演出
- メタ演出の調整
- デバッグトレースの無効化
