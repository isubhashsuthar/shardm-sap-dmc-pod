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
    const tpl = path.join(context.extensionPath, 'templates', 'pod2_0_react');
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
    write('pod.js', 'app/src/pod.js');
    write('message.js', 'app/src/message.js');
    write('index.js', 'app/src/index.js');
    write('App.js', 'app/src/App.js');
    write('index.html', 'app/public/index.html');
    write('package.json', 'app/package.json');

    vscode.window.showInformationMessage(`POD 2.0 React project created: ${pluginname}`);
}

function NPMInstall() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder found.');
        return;
    }
    const rootPath = workspaceFolders[0].uri.fsPath;
    const appPath = path.join(rootPath, 'app');
    if (!fs.existsSync(appPath) || !fs.statSync(appPath).isDirectory()) {
        vscode.window.showErrorMessage('app folder not found in workspace.');
        return;
    }
    const outputChannel = vscode.window.createOutputChannel('NPM Installer');
    outputChannel.show(true);
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Installing dependencies and building...',
        cancellable: false
    }, async (progress) => {
        try {
            progress.report({ message: 'Running npm install...' });
            outputChannel.appendLine('Running npm install...');
            await runCommandPromise('npm install', appPath, outputChannel);
            progress.report({ message: 'Running npm run build...' });
            outputChannel.appendLine('Running npm run build...');
            await runCommandPromise('npm run build', appPath, outputChannel);
            progress.report({ message: 'Build completed.' });
            outputChannel.appendLine('Build completed successfully.');
        } catch (err) {
            vscode.window.showErrorMessage(`Build failed: ${err.message}`);
            outputChannel.appendLine(`Error: ${err.message}`);
        }
    });
}

function runCommandPromise(command, cwd, outputChannel) {
    return new Promise((resolve, reject) => {
        const proc = exec(command, { cwd });
        proc.stdout.on('data', data => outputChannel.append(data.toString()));
        proc.stderr.on('data', data => outputChannel.append(data.toString()));
        proc.on('close', code => {
            if (code === 0) resolve();
            else reject(new Error(`Command "${command}" exited with code ${code}`));
        });
        proc.on('error', err => reject(err));
    });
}

module.exports = { generatePod2_0ReactFiles, NPMInstall };
