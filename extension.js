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
			'SHAR-DM SAP DM POD Plugin Generator',
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
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
			padding: 16px; color: #333;
		}
		h2 { color: #0078D4; border-bottom: 2px solid #0078D4; padding-bottom: 8px; font-size: 20px; }
		h3 { margin-top: 14px; margin-bottom: 6px; font-size: 14px; color: #444; }
		label { display: inline-block; margin: 4px 16px 4px 0; white-space: nowrap; font-size: 13px; }
		input[type="text"] {
			width: 100%; max-width: 500px; padding: 5px 8px;
			border: 1px solid #ccc; border-radius: 3px; font-size: 13px;
		}
		.readonly-input[readonly] { background-color: #f0f0f0; color: #666; cursor: not-allowed; }
		button {
			margin-top: 12px; padding: 7px 22px; background: #0078D4;
			color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 13px;
		}
		button:hover { background: #106EBE; }
		.section { margin-bottom: 10px; }
		.lang-group { display: flex; flex-wrap: wrap; }
		.lang-group label { min-width: 140px; }
	</style>
</head>
<body>

	<h2>SHAR-DM SAP Digital Manufacturing POD Plugin Generator v16</h2>

	<div class="section">
		<h3>Select POD Version</h3>
		<div>
			<label><input type="radio" name="podVersion" value="POD 1.0" onchange="updateUI()"> POD 1.0 (not recommended for new plugins)</label>
			<label><input type="radio" name="podVersion" value="POD 1.1" onchange="updateUI()" checked> POD 1.1</label>
			<label><input type="radio" name="podVersion" value="POD 1.1 CLI" onchange="updateUI()"> POD 1.1 Using UI5 CLI</label>
			<label><input type="radio" name="podVersion" value="POD 2.0 UI5" onchange="updateUI()"> POD 2.0 Using UI5</label>
			<label><input type="radio" name="podVersion" value="POD 2.0 React" onchange="updateUI()"> POD 2.0 Using React</label>
		</div>
	</div>

	<div id="podTypeGroup" class="section">
		<h3>Select POD Type</h3>
		<label><input type="radio" name="pluginType" value="view" checked> View Plugin</label>
		<label><input type="radio" name="pluginType" value="execution" disabled> Execution Plugin (Coming Soon)</label>
	</div>

	<div class="section">
		<h3>Plugin Name</h3>
		<input type="text" id="pluginName" value="pluginname" oninput="this.value = this.value.toLowerCase().replace(/[^a-z]/g, '');"/>
	</div>

	<div class="section">
		<h3>POD Designer Name</h3>
		<input type="text" id="PODName" value="Plugin Name"/>
	</div>

	<div id="PODGroup" class="section" style="display:none">
		<h3>POD Designer Group</h3>
		<input type="text" id="PODGroupName" value="Custom"/>
	</div>

	<div id="iconGroup" class="section" style="display:none">
		<h3>Icon</h3>
		<input type="text" id="iconName" value="sap-icon://locate-me-2"/>
	</div>

	<div id="descriptionGroup" class="section" style="display:none">
		<h3>Description</h3>
		<input type="text" id="description" value="Description"/>
	</div>

	<div class="section">
		<h3>Version</h3>
		<input type="text" id="version" value="0.0.1"/>
	</div>

	<div id="hostnameGroup" class="section" style="display:none">
		<h3>Hostname</h3>
		<input type="text" id="hostName" value="yourhost.execution.eu20.web.dmc.cloud.sap" size="60"/>
	</div>

	<div class="section">
		<h3>Namespace</h3>
		<input type="text" id="namespace" value="company.custom.plugins" size="60"/>
	</div>

	<div id="podTypeHeader" class="section">
		<h3>POD Types Supported</h3>
		<label><input type="checkbox" value="OPERATION" data-group="pod" checked> Operation POD</label>
		<label><input type="checkbox" value="WORK_CENTER" data-group="pod"> Workcenter POD</label>
		<label><input type="checkbox" value="ORDER" data-group="pod"> Order POD</label>
		<label><input type="checkbox" value="OTHER" data-group="pod"> Custom POD</label>
		<label><input type="checkbox" value="MONITOR" data-group="pod"> Line Monitor POD</label>
	</div>

	<div id="podOptions" class="section">
		<h3>Misc Options</h3>
		<label><input type="checkbox" value="multiple" data-group="misc"> Allow Multiple Instances</label>
		<label><input type="checkbox" value="ppenabled" data-group="misc"> Production Process Enabled</label>
	</div>

	<div id="thirdPartyLibs" class="section">
		<h3>3rd Party Libraries</h3>
		<label><input type="checkbox" value="lodash" data-group="thirdparty"> Lodash 4.17.21</label>
		<label><input type="checkbox" value="moment" data-group="thirdparty"> Moment 2.30.1</label>
		<label><input type="checkbox" value="mqtt" data-group="thirdparty"> MQTT.JS 5.13.3</label>
		<label><input type="checkbox" value="socket.io" data-group="thirdparty"> Socket.IO 4.8.1</label>
		<label><input type="checkbox" value="date-fns" data-group="thirdparty"> Date-FNS 4.1.0</label>
	</div>

	<div id="languageGroup" class="section">
		<h3>Language Support</h3>
		<div class="lang-group">
			<label><input type="checkbox" value="bg" data-group="language"> Bulgarian</label>
			<label><input type="checkbox" value="zh_CN" data-group="language"> Simplified Chinese</label>
			<label><input type="checkbox" value="zh_TW" data-group="language"> Traditional Chinese</label>
			<label><input type="checkbox" value="hr" data-group="language"> Croatian</label>
			<label><input type="checkbox" value="cs" data-group="language"> Czech</label>
			<label><input type="checkbox" value="da" data-group="language"> Danish</label>
			<label><input type="checkbox" value="nl" data-group="language"> Dutch</label>
			<label><input type="checkbox" value="en_US" data-group="language"> English (US)</label>
			<label><input type="checkbox" value="en" data-group="language" checked> English</label>
			<label><input type="checkbox" value="fr" data-group="language"> French</label>
			<label><input type="checkbox" value="de" data-group="language"> German</label>
			<label><input type="checkbox" value="hu" data-group="language"> Hungarian</label>
			<label><input type="checkbox" value="it" data-group="language"> Italian</label>
			<label><input type="checkbox" value="ja" data-group="language"> Japanese</label>
			<label><input type="checkbox" value="ko" data-group="language"> Korean</label>
			<label><input type="checkbox" value="lt" data-group="language"> Lithuanian</label>
			<label><input type="checkbox" value="pl" data-group="language"> Polish</label>
			<label><input type="checkbox" value="pt" data-group="language"> Portuguese (Brazilian)</label>
			<label><input type="checkbox" value="ro" data-group="language"> Romanian</label>
			<label><input type="checkbox" value="ru" data-group="language"> Russian</label>
			<label><input type="checkbox" value="sh" data-group="language"> Serbian (Latin)</label>
			<label><input type="checkbox" value="sk" data-group="language"> Slovak</label>
			<label><input type="checkbox" value="sl" data-group="language"> Slovenian</label>
			<label><input type="checkbox" value="es" data-group="language"> Spanish</label>
			<label><input type="checkbox" value="sv" data-group="language"> Swedish</label>
			<label><input type="checkbox" value="th" data-group="language"> Thai</label>
			<label><input type="checkbox" value="tr" data-group="language"> Turkish</label>
			<label><input type="checkbox" value="vi" data-group="language"> Vietnamese</label>
		</div>
	</div>

	<br>
	<button onclick="sendData()">Create</button>
	<button id="npmButton" onclick="npmInstall()" style="display:none">NPM Install and Build</button>

	<script>
		const vscode = acquireVsCodeApi();

		function updateUI() {
			const selected = document.querySelector('input[name="podVersion"]:checked')?.value;
			const hostGroup = document.getElementById('hostnameGroup');
			const podTypeGroup = document.getElementById('podTypeGroup');
			const podTypeHeader = document.getElementById('podTypeHeader');
			const podOptions = document.getElementById('podOptions');
			const thirdPartyLibs = document.getElementById('thirdPartyLibs');
			const languageGroup = document.getElementById('languageGroup');
			const podGroup = document.getElementById('PODGroup');
			const iconGroup = document.getElementById('iconGroup');
			const descriptionGroup = document.getElementById('descriptionGroup');
			const npmButton = document.getElementById('npmButton');

			hostGroup.style.display = (selected === 'POD 1.0') ? 'block' : 'none';

			if (selected === 'POD 2.0 React' || selected === 'POD 2.0 UI5') {
				podTypeGroup.style.display = 'none';
				podTypeHeader.style.display = 'none';
				podOptions.style.display = 'none';
				thirdPartyLibs.style.display = 'none';
				languageGroup.style.display = 'none';
				podGroup.style.display = 'block';
				iconGroup.style.display = 'block';
				descriptionGroup.style.display = 'block';
				npmButton.style.display = 'none';
			} else {
				podTypeGroup.style.display = 'block';
				podTypeHeader.style.display = 'block';
				podOptions.style.display = 'block';
				thirdPartyLibs.style.display = 'block';
				podGroup.style.display = 'none';
				iconGroup.style.display = 'none';
				descriptionGroup.style.display = 'none';
				npmButton.style.display = 'none';
			}

			if (selected === 'POD 2.0 React' || selected === 'POD 1.1 CLI') {
				npmButton.style.display = 'inline';
				languageGroup.style.display = 'none';
			}
		}
		updateUI();

		function sendData() {
			const podoptions = Array.from(document.querySelectorAll('input[data-group="pod"]'))
				.filter(cb => cb.checked).map(cb => cb.value);
			const miscoptions = Array.from(document.querySelectorAll('input[data-group="misc"]'))
				.filter(cb => cb.checked).map(cb => cb.value);
			const thirdpartylibs = Array.from(document.querySelectorAll('input[data-group="thirdparty"]'))
				.filter(cb => cb.checked).map(cb => cb.value);
			const languages = Array.from(document.querySelectorAll('input[data-group="language"]'))
				.filter(cb => cb.checked).map(cb => cb.value);

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
