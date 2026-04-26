# PixelGameKit - FAMITORY

ブラウザでピクセルアートゲームが作れる、フリーなゲーム制作ツールです。

## 🎮 アプリについて

**FAMITORY（ファミトリー）** は、プログラミング知識がなくても、誰でもかんたんにドット絵ゲームを制作・共有できるゲームエディタです。

### 主な機能

- **スプライトエディタ**: ドット絵キャラクターの作成・編集
- **ステージエディタ**: ゲームのステージ・マップデザイン
- **BGMエディタ**: ピアノロール形式の簡単作曲
- **ゲーム実行**: ブラウザ内でゲームプレイ
- **データ保存・共有**: 作成したゲームを URL で共有
- **マルチプラットフォーム**: PC・タブレット・スマートフォン対応

## 🚀 使い方

https://ngcnj175.github.io/Famitory/

ブラウザでアクセスするだけで、すぐにゲーム制作を開始できます。

## ⌨️ キーボード操作

ゲームプレイ時の PC キーボード操作：

- **上** ： ↑ / W
- **下** ： ↓ / S
- **左** ： ← / A
- **右** ： → / D
- **A ボタン** ： Z / J / スペース
- **B ボタン** ： X / K
- **START** ： Enter

## 🛠 技術スタック

- **フロントエンド**: Vanilla JavaScript（フレームワーク不使用）
- **キャンバス描画**: HTML5 Canvas
- **音声生成**: Web Audio API
- **データ保存**: LocalStorage + Firebase Realtime Database
- **ホスティング**: GitHub Pages
- **外部ライブラリ**:
  - [pako](https://github.com/nodeca/pako) - データ圧縮（MIT License）
  - [Firebase](https://firebase.google.com/) - データベース（Apache 2.0）

## 📋 ライセンス

このプロジェクトは著作権保護されています。

### ✅ 許可される利用
- 個人利用・学習目的での使用
- ゲーム制作・プレイ

### ❌ 禁止される利用
- 商用利用（有料販売等）
- 改変版の配布・再投稿
- 営利を目的とした改変・利用

詳細については、[作者に問い合わせ](https://github.com/ngcnj175)ください。

## 📁 プロジェクト構成

```
PixelGameKit/
├── index.html              # メインアプリケーション
├── manifest.json           # PWA設定
├── sw.js                   # Service Worker（オフライン対応）
├── js/
│   ├── app.js              # アプリケーションコア
│   ├── app-*.js            # 機能別モジュール
│   ├── editor/             # スプライト・ステージ・BGMエディタ
│   ├── engine/             # ゲームエンジン・物理演算
│   ├── ui/                 # UIコンポーネント
│   └── utils/              # ユーティリティ
├── css/
│   └── style.css           # スタイルシート
├── images/                 # アセット（アイコン等）
├── ui-map.md               # テキストID索引
└── screen-map.md           # 画面・機能対応表
```

## 📧 お問い合わせ

- GitHub: https://github.com/ngcnj175/Famitory
- 問題報告: https://github.com/ngcnj175/Famitory/issues

---

**楽しいゲーム制作を！** 🎨🎮
