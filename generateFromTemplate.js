const fs = require('fs');

function generateFromTemplate(filePath, variables) {
    let content = fs.readFileSync(filePath, 'utf-8');
    for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        content = content.replace(regex, value !== undefined ? value : '');
    }
    return content;
}

module.exports = { generateFromTemplate };
