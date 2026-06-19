const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const { exec } = require('child_process');
const { generateFromTemplate } = require('./generateFromTemplate.js');

function generatePod2_0ReactFiles({ context, pluginname, hostname, namespace, podoptions, miscoptions, PODversion, PODname, languages, version, thirdpartylibs, PODGroup, icon, description }) {

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }
    const targetDir = workspaceFolders[0].uri.fsPath;
    const templateRoot = path.join(context.extensionPath, 'templates', 'pod2_0_react');
    const namespacePath = (namespace || 'company.custom.plugins').replace(/\./g, '/');

    const vars = { pluginname, namespace, namespacePath, version,
        podDisplayName: PODname || pluginname, PODGroup: PODGroup || 'Custom',
        icon: icon || 'sap-icon://locate-me-2', description: description || 'Description' };

    const files = [
        'extension.json', 'plugin.js', 'pod.js', 'App.js',
        'message.js', 'index.js', 'index.html', 'package.json', '.gitignore'
    ];

    files.forEach(f => {
        const src = path.join(templateRoot, f);
        if (!fs.existsSync(src)) return;
        try {
            const content = generateFromTemplate(src, vars);
            const outPath = path.join(targetDir, f);
            const outDir = path.dirname(outPath);
            fs.mkdirSync(outDir, { recursive: true });
            fs.writeFileSync(outPath, content, 'utf-8');
            vscode.window.showInformationMessage(`Created: ${f}`);
        } catch (err) {
            vscode.window.showErrorMessage(`Error creating ${f}: ${err.message}`);
        }
    });
}

function NPMInstall() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;
    const targetDir = workspaceFolders[0].uri.fsPath;

    vscode.window.showInformationMessage('Running npm install for POD 2.0 React...');
    exec('npm install', { cwd: targetDir }, (error, stdout, stderr) => {
        if (error) {
            vscode.window.showErrorMessage(`npm install failed: ${error.message}`);
            return;
        }
        vscode.window.showInformationMessage('npm install completed. Run "npm run build" to build the React app.');
    });
}

module.exports = { generatePod2_0ReactFiles, NPMInstall };
