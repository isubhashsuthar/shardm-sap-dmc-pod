# ShardM SAP DM POD Plugin Generator

> A Visual Studio Code extension for scaffolding SAP Digital Manufacturing (DM) POD plugins across all major POD versions — from legacy SAPUI5 to modern React.

[![Version](https://img.shields.io/badge/version-0.0.2-blue)](https://github.com/isubhashsuthar/shardm-sap-dmc-pod/releases)
[![VS Code](https://img.shields.io/badge/VS%20Code-%5E1.99.3-007ACC)](https://code.visualstudio.com)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![PRs](https://img.shields.io/badge/PRs-welcome-brightgreen)](https://github.com/isubhashsuthar/shardm-sap-dmc-pod/pulls)

---

## Overview

This extension provides a **Webview-based graphical interface** inside VS Code to generate complete, production-ready SAP DM POD plugin projects. It eliminates manual boilerplate by scaffolding the full project structure — including i18n, build configs, manifests, service bindings, and third-party library integration — for any POD version.

**Why this extension?** SAP DMC POD plugins require a specific folder structure, component registration, and configuration files that vary significantly between POD versions. This generator handles all the variations so you can focus on plugin logic, not setup.

---

## POD Version Support

| Version | Description | Build Pipeline | Use Case |
|---|---|---|---|
| **POD 1.0** | Legacy SAPUI5 plugin | `cf push` via MTA | Existing POD 1.0 landscapes |
| **POD 1.1** | Current SAPUI5 plugin | `cf push` via MTA | Standard SAP DM implementations |
| **POD 1.1 CLI** | SAPUI5 + UI5 Tooling CLI | `npm run build` → deploy `dist/` | Modern UI5 development workflow |
| **POD 2.0 UI5** | Next-gen SAPUI5 widget | Register via `extension.json` | SAP DM POD 2.0 with UI5 |
| **POD 2.0 React** | React 19 widget | `npm install && npm run build` | SAP DM POD 2.0 with React |

---

## Features

### Core

- **5 POD version generators** — each with correct project structure, component IDs, manifests, and build configs
- **5 POD type selection** — Operation POD, Work Center POD, Order POD, Custom POD, Line Monitor POD
- **18+ language locales** — full i18n.properties generation for 28 languages
- **5 bundled third-party libraries** — Lodash 4.17.21, Moment 2.30.1, MQTT.js 5.13.3, Socket.IO 4.8.1, Date-FNS 4.1.0
- **Conditional scaffolding** — POD 2.0 versions get `extension.json` + icon/description; POD 1.x get pod options and language bundles
- **Workspace ZIP** — one-click packaging, skips `node_modules/`, zips only `dist/` for POD 1.1 CLI

### UX

- **Webview form** inside VS Code with radio buttons, checkboxes, and conditional field visibility
- **Real-time field validation** — plugin name auto-lowercased and sanitized
- **NPM Install button** — appears for POD 1.1 CLI and POD 2.0 React to run build after scaffolding

---

## Quick Start

### Installation

1. **Download** the `.vsix` from [Releases](https://github.com/isubhashsuthar/shardm-sap-dmc-pod/releases)
2. **Install** in VS Code:
   - `Extensions` → `...` → `Install from VSIX...` → select the file
   - Or from CLI: `code --install-extension shardm-sap-dmc-pod-0.0.2.vsix`

### Generate a Plugin

1. Open an **empty folder** in VS Code (`File > Open Folder...`)
2. Open Command Palette (`Ctrl+Shift+P`)
3. Run **ShardM: Create SAP DM POD Plugin**
4. Fill in the Webview form:
   - Select **POD Version** (radio buttons)
   - Enter **Plugin Name**, **Namespace**, **POD Designer Name**
   - Configure version-specific options (POD types, languages, misc options)
   - Optionally select **third-party libraries**
5. Click **Create Plugin**

### Package for Deployment

- `Ctrl+Shift+P` → **ShardM: ZIP Workspace**
- Or right-click the status bar → **ZIP all files in the current workspace**

The ZIP behaviour adapts to the POD version automatically.

---

## Project Structure (Generated)

```
my-plugin/
├── Component.js                  # SAPUI5 component definition
├── MainView.controller.js        # Main controller logic
├── MainView.view.xml             # Main view layout
├── PropertyEditor.js             # POD property editor
├── builder.properties            # Builder metadata
├── components.json               # POD component registration
├── manifest.json                 # SAPUI5 manifest
├── models.js                     # Data models
├── serviceBindings.js            # Backend service bindings
├── i18n.properties               # Default (English) strings
├── i18n/                         # 28 locale translations
│   ├── i18n_de.properties
│   ├── i18n_fr.properties
│   └── ...
├── style.css                     # Plugin styles
├── index.html                    # Entry point
├── mta.yaml                      # MTA deployment descriptor (POD 1.x)
├── xs-app.json                   # XS app router config
├── xs-security.json              # Security settings
├── package.json                  # Dependencies
└── 3rdparty/                     # Selected libraries (optional)
    ├── lodash.min.js
    └── ...
```

*POD 2.0 versions use `extension.json` + widget registration instead of `components.json`; POD 1.1 CLI uses `ui5.yaml` + `dist/` build.*

---

## Commands

| Command Palette Entry | Command ID | When |
|---|---|---|
| `ShardM: Create SAP DM POD Plugin` | `SHARD_M.POD_Plugin` | Always |
| `ShardM: ZIP Workspace` | `SHARD_M.zipWorkspace` | Workspace open |

---

## Development

```bash
# Clone
git clone https://github.com/isubhashsuthar/shardm-sap-dmc-pod.git
cd shardm-sap-dmc-pod

# Install dependencies
npm install

# Package VSIX
npm run package

# Debug in VS Code
code .
# Press F5 → Extension Development Host opens
# Ctrl+Shift+P → ShardM: Create SAP DM POD Plugin
```

---

## Architecture

```
extension.js                  # Entry point: registers commands, manages Webview
├── generateFromTemplate.js   # {{variable}} → value string replacement utility
├── pod1_0.js                 # POD 1.0 generator
├── pod1_1.js                 # POD 1.1 generator
├── pod1_1cli.js              # POD 1.1 CLI generator (+ NPM build)
├── pod2_0_react.js           # POD 2.0 React generator (+ NPM install)
├── pod2_0_ui5.js             # POD 2.0 UI5 generator
├── templates/                # Template files per POD version
│   ├── pod1_0/               # 72 files
│   ├── pod1_1/               # 16 files
│   ├── pod1_1cli/            # 73 files
│   ├── pod2_0_react/         # 8 files
│   └── pod2_0_ui5/           # 31 files
└── 3rdParty/                 # Bundled libraries (5)
```

Each POD generator uses `generateFromTemplate()` to read template files, replace `{{variable}}` placeholders, and write the result to the user's workspace.

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.

---

## License

[MIT](LICENSE) © 2026 Subhash Suthar
