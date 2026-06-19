const vscode = require('vscode');

const SYSTEM_PROMPT = `You are an SAP DMC POD plugin configurator. Given a user description of what plugin they need, output ONLY valid JSON.

POD versions:
- POD 1.0: Legacy, uses webapp/{name}/ structure, Component.js
- POD 1.1: Standard, has designer/builder/controller/css/i18n/models/view folders
- POD 1.1 CLI: Uses UI5 CLI, has ui5.yaml, dist/ folder after build
- POD 2.0 UI5: extension.json + plugin/{name}.js + i18n/ folder
- POD 2.0 React: extension.json + app/ (React SPA with components)

POD types: OPERATION, WORK_CENTER, ORDER, OTHER, MONITOR
Languages: en, de, fr, es, ja, ko, zh_CN, zh_TW, pt, it, ru, pl, nl, sv, da, cs, hu, ro, sk, sl, hr, lt, th, tr, vi, bg, sh, en_US
Libraries: lodash, moment, mqtt, socket.io, date-fns
Groups: Custom, Production, Quality, Maintenance, Inventory

Return ONLY this JSON format, no markdown, no explanation:
{
  "pluginname": "lowercase_name_no_spaces",
  "PODversion": "POD 1.0|POD 1.1|POD 1.1 CLI|POD 2.0 UI5|POD 2.0 React",
  "PODname": "Display Name",
  "namespace": "company.custom.plugins",
  "podoptions": ["OPERATION"],
  "miscoptions": [],
  "languages": ["en"],
  "thirdpartylibs": [],
  "PODGroup": "Custom",
  "icon": "sap-icon://locate-me-2",
  "description": "User's request summary",
  "version": "0.0.1"
}`;

async function classifyWithLM(description) {
  try {
    const models = await vscode.lm.selectChatModels({ family: 'gpt-4o' });
    const model = models?.[0] || (await vscode.lm.selectChatModels())?.[0];
    if (!model) return null;

    const messages = [
      vscode.LanguageModelChatMessage.User(SYSTEM_PROMPT),
      vscode.LanguageModelChatMessage.User(`User request: "${description}"`)
    ];

    const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
    let text = '';
    for await (const chunk of response.text) { text += chunk; }
    text = text.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
    return JSON.parse(text);
  } catch (err) {
    console.error('LM API failed:', err.message);
    return null;
  }
}

async function classifyIntent(description) {
  let result = await classifyWithLM(description);
  if (result && result.pluginname) return result;
  return classifyWithKeywords(description);
}

function classifyWithKeywords(description) {
  const desc = description.toLowerCase();
  const name = extractName(desc) || 'myplugin';
  const displayName = name.charAt(0).toUpperCase() + name.slice(1);

  const result = {
    pluginname: name, PODversion: 'POD 1.1', PODname: displayName,
    namespace: extractNamespace(desc) || 'rits.custom.plugins',
    podoptions: [], miscoptions: [], languages: ['en'],
    thirdpartylibs: [], PODGroup: 'Custom',
    icon: 'sap-icon://locate-me-2', description: description || 'Description',
    version: '0.0.1', hostname: ''
  };

  if (/monitor|dashboard|real-?time|realtime|live|overview/.test(desc)) {
    result.PODversion = 'POD 2.0 React';
    result.podoptions.push('MONITOR');
    result.thirdpartylibs.push('socket.io', 'moment');
  } else if (/order|production order|shop order|work order/.test(desc)) {
    result.PODversion = 'POD 1.1'; result.podoptions.push('ORDER');
  } else if (/work ?center|work ?centre|machine|station/.test(desc)) {
    result.PODversion = 'POD 1.1'; result.podoptions.push('WORK_CENTER');
  } else if (/operation|routing|step|instruction/.test(desc)) {
    result.PODversion = 'POD 1.0'; result.podoptions.push('OPERATION');
  } else if (/execut|trigger|background|automate|schedule/.test(desc)) {
    result.PODversion = 'POD 1.1 CLI'; result.podoptions.push('OTHER');
    result.miscoptions.push('ppenabled');
  } else if (/custom|generic|blank/.test(desc)) {
    result.PODversion = 'POD 2.0 UI5'; result.podoptions.push('OTHER');
  }

  if (!result.podoptions.length) result.podoptions.push('OPERATION');
  if (/multiple|multi-instance|parallel/.test(desc)) result.miscoptions.push('multiple');
  if (/mqtt|iot|sensor|device/.test(desc)) result.thirdpartylibs.push('mqtt');
  if (/chart|graph|visualize/.test(desc)) result.thirdpartylibs.push('lodash');
  if (/date|time|calendar|schedule/.test(desc)) result.thirdpartylibs.push('date-fns');

  if (/german|deutsch/.test(desc)) result.languages.push('de');
  if (/french/.test(desc)) result.languages.push('fr');
  if (/chinese/.test(desc)) result.languages.push('zh_CN');
  if (/japanese/.test(desc)) result.languages.push('ja');
  if (/spanish/.test(desc)) result.languages.push('es');

  if (desc.includes('production')) result.PODGroup = 'Production';
  else if (/quality|inspection/.test(desc)) result.PODGroup = 'Quality';
  else if (desc.includes('maintenance')) result.PODGroup = 'Maintenance';
  else if (/inventory|stock|material|logistic/.test(desc)) result.PODGroup = 'Inventory';

  if (desc.includes('order')) result.icon = 'sap-icon://sales-order';
  else if (desc.includes('machine')) result.icon = 'sap-icon://machine';
  else if (desc.includes('quality')) result.icon = 'sap-icon://quality-issue';
  else if (desc.includes('maintenance')) result.icon = 'sap-icon://maintenance';
  else if (desc.includes('inventory')) result.icon = 'sap-icon://inventory';
  else if (/monitor|dashboard/.test(desc)) result.icon = 'sap-icon://monitor-policies';

  return result;
}

function extractName(desc) {
  const patterns = [
    /(?:called|named|name)\s+['"]([^'"]+)['"]/,
    /(?:called|named|name)\s+(\S+)/,
    /^(\w+)\s+(?:pod|plugin|widget)/
  ];
  for (const p of patterns) {
    const m = desc.match(p);
    if (m?.[1]) {
      const n = m[1].toLowerCase().replace(/[^a-z]/g, '').substring(0, 24);
      if (n.length > 0) return n;
    }
  }
  return null;
}

function extractNamespace(desc) {
  const m = desc.match(/(?:namespace|ns)\s+['"]?(\w+(?:\.\w+)*)['"]?/);
  return m?.[1] || null;
}

module.exports = { classifyIntent };
