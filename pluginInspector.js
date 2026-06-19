const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

async function inspectWorkspace() {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) return [];

  const plugins = [];
  const entries = await fs.promises.readdir(root, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.')) continue;
    const pluginPath = path.join(root, entry.name);
    const config = await detectPlugin(pluginPath);
    if (config) {
      plugins.push({ name: entry.name, path: pluginPath, config });
    }
  }

  return plugins;
}

async function detectPlugin(folderPath) {
  const files = await getFileTree(folderPath);
  const folderName = path.basename(folderPath);

  // POD 2.0 React — has extension.json + app/ + app/package.json with react
  if (files.has('extension.json')) {
    try {
      const extPath = path.join(folderPath, 'extension.json');
      const extJson = JSON.parse(await fs.promises.readFile(extPath, 'utf-8'));

      if (files.has('app/package.json')) {
        const appPkg = JSON.parse(await fs.promises.readFile(path.join(folderPath, 'app', 'package.json'), 'utf-8'));
        const deps = { ...appPkg.dependencies, ...appPkg.devDependencies };
        if (deps.react || deps['react-scripts']) {
          return await buildReactConfig(folderPath, extJson, folderName);
        }
      }

      if (!files.has('app/package.json') || !files.has('app/src')) {
        return await buildUI5Config(folderPath, extJson, folderName);
      }
    } catch { return null; }
  }

  // POD 1.1 — has designer/ + Plugin.js
  if (files.has('Plugin.js') || files.has('designer')) {
    return await buildPOD1_1Config(folderPath, folderName);
  }

  // POD 1.1 CLI — has ui5.yaml + package.json
  if (files.has('ui5.yaml') && files.has('package.json')) {
    const pkg = JSON.parse(await fs.promises.readFile(path.join(folderPath, 'package.json'), 'utf-8'));
    if (pkg.devDependencies?.ui5) {
      return await buildPOD1_1CLIConfig(folderPath, folderName);
    }
  }

  // POD 1.0 — has webapp/ + package.json
  if (files.has('webapp') && files.has('package.json')) {
    try {
      const webappPath = path.join(folderPath, 'webapp');
      const subdirs = await fs.promises.readdir(webappPath, { withFileTypes: true });
      for (const sub of subdirs) {
        if (sub.isDirectory()) {
          const subPath = path.join(webappPath, sub.name);
          const subFiles = await getFileTree(subPath);
          if (subFiles.has('Plugin.js')) {
            return await buildPOD1_0Config(folderPath, sub.name, folderName);
          }
        }
      }
    } catch { return null; }
  }

  return null;
}

async function buildReactConfig(folderPath, extJson, folderName) {
  const config = {
    pluginname: folderName,
    PODversion: 'POD 2.0 React',
    PODname: extJson.title || capitalize(folderName),
    namespace: extJson.namespace || 'custom.plugins',
    podoptions: extractPodOptions(extJson),
    miscoptions: extractMiscOptions(extJson),
    languages: extractLanguages(folderPath),
    thirdpartylibs: [],
    PODGroup: extJson.group || 'Custom',
    icon: extJson.icon || 'sap-icon://locate-me-2',
    description: extJson.description || '',
    version: extJson.version || '0.0.1',
    hostname: ''
  };

  const appPkg = tryReadJSON(path.join(folderPath, 'app', 'package.json'));
  if (appPkg) {
    const deps = { ...appPkg.dependencies, ...appPkg.devDependencies };
    if (deps.lodash) config.thirdpartylibs.push('lodash');
    if (deps.moment) config.thirdpartylibs.push('moment');
    if (deps['socket.io'] || deps['socket.io-client']) config.thirdpartylibs.push('socket.io');
    if (deps.mqtt) config.thirdpartylibs.push('mqtt');
    if (deps['date-fns']) config.thirdpartylibs.push('date-fns');
  }

  return config;
}

