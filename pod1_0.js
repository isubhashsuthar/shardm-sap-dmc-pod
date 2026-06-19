const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const { generateFromTemplate } = require('./generateFromTemplate.js');

function generatePod1_0Files({ context, pluginname, hostname, namespace, podoptions, miscoptions, PODversion, PODname, languages, version, thirdpartylibs, PODGroup }) {

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }
    const targetDir = workspaceFolders[0].uri.fsPath;
    const tpl = path.join(context.extensionPath, 'templates', 'pod1_0');
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

    const pn = pluginname;
    const root = targetDir;

    const write = (src, dest) => {
        const fp = path.join(tpl, src);
        if (!fs.existsSync(fp)) return;
        const content = generateFromTemplate(fp, v);
        const out = path.join(root, dest);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, content, 'utf-8');
    };

    write('mta.yaml', 'mta.yaml');
    write('xs-security.json', 'xs-security.json');
    write('package.json', `${pn}/package.json`);
    write('xs-app.json', `${pn}/xs-app.json`);
    write('index.html', `${pn}/webapp/index.html`);
    write('components.json', `${pn}/webapp/designer/components.json`);
    write('Component.js', `${pn}/webapp/${pn}/Component.js`);
    write('manifest.json', `${pn}/webapp/${pn}/manifest.json`);
    write('serviceBindings.js', `${pn}/webapp/${pn}/serviceBindings.js`);
    write('PropertyEditor.js', `${pn}/webapp/${pn}/builder/PropertyEditor.js`);
    write('MainView.controller.js', `${pn}/webapp/${pn}/controller/MainView.controller.js`);
    write('style.css', `${pn}/webapp/${pn}/css/style.css`);
    write('builder.properties', `${pn}/webapp/${pn}/i18n/builder.properties`);
    write('i18n.properties', `${pn}/webapp/${pn}/i18n/i18n.properties`);
    write('models.js', `${pn}/webapp/${pn}/models/models.js`);
    write('MainView.view.xml', `${pn}/webapp/${pn}/view/MainView.view.xml`);

    if (languages && languages.length > 0) {
        const i18nOut = path.join(root, pn, 'webapp', pn, 'i18n');
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

    vscode.window.showInformationMessage(`POD 1.0 project created: ${pluginname}`);
}

module.exports = { generatePod1_0Files };
