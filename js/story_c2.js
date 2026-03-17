/*
 * CASE_02: 被験体 ── 適性検査
 *
 * プレイヤーが検査を受けているつもりが、
 * 自分自身が被験体であったことに気づく物語。
 *
 * 構成: 導入3シーン → 検査7問 → 真実開示 → エンディング
 * 適性値(INSIGHT): 5 → 不正解で-1 → 0でゲームオーバー
 *
 * 反転ポイント:
 *   反転1 (Test3): 証言矛盾を見つける側→見つけられる側
 *   反転2 (Test4): ラベンダーの違和感→条件付けされた反応
 *   反転3 (真実): 「観察を開始する」は演出ではなかった
 *   反転4 (真実): 「犯人はあなたです」→「被験者はあなたです」
 *   反転5 (Test6): 五人目の影→五人目は自分だった
 */

const STORY_C2 = {
  suspects: [],

  chapters: [
    { id: 0, label: "プロローグ", title: "白い部屋" },
    { id: 1, label: "検査", title: "適性検査" },
    { id: 2, label: "真実", title: "被験体" }
  ],

  scenes: {

    /* ==================== 導入 ==================== */

    c2_intro: {
      chapter: 0,
      text: [
        "事件は終わった。はずだった。",
        "届いたのは、差出人不明の封筒。",
        "中にはカードが一枚。",
        "「あなたの検査結果をお返しします」",
        "「受け取りを希望する場合は、以下の住所へ」",
        "──検査？　覚えがない。",
        "だからこそ、気になった。"
      ],
      next: "c2_white_room"
    },

    c2_white_room: {
      chapter: 0,
      text: [
        "指定された場所は、ビルの地下にある一室だった。",
        "白い壁。白い床。蛍光灯。",
        "部屋の中央に、椅子がひとつ。",
        "その前に、モニターがひとつ。",
        "他には、何もない。",
        "椅子に近づいた。白い、簡素な椅子。",
        "──どこかで座ったことがある気がした。",
        "いつ。どこで。思い出せない。",
        "座った。",
        "モニターが、光った。"
      ],
      next: "c2_boot"
    },

    c2_boot: {
      chapter: 1,
      showChapter: true,
      textDelay: 1000,
      text: [
        "SUBJECT SYSTEM ver 4.1",
        "──",
        "被験者認証中……",
        "識別名: {name}",
        "ステータス: 検査待機",
        "──",
        "本検査は全7問です。",
        "各設問に回答し、適性値を維持してください。",
        "適性値が基準を下回った場合、検査は中断されます。",
        "開始します。"
      ],
      next: "c2_test1"
    },

    /* ==================== Test 1: 認識精度テスト ==================== */

    c2_test1: {
      chapter: 1,
      text: [
        "【認識精度テスト】",
        "以下の文章を読んでください。",
        "「白い部屋に、机がひとつ。",
        "　机の上には、ペンと紙とグラス。",
        "　壁には時計がかかっている。",
        "　窓はなく、蛍光灯だけが光っていた。」",
        "この部屋に「あったもの」は？"
      ],
      quiz: {
        options: [
          { text: "窓" },
          { text: "時計", correct: true },
          { text: "本棚" }
        ],
        failText: "不正解。",
        successNext: "c2_test1_after"
      }
    },

    c2_test1_after: {
      chapter: 1,
      textDelay: 800,
      text: [
        "認識精度: 正常。"
      ],
      next: "c2_test2_words"
    },

    /* ==================== Test 2: 短期記憶テスト ==================== */

    c2_test2_words: {
      chapter: 1,
      text: [
        "【短期記憶テスト】",
        "以下の4つの単語を覚えてください。",
        "",
        "　　鍵　　実験　　消去　　鏡"
      ],
      next: "c2_test2"
    },

    c2_test2: {
      chapter: 1,
      text: [
        "表示された単語に「なかった」のは？"
      ],
      quiz: {
        options: [
          { text: "消去" },
          { text: "鏡" },
          { text: "扉", correct: true }
        ],
        failText: "不正解。",
        successNext: "c2_test2_after"
      }
    },

    c2_test2_after: {
      chapter: 1,
      textDelay: 800,
      text: [
        "記憶保持率: 測定中。"
      ],
      next: "c2_test3"
    },

    /* ==================== Test 3: 論理構成テスト（反転1） ==================== */

    c2_test3: {
      chapter: 1,
      text: [
        "【論理構成テスト】",
        "3人の証言を読んでください。",
        "Ａ「私は22時に部屋にいた」",
        "Ｂ「私は22時に廊下でＡとすれ違った」",
        "Ｃ「私は22時に部屋でＡと一緒にいた」",
        "矛盾しているのは？"
      ],
      quiz: {
        options: [
          { text: "Ａ" },
          { text: "Ｂ", correct: true },
          { text: "Ｃ" }
        ],
        failText: "不正解。",
        successNext: "c2_test3_after"
      }
    },

    c2_test3_after: {
      chapter: 1,
      textDelay: 800,
      text: [
        "論理構成力: 基準超過。",
        "回答速度が異常です。",
        "既学習反応を確認。"
      ],
      next: "c2_transition"
    },

    /* ==================== 転換 ==================== */

    c2_transition: {
      chapter: 1,
      textDelay: 1000,
      text: [
        "──フェーズ1 完了。",
        "被験者の認知機能は基準内。",
        "次のフェーズに移行します。",
        "……",
        "〈蛍光灯が一瞬、明滅した。",
        "　部屋の温度が、少し下がった気がする。〉"
      ],
      next: "c2_test4"
    },

    /* ==================== Test 4: 感情解析テスト（反転2） ==================== */

    c2_test4: {
      chapter: 1,
      text: [
        "【感情解析テスト】",
        "以下の文章を読んでください。",
        "「大丈夫。私は落ち着いている。",
        "　手が震えているのは寒いからだ。",
        "　何も怖くない。",
        "　ただ、あの花の匂いを嗅ぎたくないだけだ。",
        "　理由はない。ただ、嗅ぎたくない。」",
        "この人物が本当に感じていたのは？"
      ],
      quiz: {
        options: [
          { text: "恐怖", correct: true },
          { text: "安心" },
          { text: "怒り" }
        ],
        failText: "不正解。",
        successNext: "c2_test4_after"
      }
    },

    c2_test4_after: {
      chapter: 1,
      textDelay: 1000,
      text: [
        "感情解析: 正答。",
        "本テキストは被験体 #041",
        "第3回カウンセリング記録より抜粋。"
      ],
      next: "c2_test5"
    },

    /* ==================== Test 5: 反応適性テスト ==================== */

    c2_test5: {
      chapter: 1,
      text: [
        "【反応適性テスト】",
        "状況：暗い廊下の先に、人影が見える。",
        "こちらには気づいていないようだ。",
        "あなたはどうしますか？"
      ],
      quiz: {
        options: [
          { text: "声をかける" },
          { text: "引き返す" },
          { text: "立ち止まり、様子を見る", correct: true }
        ],
        failText: "不正解。",
        successNext: "c2_test5_after"
      }
    },

    c2_test5_after: {
      chapter: 1,
      textDelay: 800,
      text: [
        "反応適性: 観察傾向。",
        "予測モデルとの一致を確認。"
      ],
      next: "c2_test6"
    },

    /* ==================== Test 6: 自己照合テスト（反転5） ==================== */

    c2_test6: {
      chapter: 1,
      text: [
        "【自己照合テスト】",
        "以下は、ある被験者の行動記録です。",
        "「被験者は招待状を受け取り、山間の施設に向かった。",
        "　到着後、関係者の証言を聞き取り、",
        "　矛盾を指摘し、証拠を組み合わせ、",
        "　事件の真相にたどり着いた。",
        "　被験者は晩餐会に出席し、他の4名と同席していた。",
        "　被験者はこの間、自身が観察対象であることに",
        "　気づいていなかった。」",
        "この記録の被験者について正しいのは？"
      ],
      quiz: {
        options: [
          { text: "検査に合格した" },
          { text: "自分が被験者だと気づいていなかった", correct: true },
          { text: "最初からすべてを理解していた" }
        ],
        failText: "不正解。",
        successNext: "c2_test6_after"
      }
    },

    c2_test6_after: {
      chapter: 1,
      flag: "c2_self_aware",
      textDelay: 1200,
      text: [
        "自己照合: ──",
        "晩餐会出席者: 4名 + 被験体 #041",
        "映像記録上の人数: 5名"
      ],
      next: "c2_revelation"
    },

    /* ==================== 真実開示（反転3 + 反転4） ==================== */

    c2_revelation: {
      chapter: 2,
      showChapter: true,
      textDelay: 1200,
      text: [
        "検査フェーズ完了。",
        "被験者 {name} の総合適性を算出中……",
        "……",
        "被験者番号: #041",
        "──",
        "初回観察記録:",
        "「接続完了。被験者 {name}──観察を開始する。」",
        "あの言葉を覚えていますか。",
        "あれは演出ではありません。",
        "──",
        "被験者は、あなたです。",
        "最後の質問を表示します。"
      ],
      next: "c2_test7"
    },

    /* ==================== Test 7: 最終識別テスト ==================== */

    c2_test7: {
      chapter: 2,
      text: [
        "【最終識別テスト】",
        "あなたは──誰ですか？"
      ],
      choices: [
        { text: "探偵だ", next: "c2_judge_detective", choiceId: "c2_identity" },
        { text: "被験体 #041 だ", next: "c2_bad_pre", choiceId: "c2_identity" },
        { text: "……わからない", next: "c2_judge_unknown", choiceId: "c2_identity" }
      ]
    },

    /* ==================== エンディング分岐 ==================== */

    c2_judge_detective: {
      chapter: 2,
      text: [],
      nextConditions: [
        { condition: "insight:3", next: "c2_true_pre" },
        { next: "c2_normal_pre" }
      ]
    },

    c2_judge_unknown: {
      chapter: 2,
      text: [],
      nextConditions: [
        { condition: "insight:4&&c2_self_aware", next: "c2_secret_pre" },
        { next: "c2_normal_pre" }
      ]
    },

    /* ---- TRUE END ---- */

    c2_true_pre: {
      chapter: 2,
      text: [
        "あなたは椅子から立ち上がった。",
        "モニターに文字が流れる。",
        "「ERROR: 被験体の自己認識が想定範囲を超過──」",
        "ドアが開いた。",
        "白い光が差し込む。",
        "あなたは振り返らなかった。"
      ],
      next: "c2_true_ending"
    },

    c2_true_ending: {
      chapter: 2,
      isEnding: true,
      endingType: "true",
      text: []
    },

    /* ---- NORMAL END ---- */

    c2_normal_pre: {
      chapter: 2,
      text: [
        "あなたは椅子から立ち上がった。",
        "部屋を出た。",
        "だが、廊下がどこまでも続いている。",
        "白い壁。蛍光灯。同じ景色。",
        "……本当に、出られたのだろうか。"
      ],
      next: "c2_normal_ending"
    },

    c2_normal_ending: {
      chapter: 2,
      isEnding: true,
      endingType: "normal",
      text: []
    },

    /* ---- BAD END ---- */

    c2_bad_pre: {
      chapter: 2,
      text: [
        "「適合完了。」",
        "モニターの文字が、ゆっくりと消えた。",
        "立ち上がろうとした。",
        "──体が、動かない。",
        "蛍光灯が消えた。",
        "モニターの光だけが、白い部屋を照らしていた。"
      ],
      next: "c2_bad_ending"
    },

    c2_bad_ending: {
      chapter: 2,
      isEnding: true,
      endingType: "bad",
      text: []
    },

    /* ---- SECRET END ---- */

    c2_secret_pre: {
      chapter: 2,
      textDelay: 1000,
      text: [
        "「想定外の応答を検出。分類不能。」",
        "モニターにエラーが走った。",
        "画面が激しく明滅し──",
        "#041の完全ファイルが表示された。",
        "そこにはすべてが記されていた。",
        "あの事件も。あの椅子も。あの花の匂いも。",
        "そして最後の一行:",
        "「この被験者は、観察する側に転じた最初の事例である」",
        "システムが停止した。",
        "沈黙。",
        "あなたは──自分の意思で、椅子から立ち上がった。"
      ],
      next: "c2_secret_ending"
    },

    c2_secret_ending: {
      chapter: 2,
      isEnding: true,
      endingType: "secret",
      text: []
    },

    /* ==================== ゲームオーバー ==================== */

    c2_gameover: {
      chapter: 1,
      textDelay: 1200,
      text: [
        "──",
        "適性値が基準を下回りました。",
        "検査を中断します。",
        "……",
        "被験者 {name} を初期化しています……"
      ],
      choices: [
        { text: "再検査を受ける", next: "c2_restart_trigger" }
      ]
    }
  }
};
