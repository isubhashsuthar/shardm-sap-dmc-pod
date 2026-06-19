const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const { generateFromTemplate } = require('./generateFromTemplate.js');

function generatePod1_1Files({ context, pluginname, hostname, namespace, podoptions, miscoptions, PODversion, PODname, languages, version, thirdpartylibs, PODGroup }) {

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }
    const targetDir = workspaceFolders[0].uri.fsPath;
    const tpl = path.join(context.extensionPath, 'templates', 'pod1_1');
    const nsPath = (namespace || 'company.custom.plugins').replace(/\./g, '/');
    const multiple = miscoptions ? miscoptions.includes('multiple') : false;
    const ppenabled = miscoptions ? miscoptions.includes('ppenabled') : false;
    const podOpts = JSON.stringify(podoptions || []);
    const langStr = languages && languages.length > 0 ? JSON.stringify(languages) : JSON.stringify(['en']);
    const thirdParty = thirdpartylibs && thirdpartylibs.length > 0
        ? JSON.stringify(thirdpartylibs.map(l => `3rdparty/${l}.min.js`))
        : '[]';

    const v = { pluginname, hostname, namespace, namespacePath: nsPath, version,
        multiple: String(multiple), ppenabled: String(ppenabled),
        podOptions: podOpts, selectedLanguages: langStr,
        thirdPartyIncludes: thirdParty, podDisplayName: PODname,
        appTitle: PODname || pluginname, appDescription: PODname || pluginname };

    const root = targetDir;

    const write = (src, dest) => {
        const fp = path.join(tpl, src);
        if (!fs.existsSync(fp)) return;
        const content = generateFromTemplate(fp, v);
        const out = path.join(root, dest);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, content, 'utf-8');
    };

    write('index.html', 'index.html');
    write('components.json', 'designer/components.json');
    write('Component.js', 'Component.js');
    write('manifest.json', 'manifest.json');
    write('serviceBindings.js', 'serviceBindings.js');
    write('PropertyEditor.js', 'builder/PropertyEditor.js');
    write('MainView.controller.js', 'controller/MainView.controller.js');
    write('style.css', 'css/style.css');
    write('builder.properties', 'i18n/builder.properties');
    write('i18n.properties', 'i18n/i18n.properties');
    write('models.js', 'models/models.js');
    write('MainView.view.xml', 'view/MainView.view.xml');

    if (languages && languages.length > 0) {
        const i18nOut = path.join(root, 'i18n');
        fs.mkdirSync(i18nOut, { recursive: true });
        languages.forEach(lang => {
            ['i18n', 'builder'].forEach(prefix => {
                const src = path.join(tpl, 'i18n', `${prefix}_${lang}.properties`);
                if (!fs.existsSync(src)) return;
                const content = generateFromTemplate(src, v);
                fs.writeFileSync(path.join(i18nOut, `${prefix}_${lang}.properties`), content, 'utf-8');
            });
        });
    }

    vscode.window.showInformationMessage(`POD 1.1 project created: ${pluginname}`);
}

module.exports = { generatePod1_1Files };
