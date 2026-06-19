const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const { generateFromTemplate } = require('./generateFromTemplate.js');

function generatePod2_0UI5Files({ context, pluginname, hostname, namespace, podoptions, miscoptions, PODversion, PODname, languages, version, thirdpartylibs, PODGroup, icon, description }) {

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }
    const targetDir = workspaceFolders[0].uri.fsPath;
    const templateRoot = path.join(context.extensionPath, 'templates', 'pod2_0_ui5');
    const namespacePath = (namespace || 'company.custom.plugins').replace(/\./g, '/');

    const vars = { pluginname, namespace, namespacePath, version,
        podDisplayName: PODname || pluginname, PODGroup: PODGroup || 'Custom',
        icon: icon || 'sap-icon://locate-me-2', description: description || 'Description' };

    const files = ['extension.json', 'plugin.js', '.gitignore'];
    files.forEach(f => {
        const src = path.join(templateRoot, f);
        if (!fs.existsSync(src)) return;
        try {
            const content = generateFromTemplate(src, vars);
            const outPath = path.join(targetDir, f);
            fs.writeFileSync(outPath, content, 'utf-8');
            vscode.window.showInformationMessage(`Created: ${f}`);
        } catch (err) {
            vscode.window.showErrorMessage(`Error creating ${f}: ${err.message}`);
        }
    });

    // Copy i18n
    const i18nDir = path.join(targetDir, 'i18n');
    fs.mkdirSync(i18nDir, { recursive: true });
    const i18nSrc = path.join(templateRoot, 'i18n', 'i18n.properties');
    if (fs.existsSync(i18nSrc)) {
        const content = generateFromTemplate(i18nSrc, vars);
        fs.writeFileSync(path.join(i18nDir, 'i18n.properties'), content, 'utf-8');
    }
}

module.exports = { generatePod2_0UI5Files };
