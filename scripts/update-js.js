const fs = require('fs');

const lines = fs.readFileSync('ui-map.md', 'utf-8').split('\n');
const targets = [];
for (const line of lines) {
    if (line.trim().startsWith('| U')) {
        const parts = line.split('|').map(p => p.trim());
        if (parts.length < 6) continue;
        const type = parts[4];
        if (type && (type.includes('JS message') || type.includes('JS action menu') || type.includes('JS object config') || type.includes('JS HTML template') || type.includes('JS dom text assign'))) {
            targets.push({
                id: parts[1],
                jpn: parts[2],
                file: parts[5],
                type: type
            });
        }
    }
}

const filesToUpdate = ['js/app.js', 'js/editor/bgm-editor.js', 'js/editor/stage-editor.js', 'js/editor/sprite-editor.js', 'js/engine/game-engine.js', 'js/share.js'];

for (const filepath of filesToUpdate) {
    if (!fs.existsSync(filepath)) continue;
    
    let content = fs.readFileSync(filepath, 'utf8');
    let modified = false;

    for (const target of targets) {
        if (!target.file || target.file !== filepath.split('/').pop()) continue;
        
        const safeJpn = target.jpn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        const replacement = `(typeof App !== 'undefined' && App.I18N['${target.id}'] ? (App.I18N['${target.id}'][App.currentLang] || '${target.jpn.replace(/'/g, "\\'")}') : '${target.jpn.replace(/'/g, "\\'")}')`;

        // Only do string replacements if we haven't already injected this target
        if (!content.includes(`App.I18N['${target.id}']`)) {
            const sqRegex = new RegExp(`'${safeJpn}'`, 'g');
            if (sqRegex.test(content)) {
                content = content.replace(sqRegex, replacement);
                console.log(`Replaced '${target.jpn}' in ${filepath}`);
                modified = true;
            }

            const dqRegex = new RegExp(`"${safeJpn}"`, 'g');
            if (dqRegex.test(content)) {
                content = content.replace(dqRegex, replacement);
                console.log(`Replaced "${target.jpn}" in ${filepath}`);
                modified = true;
            }

            const tlRegex = new RegExp(`\`${safeJpn}\``, 'g');
            if (tlRegex.test(content)) {
                content = content.replace(tlRegex, replacement);
                console.log(`Replaced \`${target.jpn}\` in ${filepath}`);
                modified = true;
            }
        }

        if (target.type && (target.type.includes('JS dom text assign') || target.type.includes('JS HTML template'))) {
             const tagRegex = new RegExp(`>\\s*${safeJpn}\\s*<`, 'g');
             if (tagRegex.test(content) && !content.includes(`data-i18n="${target.id}"`)) {
                  content = content.replace(tagRegex, ` data-i18n="${target.id}">${target.jpn}<`);
                  console.log(`Replaced >${target.jpn}< inside HTML string in ${filepath}`);
                  modified = true;
             }
        }
    }

    if (modified) {
        fs.writeFileSync(filepath, content, 'utf8');
    }
}
console.log('JS text replacement complete!');
