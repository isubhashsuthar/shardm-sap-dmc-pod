function classifyIntent(description) {
  const desc = description.toLowerCase();
  const name = extractName(desc) || 'myplugin';
  const displayName = name.charAt(0).toUpperCase() + name.slice(1);

  const result = {
    pluginname: name,
    PODversion: 'POD 1.1',
    PODname: displayName,
    namespace: extractNamespace(desc) || 'rits.custom.plugins',
    podoptions: [],
    miscoptions: [],
    languages: ['en'],
    thirdpartylibs: [],
    PODGroup: 'Custom',
    icon: 'sap-icon://locate-me-2',
    description: description || 'Description',
    version: '0.0.1',
    hostname: ''
  };

  const hasMonitor = /monitor|dashboard|real-?time|realtime|live|overview/.test(desc);
  const hasOrder = /order|production order|shop order|work order/.test(desc);
  const hasWC = /work ?center|work ?centre|machine|station/.test(desc);
  const hasOperation = /operation|routing|step|instruction|workflow/.test(desc);
  const hasCustom = /custom|generic|blank|scratch/.test(desc);
  const hasExecute = /execut|trigger|background|automate|scheduled/.test(desc);
  const hasUI5 = /ui5|sapui5|fiori/.test(desc);
  const hasReact = /react|typescript|component/.test(desc);

  if (hasMonitor && !hasUI5) {
    result.PODversion = 'POD 2.0 React';
    result.podoptions.push('MONITOR');
    result.icon = 'sap-icon://monitor-policies';
    result.thirdpartylibs.push('socket.io', 'moment');
  } else if (hasOrder || hasWC || hasOperation) {
    result.PODversion = hasExecute ? 'POD 1.1 CLI' : 'POD 1.1';
    if (hasOrder) result.podoptions.push('ORDER');
    if (hasWC) result.podoptions.push('WORK_CENTER');
    if (hasOperation) result.podoptions.push('OPERATION');
    if (hasExecute) result.miscoptions.push('ppenabled');
  } else if (hasExecute) {
    result.PODversion = 'POD 1.1 CLI';
    result.podoptions.push('OTHER');
    result.miscoptions.push('ppenabled');
  } else if (hasCustom) {
    result.PODversion = hasUI5 ? 'POD 2.0 UI5' : 'POD 2.0 React';
    result.podoptions.push('OTHER');
  }

  if (result.podoptions.length === 0) {
    result.podoptions.push('OPERATION');
  }

  if (desc.includes('multiple') || desc.includes('multi-instance') || desc.includes('parallel')) {
    result.miscoptions.push('multiple');
  }

  if (desc.includes('chart') || desc.includes('graph') || desc.includes('visualize') || desc.includes('plot')) {
    if (!result.thirdpartylibs.includes('lodash')) result.thirdpartylibs.push('lodash');
  }
  if (desc.includes('date') || desc.includes('time') || desc.includes('calendar') || desc.includes('schedule') || desc.includes('deadline')) {
    if (!result.thirdpartylibs.includes('date-fns')) result.thirdpartylibs.push('date-fns');
  }
  if (desc.includes('mqtt') || desc.includes('iot') || desc.includes('sensor') || desc.includes('device')) {
    if (!result.thirdpartylibs.includes('mqtt')) result.thirdpartylibs.push('mqtt');
  }

  if (desc.includes('german') || desc.includes('deutsch')) result.languages.push('de');
  if (desc.includes('french') || desc.includes('francais')) result.languages.push('fr');
  if (desc.includes('chinese') || desc.includes('mandarin')) result.languages.push('zh_CN');
  if (desc.includes('japanese')) result.languages.push('ja');
  if (desc.includes('spanish')) result.languages.push('es');
  if (desc.includes('korean')) result.languages.push('ko');

  if (desc.includes('production')) result.PODGroup = 'Production';
  else if (desc.includes('quality') || desc.includes('inspection')) result.PODGroup = 'Quality';
  else if (desc.includes('maintenance')) result.PODGroup = 'Maintenance';
  else if (desc.includes('inventory') || desc.includes('stock') || desc.includes('material') || desc.includes('logistic')) result.PODGroup = 'Inventory';

  if (desc.includes('order')) result.icon = 'sap-icon://sales-order';
  else if (desc.includes('machine') || desc.includes('work center') || desc.includes('workcenter')) result.icon = 'sap-icon://machine';
  else if (desc.includes('quality') || desc.includes('inspection')) result.icon = 'sap-icon://quality-issue';
  else if (desc.includes('maintenance')) result.icon = 'sap-icon://maintenance';
  else if (desc.includes('inventory') || desc.includes('stock')) result.icon = 'sap-icon://inventory';

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
    if (m) {
      const n = m[1].toLowerCase().replace(/[^a-z]/g, '').substring(0, 24);
      if (n.length > 0) return n;
    }
  }
  return null;
}

function extractNamespace(desc) {
  const m = desc.match(/(?:namespace|ns)\s+['"]?(\w+(?:\.\w+)*)['"]?/);
  return m ? m[1] : null;
}

module.exports = { classifyIntent };
