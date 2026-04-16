const fs = require('fs');

const lines = fs.readFileSync('ui-map.md', 'utf-8').split('\n');
const missingHTML = [];
for (const line of lines) {
    if (line.trim().startsWith('| U')) {
        const parts = line.split('|').map(p => p.trim());
        if (parts[5] === 'index.html' && parts[4].includes('HTML')) {
            missingHTML.push({
                id: parts[1],
                jpn: parts[2],
                type: parts[4]
            });
        }
    }
}

let html = fs.readFileSync('index.html', 'utf-8');

for (const item of missingHTML) {
    const { id, jpn, type } = item;
    
    // Ignore if already has this ID
    if (html.includes(`"${id}"`)) continue;
    if (jpn.length < 1) continue;

    if (type.includes('attribute (title)')) {
        html = html.replace(new RegExp(`title="${jpn}"`, 'g'), `title="${jpn}" data-i18n-title="${id}"`);
    } else if (type.includes('attribute (placeholder)')) {
        html = html.replace(new RegExp(`placeholder="${jpn}"`, 'g'), `placeholder="${jpn}" data-i18n-placeholder="${id}"`);
    } else if (type.includes('text node')) {
        // Find things like >jpn< without a data-i18n on the previous tag
        // Note: HTML might have whitespaces like >\n  jpn\n<
        // Also handling cases where jpn string is alone, we replace >jpn< with >jpn<, no wait! 
        // We'll just simple replace >jpn< with data-i18n attribute... actually doing it with regex over tags is risky.
        // A safer trick: `>${jpn}<` to ` data-i18n="${id}">${jpn}<` but we need to insert in the element.
        // Let's use a simpler regex: /([^>]*?)(>(?:\s*)${jpn}(?:\s*)<\/)/
        // Example: matching `<span class="something">なまえ</span>`
        const safeJpn = jpn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // escape regex
        const contentRegex = new RegExp(`(<[a-zA-Z0-9_-]+[^>]*?)(>\\s*${safeJpn}\\s*<\\/)`, 'g');
        const contentRegexSingle = new RegExp(`(<[a-zA-Z0-9_-]+[^>]*?)(>\\s*${safeJpn}\\s*<[a-zA-Z0-9_-]+)`, 'g');
        html = html.replace(contentRegex, (match, p1, p2) => {
            if (p1.includes('data-i18n')) return match; // already has
            return `${p1} data-i18n="${id}"${p2}`;
        });
    }
}

fs.writeFileSync('index.html', html, 'utf-8');
console.log('Updated index.html elements');
