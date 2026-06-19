const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { generateFromTemplate } = require('./generateFromTemplate.js');
const { generatePod1_0Files } = require('./pod1_0.js');
const { generatePod1_1Files } = require('./pod1_1.js');
const { generatePod1_1_CLI_Files } = require('./pod1_1cli.js');
const { generatePod2_0ReactFiles, NPMInstall } = require('./pod2_0_react.js');
const { generatePod2_0UI5Files } = require('./pod2_0_ui5.js');
const { classifyIntent } = require('./intentClassifier.js');
const { saveTemplate, loadTemplate, listTemplates, deleteTemplate, saveProject, loadProject, renderPreviewHTML } = require('./templateManager.js');
const { inspectWorkspace } = require('./pluginInspector.js');

let lastPluginName = 'workspace';
let lastPODversion = undefined;
let multiPluginProject = { name: 'My Project', plugins: [] };

function activate(context) {
	const disposable = vscode.commands.registerCommand('SHARD_M.POD_Plugin', function () {
		const panel = vscode.window.createWebviewPanel(
			'generator',
			'SHAR-DM SAP DM POD Plugin Generator',
			vscode.ViewColumn.One,
			{ enableScripts: true }
		);

		panel.webview.html = getWebviewContent();

		panel.webview.onDidReceiveMessage(async message => {
			if (message.command === 'create') {
				const { pluginname, hostname, namespace, podoptions, miscoptions,
					PODversion, PODname, languages, version, thirdpartylibs,
					PODGroup, icon, description } = message;
				lastPluginName = pluginname || 'workspace';
				lastPODversion = PODversion;

				const opts = { context, pluginname, hostname, namespace,
					podoptions, miscoptions, PODversion, PODname, languages,
					version, thirdpartylibs, PODGroup, icon, description };

				if (PODversion === "POD 1.0") generatePod1_0Files(opts);
				if (PODversion === "POD 1.1") generatePod1_1Files(opts);
				if (PODversion === "POD 1.1 CLI") generatePod1_1_CLI_Files(opts);
				if (PODversion === "POD 2.0 React") { generatePod2_0ReactFiles(opts); NPMInstall(); }
				if (PODversion === "POD 2.0 UI5") generatePod2_0UI5Files(opts);

				if (thirdpartylibs?.length > 0) {
					const rootFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
					if (!rootFolder) { vscode.window.showErrorMessage('No open workspace.'); return; }
					const targetDir = path.join(rootFolder, '3rdparty');
					await fs.promises.mkdir(targetDir, { recursive: true });
					for (const lib of thirdpartylibs) {
						const fn = `${lib}.min.js`;
						try { await fs.promises.copyFile(path.join(context.extensionPath, '3rdParty', lib, fn), path.join(targetDir, fn)); }
						catch (err) { vscode.window.showErrorMessage(`Failed to copy ${fn}: ${err.message}`); }
					}
				}
			}

			if (message.command === 'npmInstall') {
				if (lastPODversion === "POD 2.0 React") NPMInstall();
				else if (lastPODversion === "POD 1.1 CLI") { const { NPMInstallCLI } = require('./pod1_1cli.js'); NPMInstallCLI(); }
				else vscode.window.showErrorMessage('NPM Install only for POD 2.0 React and POD 1.1 CLI.');
			}

			if (message.command === 'classify') {
				panel.webview.postMessage({ command: 'classifyStatus', status: 'classifying' });
				try {
					const result = await classifyIntent(message.description);
					panel.webview.postMessage({ command: 'classified', config: result });
				} catch (err) {
					panel.webview.postMessage({ command: 'classifyStatus', status: 'error', error: err.message });
				}
			}

			if (message.command === 'preview') {
				const tree = renderPreviewHTML(message.config);
				panel.webview.postMessage({ command: 'previewUpdate', tree });
			}

			if (message.command === 'saveTemplate') {
				const r = saveTemplate(message.name, message.description, message.config);
				panel.webview.postMessage({ command: 'templateSaved', success: r.success, error: r.error });
			}
			if (message.command === 'listTemplates') {
				panel.webview.postMessage({ command: 'templateList', templates: listTemplates() });
			}
			if (message.command === 'deleteTemplate') {
				panel.webview.postMessage({ command: 'templateDeleted', success: deleteTemplate(message.filePath) });
			}
			if (message.command === 'loadTemplate') {
				panel.webview.postMessage({ command: 'templateLoaded', template: loadTemplate(message.filePath) });
			}
			if (message.command === 'saveProject') {
				multiPluginProject.plugins = message.plugins;
				const r = saveProject(multiPluginProject);
				panel.webview.postMessage({ command: 'projectSaved', success: r.success, error: r.error });
			}
			if (message.command === 'loadProject') {
				const p = loadProject();
				if (p) multiPluginProject = p;
				panel.webview.postMessage({ command: 'projectLoaded', project: p });
			}
			if (message.command === 'generateBatch') {
				await generateBatchPlugins(message.plugins, context);
			}
			if (message.command === 'zipProject') {
				await zipMultiPluginProject(message.plugins);
			}

			if (message.command === 'inspect') {
				panel.webview.postMessage({ command: 'inspectStatus', status: 'scanning' });
				try {
					const plugins = await inspectWorkspace();
					panel.webview.postMessage({ command: 'inspectResult', plugins });
				} catch (err) {
					panel.webview.postMessage({ command: 'inspectStatus', status: 'error', error: err.message });
				}
			}
		}, undefined, context.subscriptions);
	});

	const zipCommand = vscode.commands.registerCommand('SHARD_M.zipWorkspace', async function () {
		const folders = vscode.workspace.workspaceFolders;
		if (!folders?.length) { vscode.window.showErrorMessage('No workspace open.'); return; }
		const root = folders[0].uri.fsPath;
		const zipPath = path.join(root, `${lastPluginName || 'workspace'}.zip`);
		const output = fs.createWriteStream(zipPath);
		const archive = archiver('zip', { zlib: { level: 9 } });
		output.on('close', () => vscode.window.showInformationMessage(`Zipped to ${zipPath} (${archive.pointer()} bytes).`));
		archive.on('error', err => vscode.window.showErrorMessage(`ZIP error: ${err.message}`));
		archive.pipe(output);

		async function addDir(dir, base, skipNM) {
			const entries = await fs.promises.readdir(dir, { withFileTypes: true });
			for (const e of entries) {
				if (skipNM && e.name === 'node_modules') continue;
				const full = path.join(dir, e.name);
				const rel = path.relative(base, full);
				if (e.isDirectory()) await addDir(full, base, skipNM);
				else archive.file(full, { name: rel });
			}
		}

		if (lastPODversion === "POD 1.1 CLI") {
			const dist = path.join(root, 'dist');
			try {
				const s = await fs.promises.stat(dist).catch(() => null);
				if (!s?.isDirectory()) { vscode.window.showErrorMessage('dist/ not found.'); archive.abort(); return; }
				const entries = await fs.promises.readdir(dist);
				if (!entries.length) { vscode.window.showErrorMessage('dist/ is empty.'); archive.abort(); return; }
				await addDir(dist, dist, false);
			} catch (err) { vscode.window.showErrorMessage(`Error: ${err.message}`); archive.abort(); return; }
		} else {
			await addDir(root, root, true);
		}
		await archive.finalize();
	});

	async function generateBatchPlugins(plugins, ctx) {
		for (const p of plugins) {
			const opts = { context: ctx, ...p.config, hostname: p.config.hostname || '', icon: p.config.icon || 'sap-icon://locate-me-2', description: p.config.description || '' };
			try {
				if (opts.PODversion === "POD 1.0") generatePod1_0Files(opts);
				if (opts.PODversion === "POD 1.1") generatePod1_1Files(opts);
				if (opts.PODversion === "POD 1.1 CLI") generatePod1_1_CLI_Files(opts);
				if (opts.PODversion === "POD 2.0 React") generatePod2_0ReactFiles(opts);
				if (opts.PODversion === "POD 2.0 UI5") generatePod2_0UI5Files(opts);
			} catch (err) { vscode.window.showErrorMessage(`Failed: ${p.name}: ${err.message}`); }
		}
		vscode.window.showInformationMessage(`Generated ${plugins.length} plugin(s).`);
	}

	async function zipMultiPluginProject(plugins) {
		const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
		if (!root) { vscode.window.showErrorMessage('No workspace open.'); return; }
		const zipPath = path.join(root, 'project.zip');
		const output = fs.createWriteStream(zipPath);
		const archive = archiver('zip', { zlib: { level: 9 } });
		output.on('close', () => vscode.window.showInformationMessage(`Project zipped (${archive.pointer()} bytes).`));
		archive.on('error', err => vscode.window.showErrorMessage(`ZIP error: ${err.message}`));
		archive.pipe(output);
		for (const p of plugins) {
			const folder = path.join(root, p.config?.pluginname || p.name);
			try { if ((await fs.promises.stat(folder).catch(() => null))?.isDirectory()) await addDirToArchive(folder, root, archive); } catch {}
		}
		async function addDirToArchive(dir, base, arch) {
			const entries = await fs.promises.readdir(dir, { withFileTypes: true });
			for (const e of entries) {
				if (e.name === 'node_modules') continue;
				const full = path.join(dir, e.name);
				if (e.isDirectory()) await addDirToArchive(full, base, arch);
				else arch.file(full, { name: path.relative(base, full) });
			}
		}
		await archive.finalize();
	}

	context.subscriptions.push(disposable, zipCommand);
}

