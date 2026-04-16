const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf-8');

html = html.replace('value="My Game"', 'value="My Game" data-i18n-value="U017"');
html = html.replace('>クリア<', ' data-i18n="U053">クリア<');
html = html.replace('>ゲームオーバー<', ' data-i18n="U054">ゲームオーバー<');
html = html.replace('>ボス<', ' data-i18n="U055">ボス<');
html = html.replace('title="消しゴム (Long: Clear)"', 'title="消しゴム (Long: Clear)" data-i18n-title="U096"');
html = html.replace(/>ゲームタイトル</g, ' data-i18n="U404">ゲームタイトル<');

fs.writeFileSync('index.html', html, 'utf-8');
console.log('Fixed final HTML tags.');
