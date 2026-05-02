# Axl Light

Axl Light is a non-invasive Obsidian plugin for reading highlights and sticky notes. It keeps Markdown and PDF files clean: highlights, notes, replies, positions, and recovery metadata are stored in `.obsidian-annotations/` sidecar JSON files.

## Quick Start

Run this in **Terminal**. Replace the path with your Obsidian vault path:

```bash
curl -fsSL https://raw.githubusercontent.com/epiphie/axl-light/main/scripts/install.sh | bash -s -- "$HOME/Documents/Obsidian Vault"
```

Then restart Obsidian, open `Settings -> Community plugins`, and enable `Axl Light`.

## Install

![Install Axl Light](docs/images/install-axl-light.png)

### Option 1: One-command install

Run this in **Terminal**:

```bash
curl -fsSL https://raw.githubusercontent.com/epiphie/axl-light/main/scripts/install.sh | bash -s -- "/path/to/your/Obsidian Vault"
```

You can also install a specific release version:

```bash
AXL_LIGHT_VERSION="0.1.0" curl -fsSL https://raw.githubusercontent.com/epiphie/axl-light/main/scripts/install.sh | bash -s -- "/path/to/your/Obsidian Vault"
```

This downloads `main.js`, `manifest.json`, and `styles.css` into:

```text
<your-vault>/.obsidian/plugins/axl-light/
```

### Option 2: Manual install

1. Go to the latest release: https://github.com/epiphie/axl-light/releases/latest
2. Download these three files from `Assets`:

- `main.js`
- `manifest.json`
- `styles.css`

3. Create this folder inside your Obsidian vault:

```text
<your-vault>/.obsidian/plugins/axl-light/
```

4. Move the three downloaded files into that folder.
5. Restart Obsidian.
6. Open `Settings -> Community plugins`.
7. Turn off `Restricted mode` if needed.
8. Enable `Axl Light`.

### Option 3: BRAT install

If you use the Obsidian BRAT plugin:

1. Install and enable `BRAT`.
2. Run `BRAT: Add a beta plugin for testing`.
3. Paste this repository URL:

```text
https://github.com/epiphie/axl-light
```

4. Enable `Axl Light` in `Settings -> Community plugins`.

## How to use

### Highlight Markdown or PDF text

![Highlight with Axl Light](docs/images/highlight-with-axl-light.png)

Select text in a Markdown note or PDF, then use the floating toolbar to choose a highlight color, add a sticky note, copy the selection, or open the annotation overview.

### Review sticky notes

![Sticky notes and annotation overview](docs/images/sticky-notes-overview.png)

On desktop, sticky notes live in the right-side reader lane. On narrow panes, click a highlight to open the note popover. The overview panel lets you search, filter, jump, delete, and export annotations.

## Features

- CodeMirror 6 overlay highlights with `Decoration.mark()`
- Floating selection toolbar with six highlight colors, sticky note, copy, and sidebar actions
- Sticky notes in a side lane with Markdown-rendered content and SVG leader lines
- Sidecar storage per Markdown file plus a global index
- Text anchors with exact offsets, selected text, prefix, and suffix
- Fuzzy relocation for lightly edited files
- Sidebar overview with search, color filtering, sorting, jump, delete, and export
- Rename migration for sidecar data when enabled
- PDF overlay highlights using page-number plus page-relative rectangle anchors
- PDF sticky notes in the same right-side reader lane, collapsing to popovers on narrow panes

## Storage

Annotations are written to:

```text
.obsidian-annotations/
  index.json
  notes__reading__book.md.json
  papers__example.pdf.json
```

Markdown source files and PDF binaries are never modified by this plugin.

## Commands

- `Highlight selected text`: `Cmd/Ctrl + Shift + H`
- `Add sticky note to selection`: `Cmd/Ctrl + Alt + M`
- `Toggle sticky note lane`: `Cmd/Ctrl + Shift + N`
- `Open annotation overview`

## Development

```bash
npm install
npm run dev
```

Copy or symlink `main.js`, `manifest.json`, and `styles.css` into:

```text
<vault>/.obsidian/plugins/axl-light/
```

## Release

This repo publishes release assets automatically when a version tag is pushed. The tag must match `manifest.json`:

```bash
npm install
npm run build
git add .
git commit -m "Release Axl Light 0.1.0"
git tag 0.1.0
git push origin main
git push origin 0.1.0
```

GitHub Actions will attach `main.js`, `manifest.json`, and `styles.css` to the release.

## Known Limits

Reading View highlights are rendered by matching selected text in the rendered DOM. Live Preview and Source Mode use CodeMirror offsets and are more precise. PDF support is DOM-based and stores page-relative rectangles, so it depends on Obsidian's built-in PDF viewer structure. For very large annotation sets, the sidebar is ready for virtual scrolling but currently renders the filtered list directly.
