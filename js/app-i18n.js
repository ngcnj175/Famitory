/**
 * PixelGameKit - 国際化 (i18n) システム
 */

const AppI18N = {
    currentLang: 'JPN',

    I18N: {
        // ---- ヘッダーツールバー ----
        'U001': { JPN: '新規',      ENG: 'New' },
        'U002': { JPN: 'NEW',       ENG: 'NEW' },
        'U003': { JPN: '読み込み',  ENG: 'Open' },
        'U004': { JPN: 'OPEN',      ENG: 'OPEN' },
        'U005': { JPN: '保存',      ENG: 'Save' },
        'U006': { JPN: 'SAVE',      ENG: 'SAVE' },
        'U007': { JPN: '共有',      ENG: 'Share' },
        'U008': { JPN: 'SHARE',     ENG: 'SHARE' },
        'U009': { JPN: 'プレイ',    ENG: 'Play' },
        'U010': { JPN: 'PLAY',      ENG: 'PLAY' },
        'U011': { JPN: 'ピクセル',  ENG: 'Pixel' },
        'U012': { JPN: 'PIXEL',     ENG: 'PIXEL' },
        'U013': { JPN: 'ステージ',  ENG: 'Stage' },
        'U014': { JPN: 'STAGE',     ENG: 'STAGE' },
        'U015': { JPN: 'サウンド',  ENG: 'Sound' },
        'U016': { JPN: 'BGM',       ENG: 'BGM' },
        // ---- ゲーム設定パネル ----
        'U040': { JPN: 'ゲーム設定',    ENG: 'Game Settings' },
        'U041': { JPN: 'ゲームタイトル',  ENG: 'Title' },
        'U043': { JPN: 'クリエイター',    ENG: 'Creator' },
        'U044': { JPN: 'エディットキー',  ENG: 'Edit Key' },
        'U045': { JPN: 'ステージサイズ',  ENG: 'Stage Size' },
        'U046': { JPN: '縦',              ENG: 'H' },
        'U049': { JPN: '横',              ENG: 'W' },
        'U050': { JPN: '背景色',          ENG: 'BG Color' },
        'U051': { JPN: 'なし',           ENG: 'None' },
        'U056': { JPN: 'クリア条件',      ENG: 'Clear Cond.' },
        'U057': { JPN: 'アイテム取得',    ENG: 'Collect Items' },
        'U058': { JPN: '敵ぜんめつ',      ENG: 'Defeat Enemies' },
        'U059': { JPN: 'ボス撃破',        ENG: 'Defeat Boss' },
        'U060': { JPN: 'サバイバル',      ENG: 'Survival' },
        'U061': { JPN: '制限時間',        ENG: 'Time Limit' },
        'U062': { JPN: '分',              ENG: 'min' },
        'U063': { JPN: '秒',              ENG: 'sec' },
        'U064': { JPN: 'スコア表示',      ENG: 'Show Score' },
        'U293': { JPN: 'サバイバル時間',  ENG: 'Survival Time' },
        'U294': { JPN: '制限時間',        ENG: 'Time Limit' },
        'U065': { JPN: '設定を保存',      ENG: 'Save Settings' },
        'U394': { JPN: 'サバイバルモードでは制限時間を設定してください', ENG: 'Please set a time limit for Survival mode' },
        // ---- リザルト画面 ----
        'U020': { JPN: 'いいね！',             ENG: 'Like!' },
        'U397': { JPN: 'STAGE CLEAR!',        ENG: 'STAGE CLEAR!' },
        'U398': { JPN: 'GAME OVER',           ENG: 'GAME OVER' },
        'U449': { JPN: 'PUSH START',          ENG: 'PUSH START' },
        'U450': { JPN: 'PAUSE',               ENG: 'PAUSE' },
        'U451': { JPN: 'Bダッシュ',           ENG: 'B-Dash' },
        // ---- 共有ダイアログ ----
        'U140': { JPN: 'ゲームを共有',         ENG: 'Share Game' },
        'U141': { JPN: 'リミックスOK',         ENG: 'Allow Remix' },
        'U142': { JPN: '公開中',              ENG: 'Published' },
        'U143': { JPN: '✓ コピーしました',     ENG: '✓ Copied' },
        'U144': { JPN: 'データを移動',         ENG: 'Transfer Data' },
        'U401': { JPN: 'エクスポート',         ENG: 'Export' },
        'U402': { JPN: 'インポート',           ENG: 'Import' },
        // ---- プロジェクトリストモーダル ----
        'U145': { JPN: 'もどる',              ENG: 'Back' },
        'U146': { JPN: 'データをえらぶ',       ENG: 'Select Data' },
        'U147': { JPN: 'ひらく',              ENG: 'Open' },
        'U148': { JPN: 'けす',               ENG: 'Delete' },
        'U149': { JPN: 'やめる',              ENG: 'Cancel' },
        'U370': { JPN: 'セーブデータなし',     ENG: 'No save data' },
        // ---- 新規作成モーダル ----
        'U150': { JPN: 'あたらしいゲームをつくる', ENG: 'Create New Game' },
        'U403': { JPN: 'ゲームタイトル',       ENG: 'Game Title' },
        'U151': { JPN: 'つくる',              ENG: 'Create' },
        // ---- セーブ/トースト ----
        'U167': { JPN: 'セーブしました',       ENG: 'Saved!' },
        'U172': { JPN: 'セーブ',              ENG: 'Save' },
        'U170': { JPN: 'なまえをつけてセーブ', ENG: 'Save As' },
        // ---- カラープリセット ----
        'U152': { JPN: 'カラープリセット',     ENG: 'Color Preset' },
        'U153': { JPN: 'ファミトリー',         ENG: 'Famitory' },
        'U155': { JPN: 'パステル',            ENG: 'Pastel' },
        'U157': { JPN: 'ファミコン',           ENG: 'Famicom' },
        'U159': { JPN: 'ゲームボーイ',         ENG: 'Game Boy' },
        'U161': { JPN: 'モノクロ',            ENG: 'Mono' },
        'U163': { JPN: 'ついか',              ENG: 'Add' },
        'U164': { JPN: 'おきかえ',            ENG: 'Replace' },
        'U165': { JPN: 'とじる',              ENG: 'Close' },
        // ---- 数値入力モーダル ----
        'U166': { JPN: '値を入力を',          ENG: 'Enter Value' },
        // ---- エディットキーモーダル ----
        'U174': { JPN: 'このゲームを編集するには<br>エディットキーが必要です', ENG: 'An edit key is required<br>to edit this game.' },
        'U175': { JPN: '8桁のキーを入力',       ENG: 'Enter 8-character key' },
        'U176': { JPN: '認証',               ENG: 'Verify' },
        'U179': { JPN: 'キャンセル',          ENG: 'Cancel' },
        'U444': { JPN: 'キーが一致しません',    ENG: 'Key mismatch' },
        // ---- BGMエディタ（ソング制御） ----
        'U078': { JPN: 'BGM名変更',         ENG: 'Rename BGM' },
        'U080': { JPN: 'コピー＆ペースト',     ENG: 'Copy & Paste' },
        'U081': { JPN: 'トラック',            ENG: 'Track' },
        'U082': { JPN: 'コピー範囲',          ENG: 'Copy Range' },
        'U084': { JPN: 'ペースト先',          ENG: 'Paste At' },
        'U085': { JPN: '実行',               ENG: 'Execute' },
        // ---- スプライト選択ポップアップ ----
        'U069': { JPN: 'スプライトを選択',     ENG: 'Select Sprite' },
        'U071': { JPN: '完了',               ENG: 'Done' },
        // ---- 属性選択ポップアップ ----
        'U072': { JPN: 'タイプを選択',         ENG: 'Select Type' },
        'U073': { JPN: 'プレイヤー',          ENG: 'Player' },
        'U074': { JPN: 'てき',               ENG: 'Enemy' },
        'U075': { JPN: 'ブロック・背景',       ENG: 'Block/BG' },
        'U076': { JPN: 'アイテム',            ENG: 'Item' },
        // ---- 公開確認ダイアログ ----
        'U168': { JPN: 'この作品を公開しますか？',    ENG: 'Publish this game?' },
        'U169': { JPN: 'はい',               ENG: 'Yes' },
        // ---- BGM設定 ----
        'U413': { JPN: 'ステージ',            ENG: 'Stage' },
        'U414': { JPN: '無敵',               ENG: 'Invincible' },
        'U415': { JPN: 'クリア',              ENG: 'Win' },
        'U416': { JPN: 'ゲームオーバー',       ENG: 'Game Over' },
        'U417': { JPN: 'ボス',               ENG: 'Boss' },
        'U418': { JPN: 'なし',               ENG: 'None' },
        'U419': { JPN: 'コピー',              ENG: 'Copy' },
        'U420': { JPN: 'URLをコピー',         ENG: 'Copy URL' },
        'U421': { JPN: 'Xにとうこう',         ENG: 'Post on X' },
        'U422': { JPN: 'Discordにとうこう',   ENG: 'Post on Discord' },
        'U423': { JPN: 'はじめから使える',    ENG: 'Available from start' },
        'U424': { JPN: 'てきの動き',          ENG: 'Move Type' },
        'U425': { JPN: 'ドロップ',            ENG: 'Drop Item' },
        'U426': { JPN: 'ギミック',            ENG: 'Gimmick' },
        'U427': { JPN: '種類',               ENG: 'Type' },

        // ---- タイル設定パネル (Stage Editor) ----
        'U193': { JPN: 'プレイヤー',          ENG: 'Player' },
        'U194': { JPN: 'てき',               ENG: 'Enemy' },
        'U195': { JPN: 'ブロック・背景',       ENG: 'Block/BG' },
        'U196': { JPN: 'アイテム',            ENG: 'Item' },
        'U197': { JPN: 'ゴール',              ENG: 'Goal' },
        'U198': { JPN: '基本',               ENG: 'Base' },
        'U199': { JPN: '歩き',               ENG: 'Walk' },
        'U200': { JPN: 'のぼる',             ENG: 'Climb' },
        'U201': { JPN: 'ジャンプ',            ENG: 'Jump' },
        'U202': { JPN: '攻撃',               ENG: 'Attack' },
        'U203': { JPN: '基本',               ENG: 'Base' },
        'U204': { JPN: 'ライフ',             ENG: 'Life' },
        'U205': { JPN: '変身\nアイテム',        ENG: 'Morph Item' },
        'U206': { JPN: '能力',               ENG: 'Abilities' },
        'U207': { JPN: '足の速さ',            ENG: 'Move Speed' },
        'U208': { JPN: 'ジャンプ力',          ENG: 'Jump Power' },
        'U209': { JPN: '2段ジャンプ',         ENG: 'Double Jump' },
        'U210': { JPN: 'ライフ数',            ENG: 'Life Count' },
        'U211': { JPN: '特性',               ENG: 'Traits' },
        'U212': { JPN: 'うろうろ',            ENG: 'Wander' },
        'U213': { JPN: '動かない',            ENG: 'Static' },
        'U214': { JPN: 'ぴょんぴょん',        ENG: 'Hop' },
        'U215': { JPN: 'うろぴょん',          ENG: 'Wander+Hop' },
        'U216': { JPN: '追いかけてくる',      ENG: 'Chase' },
        'U217': { JPN: 'とっしん',            ENG: 'Rush' },
        'U218': { JPN: '空中',               ENG: 'Aerial' },
        'U448': { JPN: 'はりつき',            ENG: 'Cling' },
        'U219': { JPN: 'ボスてき',            ENG: 'Boss Enemy' },
        'U220': { JPN: 'なし',               ENG: 'None' },
        'U221': { JPN: 'コイン',             ENG: 'Coin' },
        'U222': { JPN: 'むてき',             ENG: 'Invincible' },
        'U223': { JPN: 'ライフアップ',        ENG: 'Life Up' },
        'U224': { JPN: 'クリア',             ENG: 'Clear' },
        'U225': { JPN: '武器',               ENG: 'Weapon' },
        'U226': { JPN: 'ボム',               ENG: 'Bomb' },
        'U227': { JPN: 'イースターエッグ',    ENG: 'Easter Egg' },
        'U228': { JPN: '武器',               ENG: 'Weapon' },
        'U229': { JPN: '近接',               ENG: 'Melee' },
        'U230': { JPN: 'ストレート',          ENG: 'Straight' },
        'U231': { JPN: '山なり',             ENG: 'Arc' },
        'U232': { JPN: '真下に落下',          ENG: 'Drop Down' },
        'U233': { JPN: '拡散',               ENG: 'Spread' },
        'U234': { JPN: 'ブーメラン',          ENG: 'Boomerang' },
        'U235': { JPN: 'ピンボール',          ENG: 'Pinball' },
        'U236': { JPN: '回転',               ENG: 'Rotate' },
        'U237': { JPN: '速度',               ENG: 'Speed' },
        'U238': { JPN: '連射',               ENG: 'Rapid Fire' },
        'U239': { JPN: '届く距離',            ENG: 'Range' },
        'U240': { JPN: '効果音',             ENG: 'Sound FX' },
        'U241': { JPN: 'ジャンプ音',          ENG: 'Jump SFX' },
        'U242': { JPN: '攻撃音',             ENG: 'Attack SFX' },
        'U243': { JPN: 'ダメージ音',          ENG: 'Damage SFX' },
        'U244': { JPN: 'ゲット音',            ENG: 'Get SFX' },
        'U245': { JPN: '横移動',             ENG: 'Horizontal' },
        'U246': { JPN: '縦移動',             ENG: 'Vertical' },
        'U247': { JPN: '落下',               ENG: 'Fall' },
        'U248': { JPN: 'はしご',             ENG: 'Ladder' },
        'U249': { JPN: 'スプリング',          ENG: 'Spring' },
        'U250': { JPN: 'とびら',             ENG: 'Door' },
        'U251': { JPN: 'はねる力',            ENG: 'Spring Power' },
        'U252': { JPN: '当たり判定',          ENG: 'Collision' },
        'U253': { JPN: '耐久性',             ENG: 'Durability' },
        'U254': { JPN: 'カギ',               ENG: 'Key' },
        'U255': { JPN: '最大20文字',          ENG: 'Max 20 chars' },
        'U256': { JPN: 'ジャンプ01',          ENG: 'Jump01' },
        'U257': { JPN: 'ジャンプ02',          ENG: 'Jump02' },
        'U258': { JPN: 'ジャンプ03',          ENG: 'Jump03' },
        'U259': { JPN: 'ジャンプ04',          ENG: 'Jump04' },
        'U260': { JPN: 'ジャンプ05',          ENG: 'Jump05' },
        'U261': { JPN: '攻撃01',             ENG: 'Attack01' },
        'U262': { JPN: '攻撃02',             ENG: 'Attack02' },
        'U263': { JPN: '攻撃03',             ENG: 'Attack03' },
        'U264': { JPN: '攻撃04',             ENG: 'Attack04' },
        'U265': { JPN: '攻撃05',             ENG: 'Attack05' },
        'U266': { JPN: 'ダメージ_01',         ENG: 'Damage_01' },
        'U267': { JPN: 'ダメージ_02',         ENG: 'Damage_02' },
        'U268': { JPN: 'ダメージ_03',         ENG: 'Damage_03' },
        'U269': { JPN: 'ダメージ_04',         ENG: 'Damage_04' },
        'U270': { JPN: 'ダメージ_05',         ENG: 'Damage_05' },
        'U271': { JPN: 'ゲット_01',           ENG: 'Get_01' },
        'U272': { JPN: 'ゲット_02',           ENG: 'Get_02' },
        'U273': { JPN: 'ゲット_03',           ENG: 'Get_03' },
        'U274': { JPN: 'ゲット_04',           ENG: 'Get_04' },
        'U275': { JPN: 'ゲット_05',           ENG: 'Get_05' },
        'U276': { JPN: 'その他01(決定)',      ENG: 'Other01(OK)' },
        'U277': { JPN: 'その他02(キャンセル)', ENG: 'Other02(Cancel)' },
        'U278': { JPN: 'その他03(カーソル)',   ENG: 'Other03(Cursor)' },
        'U279': { JPN: 'その他04(ポーズ)',     ENG: 'Other04(Pause)' },
        'U280': { JPN: 'その他05(爆発)',       ENG: 'Other05(Explosion)' },
        'U281': { JPN: 'ダメージ',            ENG: 'Damage' },
        'U282': { JPN: 'ゲット',              ENG: 'Get' },
        'U285': { JPN: 'スプライトを登録してください', ENG: 'Please register a sprite' },
        'U286': { JPN: '複製',               ENG: 'Duplicate' },
        'U287': { JPN: '削除',               ENG: 'Delete' },
        'U288': { JPN: 'キャンセル',          ENG: 'Cancel' },
        'U177': { JPN: '複製',               ENG: 'Duplicate' },
        'U178': { JPN: '削除',               ENG: 'Delete' },
        'U179': { JPN: 'キャンセル',          ENG: 'Cancel' },
        'U180': { JPN: 'プリセットを選択してください', ENG: 'Please select a preset' },
        'U181': { JPN: '現在のパレットをおきかえますか？\nスプライトの色が変わる可能性があります。', ENG: 'Replace the current palette?\nSprite colors may change.' },
        'U183': { JPN: '最低1色は必要です',    ENG: 'At least 1 color is required' },
        'U185': { JPN: '縮小すると細かい情報が失われます。続行しますか？', ENG: 'Shrinking may lose detail. Continue?' },
        'U186': { JPN: 'これ以上削除できません', ENG: 'Cannot delete any more' },
        'U428': { JPN: '軌道',               ENG: 'Trajectory' },
        'U430': { JPN: 'カラー編集',         ENG: 'Color Edit' },
        'U431': { JPN: '現在',               ENG: 'Current' },
        'U432': { JPN: '編集中',             ENG: 'Editing' },
        'U433': { JPN: 'よく使う色',         ENG: 'Recent Colors' },
        'U452': { JPN: 'カラーパレット',     ENG: 'Color Palette' },
        'U434': { JPN: 'はい',               ENG: 'Yes' },
        'U435': { JPN: 'いいえ',             ENG: 'No' },
        'U306': { JPN: '閉じる',             ENG: 'Close' },
        'U436': { JPN: 'エディットキーをコピーしました', ENG: 'Edit key copied' },
        'U295': { JPN: '音色を選択',         ENG: 'Select Tone' },
        'U296': { JPN: 'Standard',           ENG: 'Standard' },
        'U297': { JPN: 'Standard (Short)',   ENG: 'Standard (Short)' },
        'U298': { JPN: 'Standard (FadeIn)',  ENG: 'Standard (FadeIn)' },
        'U299': { JPN: 'Sharp',              ENG: 'Sharp' },
        'U300': { JPN: 'Sharp (Short)',      ENG: 'Sharp (Short)' },
        'U301': { JPN: 'Sharp (FadeIn)',     ENG: 'Sharp (FadeIn)' },
        'U302': { JPN: 'Tremolo (高速)',     ENG: 'Tremolo (Fast)' },
        'U303': { JPN: 'Soft (Sine)',        ENG: 'Soft (Sine)' },
        'U304': { JPN: 'Power (Saw)',        ENG: 'Power (Saw)' },
        'U305': { JPN: 'Kick (ピッチ下降)',   ENG: 'Kick (Pitch Down)' },
        'U399': { JPN: 'Noise (ピッチ)',     ENG: 'Noise (Pitch)' },
        'U400': { JPN: 'Drum Kit',           ENG: 'Drum Kit' },
        'U187': { JPN: 'このスプライトを削除しますか？\n（使用されている箇所は削除されます）', ENG: 'Delete this sprite?\n(All usages will be removed.)' },
        'U188': { JPN: 'スプライトをクリアしますか？', ENG: 'Clear this sprite?' },
        'U317': { JPN: 'クリップボードが空です',   ENG: 'Clipboard is empty' },
        'U363': { JPN: '「${name}」を開きました',       ENG: 'Opened "${name}"' },
        'U365': { JPN: '「${importName}」としてインポートしました。\n今すぐ開きますか？', ENG: 'Imported as "${importName}".\nOpen now?' },
        'U366': { JPN: 'インポートしました。「開く」メニューから選択できます。', ENG: 'Imported. You can open it from the "Open" menu.' },
        'U368': { JPN: 'そのなまえは すでに つかわれています', ENG: 'That name is already in use' },
        'U369': { JPN: 'あたらしいゲームを つくりました', ENG: 'New game created!' },
        'U354': { JPN: '編集モードに切り替わりました',     ENG: 'Switched to Edit Mode' },
        'U373': { JPN: 'この作品を公開しますか？',    ENG: 'Publish this game?' },
        'U374': { JPN: '公開中の作品を更新しますか？', ENG: 'Update the published game?' },
        'U375': { JPN: 'URLが発行され、だれでもプレイできるようになります', ENG: 'A URL will be generated so anyone can play' },
        'U376': { JPN: '現在の内容で上書き保存されます', ENG: 'The current content will be overwritten' },
        'U437': { JPN: 'スコアを共有',    ENG: 'Share Score' },
        'U438': { JPN: 'もう一度',        ENG: 'Retry' },
        'U439': { JPN: 'リミックスする',  ENG: 'Remix' },
        'U440': { JPN: '編集に戻る',      ENG: 'Back to Edit' },
        'U441': { JPN: 'スコアを共有',    ENG: 'Share Score' },
        'U442': { JPN: 'もどる',          ENG: 'Back' },
        'U443': { JPN: '✓ コピーしました', ENG: '✓ Copied' },
        'U445': { JPN: 'メッセージ',      ENG: 'Message' },
        'U307': { JPN: 'これ以上削除できません', ENG: 'Cannot delete anymore' },
        'U313': { JPN: '「${songName}」を削除しますか？', ENG: 'Delete "${songName}"?' },
        'U308': { JPN: 'このBGMを削除しますか？', ENG: 'Delete this BGM?' },
        'U314': { JPN: 'Tr${trackNum}の全ノートを削除しますか？', ENG: 'Delete all notes in Tr${trackNum}?' },
        'U317': { JPN: 'クリップボードが空です',   ENG: 'Clipboard is empty' },
        'U322': { JPN: 'トラックを選択してください', ENG: 'Please select a track' },
        'U331': { JPN: 'コピー範囲を正しく設定してください', ENG: 'Please set the copy range correctly' },
        // ---- 言語切り替え ----
        'U446': { JPN: '言語を日本語に変更しました', ENG: 'Language set to Japanese' },
        'U447': { JPN: 'Language set to English', ENG: 'Language set to English' },
    },

    applyLang() {
        const lang = this.currentLang;
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const id = el.getAttribute('data-i18n');
            const entry = this.I18N[id];
            if (entry && entry[lang] !== undefined) {
                el.textContent = entry[lang];
            }
        });
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const id = el.getAttribute('data-i18n-title');
            const entry = this.I18N[id];
            if (entry && entry[lang] !== undefined) {
                el.title = entry[lang];
            }
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const id = el.getAttribute('data-i18n-placeholder');
            const entry = this.I18N[id];
            if (entry && entry[lang] !== undefined) {
                el.placeholder = entry[lang];
            }
        });
        const langLabel = document.getElementById('lang-label');
        if (langLabel) langLabel.textContent = lang;

        document.documentElement.lang = (lang === 'JPN') ? 'ja' : 'en';

        if (typeof StageEditor !== 'undefined') {
            if (StageEditor.updateBgmSelects) StageEditor.updateBgmSelects();
            if (StageEditor.isConfigOpen && StageEditor.renderConfigContent) {
                StageEditor.renderConfigContent();
            }
        }
    },

    initLangBtn() {
        const savedLang = localStorage.getItem('pgk_lang');
        if (savedLang === 'ENG') {
            this.currentLang = 'ENG';
            const btn = document.getElementById('lang-icon-btn');
            if (btn) btn.classList.add('lang-eng');
        } else {
            this.currentLang = 'JPN';
        }
        this.applyLang();

        const langBtn = document.getElementById('lang-icon-btn');
        if (!langBtn) return;
        langBtn.addEventListener('click', () => {
            if (this.currentLang === 'JPN') {
                this.currentLang = 'ENG';
                langBtn.classList.add('lang-eng');
                if (typeof App !== 'undefined' && App.showToast) {
                    App.showToast(this.I18N['U447']?.[this.currentLang] || 'Language set to English');
                }
            } else {
                this.currentLang = 'JPN';
                langBtn.classList.remove('lang-eng');
                if (typeof App !== 'undefined' && App.showToast) {
                    App.showToast(this.I18N['U446']?.[this.currentLang] || '言語を日本語に変更しました');
                }
            }
            localStorage.setItem('pgk_lang', this.currentLang);
            this.applyLang();
        });
    }
};
