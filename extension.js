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

function activate(context) {
	let lastPluginName = 'workspace';
	let lastPODversion = undefined;

	const disposable = vscode.commands.registerCommand('SHARD_M.POD_Plugin', function () {
		const panel = vscode.window.createWebviewPanel(
			'generator',
			'ShardM SAP DM POD Plugin Generator',
			vscode.ViewColumn.One,
			{ enableScripts: true }
		);

		panel.webview.html = getWebviewContent();

		panel.webview.onDidReceiveMessage(
			async message => {
				if (message.command === 'create') {
					const { pluginname, hostname, namespace, podoptions, miscoptions,
						PODversion, PODname, languages, version, thirdpartylibs,
						PODGroup, icon, description } = message;
					lastPluginName = pluginname || 'workspace';
					lastPODversion = PODversion;

					if (PODversion === "POD 1.0") {
						generatePod1_0Files({ context, pluginname, hostname, namespace,
							podoptions, miscoptions, PODversion, PODname, languages,
							version, thirdpartylibs, PODGroup });
					}
					if (PODversion === "POD 1.1") {
						generatePod1_1Files({ context, pluginname, hostname, namespace,
							podoptions, miscoptions, PODversion, PODname, languages,
							version, thirdpartylibs, PODGroup });
					}
					if (PODversion === "POD 1.1 CLI") {
						generatePod1_1_CLI_Files({ context, pluginname, hostname, namespace,
							podoptions, miscoptions, PODversion, PODname, languages,
							version, thirdpartylibs, PODGroup });
					}
					if (PODversion === "POD 2.0 React") {
						generatePod2_0ReactFiles({ context, pluginname, hostname, namespace,
							podoptions, miscoptions, PODversion, PODname, languages,
							version, thirdpartylibs, PODGroup, icon, description });
						NPMInstall();
					}
					if (PODversion === "POD 2.0 UI5") {
						generatePod2_0UI5Files({ context, pluginname, hostname, namespace,
							podoptions, miscoptions, PODversion, PODname, languages,
							version, thirdpartylibs, PODGroup, icon, description });
					}

					if (thirdpartylibs && thirdpartylibs.length > 0) {
						const rootFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
						if (!rootFolder) {
							vscode.window.showErrorMessage('No open workspace to copy 3rd party libraries.');
							return;
						}
						const targetDir = path.join(rootFolder, '3rdparty');
						await fs.promises.mkdir(targetDir, { recursive: true });
						for (const lib of thirdpartylibs) {
							const filename = `${lib}.min.js`;
							const srcFile = path.join(context.extensionPath, '3rdParty', lib, filename);
							const destFile = path.join(targetDir, filename);
							try {
								await fs.promises.copyFile(srcFile, destFile);
							} catch (err) {
								vscode.window.showErrorMessage(`Failed to copy ${filename}: ${err.message}`);
							}
						}
					}
				}

				if (message.command === 'npmInstall') {
					onNPMInstall();
				}
			},
			undefined,
			context.subscriptions
		);
	});

	const zipCommand = vscode.commands.registerCommand('SHARD_M.zipWorkspace', async function () {
		const folders = vscode.workspace.workspaceFolders;
		if (!folders || folders.length === 0) {
			vscode.window.showErrorMessage('No workspace folder is open.');
			return;
		}

		const rootFolder = folders[0].uri.fsPath;
		const zipFilename = `${lastPluginName || 'workspace'}.zip`;
		const zipPath = path.join(rootFolder, zipFilename);

		const output = fs.createWriteStream(zipPath);
		const archive = archiver('zip', { zlib: { level: 9 } });

		output.on('close', () => {
			vscode.window.showInformationMessage(`Workspace zipped to ${zipPath} (${archive.pointer()} bytes).`);
		});

		archive.on('error', err => {
			vscode.window.showErrorMessage(`Error creating ZIP: ${err.message}`);
		});

		archive.pipe(output);

		async function addDirectoryToArchive(dir, baseDir, skipNodeModules = false) {
			const entries = await fs.promises.readdir(dir, { withFileTypes: true });
			for (const entry of entries) {
				const fullPath = path.join(dir, entry.name);
				const relativePath = path.relative(baseDir, fullPath);
				if (skipNodeModules && entry.name === 'node_modules') continue;
				if (entry.isDirectory()) {
					await addDirectoryToArchive(fullPath, baseDir, skipNodeModules);
				} else {
					archive.file(fullPath, { name: relativePath });
				}
			}
		}

		if (lastPODversion === "POD 1.1 CLI") {
			const distFolder = path.join(rootFolder, 'dist');
			try {
				const stat = await fs.promises.stat(distFolder).catch(() => null);
				if (!stat || !stat.isDirectory()) {
					vscode.window.showErrorMessage('dist folder does not exist. Nothing to zip.');
					archive.abort();
					return;
				}
				const entries = await fs.promises.readdir(distFolder);
				if (entries.length === 0) {
					vscode.window.showErrorMessage('dist folder is empty. Nothing to zip.');
					archive.abort();
					return;
				}
				await addDirectoryToArchive(distFolder, distFolder, false);
			} catch (err) {
				vscode.window.showErrorMessage(`Error zipping dist folder: ${err.message}`);
				archive.abort();
				return;
			}
		} else {
			await addDirectoryToArchive(rootFolder, rootFolder, true);
		}
		await archive.finalize();
	});

	function onNPMInstall() {
		if (lastPODversion === "POD 2.0 React") {
			NPMInstall();
		} else if (lastPODversion === "POD 1.1 CLI") {
			const { NPMInstallCLI } = require('./pod1_1cli.js');
			NPMInstallCLI();
		} else {
			vscode.window.showErrorMessage('NPM Install is only available for POD 2.0 React and POD 1.1 CLI projects.');
		}
	}

	context.subscriptions.push(disposable, zipCommand);
}

