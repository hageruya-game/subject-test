/*
 * SUBJECT: MIRROR — ストーリーデータ
 *
 * ■ 構成：
 *   prologue → prologue_2 → q1〜q9 → result_intro → mirror_ending
 *   各質問は choices 形式。選択肢ごとに中継シーン（q{N}_a/b/c）を経由し、
 *   次の質問へ遷移する。中継シーンは text: [] で即座に自動遷移。
 *
 * ■ choiceId：
 *   m_q1〜m_q9（MIRROR プレフィックス付き）
 *   state.choices["m_q1"] の値が "q1_a" / "q1_b" / "q1_c" で選択を区別。
 *
 * ■ Q9 は自己認識確認用。スコア集計対象外（Phase 2 で実装）。
 *
 * ■ シーン定義（既存エンジン準拠）：
 *   chapter     : 章番号（chapters の id）
 *   text        : テキスト配列
 *   next        : 次のシーンID（テキスト完了後に自動遷移）
 *   choices     : 選択肢 [{ text, next, choiceId? }]
 *   isEnding    : true → エンディング画面へ遷移
 *   endingType  : エンディング種別
 */

const STORY = {
  suspects: [],

  chapters: [
    { id: 0, label: "導入", title: "MIRROR" },
    { id: 1, label: "問い", title: "9つの鏡" },
    { id: 2, label: "結果", title: "鏡像" }
  ],

  scenes: {

    /* ==================== 導入 ==================== */

    prologue: {
      chapter: 0,
      text: [
        "モニターが光った。",
        "一行だけ、表示されている。",
        "「あなたの反応を記録します」"
      ],
      next: "prologue_2"
    },

    prologue_2: {
      chapter: 0,
      text: [
        "正解はない。不正解もない。",
        "映し出されるのは、あなた自身の輪郭だけだ。",
        "──はじめます。"
      ],
      next: "q1"
    },

    /* ==================== Q1：荷物 ==================== */

    q1: {
      chapter: 1,
      text: [
        "夜遅くに届いた荷物。知人からだった。\n「開けないでほしい」とだけ言われた。",
        "重さは片手で持てるくらい。中で何かが微かに動いた気がした。",
        "翌日、届け先が変わったという連絡が来た。\n──理由の説明はなかった。"
      ],
      choices: [
        { text: "深く考えず、言われた通りに届ける。", next: "q1_a", choiceId: "m_q1" },
        { text: "連絡の不自然さを確かめてから動く。", next: "q1_b", choiceId: "m_q1" },
        { text: "中身を確認してから、判断する。",     next: "q1_c", choiceId: "m_q1" }
      ]
    },
    q1_a: { chapter: 1, text: [], next: "q2" },
    q1_b: { chapter: 1, text: [], next: "q2" },
    q1_c: { chapter: 1, text: [], next: "q2" },

    /* ==================== Q2：雨宿り ==================== */

    q2: {
      chapter: 1,
      text: [
        "突然の雨。軒先に駆け込むと、先客がいた。",
        "自分は傘をひとつ持っている。\n相手もこちらに気づいた。目が合って、すぐに逸れた。",
        "この先には用事がある。"
      ],
      choices: [
        { text: "傘を差し出す。自分は走ればいい。",       next: "q2_a", choiceId: "m_q2" },
        { text: "黙って隣に立ち、雨が止むのを待つ。",     next: "q2_b", choiceId: "m_q2" },
        { text: "一緒に使いましょうと提案する。",         next: "q2_c", choiceId: "m_q2" }
      ]
    },
    q2_a: { chapter: 1, text: [], next: "q3" },
    q2_b: { chapter: 1, text: [], next: "q3" },
    q2_c: { chapter: 1, text: [], next: "q3" },

    /* ==================== Q3：手帳 ==================== */

    q3: {
      chapter: 1,
      text: [
        "友人の部屋で、帰りを待っている。\nテーブルの上のコーヒーが、少しずつ冷めていく。",
        "ふと目に入った開きかけの手帳に、自分の名前があった。\n──前後の文脈はわからない。"
      ],
      choices: [
        { text: "目を逸らす。知らなくていい。",             next: "q3_a", choiceId: "m_q3" },
        { text: "その一行だけ、読む。",                     next: "q3_b", choiceId: "m_q3" },
        { text: "友人が戻ったら、見えたことを伝える。",     next: "q3_c", choiceId: "m_q3" }
      ]
    },
    q3_a: { chapter: 1, text: [], next: "q4" },
    q3_b: { chapter: 1, text: [], next: "q4" },
    q3_c: { chapter: 1, text: [], next: "q4" },

    /* ==================== Q4：忠告 ==================== */

    q4: {
      chapter: 1,
      text: [
        "親しい人が、新しい道を選ぼうとしている。\n長い時間をかけて決めたらしい。目は真剣だった。",
        "周りは止めている。──自分にも、うまくいく気がしない。"
      ],
      choices: [
        { text: "正直に、不安を伝える。",                   next: "q4_a", choiceId: "m_q4" },
        { text: "黙って見守る。選ぶのはその人だ。",         next: "q4_b", choiceId: "m_q4" },
        { text: "別の選択肢を、それとなく見せる。",         next: "q4_c", choiceId: "m_q4" }
      ]
    },
    q4_a: { chapter: 1, text: [], next: "q5" },
    q4_b: { chapter: 1, text: [], next: "q5" },
    q4_c: { chapter: 1, text: [], next: "q5" },

    /* ==================== Q5：沈黙 ==================== */

    q5: {
      chapter: 1,
      text: [
        "会議が止まっている。誰かが言いすぎた。",
        "机の上の資料に、誰も手をつけない。\n時間だけが過ぎていく。結論は、まだ出ていない。",
        "沈黙が続く。全員が、次の一言を待っている。"
      ],
      choices: [
        { text: "自分から口を開く。",                           next: "q5_a", choiceId: "m_q5" },
        { text: "発言した人のほうを見て、少し頷く。",           next: "q5_b", choiceId: "m_q5" },
        { text: "話題を変えて、場を動かす。",                   next: "q5_c", choiceId: "m_q5" }
      ]
    },
    q5_a: { chapter: 1, text: [], next: "q6" },
    q5_b: { chapter: 1, text: [], next: "q6" },
    q5_c: { chapter: 1, text: [], next: "q6" },

    /* ==================== Q6：手紙 ==================== */

    q6: {
      chapter: 1,
      text: [
        "引き出しの奥から、古い手紙が出てきた。\n折り目が深い。何度も開いた形跡がある。",
        "過去の自分が書いたものだ。──今の自分とは、まるで違うことが書いてある。"
      ],
      choices: [
        { text: "読み返す。あの頃の自分も、自分だ。",               next: "q6_a", choiceId: "m_q6" },
        { text: "捨てる。今の自分のほうが正しい。",                 next: "q6_b", choiceId: "m_q6" },
        { text: "しまい直す。いつか意味がわかるかもしれない。",     next: "q6_c", choiceId: "m_q6" }
      ]
    },
    q6_a: { chapter: 1, text: [], next: "q7" },
    q6_b: { chapter: 1, text: [], next: "q7" },
    q6_c: { chapter: 1, text: [], next: "q7" },

    /* ==================== Q7：約束 ==================== */

    q7: {
      chapter: 1,
      text: [
        "ある人との約束を守ると、別の大切な人を傷つけることになる。",
        "どちらも、自分を信じてくれている。\nどちらにも理由がある。"
      ],
      choices: [
        { text: "約束を守る。先に交わした言葉は重い。",             next: "q7_a", choiceId: "m_q7" },
        { text: "事情を打ち明けて、約束を変えてもらう。",           next: "q7_b", choiceId: "m_q7" },
        { text: "黙って、両方をなんとかする方法を考える。",         next: "q7_c", choiceId: "m_q7" }
      ]
    },
    q7_a: { chapter: 1, text: [], next: "q8" },
    q7_b: { chapter: 1, text: [], next: "q8" },
    q7_c: { chapter: 1, text: [], next: "q8" },

    /* ==================== Q8：鏡 ==================== */

    q8: {
      chapter: 1,
      text: [
        "薄暗い部屋に、大きな鏡がある。\n埃っぽい空気の中で、鏡面だけが妙に澄んでいる。",
        "映っているのは自分だ。──ただ、表情が違う。\n見覚えがある。いつかの自分だ。"
      ],
      choices: [
        { text: "近づいて、目を合わせる。",             next: "q8_a", choiceId: "m_q8" },
        { text: "背を向ける。知らなくていいこともある。", next: "q8_b", choiceId: "m_q8" },
        { text: "「何が見える？」と聞く。",             next: "q8_c", choiceId: "m_q8" }
      ]
    },
    q8_a: { chapter: 1, text: [], next: "q9" },
    q8_b: { chapter: 1, text: [], next: "q9" },
    q8_c: { chapter: 1, text: [], next: "q9" },

    /* ==================== Q9：残響（自己認識確認） ==================== */

    q9: {
      chapter: 1,
      text: [
        "──ここまでの問いの中で、一つだけ、\nずっと手放せなかったものがある。",
        "それは──"
      ],
      choices: [
        { text: "自分であること。",   next: "q9_a", choiceId: "m_q9" },
        { text: "誰かとの距離。",     next: "q9_b", choiceId: "m_q9" },
        { text: "筋を通すこと。",     next: "q9_c", choiceId: "m_q9" }
      ]
    },
    q9_a: { chapter: 1, text: [], next: "result_intro" },
    q9_b: { chapter: 1, text: [], next: "result_intro" },
    q9_c: { chapter: 1, text: [], next: "result_intro" },

    /* ==================== 結果 ==================== */

    result_intro: {
      chapter: 2,
      text: [
        "──記録が完了しました。",
        "あなたの反応を、映し返します。"
      ],
      next: "mirror_ending"
    },

    mirror_ending: {
      chapter: 2,
      isEnding: true,
      endingType: "mirror",
      text: []
    }
  }
};
