# ShardM SAP DM POD Plugin Generator

Generate SAP Digital Manufacturing POD plugins directly from VS Code. Supports all POD versions.

## Features

- **5 POD versions**: 1.0, 1.1, 1.1 CLI, 2.0 UI5, 2.0 React
- **Webview UI** with conditional fields per POD version
- **ZIP workspace** command for easy plugin packaging
- **i18n** support with 28 locales
- **3rd-party libraries**: Lodash, Moment, MQTT.js, Socket.IO, Date-FNS

## Usage

### Create a Plugin

1. Open an empty folder in VS Code (`File > Open Folder...`)
2. Press `Ctrl+Shift+P` → `Create SAP DM POD Plugin`
3. Fill in the form and click **Create Plugin**

### ZIP the Workspace

After generating your plugin:
- Press `Ctrl+Shift+P` → `ZIP all files in the current workspace`
- Right-click the status bar → `ZIP all files in the current workspace`

The ZIP skips `node_modules/` for standard PODs, and zips only the `dist/` folder for POD 1.1 CLI.

## POD Version Guide

| Version | Description | Template Engine | Build |
|---------|-------------|----------------|-------|
| POD 1.0 | Legacy SAPUI5 | SAPUI5 + MTA | CF push |
| POD 1.1 | Current SAPUI5 | SAPUI5 + MTA | CF push |
| POD 1.1 CLI | SAPUI5 + UI5 CLI | SAPUI5 + UI5 CLI | `npm run build` |
| POD 2.0 UI5 | Next-gen UI5 widget | SAPUI5 POD 2 | Deploy via extension.json |
| POD 2.0 React | React widget | React 19 | `npm install && npm run build` |

## Commands

| Command | ID | Description |
|---------|----|-------------|
| Create SAP DM POD Plugin | `SHARD_M.POD_Plugin` | Opens the plugin generator form |
| ZIP all files in workspace | `SHARD_M.zipWorkspace` | Zips workspace for deployment |

## Development

```bash
# Clone and install
git clone https://github.com/shardm/shardm-sap-dmc-pod
cd shardm-sap-dmc-pod
npm install

# Package VSIX
npm run package

# Debug in VS Code
code . && F5
```

## License

MIT
