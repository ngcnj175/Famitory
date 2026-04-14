# 画面・ウィンドウ・ダイアログ一覧

このアプリの全画面・ウィンドウ・ダイアログの一覧です。

| ID | 画面名 | 役割（1行説明） | メインファイル名 |
|----|--------|----------------|----------------|
| S001 | ゲーム画面 (play-screen) | ゲームプレイ画面。キャンバス表示・コントローラー操作・リザルト表示 | index.html, game-engine.js |
| S002 | ピクセル画面 (paint-screen) | スプライトエディタ。ピクセル描画・ツール・パレット | index.html, sprite-editor.js |
| S003 | ステージ画面 (stage-screen) | ステージエディタ。タイル配置・ステージ設定・オブジェクト配置 | index.html, stage-editor.js |
| S004 | サウンド画面 (sound-screen) | BGMエディタ。ピアノロール・シーケンス編集・トラックミキサー | index.html, bgm-editor.js |
| S005 | リザルトオーバーレイ (result-overlay) | クリア/ゲームオーバー時のスコア表示・いいね・共有・リトライ | index.html, game-engine.js |
| S006 | 共有ダイアログ (share-dialog) | ゲーム共有・URLコピー・X/Discord投稿・エクスポート/インポート | index.html, app.js, share.js |
| S007 | プロジェクトリストモーダル (project-list-modal) | 保存済みプロジェクトの選択・開く・コピー・削除 | index.html, app.js |
| S008 | 新規作成モーダル (new-game-modal) | 新規ゲーム作成。名前入力 | index.html, app.js |
| S009 | パレットプリセットダイアログ (palette-preset-dialog) | カラープリセット選択。追加・置き換え | index.html, sprite-editor.js |
| S010 | 数値入力モーダル (number-input-modal) | BPM/STEP等の数値入力（iOSのprompt回避用） | index.html, bgm-editor.js |
| S011 | SAVEトースト (save-toast) | セーブ完了の一時通知表示 | index.html, app.js |
| S012 | 公開確認ダイアログ (publish-confirm-modal) | 作品公開の確認 | index.html, app.js |
| S013 | 名前を付けてセーブモーダル (save-as-modal) | プロジェクト名を指定して保存 | index.html, app.js |
| S014 | エディットキー入力モーダル (editkey-modal) | 共有ゲーム編集時のエディットキー認証 | index.html, app.js |
| S015 | スプライト選択ポップアップ (sprite-select-popup) | タイル設定時のスプライト選択 | index.html, stage-editor.js |
| S016 | SE選択ポップアップ (se-select-popup) | 効果音の選択 | index.html, stage-editor.js |
| S017 | BGM選択ポップアップ (bgm-select-popup) | BGM曲の選択 | index.html, stage-editor.js |
| S018 | 属性選択ポップアップ (type-select-popup) | タイル追加時の種別選択（プレイヤー・敵・素材・アイテム） | index.html, stage-editor.js |
| S019 | ソング名変更ポップアップ (song-name-popup) | BGMソングの名前変更 | index.html, bgm-editor.js |
| S020 | ソングジュークボックスモーダル (song-jukebox-modal) | サウンド画面内のソング一覧選択 | index.html, bgm-editor.js |
| S021 | 種別選択モーダル (type-select-modal) | タイル種別選択（旧UI・未使用の可能性） | index.html |
| S022 | プレイヤー設定モーダル (player-config-modal) | プレイヤータイルの詳細設定（旧UI・未使用の可能性） | index.html |
| S023 | 敵設定モーダル (enemy-config-modal) | 敵タイルの詳細設定（旧UI・未使用の可能性） | index.html |
| S024 | 素材設定モーダル (material-config-modal) | 素材タイルの詳細設定（旧UI・未使用の可能性） | index.html |
| S025 | アイテム設定モーダル (item-config-modal) | アイテムタイルの詳細設定（旧UI・未使用の可能性） | index.html |
| S026 | ゴール設定モーダル (goal-config-modal) | ゴールタイルの詳細設定（旧UI・未使用の可能性） | index.html |
| S027 | ステージ設定モーダル (stage-settings-modal) | ステージ全体設定（旧UI・未使用の可能性） | index.html |
| S028 | スプライト選択モーダル (sprite-select-modal) | スプライト選択（モーダル版・未使用の可能性） | index.html |
| S029 | ステージ設定パネル (stage-settings-panel) | ステージ画面内の折りたたみ設定パネル | index.html, stage-editor.js |
| S030 | タイル設定パネル (tile-config-panel) | ステージ画面内のインラインタイル設定パネル | index.html, stage-editor.js |
| S031 | テキスト編集ポップアップ (text-edit-popup) | 汎用テキスト編集（ゲームタイトル/作成者名など） | index.html |
| S032 | 数値コピー＆ペーストポップアップ (numcopy-popup) | サウンドパターンの指定範囲・トラック間のコピー＆ペースト | index.html, bgm-editor.js |
| S033 | ローカライズボタン (lang-icon-btn) | ヘッダー最上段に常時表示。タップでJPN/ENGを切替。data-i18n属性を持つ全要素のテキストを切替 | index.html, app.js |
