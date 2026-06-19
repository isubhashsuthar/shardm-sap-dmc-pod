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
    const tpl = path.join(context.extensionPath, 'templates', 'pod2_0_ui5');
    const nsPath = (namespace || 'company.custom.plugins').replace(/\./g, '/');

    const v = { pluginname, namespace, namespacePath: nsPath, version,
        podDisplayName: PODname || pluginname, PODGroup: PODGroup || 'Custom',
        icon: icon || 'sap-icon://locate-me-2', description: description || 'Description' };

    const root = targetDir;

    const write = (src, dest) => {
        const fp = path.join(tpl, src);
        if (!fs.existsSync(fp)) return;
        try {
            const content = generateFromTemplate(fp, v);
            const out = path.join(root, dest);
            fs.mkdirSync(path.dirname(out), { recursive: true });
            fs.writeFileSync(out, content, 'utf-8');
        } catch (err) {
            vscode.window.showErrorMessage(`Error creating ${dest}: ${err.message}`);
        }
    };

    write('extension.json', 'extension.json');
    write('plugin.js', `plugin/${pluginname}.js`);
    write('i18n/i18n.properties', 'i18n/i18n.properties');

    if (languages && languages.length > 0) {
        const i18nOut = path.join(root, 'i18n');
        fs.mkdirSync(i18nOut, { recursive: true });
        languages.forEach(lang => {
            const src = path.join(tpl, 'i18n', `i18n_${lang}.properties`);
            if (!fs.existsSync(src)) return;
            try {
                const content = generateFromTemplate(src, v);
                fs.writeFileSync(path.join(i18nOut, `i18n_${lang}.properties`), content, 'utf-8');
            } catch (err) {
                vscode.window.showErrorMessage(`Error creating i18n/i18n_${lang}.properties: ${err.message}`);
            }
        });
    }

    vscode.window.showInformationMessage(`POD 2.0 UI5 project created: ${pluginname}`);
}

module.exports = { generatePod2_0UI5Files };