async function buildUI5Config(folderPath, extJson, folderName) {
  const config = {
    pluginname: folderName,
    PODversion: 'POD 2.0 UI5',
    PODname: extJson.title || capitalize(folderName),
    namespace: extJson.namespace || 'custom.plugins',
    podoptions: extractPodOptions(extJson),
    miscoptions: extractMiscOptions(extJson),
    languages: extractLanguages(folderPath),
    thirdpartylibs: [],
    PODGroup: extJson.group || 'Custom',
    icon: extJson.icon || 'sap-icon://locate-me-2',
    description: extJson.description || '',
    version: extJson.version || '0.0.1',
    hostname: ''
  };
  return config;
}

async function buildPOD1_1Config(folderPath, folderName) {
  const config = {
    pluginname: folderName,
    PODversion: 'POD 1.1',
    PODname: capitalize(folderName),
    namespace: 'custom.plugins',
    podoptions: ['OPERATION'],
    miscoptions: [],
    languages: extractLanguages(folderPath),
    thirdpartylibs: [],
    PODGroup: 'Custom',
    icon: 'sap-icon://locate-me-2',
    description: '',
    version: '0.0.1',
    hostname: ''
  };

  try {
    const pluginJsPath = path.join(folderPath, 'Plugin.js');
    if (fs.existsSync(pluginJsPath)) {
      const content = await fs.promises.readFile(pluginJsPath, 'utf-8');
      const nsMatch = content.match(/this\.namespace\s*=\s*['"]([^'"]+)['"]/);
      if (nsMatch) config.namespace = nsMatch[1];
    }
  } catch {}

  return config;
}

async function buildPOD1_1CLIConfig(folderPath, folderName) {
  return {
    pluginname: folderName,
    PODversion: 'POD 1.1 CLI',
    PODname: capitalize(folderName),
    namespace: 'custom.plugins',
    podoptions: ['OTHER'],
    miscoptions: ['ppenabled'],
    languages: ['en'],
    thirdpartylibs: [],
    PODGroup: 'Custom',
    icon: 'sap-icon://locate-me-2',
    description: '',
    version: '0.0.1',
    hostname: ''
  };
}

async function buildPOD1_0Config(folderPath, pluginSubdir, folderName) {
  return {
    pluginname: folderName,
    PODversion: 'POD 1.0',
    PODname: capitalize(folderName),
    namespace: 'custom.plugins',
    podoptions: ['OPERATION'],
    miscoptions: [],
    languages: extractLanguages(path.join(folderPath, 'webapp', pluginSubdir)),
    thirdpartylibs: [],
    PODGroup: 'Custom',
    icon: 'sap-icon://locate-me-2',
    description: '',
    version: '0.0.1',
    hostname: ''
  };
}

async function getFileTree(dir) {
  const files = new Set();
  async function walk(current) {
    let entries;
    try { entries = await fs.promises.readdir(current, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      const full = path.join(current, e.name);
      const rel = path.relative(dir, full).replace(/\\/g, '/');
      files.add(rel);
      if (e.isDirectory()) await walk(full);
    }
  }
  await walk(dir);
  return files;
}

function extractLanguages(folderPath) {
  const langs = ['en'];
  try {
    const i18nPath = path.join(folderPath, 'i18n');
    if (fs.existsSync(i18nPath)) {
      const files = fs.readdirSync(i18nPath);
      for (const f of files) {
        const m = f.match(/i18n_(\w+)\.properties/);
        if (m && m[1] !== 'en') langs.push(m[1]);
      }
    }
  } catch {}
  return [...new Set(langs)];
}

function extractPodOptions(extJson) {
  const types = [];
  const widgets = extJson.plugin?.widgets || extJson.widgets || [extJson];
  for (const w of widgets) {
    if (w.podType) types.push(w.podType);
    if (w.podTypes) types.push(...w.podTypes);
  }
  return types.length > 0 ? types : ['OPERATION'];
}

function extractMiscOptions(extJson) {
  const opts = [];
  if (extJson.allowMultiple) opts.push('multiple');
  if (extJson.ppEnabled) opts.push('ppenabled');
  return opts;
}

function tryReadJSON(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); }
  catch { return null; }
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

module.exports = { inspectWorkspace, detectPlugin };