function getWebviewContent() {
	return `<!DOCTYPE html>
<html lang="en">
<head>
<style>
:root {
	--bg: var(--vscode-editor-background, #1e1e1e);
	--fg: var(--vscode-editor-foreground, #d4d4d4);
	--border: var(--vscode-editorWidget-border, #454545);
	--input-bg: var(--vscode-input-background, #3c3c3c);
	--input-fg: var(--vscode-input-foreground, #cccccc);
	--input-border: var(--vscode-input-border, #555);
	--btn-bg: var(--vscode-button-background, #0e639c);
	--btn-fg: var(--vscode-button-foreground, #ffffff);
	--btn-hover: var(--vscode-button-hoverBackground, #1177bb);
	--tab-active: var(--vscode-tab-activeBackground, #1e1e1e);
	--tab-inactive: var(--vscode-tab-inactiveBackground, #2d2d2d);
	--focus: var(--vscode-focusBorder, #007fd4);
	--badge: var(--vscode-badge-background, #4d4d4d);
	--badge-fg: var(--vscode-badge-foreground, #ffffff);
	--font: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
	--font-size: var(--vscode-font-size, 13px);
}
body { background: var(--bg); color: var(--fg); font-family: var(--font); font-size: var(--font-size); padding: 0; margin: 0; }
.tab-bar { display: flex; background: var(--tab-inactive); border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 10; flex-wrap: wrap; }
.tab-bar button { background: var(--tab-inactive); color: var(--fg); border: none; padding: 8px 14px; cursor: pointer; font-size: var(--font-size); border-right: 1px solid var(--border); }
.tab-bar button.active { background: var(--tab-active); border-bottom: 2px solid var(--btn-bg); }
.tab-bar button:hover { background: var(--tab-active); }
.tab-content { display: none; padding: 16px; }
.tab-content.active { display: block; }
h2 { margin: 0 0 12px 0; font-size: 15px; font-weight: 600; }
h3 { margin: 12px 0 6px 0; font-size: var(--font-size); font-weight: 500; }
label { display: inline-flex; align-items: center; margin: 3px 14px 3px 0; white-space: nowrap; gap: 4px; cursor: pointer; }
input[type="text"], textarea, select {
	width: 100%; max-width: 520px; padding: 4px 8px;
	background: var(--input-bg); color: var(--input-fg);
	border: 1px solid var(--input-border); border-radius: 2px;
	font-family: var(--font); font-size: var(--font-size); box-sizing: border-box;
}
textarea { min-height: 80px; resize: vertical; }
input:focus, textarea:focus, select:focus { outline: none; border-color: var(--focus); }
button {
	padding: 6px 16px; background: var(--btn-bg); color: var(--btn-fg);
	border: none; border-radius: 2px; cursor: pointer; font-size: var(--font-size);
}
button:hover { background: var(--btn-hover); }
button.secondary { background: transparent; border: 1px solid var(--border); color: var(--fg); }
button.secondary:hover { background: var(--input-bg); }
button.small { padding: 3px 10px; font-size: 11px; }
.field-row { display: flex; gap: 12px; align-items: center; margin-bottom: 6px; flex-wrap: wrap; }
.field-row label { min-width: 100px; }
.preview-tree { background: var(--input-bg); padding: 10px 14px; border-radius: 3px; font-family: monospace; font-size: 12px; line-height: 1.6; white-space: pre; overflow-x: auto; min-height: 100px; }
.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
.card { background: var(--input-bg); border: 1px solid var(--border); border-radius: 3px; padding: 12px; cursor: pointer; }
.card:hover { border-color: var(--focus); }
.card h4 { margin: 0 0 4px 0; font-size: var(--font-size); }
.card p { margin: 0; font-size: 11px; opacity: 0.7; }
.badge { display: inline-block; background: var(--badge); color: var(--badge-fg); padding: 2px 6px; border-radius: 3px; font-size: 10px; margin-right: 3px; }
.ai-badge { background: #2ea043; }
.plugin-item { display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 3px; margin-bottom: 4px; flex-wrap: wrap; gap: 4px; }
.plugin-item .name { font-weight: 500; }
.summary-box { margin: 8px 0; padding: 10px 12px; background: var(--input-bg); border-radius: 3px; border: 1px solid var(--border); }
.loader { display: inline-block; width: 14px; height: 14px; border: 2px solid var(--border); border-top-color: var(--btn-bg); border-radius: 50%; animation: spin .8s linear infinite; vertical-align: middle; margin-right: 6px; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>

<div class="tab-bar">
	<button class="tab active" onclick="switchTab('describe')">Describe</button>
	<button class="tab" onclick="switchTab('configure')">Configure</button>
	<button class="tab" onclick="switchTab('preview')">Preview</button>
	<button class="tab" onclick="switchTab('inspector')">Inspector</button>
	<button class="tab" onclick="switchTab('templates')">Templates</button>
</div>

<!-- ===== TAB: DESCRIBE ===== -->
<div id="tab-describe" class="tab-content active">
	<h2>Describe Your Plugin</h2>
	<p style="opacity:0.7;margin-bottom:10px;">Tell us what you need in plain English. Real AI (Copilot) or quick keyword matching.</p>
	<textarea id="aiDescription" style="min-height:90px;" placeholder="e.g. I need a production order monitoring plugin with real-time dashboard using React, German and English language support..."></textarea>
	<div class="field-row">
		<button onclick="classifyAI()" id="aiBtn">Auto-Configure (AI)</button>
		<button class="secondary" onclick="classifyQuick()" id="quickBtn">Auto-Configure (Quick)</button>
		<button class="secondary" onclick="clearAI()">Clear</button>
	</div>
	<div id="aiStatus" style="margin-top:8px;min-height:20px;"></div>
	<div id="aiBox" style="display:none;" class="summary-box">
		<h3>Detected Configuration</h3>
		<div id="aiSummary" style="font-size:12px;line-height:1.8;"></div>
		<div class="field-row" style="margin-top:8px;">
			<button onclick="applyAIConfig()">Apply & Go to Configure</button>
		</div>
	</div>
	<div style="margin-top:16px;">
		<h3>Templates</h3>
		<div class="card-grid" id="galleryTemplates"><p style="opacity:0.7;">No templates yet. Save one from the Configure tab.</p></div>
	</div>
</div>

<!-- ===== TAB: CONFIGURE ===== -->
<div id="tab-configure" class="tab-content">
<div style="max-width:700px;">

<div class="field-group">
	<h3>POD Version</h3>
	<div class="field-row">
		<label><input type="radio" name="podVersion" value="POD 1.0" onchange="updateUI()"> POD 1.0 <span class="badge">Legacy</span></label>
		<label><input type="radio" name="podVersion" value="POD 1.1" onchange="updateUI()" checked> POD 1.1</label>
		<label><input type="radio" name="podVersion" value="POD 1.1 CLI" onchange="updateUI()"> POD 1.1 CLI <span class="badge">UI5</span></label>
		<label><input type="radio" name="podVersion" value="POD 2.0 UI5" onchange="updateUI()"> POD 2.0 UI5</label>
		<label><input type="radio" name="podVersion" value="POD 2.0 React" onchange="updateUI()"> POD 2.0 React</label>
	</div>
</div>

<div class="field-group">
	<h3>Plugin Identity</h3>
	<div class="field-row"><label>Plugin Name</label><input type="text" id="pluginName" value="pluginname" oninput="this.value=this.value.toLowerCase().replace(/[^a-z]/g,'');updatePreview()" style="max-width:220px;"></div>
	<div class="field-row"><label>Display Name</label><input type="text" id="PODName" value="Plugin Name" oninput="updatePreview()" style="max-width:220px;"></div>
	<div class="field-row"><label>Version</label><input type="text" id="version" value="0.0.1" style="max-width:100px;"></div>
	<div class="field-row"><label>Namespace</label><input type="text" id="namespace" value="company.custom.plugins" style="max-width:300px;"></div>
</div>

<div id="PODGroup" class="field-group" style="display:none"><h3>POD Designer Group</h3><input type="text" id="PODGroupName" value="Custom" style="max-width:200px;"></div>
<div id="iconGroup" class="field-group" style="display:none"><h3>Icon</h3><input type="text" id="iconName" value="sap-icon://locate-me-2" style="max-width:300px;"></div>
<div id="descriptionGroup" class="field-group" style="display:none"><h3>Description</h3><input type="text" id="description" value="Description" style="max-width:400px;"></div>
<div id="hostnameGroup" class="field-group" style="display:none"><h3>Hostname</h3><input type="text" id="hostName" value="yourhost.execution.eu20.web.dmc.cloud.sap" style="max-width:450px;"></div>

<div id="podTypeGroup" class="field-group"><h3>POD Type</h3><div class="field-row"><label><input type="radio" name="pluginType" value="view" checked> View Plugin</label><label><input type="radio" name="pluginType" value="execution" disabled> Execution Plugin <span class="badge">Soon</span></label></div></div>
<div id="podTypeHeader" class="field-group"><h3>POD Types Supported</h3><div class="field-row">
<label><input type="checkbox" value="OPERATION" data-group="pod" checked> Operation</label>
<label><input type="checkbox" value="WORK_CENTER" data-group="pod"> Work Center</label>
<label><input type="checkbox" value="ORDER" data-group="pod"> Order</label>
<label><input type="checkbox" value="OTHER" data-group="pod"> Custom</label>
<label><input type="checkbox" value="MONITOR" data-group="pod"> Line Monitor</label>
</div></div>
<div id="podOptions" class="field-group"><h3>Misc Options</h3><div class="field-row">
<label><input type="checkbox" value="multiple" data-group="misc"> Allow Multiple Instances</label>
<label><input type="checkbox" value="ppenabled" data-group="misc"> Production Process Enabled</label>
</div></div>
<div id="thirdPartyLibs" class="field-group"><h3>3rd Party Libraries</h3><div class="field-row">
<label><input type="checkbox" value="lodash" data-group="thirdparty"> Lodash</label>
<label><input type="checkbox" value="moment" data-group="thirdparty"> Moment</label>
<label><input type="checkbox" value="mqtt" data-group="thirdparty"> MQTT</label>
<label><input type="checkbox" value="socket.io" data-group="thirdparty"> Socket.IO</label>
<label><input type="checkbox" value="date-fns" data-group="thirdparty"> Date-FNS</label>
</div></div>
<div id="languageGroup" class="field-group"><h3>Languages</h3><div class="field-row" style="gap:4px;">
<label><input type="checkbox" value="bg" data-group="language"> BG</label><label><input type="checkbox" value="zh_CN" data-group="language"> zh_CN</label>
<label><input type="checkbox" value="zh_TW" data-group="language"> zh_TW</label><label><input type="checkbox" value="hr" data-group="language"> HR</label>
<label><input type="checkbox" value="cs" data-group="language"> CS</label><label><input type="checkbox" value="da" data-group="language"> DA</label>
<label><input type="checkbox" value="nl" data-group="language"> NL</label><label><input type="checkbox" value="en_US" data-group="language"> en_US</label>
<label><input type="checkbox" value="en" data-group="language" checked> EN</label><label><input type="checkbox" value="fr" data-group="language"> FR</label>
<label><input type="checkbox" value="de" data-group="language"> DE</label><label><input type="checkbox" value="hu" data-group="language"> HU</label>
<label><input type="checkbox" value="it" data-group="language"> IT</label><label><input type="checkbox" value="ja" data-group="language"> JA</label>
<label><input type="checkbox" value="ko" data-group="language"> KO</label><label><input type="checkbox" value="lt" data-group="language"> LT</label>
<label><input type="checkbox" value="pl" data-group="language"> PL</label><label><input type="checkbox" value="pt" data-group="language"> PT</label>
<label><input type="checkbox" value="ro" data-group="language"> RO</label><label><input type="checkbox" value="ru" data-group="language"> RU</label>
<label><input type="checkbox" value="sh" data-group="language"> SH</label><label><input type="checkbox" value="sk" data-group="language"> SK</label>
<label><input type="checkbox" value="sl" data-group="language"> SL</label><label><input type="checkbox" value="es" data-group="language"> ES</label>
<label><input type="checkbox" value="sv" data-group="language"> SV</label><label><input type="checkbox" value="th" data-group="language"> TH</label>
<label><input type="checkbox" value="tr" data-group="language"> TR</label><label><input type="checkbox" value="vi" data-group="language"> VI</label>
</div></div>

<div class="field-row" style="margin-top:12px;">
	<button onclick="sendData()">Create Plugin</button>
	<button id="npmButton" class="secondary" onclick="npmInstall()" style="display:none">NPM Install</button>
	<button class="secondary" onclick="saveCurrentTemplate()">Save Template</button>
	<button class="secondary" onclick="addToProject()">Add to Project</button>
</div>
</div>
</div>

<!-- ===== TAB: PREVIEW ===== -->
<div id="tab-preview" class="tab-content">
	<h2>Live Preview</h2>
	<p style="opacity:0.7;">Folder structure that will be generated.</p>
	<div class="preview-tree" id="previewTree">Configure fields to see preview.</div>
	<div class="field-row" style="margin-top:12px;">
		<button onclick="sendData()">Create Plugin</button>
		<button class="secondary" onclick="switchTab('configure')">Configure</button>
	</div>
</div>

<!-- ===== TAB: INSPECTOR ===== -->
<div id="tab-inspector" class="tab-content">
	<h2>Plugin Inspector</h2>
	<p style="opacity:0.7;">Scan your workspace for existing POD plugins and edit or regenerate them.</p>
	<div class="field-row">
		<button onclick="scanWorkspace()">Scan Workspace</button>
	</div>
	<div id="scanStatus"></div>
	<div id="scanResults"></div>
</div>

<!-- ===== TAB: TEMPLATES ===== -->
<div id="tab-templates" class="tab-content">
	<h2>Saved Templates</h2>
	<p style="opacity:0.7;">Templates let you save plugin configs and reuse them later.</p>
	<div class="card-grid" id="templateList"><p style="opacity:0.7;">No templates saved yet.</p></div>
	<div class="field-row" style="margin-top:8px;"><button class="secondary small" onclick="refreshTemplates()">Refresh</button></div>

	<h3 style="margin-top:16px;">Multi-Plugin Project</h3>
	<p style="opacity:0.7;">Group multiple plugins into one project. Generate all at once.</p>
	<div class="field-row"><label>Project Name</label><input type="text" id="projectName" value="My Project" style="max-width:200px;"></div>
	<div id="pluginProjectList" style="margin:8px 0;"></div>
	<div class="field-row">
		<button class="secondary small" onclick="addToProject()">Add Current Config</button>
		<button class="secondary small" onclick="saveProjectToDisk()">Save Project</button>
		<button class="secondary small" onclick="loadProjectFromDisk()">Load Project</button>
	</div>
	<div class="field-row" style="margin-top:8px;">
		<button onclick="generateAllProjectPlugins()">Generate All</button>
		<button class="secondary" onclick="zipAllProjectPlugins()">ZIP All</button>
	</div>
</div>

<script>
const vscode = acquireVsCodeApi();
let pendingAIConfig = null;
let templateList = [];
let projectPlugins = [];

function switchTab(name) {
	document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
	document.querySelectorAll('.tab-bar button').forEach(t => t.classList.remove('active'));
	document.getElementById('tab-' + name).classList.add('active');
	document.querySelectorAll('.tab-bar button').forEach(b => { if(b.textContent.trim().toLowerCase() === name.toLowerCase()) b.classList.add('active'); });
	if (name === 'preview') updatePreview();
	if (name === 'templates') refreshTemplates();
}

function updateUI() {
	const s = document.querySelector('input[name="podVersion"]:checked')?.value;
	document.getElementById('hostnameGroup').style.display = s === 'POD 1.0' ? 'block' : 'none';
	document.getElementById('podTypeGroup').style.display = (s === 'POD 2.0 React' || s === 'POD 2.0 UI5') ? 'none' : 'block';
	document.getElementById('podTypeHeader').style.display = (s === 'POD 2.0 React' || s === 'POD 2.0 UI5') ? 'none' : 'block';
	document.getElementById('podOptions').style.display = (s === 'POD 2.0 React' || s === 'POD 2.0 UI5') ? 'none' : 'block';
	document.getElementById('thirdPartyLibs').style.display = (s === 'POD 2.0 React' || s === 'POD 2.0 UI5') ? 'none' : 'block';
	document.getElementById('languageGroup').style.display = (s === 'POD 2.0 React' || s === 'POD 1.1 CLI') ? 'none' : 'block';
	document.getElementById('PODGroup').style.display = (s === 'POD 2.0 React' || s === 'POD 2.0 UI5') ? 'block' : 'none';
	document.getElementById('iconGroup').style.display = (s === 'POD 2.0 React' || s === 'POD 2.0 UI5') ? 'block' : 'none';
	document.getElementById('descriptionGroup').style.display = (s === 'POD 2.0 React' || s === 'POD 2.0 UI5') ? 'block' : 'none';
	document.getElementById('npmButton').style.display = (s === 'POD 2.0 React' || s === 'POD 1.1 CLI') ? 'inline-block' : 'none';
	updatePreview();
}

function updatePreview() {
	vscode.postMessage({ command: 'preview', config: gatherConfig() });
}
function gatherConfig() {
	return {
		pluginname: document.getElementById('pluginName').value,
		PODversion: document.querySelector('input[name="podVersion"]:checked')?.value,
		PODname: document.getElementById('PODName').value,
		namespace: document.getElementById('namespace').value,
		languages: Array.from(document.querySelectorAll('input[data-group="language"]:checked')).map(cb => cb.value),
		podoptions: Array.from(document.querySelectorAll('input[data-group="pod"]:checked')).map(cb => cb.value)
	};
}
function collectFullConfig() {
	return {
		pluginname: document.getElementById('pluginName').value,
		hostname: document.getElementById('hostName').value,
		namespace: document.getElementById('namespace').value,
		podoptions: Array.from(document.querySelectorAll('input[data-group="pod"]:checked')).map(cb => cb.value),
		miscoptions: Array.from(document.querySelectorAll('input[data-group="misc"]:checked')).map(cb => cb.value),
		thirdpartylibs: Array.from(document.querySelectorAll('input[data-group="thirdparty"]:checked')).map(cb => cb.value),
		languages: Array.from(document.querySelectorAll('input[data-group="language"]:checked')).map(cb => cb.value),
		PODversion: document.querySelector('input[name="podVersion"]:checked')?.value,
		PODname: document.getElementById('PODName').value,
		version: document.getElementById('version').value,
		PODGroup: document.getElementById('PODGroupName').value,
		icon: document.getElementById('iconName').value,
		description: document.getElementById('description').value
	};
}

// ---- AI Classification ----
function classifyAI() {
	const desc = document.getElementById('aiDescription').value.trim();
	if (!desc) { vscode.window.showErrorMessage('Describe your plugin first.'); return; }
	const status = document.getElementById('aiStatus');
	status.innerHTML = '<span class="loader"></span> AI is thinking... (using Copilot)';
	document.getElementById('aiBox').style.display = 'none';
	vscode.postMessage({ command: 'classify', description: desc });
}
function classifyQuick() {
	const desc = document.getElementById('aiDescription').value.trim();
	if (!desc) { vscode.window.showErrorMessage('Describe your plugin first.'); return; }
	document.getElementById('aiStatus').innerHTML = '<span class="loader"></span> Quick matching...';
	document.getElementById('aiBox').style.display = 'none';
	vscode.postMessage({ command: 'classify', description: desc });
}
function clearAI() {
	document.getElementById('aiDescription').value = '';
	document.getElementById('aiBox').style.display = 'none';
	document.getElementById('aiStatus').innerHTML = '';
}

function applyAIConfig() {
	if (!pendingAIConfig) return;
	const c = pendingAIConfig;
	if (c.pluginname) document.getElementById('pluginName').value = c.pluginname;
	if (c.PODname) document.getElementById('PODName').value = c.PODname;
	if (c.namespace) document.getElementById('namespace').value = c.namespace;
	if (c.version) document.getElementById('version').value = c.version;
	if (c.PODGroup) document.getElementById('PODGroupName').value = c.PODGroup;
	if (c.icon) document.getElementById('iconName').value = c.icon;
	if (c.description) document.getElementById('description').value = c.description;
	if (c.hostname) document.getElementById('hostName').value = c.hostname;
	document.querySelectorAll('input[name="podVersion"]').forEach(r => r.checked = r.value === c.PODversion);
	document.querySelectorAll('input[data-group="pod"]').forEach(cb => cb.checked = c.podoptions?.includes(cb.value));
	document.querySelectorAll('input[data-group="misc"]').forEach(cb => cb.checked = c.miscoptions?.includes(cb.value));
	document.querySelectorAll('input[data-group="thirdparty"]').forEach(cb => cb.checked = c.thirdpartylibs?.includes(cb.value));
	document.querySelectorAll('input[data-group="language"]').forEach(cb => cb.checked = c.languages?.includes(cb.value));
	updateUI();
	switchTab('configure');
}

// ---- Inspector ----
function scanWorkspace() {
	document.getElementById('scanStatus').innerHTML = '<span class="loader"></span> Scanning workspace...';
	document.getElementById('scanResults').innerHTML = '';
	vscode.postMessage({ command: 'inspect' });
}

// ---- Messages ----
window.addEventListener('message', event => {
	const msg = event.data;

	if (msg.command === 'classified') {
		pendingAIConfig = msg.config;
		const c = msg.config;
		document.getElementById('aiStatus').innerHTML = '<span class="badge ai-badge">AI Ready</span>';
		document.getElementById('aiBox').style.display = 'block';
		const s = document.getElementById('aiSummary');
		s.innerHTML = '<strong>Version:</strong> ' + (c.PODversion || '—') + '<br>' +
			'<strong>Name:</strong> ' + (c.pluginname || '—') + '<br>' +
			'<strong>POD Types:</strong> ' + (c.podoptions?.join(', ') || '—') + '<br>' +
			'<strong>Libraries:</strong> ' + (c.thirdpartylibs?.join(', ') || 'none') + '<br>' +
			'<strong>Languages:</strong> ' + (c.languages?.join(', ') || '—') + '<br>' +
			'<strong>Group:</strong> ' + (c.PODGroup || '—');
	}
	if (msg.command === 'classifyStatus') {
		if (msg.status === 'classifying') document.getElementById('aiStatus').innerHTML = '<span class="loader"></span> Classifying...';
		else if (msg.status === 'error') document.getElementById('aiStatus').innerHTML = '<span style="color:#f14c4c;">Error: ' + msg.error + '</span>';
	}
	if (msg.command === 'previewUpdate') {
		document.getElementById('previewTree').textContent = msg.tree || 'No config yet.';
	}
	if (msg.command === 'templateSaved') {
		vscode.window.showInformationMessage(msg.success ? 'Template saved!' : 'Error: ' + msg.error);
		if (msg.success) refreshTemplates();
	}
	if (msg.command === 'templateList') {
		templateList = msg.templates || [];
		renderAllTemplates();
	}
	if (msg.command === 'templateDeleted') { if (msg.success) refreshTemplates(); }
	if (msg.command === 'templateLoaded') { if (msg.template?.config) applyAIConfigFrom(msg.template.config); }
	if (msg.command === 'projectSaved') { vscode.window.showInformationMessage(msg.success ? 'Project saved!' : 'Error: ' + msg.error); }
	if (msg.command === 'projectLoaded') {
		if (msg.project) {
			document.getElementById('projectName').value = msg.project.name || 'My Project';
			projectPlugins = msg.project.plugins || [];
			renderProjectPlugins();
		} else vscode.window.showInformationMessage('No saved project found.');
	}
	if (msg.command === 'inspectStatus') {
		if (msg.status === 'scanning') document.getElementById('scanStatus').innerHTML = '<span class="loader"></span> Scanning...';
		else if (msg.status === 'error') document.getElementById('scanStatus').innerHTML = '<span style="color:#f14c4c;">Error: ' + msg.error + '</span>';
	}
	if (msg.command === 'inspectResult') {
		const plugins = msg.plugins || [];
		const container = document.getElementById('scanResults');
		const status = document.getElementById('scanStatus');
		if (plugins.length === 0) {
			status.innerHTML = 'No POD plugins detected.';
			container.innerHTML = '';
			return;
		}
		status.innerHTML = 'Found ' + plugins.length + ' plugin(s). Click to load into Configure.';
		container.innerHTML = plugins.map(p =>
			'<div class="plugin-item" onclick="loadInspectedPlugin(' + JSON.stringify(p.config).replace(/"/g, '&quot;') + ')">' +
			'<span class="name">' + p.name + '</span>' +
			'<span><span class="badge">' + (p.config.PODversion || '—') + '</span></span>' +
			'<span style="font-size:11px;opacity:0.7;">' + (p.config.PODname || '') + '</span>' +
			'</div>'
		).join('');
	}
});

function loadInspectedPlugin(config) {
	applyAIConfigFrom(config);
	switchTab('configure');
}

// ---- Templates ----
function saveCurrentTemplate() {
	const name = prompt('Template name:');
	if (!name) return;
	vscode.postMessage({ command: 'saveTemplate', name, description: collectFullConfig().description || name, config: collectFullConfig() });
}
function applyAIConfigFrom(config) {
	if (config.pluginname) document.getElementById('pluginName').value = config.pluginname;
	if (config.PODname) document.getElementById('PODName').value = config.PODname;
	if (config.namespace) document.getElementById('namespace').value = config.namespace;
	if (config.version) document.getElementById('version').value = config.version;
	if (config.PODGroup) document.getElementById('PODGroupName').value = config.PODGroup;
	if (config.icon) document.getElementById('iconName').value = config.icon;
	if (config.description) document.getElementById('description').value = config.description;
	if (config.hostname) document.getElementById('hostName').value = config.hostname;
	document.querySelectorAll('input[name="podVersion"]').forEach(r => r.checked = r.value === config.PODversion);
	document.querySelectorAll('input[data-group="pod"]').forEach(cb => cb.checked = config.podoptions?.includes(cb.value));
	document.querySelectorAll('input[data-group="misc"]').forEach(cb => cb.checked = config.miscoptions?.includes(cb.value));
	document.querySelectorAll('input[data-group="thirdparty"]').forEach(cb => cb.checked = config.thirdpartylibs?.includes(cb.value));
	document.querySelectorAll('input[data-group="language"]').forEach(cb => cb.checked = config.languages?.includes(cb.value));
	updateUI();
}
function refreshTemplates() { vscode.postMessage({ command: 'listTemplates' }); }
function renderAllTemplates() {
	const html = templateList.length === 0
		? '<p style="opacity:0.7;">No templates saved yet.</p>'
		: templateList.map(t =>
			'<div class="card" onclick="loadTemplateFile(\'' + t.filePath.replace(/\\/g, '\\\\') + '\')">' +
			'<h4>' + (t.name || 'Unnamed') + '</h4>' +
			'<p>' + (t.description || '') + '</p>' +
			'<span class="badge">' + (t.config?.PODversion || '—') + '</span>' +
			'</div>'
		).join('');
	document.getElementById('templateList').innerHTML = html;
	document.getElementById('galleryTemplates').innerHTML = html;
}
function loadTemplateFile(fp) { vscode.postMessage({ command: 'loadTemplate', filePath: fp }); }

// ---- Multi-Plugin Project ----
function addToProject() {
	const config = collectFullConfig();
	const name = config.PODname || config.pluginname || 'Unnamed';
	projectPlugins.push({ name, config });
	renderProjectPlugins();
	vscode.window.showInformationMessage('Added "' + name + '" to project.');
}
function renderProjectPlugins() {
	const list = document.getElementById('pluginProjectList');
	if (projectPlugins.length === 0) { list.innerHTML = '<p style="opacity:0.7;">No plugins added yet.</p>'; return; }
	list.innerHTML = projectPlugins.map((p, i) =>
		'<div class="plugin-item"><span class="name">' + (i+1) + '. ' + (p.name || 'Unnamed') + '</span>' +
		'<span class="badge">' + (p.config?.PODversion || '—') + '</span>' +
		'<div><button class="secondary small" onclick="editProjectPlugin(' + i + ')">Edit</button> ' +
		'<button class="secondary small" onclick="removeProjectPlugin(' + i + ')">Remove</button></div></div>'
	).join('');
}
function removeProjectPlugin(i) { projectPlugins.splice(i, 1); renderProjectPlugins(); }
function editProjectPlugin(i) { if (projectPlugins[i]?.config) applyAIConfigFrom(projectPlugins[i].config); switchTab('configure'); }
function saveProjectToDisk() { vscode.postMessage({ command: 'saveProject', plugins: projectPlugins }); }
function loadProjectFromDisk() { vscode.postMessage({ command: 'loadProject' }); }
function generateAllProjectPlugins() {
	if (!projectPlugins.length) { vscode.window.showErrorMessage('No plugins in project.'); return; }
	vscode.postMessage({ command: 'generateBatch', plugins: projectPlugins });
}
function zipAllProjectPlugins() {
	if (!projectPlugins.length) { vscode.window.showErrorMessage('No plugins in project.'); return; }
	vscode.postMessage({ command: 'zipProject', plugins: projectPlugins });
}
function sendData() { vscode.postMessage({ command: 'create', ...collectFullConfig() }); }
function npmInstall() { vscode.postMessage({ command: 'npmInstall' }); }

updateUI();
refreshTemplates();
</script>
</body>
</html>`;
}

exports.activate = activate;
function deactivate() {}
module.exports = { activate, deactivate };
