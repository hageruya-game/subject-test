# SUBJECT: MIRROR — シーン構成 & ID 設計

## シーンID 一覧

```
prologue          導入①：状況提示
prologue_2        導入②：問いの提示「あなたが守っているものは？」
q1                Q1 シーン（テキスト + 3択）
q2                Q2
q3                Q3
q4                Q4
q5                Q5
q6                Q6
q7                Q7
q8                Q8
q9                Q9（自己認識確認用）
result_intro      結果導入テキスト
mirror_ending     結果表示 → エンディング（isEnding: true）
```

## フロー図

```
タイトル画面
  ↓ 「はじめから」
ブートシーケンス（名前入力）← 既存エンジンそのまま
  ↓
prologue → prologue_2
  ↓
q1 → q2 → q3 → q4 → q5 → q6 → q7 → q8 → q9
  ↓
result_intro → mirror_ending
```

- 全シーンは一本道（分岐なし、next で直列）
- 各質問シーンの choices は全て同じ next を持つ（次の質問へ進む）
- 分岐は発生しない。選んだ内容は choiceId で記録されるだけ

---

## choiceId 命名ルール

### 基本ルール

```
m_q{N}
```

| 要素 | 意味 |
|------|------|
| `m_` | MIRROR プレフィックス（旧作の choiceId と衝突しない） |
| `q{N}` | 質問番号（1〜9） |

### 例

| choiceId | 意味 |
|----------|------|
| `m_q1` | Q1 の回答記録 |
| `m_q2` | Q2 の回答記録 |
| ... | ... |
| `m_q8` | Q8 の回答記録 |
| `m_q9` | Q9 の回答記録（自己認識用） |

### 記録される値

エンジンの仕様により `state.choices["m_q1"] = "q2"` のように **選んだ next が値**になる。
しかし MIRROR では全選択肢の next が同じ（次の質問へ進む）ため、
next だけでは「何を選んだか」が区別できない。

**解決策：next を選択肢ごとに分ける**

```javascript
q1: {
  chapter: 1,
  text: ["..."],
  choices: [
    { text: "選択肢A", next: "q1_a", choiceId: "m_q1" },
    { text: "選択肢B", next: "q1_b", choiceId: "m_q1" },
    { text: "選択肢C", next: "q1_c", choiceId: "m_q1" }
  ]
},
// 中継シーン（テキストなし、即座に次へ）
q1_a: { chapter: 1, text: [], next: "q2" },
q1_b: { chapter: 1, text: [], next: "q2" },
q1_c: { chapter: 1, text: [], next: "q2" },
```

これにより:
- `state.choices["m_q1"]` の値が `"q1_a"` / `"q1_b"` / `"q1_c"` で区別できる
- 後の集計で `"q1_a"` → スコア加点マップを引ける
- 中継シーンは text が空なので一瞬で通過する

### 中継シーンIDの命名

```
q{N}_a    選択肢A を選んだ時の中継
q{N}_b    選択肢B を選んだ時の中継
q{N}_c    選択肢C を選んだ時の中継
```

---

## Q9 の区別

Q9 は `choiceId: "m_q9"` で統一。
集計関数側で `m_q9` を判定対象から除外し、`selfImage` として別保存する。

```javascript
// 集計時
var selfImage = state.choices["m_q9"];  // "q9_a" / "q9_b" / "q9_c"
// m_q1 〜 m_q8 のみスコア加算
```

コード上は choiceId の形式は同じだが、集計ロジックで `m_q9` だけ扱いが違う。
設計メモの `MIRROR_SCORES` マップに `m_q9` を含めなければよい。

---

## 全シーンID 一覧（確定版）

| シーンID | 種別 | 説明 |
|----------|------|------|
| `prologue` | 導入 | 状況提示 |
| `prologue_2` | 導入 | 問いの提示 |
| `q1` | 質問 | Q1 本体 |
| `q1_a` | 中継 | Q1 選択A → q2 へ |
| `q1_b` | 中継 | Q1 選択B → q2 へ |
| `q1_c` | 中継 | Q1 選択C → q2 へ |
| `q2` | 質問 | Q2 本体 |
| `q2_a` | 中継 | Q2 選択A → q3 へ |
| `q2_b` | 中継 | Q2 選択B → q3 へ |
| `q2_c` | 中継 | Q2 選択C → q3 へ |
| ... | ... | (Q3〜Q7 同様) |
| `q8` | 質問 | Q8 本体 |
| `q8_a` | 中継 | Q8 選択A → q9 へ |
| `q8_b` | 中継 | Q8 選択B → q9 へ |
| `q8_c` | 中継 | Q8 選択C → q9 へ |
| `q9` | 質問 | Q9（自己認識確認） |
| `q9_a` | 中継 | Q9 選択A → result_intro へ |
| `q9_b` | 中継 | Q9 選択B → result_intro へ |
| `q9_c` | 中継 | Q9 選択C → result_intro へ |
| `result_intro` | 結果導入 | 集計前テキスト |
| `mirror_ending` | 終了 | isEnding: true |

合計: 2 (導入) + 9×4 (質問+中継) + 2 (結果) = **40 シーン**

---

## story.js 差し替え時の注意点

1. **prologue が初期シーン**
   - game.js の `createInitialState()` で `currentScene: "prologue"` がデフォルト
   - 既存と同じ ID なのでそのまま動く

2. **chapters 配列の id は 0 始まり**
   - エンジンが `chapters[scene.chapter]` で参照するため、
     各シーンの `chapter` 値と chapters 配列の index を一致させる

3. **story_c2.js はそのまま残す**
   - `<script src="js/story_c2.js">` で読み込まれるが、
     CASE_02 が起動されなければ影響しない
   - 削除すると `STORY_C2 is not defined` エラーの可能性がある
   - Phase 1 では触らない

4. **suspects 配列は空にする**
   - MIRROR では容疑者システムを使わない
   - `suspects: []` にすればエンジン側でエラーにならない

5. **中継シーンの text は空配列**
   - `text: []` にすると `onTextComplete()` が即座に呼ばれ、
     `next` で次のシーンへ自動遷移する（既存動作で確認済み）

6. **isEnding のシーンで endingType を指定**
   - `endingType: "mirror"` を指定すれば、
     showEnding() 内で分岐追加するまでは NORMAL END 相当で表示される
   - Phase 2 で showEnding() に MIRROR 用分岐を追加する
