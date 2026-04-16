const fs = require('fs');

const mapData = fs.readFileSync('ui-map.md', 'utf-8');
const lines = mapData.split('\n');

const translations = [];
for (const line of lines) {
    if (line.trim().startsWith('| U')) {
        const parts = line.split('|').map(p => p.trim());
        if (parts.length < 5) continue;
        const id = parts[1];
        const jpn = parts[2];
        const eng = parts[3];
        if (id && jpn && eng) {
            translations.push({ id, jpn, eng });
        }
    }
}

let appJs = fs.readFileSync('js/app.js', 'utf-8');
const i18nMatch = appJs.match(/I18N:\s*\{[\s\S]*?\},/);

if (i18nMatch) {
    let newI18n = 'I18N: {\n';
    for (const item of translations) {
        const safeJpn = item.jpn.replace(/'/g, "\\'");
        const safeEng = item.eng.replace(/'/g, "\\'");
        newI18n += `        '${item.id}': { JPN: '${safeJpn}', ENG: '${safeEng}' },\n`;
    }
    newI18n += '    },';
    
    appJs = appJs.replace(i18nMatch[0], newI18n);
    fs.writeFileSync('js/app.js', appJs, 'utf-8');
    console.log('Successfully rebuilt I18N dictionary in app.js from ui-map.md');
} else {
    console.log('Could not find I18N block in app.js');
}

// Also clean up ui-map.md checkmarks to be consistent '| ✓ |'
let newMap = lines.map(line => {
    if (line.trim().startsWith('| U')) {
        // Remove trailing empty cells or multiple checkmarks and set to single | ✓ |
        return line.replace(/\|\s*(✓\s*|)+\|\s*$/, '| ✓ |');
    }
    return line;
}).join('\n');
fs.writeFileSync('ui-map.md', newMap, 'utf-8');
console.log('Cleaned up ui-map.md checkmarks');