function getWebviewContent() {
	return `<!DOCTYPE html>
<html lang="en">
<head>
	<style>
		* { box-sizing: border-box; margin: 0; }
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
			padding: 24px; color: #1a1a2e; background: #f0f2f5;
		}
		.header {
			background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
			color: white; padding: 24px 28px; border-radius: 12px;
			margin-bottom: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);
		}
		.header h1 { font-size: 22px; font-weight: 700; margin: 0; }
		.header p { font-size: 13px; opacity: 0.8; margin-top: 6px; }
		.header .badge {
			display: inline-block; background: rgba(255,255,255,0.2);
			padding: 2px 10px; border-radius: 20px; font-size: 11px;
			margin-left: 10px; vertical-align: middle;
		}
		.card {
			background: white; border-radius: 10px; padding: 20px 24px;
			margin-bottom: 16px; box-shadow: 0 1px 4px rgba(0,0,0,0.06);
			border: 1px solid #e8ecf1;
		}
		.card-title {
			font-size: 13px; font-weight: 600; text-transform: uppercase;
			letter-spacing: 0.5px; color: #0f3460; margin-bottom: 12px;
			display: flex; align-items: center; gap: 8px;
		}
		.card-title .dot {
			width: 6px; height: 6px; border-radius: 50%; background: #0f3460;
			display: inline-block;
		}
		.form-row { display: flex; gap: 16px; flex-wrap: wrap; }
		.form-group { flex: 1; min-width: 200px; }
		.form-group label {
			display: block; font-size: 12px; font-weight: 500;
			color: #4a5568; margin-bottom: 4px;
		}
		.form-group input[type="text"], .form-group input[type="number"] {
			width: 100%; padding: 10px 12px; border: 1px solid #d1d5db;
			border-radius: 6px; font-size: 13px; transition: border-color 0.2s;
			background: #f9fafb;
		}
		.form-group input:focus {
			outline: none; border-color: #0f3460; box-shadow: 0 0 0 3px rgba(15,52,96,0.1);
			background: white;
		}
		.form-group input[readonly] {
			background: #f0f0f0; color: #888; cursor: not-allowed;
		}
		.pod-tiles { display: flex; gap: 8px; flex-wrap: wrap; }
		.pod-tile {
			flex: 1; min-width: 110px; text-align: center;
			padding: 14px 10px; border: 2px solid #e2e8f0; border-radius: 10px;
			cursor: pointer; transition: all 0.2s; font-size: 12px; font-weight: 500;
			background: #fafbfc;
		}
		.pod-tile:hover { border-color: #0f3460; background: #eef2f7; }
		.pod-tile.selected {
			border-color: #0f3460; background: #e8eef6;
			box-shadow: 0 0 0 3px rgba(15,52,96,0.12);
		}
		.pod-tile input { display: none; }
		.pod-tile .tile-icon { font-size: 20px; display: block; margin-bottom: 6px; }
		.pod-tile .tile-label { display: block; line-height: 1.3; }
		.pod-tile .tile-sub { font-size: 10px; color: #888; font-weight: 400; margin-top: 3px; }
		.check-grid { display: flex; flex-wrap: wrap; gap: 6px; }
		.check-item {
			display: flex; align-items: center; gap: 6px;
			padding: 6px 12px; border: 1px solid #e2e8f0; border-radius: 6px;
			cursor: pointer; font-size: 12px; transition: all 0.15s;
			background: #fafbfc; user-select: none;
		}
		.check-item:hover { border-color: #0f3460; background: #eef2f7; }
		.check-item.checked { border-color: #0f3460; background: #e8eef6; }
		.check-item input { display: none; }
		.check-item .ck { width: 14px; height: 14px; border: 1.5px solid #cbd5e0;
			border-radius: 3px; display: inline-flex; align-items: center;
			justify-content: center; font-size: 10px; color: white;
			transition: all 0.15s; flex-shrink: 0;
		}
		.check-item.checked .ck { background: #0f3460; border-color: #0f3460; }
		.btn-row { display: flex; gap: 12px; margin-top: 8px; flex-wrap: wrap; }
		.btn {
			padding: 12px 32px; border: none; border-radius: 8px;
			font-size: 14px; font-weight: 600; cursor: pointer;
			transition: all 0.2s; display: inline-flex; align-items: center; gap: 8px;
		}
		.btn-primary {
			background: linear-gradient(135deg, #0f3460, #1a1a2e);
			color: white; box-shadow: 0 4px 12px rgba(15,52,96,0.3);
		}
		.btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(15,52,96,0.4); }
		.btn-secondary {
			background: #e8ecf1; color: #1a1a2e;
		}
		.btn-secondary:hover { background: #dce1e8; }
		.lang-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 4px; }
		.hidden { display: none !important; }
		@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
		.card { animation: fadeIn 0.3s ease-out; }
	</style>
</head>
<body>

	<div class="header">
		<h1>ShardM SAP DM POD Plugin Generator <span class="badge">v0.0.2</span></h1>
		<p>Scaffold production-ready SAP DMC POD plugins for any POD version</p>
	</div>

	<div class="card">
		<div class="card-title"><span class="dot"></span> Select POD Version</div>
		<div class="pod-tiles" id="podTiles">
			<label class="pod-tile" onclick="selectPod(this,'POD 1.0')">
				<input type="radio" name="podVersion" value="POD 1.0" onchange="updateUI()">
				<span class="tile-icon">📦</span>
				<span class="tile-label">POD 1.0</span>
				<span class="tile-sub">Legacy SAPUI5</span>
			</label>
			<label class="pod-tile selected" onclick="selectPod(this,'POD 1.1')">
				<input type="radio" name="podVersion" value="POD 1.1" onchange="updateUI()" checked>
				<span class="tile-icon">📦</span>
				<span class="tile-label">POD 1.1</span>
				<span class="tile-sub">Current SAPUI5</span>
			</label>
			<label class="pod-tile" onclick="selectPod(this,'POD 1.1 CLI')">
				<input type="radio" name="podVersion" value="POD 1.1 CLI" onchange="updateUI()">
				<span class="tile-icon">⚙️</span>
				<span class="tile-label">POD 1.1 CLI</span>
				<span class="tile-sub">UI5 CLI Build</span>
			</label>
			<label class="pod-tile" onclick="selectPod(this,'POD 2.0 UI5')">
				<input type="radio" name="podVersion" value="POD 2.0 UI5" onchange="updateUI()">
				<span class="tile-icon">🚀</span>
				<span class="tile-label">POD 2.0 UI5</span>
				<span class="tile-sub">Next-gen UI5</span>
			</label>
			<label class="pod-tile" onclick="selectPod(this,'POD 2.0 React')">
				<input type="radio" name="podVersion" value="POD 2.0 React" onchange="updateUI()">
				<span class="tile-icon">⚛️</span>
				<span class="tile-label">POD 2.0 React</span>
				<span class="tile-sub">React 19</span>
			</label>
		</div>
	</div>

	<div class="card">
		<div class="card-title"><span class="dot"></span> Basic Information</div>
		<div class="form-row">
			<div class="form-group">
				<label>Plugin Name</label>
				<input type="text" id="pluginName" value="pluginname" oninput="this.value = this.value.toLowerCase().replace(/[^a-z]/g, '');">
			</div>
			<div class="form-group">
				<label>POD Designer Name</label>
				<input type="text" id="PODName" value="Plugin Name">
			</div>
			<div class="form-group">
				<label>Version</label>
				<input type="text" id="version" value="0.0.1">
			</div>
		</div>
		<div class="form-row" style="margin-top:12px">
			<div class="form-group">
				<label>Namespace</label>
				<input type="text" id="namespace" value="company.custom.plugins">
			</div>
			<div id="hostnameGroup" class="form-group">
				<label>Hostname</label>
				<input type="text" id="hostName" value="yourhost.execution.eu20.web.dmc.cloud.sap" readonly>
			</div>
		</div>
	</div>

	<div id="pod2Fields" class="hidden">
		<div class="card">
			<div class="card-title"><span class="dot"></span> POD 2.0 Configuration</div>
			<div class="form-row">
				<div class="form-group">
					<label>POD Designer Group</label>
					<input type="text" id="PODGroupName" value="Custom">
				</div>
				<div class="form-group">
					<label>Icon</label>
					<input type="text" id="iconName" value="sap-icon://locate-me-2">
				</div>
				<div class="form-group">
					<label>Description</label>
					<input type="text" id="description" value="Description">
				</div>
			</div>
		</div>
	</div>

	<div id="pod1Fields">
		<div class="card">
			<div class="card-title"><span class="dot"></span> POD Types</div>
			<div class="check-grid" id="podTypeHeader">
				<label class="check-item checked" onclick="toggleCheck(this)">
					<input type="checkbox" value="OPERATION" data-group="pod" checked><span class="ck">✓</span> Operation POD
				</label>
				<label class="check-item" onclick="toggleCheck(this)">
					<input type="checkbox" value="WORK_CENTER" data-group="pod"><span class="ck">✓</span> Work Center POD
				</label>
				<label class="check-item" onclick="toggleCheck(this)">
					<input type="checkbox" value="ORDER" data-group="pod"><span class="ck">✓</span> Order POD
				</label>
				<label class="check-item" onclick="toggleCheck(this)">
					<input type="checkbox" value="OTHER" data-group="pod"><span class="ck">✓</span> Custom POD
				</label>
				<label class="check-item" onclick="toggleCheck(this)">
					<input type="checkbox" value="MONITOR" data-group="pod"><span class="ck">✓</span> Line Monitor POD
				</label>
			</div>
		</div>

		<div class="card" id="podOptions">
			<div class="card-title"><span class="dot"></span> Misc Options</div>
			<div class="check-grid">
				<label class="check-item" onclick="toggleCheck(this)">
					<input type="checkbox" value="multiple" data-group="misc"><span class="ck">✓</span> Allow Multiple Instances
				</label>
				<label class="check-item" onclick="toggleCheck(this)">
					<input type="checkbox" value="ppenabled" data-group="misc"><span class="ck">✓</span> Production Process Enabled
				</label>
			</div>
		</div>

		<div class="card" id="thirdPartyLibs">
			<div class="card-title"><span class="dot"></span> 3rd Party Libraries</div>
			<div class="check-grid">
				<label class="check-item" onclick="toggleCheck(this)">
					<input type="checkbox" value="lodash" data-group="thirdparty"><span class="ck">✓</span> Lodash 4.17.21
				</label>
				<label class="check-item" onclick="toggleCheck(this)">
					<input type="checkbox" value="moment" data-group="thirdparty"><span class="ck">✓</span> Moment 2.30.1
				</label>
				<label class="check-item" onclick="toggleCheck(this)">
					<input type="checkbox" value="mqtt" data-group="thirdparty"><span class="ck">✓</span> MQTT.JS 5.13.3
				</label>
				<label class="check-item" onclick="toggleCheck(this)">
					<input type="checkbox" value="socket.io" data-group="thirdparty"><span class="ck">✓</span> Socket.IO 4.8.1
				</label>
				<label class="check-item" onclick="toggleCheck(this)">
					<input type="checkbox" value="date-fns" data-group="thirdparty"><span class="ck">✓</span> Date-FNS 4.1.0
				</label>
			</div>
		</div>

		<div class="card" id="languageGroup">
			<div class="card-title"><span class="dot"></span> Language Support</div>
			<div class="lang-grid">
				<label class="check-item checked" onclick="toggleCheck(this)"><input type="checkbox" value="en" data-group="language" checked><span class="ck">✓</span> English</label>
				<label class="check-item" onclick="toggleCheck(this)"><input type="checkbox" value="bg" data-group="language"><span class="ck">✓</span> Bulgarian</label>
				<label class="check-item" onclick="toggleCheck(this)"><input type="checkbox" value="zh_CN" data-group="language"><span class="ck">✓</span> Chinese (Simplified)</label>
				<label class="check-item" onclick="toggleCheck(this)"><input type="checkbox" value="zh_TW" data-group="language"><span class="ck">✓</span> Chinese (Traditional)</label>
				<label class="check-item" onclick="toggleCheck(this)"><input type="checkbox" value="hr" data-group="language"><span class="ck">✓</span> Croatian</label>
				<label class="check-item" onclick="toggleCheck(this)"><input type="checkbox" value="cs" data-group="language"><span class="ck">✓</span> Czech</label>
				<label class="check-item" onclick="toggleCheck(this)"><input type="checkbox" value="da" data-group="language"><span class="ck">✓</span> Danish</label>
				<label class="check-item" onclick="toggleCheck(this)"><input type="checkbox" value="nl" data-group="language"><span class="ck">✓</span> Dutch</label>
				<label class="check-item" onclick="toggleCheck(this)"><input type="checkbox" value="en_US" data-group="language"><span class="ck">✓</span> English (US)</label>
				<label class="check-item" onclick="toggleCheck(this)"><input type="checkbox" value="fr" data-group="language"><span class="ck">✓</span> French</label>
				<label class="check-item" onclick="toggleCheck(this)"><input type="checkbox" value="de" data-group="language"><span class="ck">✓</span> German</label>
				<label class="check-item" onclick="toggleCheck(this)"><input type="checkbox" value="hu" data-group="language"><span class="ck">✓</span> Hungarian</label>
				<label class="check-item" onclick="toggleCheck(this)"><input type="checkbox" value="it" data-group="language"><span class="ck">✓</span> Italian</label>
				<label class="check-item" onclick="toggleCheck(this)"><input type="checkbox" value="ja" data-group="language"><span class="ck">✓</span> Japanese</label>
				<label class="check-item" onclick="toggleCheck(this)"><input type="checkbox" value="ko" data-group="language"><span class="ck">✓</span> Korean</label>
				<label class="check-item" onclick="toggleCheck(this)"><input type="checkbox" value="lt" data-group="language"><span class="ck">✓</span> Lithuanian</label>
				<label class="check-item" onclick="toggleCheck(this)"><input type="checkbox" value="pl" data-group="language"><span class="ck">✓</span> Polish</label>
				<label class="check-item" onclick="toggleCheck(this)"><input type="checkbox" value="pt" data-group="language"><span class="ck">✓</span> Portuguese (Brazilian)</label>
				<label class="check-item" onclick="toggleCheck(this)"><input type="checkbox" value="ro" data-group="language"><span class="ck">✓</span> Romanian</label>
				<label class="check-item" onclick="toggleCheck(this)"><input type="checkbox" value="ru" data-group="language"><span class="ck">✓</span> Russian</label>
				<label class="check-item" onclick="toggleCheck(this)"><input type="checkbox" value="sh" data-group="language"><span class="ck">✓</span> Serbian (Latin)</label>
				<label class="check-item" onclick="toggleCheck(this)"><input type="checkbox" value="sk" data-group="language"><span class="ck">✓</span> Slovak</label>
				<label class="check-item" onclick="toggleCheck(this)"><input type="checkbox" value="sl" data-group="language"><span class="ck">✓</span> Slovenian</label>
				<label class="check-item" onclick="toggleCheck(this)"><input type="checkbox" value="es" data-group="language"><span class="ck">✓</span> Spanish</label>
				<label class="check-item" onclick="toggleCheck(this)"><input type="checkbox" value="sv" data-group="language"><span class="ck">✓</span> Swedish</label>
				<label class="check-item" onclick="toggleCheck(this)"><input type="checkbox" value="th" data-group="language"><span class="ck">✓</span> Thai</label>
				<label class="check-item" onclick="toggleCheck(this)"><input type="checkbox" value="tr" data-group="language"><span class="ck">✓</span> Turkish</label>
				<label class="check-item" onclick="toggleCheck(this)"><input type="checkbox" value="vi" data-group="language"><span class="ck">✓</span> Vietnamese</label>
			</div>
		</div>
	</div>

	<div class="card" style="text-align:center; border: none; box-shadow: none; background: transparent;">
		<div class="btn-row" style="justify-content:center">
			<button class="btn btn-primary" onclick="sendData()">🚀 Create Plugin</button>
			<button id="npmButton" class="btn btn-secondary" onclick="npmInstall()" style="display:none">⬇ NPM Install & Build</button>
		</div>
	</div>

	<script>
		const vscode = acquireVsCodeApi();

		function selectPod(el, value) {
			document.querySelectorAll('.pod-tile').forEach(t => t.classList.remove('selected'));
			el.classList.add('selected');
			el.querySelector('input').checked = true;
			updateUI();
		}

		function toggleCheck(el) {
			const cb = el.querySelector('input[type="checkbox"]');
			cb.checked = !cb.checked;
			el.classList.toggle('checked', cb.checked);
		}

		function updateUI() {
			const selected = document.querySelector('input[name="podVersion"]:checked')?.value;
			const hostGroup = document.getElementById('hostnameGroup');
			const hostField = document.getElementById('hostName');
			const pod2Fields = document.getElementById('pod2Fields');
			const pod1Fields = document.getElementById('pod1Fields');
			const npmButton = document.getElementById('npmButton');

			hostGroup.style.display = (selected === 'POD 1.0') ? 'block' : 'none';
			hostField.readOnly = (selected !== 'POD 1.0');

			const isPod2 = selected === 'POD 2.0 React' || selected === 'POD 2.0 UI5';
			pod2Fields.classList.toggle('hidden', !isPod2);
			pod1Fields.classList.toggle('hidden', isPod2);
			npmButton.style.display = (selected === 'POD 1.1 CLI') ? 'inline-flex' : 'none';
		}
		updateUI();

		function sendData() {
			const podoptions = Array.from(document.querySelectorAll('input[data-group="pod"]:checked'))
				.map(cb => cb.value);
			const miscoptions = Array.from(document.querySelectorAll('input[data-group="misc"]:checked'))
				.map(cb => cb.value);
			const thirdpartylibs = Array.from(document.querySelectorAll('input[data-group="thirdparty"]:checked'))
				.map(cb => cb.value);
			const languages = Array.from(document.querySelectorAll('input[data-group="language"]:checked'))
				.map(cb => cb.value);

			vscode.postMessage({
				command: 'create',
				pluginname: document.getElementById('pluginName').value,
				hostname: document.getElementById('hostName').value,
				namespace: document.getElementById('namespace').value,
				podoptions, miscoptions, thirdpartylibs, languages,
				PODversion: document.querySelector('input[name="podVersion"]:checked')?.value,
				PODname: document.getElementById('PODName').value,
				version: document.getElementById('version').value,
				PODGroup: document.getElementById('PODGroupName').value,
				icon: document.getElementById('iconName').value,
				description: document.getElementById('description').value
			});
		}

		function npmInstall() {
			vscode.postMessage({ command: 'npmInstall' });
		}
	</script>
</body>
</html>`;
}

exports.activate = activate;
function deactivate() {}
module.exports = { activate, deactivate };
