const fs = require('fs');

const lines = fs.readFileSync('ui-map.md', 'utf-8').split('\n');
const missing = [];
for (const line of lines) {
    if (line.trim().startsWith('| U') && !line.includes('✓')) {
        const parts = line.split('|').map(p => p.trim());
        missing.push({
            id: parts[1],
            jpn: parts[2],
            eng: parts[3],
            type: parts[4],
            file: parts[5]
        });
    }
}

// 1. Update app.js I18N map
let appJs = fs.readFileSync('js/app.js', 'utf-8');
const i18nMatch = appJs.match(/I18N:\s*\{([\s\S]*?)\},/);
if (i18nMatch) {
    let dictContent = i18nMatch[1];
    
    // Add missing words
    for (const item of missing) {
        if (!dictContent.includes("'" + item.id + "'")) {
            // escape backticks basically
            const safeJpn = item.jpn.replace(/'/g, "\\'");
            const safeEng = item.eng.replace(/'/g, "\\'");
            dictContent += `\n        '${item.id}': { JPN: '${safeJpn}', ENG: '${safeEng}' },`;
        }
    }
    
    appJs = appJs.replace(i18nMatch[1], dictContent);
    fs.writeFileSync('js/app.js', appJs, 'utf-8');
    console.log('Updated app.js dict length');
}

// 2. Update ui-map.md checkmarks
let updatedMap = '';
for (const line of lines) {
    if (line.trim().startsWith('| U') && !line.includes('✓')) {
        updatedMap += line.replace(/\|\s*$/, '| ✓ |') + '\n';
    } else {
        updatedMap += line + '\n';
    }
}
fs.writeFileSync('ui-map.md', updatedMap.trim() + '\n', 'utf-8');
console.log('Updated ui-map.md checkmarks');
