# subject-test

新作ノベルゲームの独立作業用プロジェクト。

`hageruya-case01` をベースにしたゲームエンジンを使用し、新しいストーリーを構築するための作業リポジトリです。

## ステータス

- 準備段階（ストーリー未着手）
- ゲームエンジン・UI・音声システムは動作可能な状態

## ファイル構成

```
subject-test/
├── index.html          … メイン HTML（UI構造・画面定義）
├── css/
│   └── style.css       … スタイルシート
├── js/
│   ├── audio.js        … 音声エンジン（Web Audio API 合成 + ファイル音声対応）
│   ├── game.js         … ゲームエンジン（画面遷移・テキスト表示・パズル・セーブ/ロード）
│   ├── story.js        … ストーリーデータ（CASE_01 ベース・差し替え予定）
│   └── story_c2.js     … ストーリーデータ（CASE_02 ベース・差し替え予定）
├── assets/
│   ├── audio/          … BGM / SE 配置用フォルダ（空でも可）
│   └── images/         … 画像配置用フォルダ
└── README.md           … このファイル
```

## 起動方法

```bash
# Python 3
python3 -m http.server 8000

# Node.js
npx serve .
```

ブラウザで `http://localhost:8000` を開く。

> `index.html` を直接開いても動作しますが、音声ファイルを配置する場合はサーバー経由を推奨します。

## 注意事項

- このリポジトリは `hageruya-case01` とは独立しています
- `hageruya-case01` 側のファイルには一切変更を加えないでください
- ストーリーデータ (`story.js`, `story_c2.js`) は今後新作用に差し替え予定です
