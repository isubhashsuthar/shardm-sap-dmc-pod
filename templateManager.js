const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

const TEMPLATES_DIR = '.dmc-templates';
const PROJECT_FILE = '.dmc-project.json';

function getWorkspaceRoot() {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || null;
}

function getTemplatesDir() {
  const root = getWorkspaceRoot();
  return root ? path.join(root, TEMPLATES_DIR) : null;
}

function getProjectFilePath() {
  const root = getWorkspaceRoot();
  return root ? path.join(root, PROJECT_FILE) : null;
}

function ensureDir(dir) {
  if (!dir) return false;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return true;
}

function generatePreview(config) {
  const tree = [];
  const ver = config.PODversion || 'POD 1.1';
  const name = config.pluginname || 'plugin';

  if (ver === 'POD 1.0') {
    tree.push({ name: `${name}`, children: [
      { name: 'webapp', children: [
        { name: `${name}`, children: [
          { name: 'controller', children: [{ name: 'Plugin.controller.js' }] },
          { name: 'css', children: [{ name: 'Plugin.css' }] },
          { name: 'i18n', children: config.languages?.map(l => ({ name: `i18n_${l}.properties` })) || [{ name: 'i18n_en.properties' }] },
          { name: 'view', children: [{ name: 'Plugin.view.xml' }] },
          { name: 'Plugin.js' }
        ]}
      ]},
      { name: 'package.json' }
    ]});
  } else if (ver === 'POD 1.1') {
    tree.push({ name: `${name}`, children: [
      { name: 'designer', children: [{ name: 'Plugin.designer.xml' }] },
      { name: 'builder', children: [{ name: 'builder.js' }] },
      { name: 'controller', children: [{ name: 'Plugin.controller.js' }] },
      { name: 'css', children: [{ name: 'Plugin.css' }] },
      { name: 'i18n', children: config.languages?.map(l => ({ name: `i18n_${l}.properties` })) || [{ name: 'i18n_en.properties' }] },
      { name: 'models', children: [{ name: 'models.js' }] },
      { name: 'view', children: [{ name: 'Plugin.view.xml' }] },
      { name: 'Plugin.js' },
      { name: 'package.json' }
    ]});
  } else if (ver === 'POD 1.1 CLI') {
    tree.push({ name: `${name}`, children: [
      { name: 'dist', children: [{ name: '(built output)' }] },
      { name: 'src', children: [
        { name: 'controller', children: [{ name: 'Plugin.controller.js' }] },
        { name: 'view', children: [{ name: 'Plugin.view.xml' }] },
        { name: 'Plugin.js' }
      ]},
      { name: 'webapp', children: [{ name: 'index.html' }] },
      { name: 'package.json' },
      { name: 'ui5.yaml' }
    ]});
  } else if (ver === 'POD 2.0 UI5') {
    tree.push({ name: `${name}`, children: [
      { name: 'plugin', children: [{ name: `${name}.js` }, { name: `${name}.css` }] },
      { name: 'i18n', children: config.languages?.map(l => ({ name: `i18n_${l}.properties` })) || [{ name: 'i18n_en.properties' }] },
      { name: 'extension.json' },
      { name: 'package.json' }
    ]});
  } else if (ver === 'POD 2.0 React') {
    tree.push({ name: `${name}`, children: [
      { name: 'plugin', children: [{ name: `${name}.js` }, { name: `${name}.css` }] },
      { name: 'app', children: [
        { name: 'public', children: [{ name: 'index.html' }] },
        { name: 'src', children: [
          { name: 'components' },
          { name: 'App.js' },
          { name: 'index.js' }
        ]},
        { name: 'package.json' }
      ]},
      { name: 'extension.json' },
      { name: 'package.json' }
    ]});
  }

  return tree;
}

function renderPreviewHTML(config) {
  const tree = generatePreview(config);
  function renderNode(node, indent) {
    const icon = node.children ? '📁' : '📄';
    const lines = [`${'  '.repeat(indent)}${icon} ${node.name}`];
    if (node.children) {
      for (const child of node.children) lines.push(renderNode(child, indent + 1));
    }
    return lines.join('\n');
  }
  return tree.map(n => renderNode(n, 0)).join('\n');
}

function saveTemplate(name, description, config) {
  const dir = getTemplatesDir();
  if (!dir) return { success: false, error: 'No workspace open' };
  ensureDir(dir);

  const filename = name.toLowerCase().replace(/[^a-z0-9_-]/g, '_') + '.json';
  const filePath = path.join(dir, filename);

  const template = { name, description, author: 'RITS Team', createdAt: new Date().toISOString(), config };
  fs.writeFileSync(filePath, JSON.stringify(template, null, 2), 'utf-8');
  return { success: true, filePath };
}

function loadTemplate(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch { return null; }
}

function listTemplates() {
  const dir = getTemplatesDir();
  if (!dir || !fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const fp = path.join(dir, f);
      try {
        const content = JSON.parse(fs.readFileSync(fp, 'utf-8'));
        return { ...content, filePath: fp };
      } catch {
        return { name: f.replace('.json', ''), filePath: fp };
      }
    });
}

function deleteTemplate(filePath) {
  try { fs.unlinkSync(filePath); return true; }
  catch { return false; }
}

function saveProject(project) {
  const fp = getProjectFilePath();
  if (!fp) return { success: false, error: 'No workspace open' };
  fs.writeFileSync(fp, JSON.stringify(project, null, 2), 'utf-8');
  return { success: true };
}

function loadProject() {
  const fp = getProjectFilePath();
  if (!fp || !fs.existsSync(fp)) return null;
  try { return JSON.parse(fs.readFileSync(fp, 'utf-8')); }
  catch { return null; }
}

module.exports = {
  saveTemplate, loadTemplate, listTemplates, deleteTemplate,
  saveProject, loadProject, getTemplatesDir,   renderPreviewHTML, generatePreview
};
