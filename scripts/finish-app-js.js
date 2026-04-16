const fs = require('fs');

const mapData = fs.readFileSync('ui-map.md', 'utf-8');
const lines = mapData.split('\n');
const targets = [];
for (const line of lines) {
    if (line.trim().startsWith('| U')) {
        const parts = line.split('|').map(p => p.trim());
        if (parts.length < 5) continue;
        targets.push({ id: parts[1], jpn: parts[2] });
    }
}
targets.sort((a,b) => b.jpn.length - a.jpn.length);

let js = fs.readFileSync('js/app.js', 'utf8');

// Separate the dictionary to preserve it
const i18nStart = js.indexOf('I18N: {');
const i18nEnd = js.indexOf('},', i18nStart) + 2;
const beforeDict = js.substring(0, i18nStart);
const dict = js.substring(i18nStart, i18nEnd);
const afterDict = js.substring(i18nEnd);

let modifiedCount = 0;
let newBefore = beforeDict;
let newAfter = afterDict;

function processContent(content) {
    for (const target of targets) {
        if (!target.jpn || target.jpn.length < 2) continue; // skip too short
        const safeJpn = target.jpn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Template literal
        const templateRegexBase = target.jpn.replace(/\$\{(.*?)\}/g, '\\$\\{(.*?)\\}');
        const tlRegex = new RegExp('[`\']' + templateRegexBase + '[`\']', 'g');
        
        content = content.replace(tlRegex, (match) => {
            if (match.includes('App.t')) return match;
            const vars = [];
            const varMatches = target.jpn.matchAll(/\$\{(.*?)\}/g);
            for (const m of varMatches) vars.push(m[1]);
            const paramObj = vars.length > 0 ? ', { ' + vars.map(v => `${v}: typeof ${v} !== 'undefined' ? ${v} : undefined`).join(', ') + ' }' : '';
            modifiedCount++;
            return `App.t('${target.id}'${paramObj})`;
        });

        // Simple literal
        const sqRegex = new RegExp(`'${safeJpn}'`, 'g');
        const dqRegex = new RegExp(`"${safeJpn}"`, 'g');
        content = content.replace(sqRegex, (match) => { modifiedCount++; return `App.t('${target.id}')`; });
        content = content.replace(dqRegex, (match) => { modifiedCount++; return `App.t('${target.id}')`; });
    }
    return content;
}

newBefore = processContent(newBefore);
newAfter = processContent(newAfter);

if (modifiedCount > 0) {
    fs.writeFileSync('js/app.js', newBefore + dict + newAfter, 'utf8');
    console.log(`Replaced ${modifiedCount} strings in app.js logi (skipping dictionary).`);
} else {
    console.log('No strings replaced in app.js.');
}
