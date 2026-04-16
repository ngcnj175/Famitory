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

// NOTE: We EXCLUDE app.js to avoid breaking the dictionary definition lines themselves.
const filesToUpdate = ['js/editor/bgm-editor.js', 'js/editor/stage-editor.js', 'js/editor/sprite-editor.js', 'js/engine/game-engine.js', 'js/share.js'];

for (const filepath of filesToUpdate) {
    if (!fs.existsSync(filepath)) continue;
    
    let content = fs.readFileSync(filepath, 'utf8');
    let modified = false;

    // Sort targets by length descending to avoid partial matches
    targets.sort((a,b) => b.jpn.length - a.jpn.length);

    for (const target of targets) {
        // We match even if it's not marked as being in this file in ui-map, just in case
        
        const safeJpn = target.jpn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Handle Template Literals with variables
        // We look for something like `...${name}...` matching target.jpn
        // Match: ` ... ` where the inner content matches target.jpn with placeholders
        // e.g. target.jpn: 「${name}」を開きました
        // Regex: `「\${(.*?)}」を開きました`
        
        const templateRegexBase = target.jpn.replace(/\$\{(.*?)\}/g, '\\$\\{(.*?)\\}');
        const tlRegex = new RegExp('`' + templateRegexBase + '`', 'g');
        
        if (tlRegex.test(content) && !content.includes(`App.t('${target.id}'`)) {
            // Extract the variable names to pass to App.t
            // For 「${name}」を開きました, we want to produce App.t('U363', { name: name })
            const vars = [];
            const varMatches = target.jpn.matchAll(/\$\{(.*?)\}/g);
            for (const m of varMatches) vars.push(m[1]);
            
            const paramObj = '{ ' + vars.map(v => `${v}: typeof ${v} !== 'undefined' ? ${v} : undefined`).join(', ') + ' }';
            const replacement = `App.t('${target.id}', ${paramObj})`;
            
            content = content.replace(tlRegex, replacement);
            console.log(`Replaced template literal for '${target.jpn}' in ${filepath}`);
            modified = true;
        }

        // Handle simple string literals (if haven't already replaced with App.t)
        if (!content.includes(`App.t('${target.id}'`) && !content.includes(`App.I18N['${target.id}']`)) {
            const sqRegex = new RegExp(`'${safeJpn}'`, 'g');
            const dqRegex = new RegExp(`"${safeJpn}"`, 'g');
            
            const simpleReplacement = `App.t('${target.id}')`;
            
            if (sqRegex.test(content)) {
                content = content.replace(sqRegex, simpleReplacement);
                console.log(`Replaced '${target.jpn}' in ${filepath}`);
                modified = true;
            } else if (dqRegex.test(content)) {
                content = content.replace(dqRegex, simpleReplacement);
                console.log(`Replaced "${target.jpn}" in ${filepath}`);
                modified = true;
            }
        }
    }

    if (modified) {
        fs.writeFileSync(filepath, content, 'utf8');
    }
}
console.log('JS text replacement complete!');
