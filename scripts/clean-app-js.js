const fs = require('fs');
let js = fs.readFileSync('js/app.js', 'utf8');

// The regex needs to be careful about escaped quotes inside the strings.
// But mostly these are simple Japanese strings.
// (typeof App !== 'undefined' && App.I18N['U\d+'] ? (App.I18N['U\d+'][App.currentLang] || '...') : '...')
const regex = /\(typeof App !== 'undefined' && App\.I18N\['U\d+'\] \? \(App\.I18N\['U\d+'\]\[App\.currentLang\] \|\| ('.*?'|\\".*?\\")\) : ('.*?'|\\".*?\\")\)/g;

// Actually, the previous replacement might have used backticks or escaped quotes.
// Let's use a simpler approach: extract the last string literal in the ternary.

js = js.replace(/\(typeof App !== 'undefined' && App\.I18N\['U\d+'\] \? \(App\.I18N\['U\d+'\]\[App\.currentLang\] \|\| (.*?) : (.*?)\)/g, (match, p1, p2) => {
    // p1 and p2 might be wrapped in quotes
    return p2.trim();
});

fs.writeFileSync('js/app.js', js, 'utf8');
console.log('Cleaned js/app.js');
