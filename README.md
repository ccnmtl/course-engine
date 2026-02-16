# Course Engine

A secure, offline-first desktop application for creating and managing EdX/Open edX courses using Excel spreadsheets.

**Course Engine** streamlines the course authoring workflow by allowing you to design your course structure and content in Excel, then instantly convert it into a production-ready OLX (Open Learning XML) archive for importing into EdX Studio. It also supports "round-trip" editing by converting existing EdX course exports back into Excel format.

## Key Features

- **Rapid Authoring** — Build complex course hierarchies (Chapters, Sequentials, Verticals) in a simple spreadsheet view.
- **Round-Trip Editing** — Import existing EdX `.tar.gz` exports to edit them in Excel, then re-export to EdX.
- **Rich Content Support** — Native support for HTML text, Videos (YouTube/HTML5), Multiple Choice Problems, and Open Response Assessments.
- **Secure & Private** — Runs entirely on your local machine. No course data is ever uploaded to a server.
- **Instant Preview** — Visualize your course structure before exporting.

## User Guide

The application includes a comprehensive built-in **User Guide**, accessible by clicking the **📖 User Guide** button in the top-right corner.

The guide covers:
- **Excel Format Reference** — Detailed specifications for each sheet (Structure, Text, Video, Problems, etc.)
- **Workflow Tutorials** — Step-by-step instructions for building and importing courses
- **Tips & Best Practices** — How to avoid common pitfalls during course authoring

## Getting Started (Development)

```bash
cd course-engine
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Building the Desktop App (.dmg)

The app can be packaged as a standalone macOS application using Electron.

### Prerequisites

- Node.js 18+
- npm

### Build Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the Vite dev server for browser development |
| `npm run build` | Build the static web assets to `dist/` |
| `npm run electron:dev` | Build and launch in an Electron window (for testing) |
| `npm run electron:build` | Build and package as a macOS `.dmg` installer |

### Creating the .dmg

```bash
cd course-engine
npm install
npm run electron:build
```

The `.dmg` file will be created in the `course-engine/release/` directory:

```
release/Course Engine-1.0.0-arm64.dmg
```

### Distributing to Users

1. Share the `.dmg` file with users (e.g. via email, shared drive, or internal portal)
2. Users double-click the `.dmg` to mount it
3. Drag **Course Engine** into the **Applications** folder
4. Launch from Applications

> **Note:** The app is currently unsigned. On first launch, users may need to right-click the app → **Open** → click **Open** in the dialog to bypass macOS Gatekeeper.

### Distributing Internal Builds (Bypassing Gatekeeper)

If specific users are unable to open the app due to "App is damaged" or "Unidentified Developer" warnings, they can remove the quarantine attribute using the terminal:

```bash
xattr -cr "/Applications/Course Engine.app"
```

This command clears the extended attributes (including the quarantine flag) that macOS attaches to downloaded files.

### Updating the Version

To create a new release, update the `version` field in `package.json`:

```json
"version": "1.1.0"
```

Then run `npm run electron:build` again. The new `.dmg` will reflect the updated version number.

## Tech Stack

- **Vite** — Dev server and build tool
- **Electron** — Desktop app wrapper
- **electron-builder** — macOS .dmg packaging
- **exceljs** — Excel file reading and writing (secure replacement for xlsx)
- **fflate** — tar.gz compression/decompression
- Pure JavaScript (no framework), vanilla CSS with dark theme

## Supported Content Types

| Type | Description |
|------|-------------|
| Text (HTML) | Rich text content blocks with full HTML support |
| Video | YouTube and HTML5 video embeds with start/end times |
| Problem | Multiple-choice questions with hints and explanations |
| Open Response | Peer/self/staff-assessed open-ended assignments with rubrics |

## Round-Trip Editing

1. Export your course from EdX Studio (**Tools → Export**)
2. Switch to **Import Mode** and upload the `.tar.gz` file
3. Download the Excel workbook
4. Edit the spreadsheet as needed
5. Switch to **Build Mode** and upload the edited workbook
6. Export to `.tar.gz` and re-import into EdX Studio
