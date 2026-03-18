/*
 * SUBJECT: MIRROR — ストーリーデータ（5問構成）
 *
 * ■ 構成：
 *   prologue → q1 → q2 → q3 → interlude_1 → q4 → interlude_2 → q5
 *   → result_intro → mirror_ending
 *
 * ■ choiceId：m_q1〜m_q5
 * ■ 中継シーン：q{N}_a/b/c（text: [] で即座に自動遷移）
 * ■ interlude_1, interlude_2：呼吸のための中継テキスト
 */

const STORY = {
  suspects: [],

  chapters: [
    { id: 0, label: "導入", title: "MIRROR" },
    { id: 1, label: "問い", title: "鏡" },
    { id: 2, label: "結果", title: "鏡像" }
  ],

  scenes: {

    /* ==================== 導入 ==================== */

    prologue: {
      chapter: 0,
      text: [
        "モニターが光った。",
        "一行だけ、表示されている。",
        "「あなたの反応を記録します」",
        "正解はない。不正解もない。",
        "──はじめます。"
      ],
      next: "q1"
    },

    /* ==================== Q1：声 ==================== */

    q1: {
      chapter: 1,
      text: [
        "誰もいないはずの部屋で、自分の名前を呼ぶ声がした。"
      ],
      choices: [
        { text: "振り返る。",       next: "q1_a", choiceId: "m_q1" },
        { text: "無視する。",       next: "q1_b", choiceId: "m_q1" },
        { text: "その場を離れる。", next: "q1_c", choiceId: "m_q1" }
      ]
    },
    q1_a: { chapter: 1, text: [], next: "q2" },
    q1_b: { chapter: 1, text: [], next: "q2" },
    q1_c: { chapter: 1, text: [], next: "q2" },

    /* ==================== Q2：雨 ==================== */

    q2: {
      chapter: 1,
      text: [
        "突然の雨。軒先に一人。自分は傘を持っている。"
      ],
      choices: [
        { text: "傘を差し出す。",     next: "q2_a", choiceId: "m_q2" },
        { text: "何もせず、いる。",   next: "q2_b", choiceId: "m_q2" },
        { text: "何も言わず離れる。", next: "q2_c", choiceId: "m_q2" }
      ]
    },
    q2_a: { chapter: 1, text: [], next: "q3" },
    q2_b: { chapter: 1, text: [], next: "q3" },
    q2_c: { chapter: 1, text: [], next: "q3" },

    /* ==================== Q3：指摘 ==================== */

    q3: {
      chapter: 1,
      text: [
        "誰かが間違っている。でも場は穏やかだ。"
      ],
      choices: [
        { text: "指摘する。",     next: "q3_a", choiceId: "m_q3" },
        { text: "何も言わない。", next: "q3_b", choiceId: "m_q3" },
        { text: "話題を変える。", next: "q3_c", choiceId: "m_q3" }
      ]
    },
    q3_a: { chapter: 1, text: [], next: "interlude_1" },
    q3_b: { chapter: 1, text: [], next: "interlude_1" },
    q3_c: { chapter: 1, text: [], next: "interlude_1" },

    /* ==================== 中継1 ==================== */

    interlude_1: {
      chapter: 1,
      text: [
        "──少し、間を置く。",
        "考えている時間が、長くなっている。"
      ],
      next: "q4"
    },

    /* ==================== Q4：評価 ==================== */

    q4: {
      chapter: 1,
      text: [
        "自分の評価が、事実と違う形で広まっている。"
      ],
      choices: [
        { text: "訂正する。",   next: "q4_a", choiceId: "m_q4" },
        { text: "受け入れる。", next: "q4_b", choiceId: "m_q4" },
        { text: "距離を取る。", next: "q4_c", choiceId: "m_q4" }
      ]
    },
    q4_a: { chapter: 1, text: [], next: "interlude_2" },
    q4_b: { chapter: 1, text: [], next: "interlude_2" },
    q4_c: { chapter: 1, text: [], next: "interlude_2" },

    /* ==================== 中継2 ==================== */

    interlude_2: {
      chapter: 1,
      text: [
        "──これが、最後の問いだ。"
      ],
      next: "q5"
    },

    /* ==================== Q5：手放す ==================== */

    q5: {
      chapter: 1,
      text: [
        "守っているものを一つ手放せば、\nすべてが楽になる。",
        "それでも、手放さない理由がある。"
      ],
      choices: [
        { text: "手放す。",       next: "q5_a", choiceId: "m_q5" },
        { text: "手放さない。",   next: "q5_b", choiceId: "m_q5" },
        { text: "目を逸らす。",   next: "q5_c", choiceId: "m_q5" }
      ]
    },
    q5_a: { chapter: 1, text: [], next: "result_intro" },
    q5_b: { chapter: 1, text: [], next: "result_intro" },
    q5_c: { chapter: 1, text: [], next: "result_intro" },

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
