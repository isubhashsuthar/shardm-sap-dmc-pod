const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const { exec } = require('child_process');
const { generateFromTemplate } = require('./generateFromTemplate.js');

function generatePod1_1_CLI_Files({ context, pluginname, hostname, namespace, podoptions, miscoptions, PODversion, PODname, languages, version, thirdpartylibs, PODGroup }) {

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }
    const targetDir = workspaceFolders[0].uri.fsPath;
    const templateRoot = path.join(context.extensionPath, 'templates', 'pod1_1cli');
    const namespacePath = (namespace || 'company.custom.plugins').replace(/\./g, '/');
    const multiple = miscoptions ? miscoptions.includes('multiple') : false;
    const ppenabled = miscoptions ? miscoptions.includes('ppenabled') : false;
    const podOptionsStr = JSON.stringify(podoptions || []);
    const languagesStr = languages && languages.length > 0 ? JSON.stringify(languages) : JSON.stringify(['en']);
    const thirdPartyStr = thirdpartylibs && thirdpartylibs.length > 0
        ? JSON.stringify(thirdpartylibs.map(l => `3rdparty/${l}.min.js`))
        : '[]';
    const appTitle = PODname || pluginname;
    const appDescription = PODname || pluginname;

    const vars = { pluginname, hostname, namespace, namespacePath, version,
        multiple: String(multiple), ppenabled: String(ppenabled),
        podOptions: podOptionsStr, selectedLanguages: languagesStr,
        thirdPartyIncludes: thirdPartyStr,
        podDisplayName: PODname, appTitle, appDescription };

    const files = [
        'index.html', 'manifest.json', 'Component.js', 'MainView.view.xml',
        'MainView.controller.js', 'PropertyEditor.js', 'components.json',
        'models.js', 'serviceBindings.js', 'builder.properties',
        'i18n.properties', 'style.css', '.gitignore'
    ];

    files.forEach(f => {
        const src = path.join(templateRoot, f);
        if (!fs.existsSync(src)) return;
        try {
            const content = generateFromTemplate(src, vars);
            fs.writeFileSync(path.join(targetDir, f), content, 'utf-8');
        } catch (err) {
            vscode.window.showErrorMessage(`Error creating ${f}: ${err.message}`);
        }
    });

    ['package.json', 'ui5.yaml'].forEach(f => {
        const src = path.join(templateRoot, f);
        if (!fs.existsSync(src)) return;
        try {
            const content = generateFromTemplate(src, vars);
            fs.writeFileSync(path.join(targetDir, f), content, 'utf-8');
        } catch (err) {
            vscode.window.showErrorMessage(`Error creating ${f}: ${err.message}`);
        }
    });

    if (languages && languages.length > 0) {
        languages.forEach(lang => {
            ['i18n', 'builder'].forEach(prefix => {
                const src = path.join(templateRoot, 'i18n', `${prefix}_${lang}.properties`);
                if (!fs.existsSync(src)) return;
                try {
                    const content = generateFromTemplate(src, vars);
                    const i18nDir = path.join(targetDir, 'i18n');
                    fs.mkdirSync(i18nDir, { recursive: true });
                    fs.writeFileSync(path.join(i18nDir, `${prefix}_${lang}.properties`), content, 'utf-8');
                } catch (err) { /* skip missing */ }
            });
        });
    }

    vscode.window.showInformationMessage(`POD 1.1 CLI project created: ${pluginname}`);
}

function NPMInstallCLI() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;
    const targetDir = workspaceFolders[0].uri.fsPath;

    vscode.window.showInformationMessage('Running npm install for POD 1.1 CLI...');
    exec('npm install', { cwd: targetDir }, (error, stdout, stderr) => {
        if (error) {
            vscode.window.showErrorMessage(`npm install failed: ${error.message}`);
            return;
        }
        vscode.window.showInformationMessage('npm install completed.');
    });
}

module.exports = { generatePod1_1_CLI_Files, NPMInstallCLI };
