# Screen Map (画面・機能対応表)

このプロジェクトの各画面と、それに対応する主要なソースファイルの一覧です。

> **2025年リファクタリング進行中**
> - **stage-editor.js** を 3 つの専門クラスに分割（3,577行 → 1,741行 + 分割ファイル群）✅
>   - StageRenderer, StageTemplateManager, StageSettings, StageCanvasInput で責務を分離
>   - 選択ツール範囲削除・塗りつぶし修正・Undo（エンティティ対応）実装
> - **game-engine.js** 描画処理の分離（フェーズ4前半）✅
>   - 描画メソッド（renderGameScreen, renderLayer, renderLayerFiltered, renderSprite）を GameRenderer クラスに抽出
>   - game-engine.js: 3,000行 → 約2,660行（削除分）
> - **ピクセル描画コアの共通化（フェーズ4後半）** ✅
>   - SpriteUtils.drawPixels を新設し、StageRenderer / GameRenderer の重複ピクセルループを統合
>   - GameRenderer.renderSprite に flipX・2xスプライト対応を追加
> - **UI/エフェクト描画の分離（フェーズ5a）** ✅
>   - renderTitleScreen/renderWipe/renderClearEffect 等15メソッドを GameRenderer に移動
>   - game-engine.js: ~2660行 → 1518行
> - **物理演算・衝突判定の分離（フェーズ5b）** ✅
>   - getCollision/checkCollisions/damageTile 等13メソッドを GamePhysics に移動
>   - game-engine.js: 1518行（304行削減）、game-physics.js: 384行

| 画面名 / 機能名 | 主要ファイル (JS) | 役割 |
|---|---|---|
| 全体管理 / アプリ基盤 | `js/app.js` | 初期化、共通UI（ダイアログ、I18N）、プロジェクト管理 |
| ゲームプレイ (Play Mode) | `js/engine/game-engine.js` | ゲームループ統括・状態管理・オーディオ・スコア |
| └─ ゲーム描画 (New) | `js/engine/game-renderer.js` | 画面描画・レイヤー管理・スプライト出力・UI/エフェクト |
| └─ ゲーム物理演算 (New) | `js/engine/game-physics.js` | 衝突クエリ・エンティティ衝突・タイルダメージ・とびら処理 |
| 共通ユーティリティ (New) | `js/engine/sprite-utils.js` | スプライトピクセル描画コア（StageRenderer / GameRenderer 共有） |
| スプライトエディタ (Pixel Editor) | `js/editor/sprite-editor.js` | ドット絵作成、パレット管理、アニメーション編集 |
| ステージエディタ (Stage Editor) | `js/editor/stage-editor.js` | 中核・初期化・Undo/Redo・委譲管理 |
| └─ テンプレート管理 | `js/editor/stage-template-manager.js` | タイル/エンティティテンプレートのCRUD |
| └─ キャンバス入力 | `js/editor/stage-canvas-input.js` | マウス/タッチイベント・選択・描画ロジック |
| └─ ステージ設定 | `js/editor/stage-settings.js` | ステージサイズ・背景色・BGM設定 |
| BGMエディタ (Sound Editor) | `js/editor/bgm-editor.js` | UIロジック、シーケンサー操作 |
| BGMデータ管理 (New) | `js/editor/song-manager.js` | 楽曲データのCRUD操作、移行処理 |
| BGMオーディオエンジン (New) | `js/editor/bgm-player.js` | Web Audio API、音声合成、再生ループ、プレビュー |
| コントローラー | `js/ui/controller.js` | 仮想十字キー、ボタン入力 |
| ユーティリティ | `js/utils/firebase-config.js` | Firebase初期化・設定 |
