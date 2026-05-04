/**
 * [INPUT]: 依赖 Obsidian Plugin API、CM6 扩展、sidecar AnnotationStore、锚点算法、视图与设置模块
 * [OUTPUT]: 对外提供 OverlayAnnotationsPlugin 主类，注册 ribbon 图标、命令、浮动工具栏、高亮、右侧便签栏、窄屏弹层、侧栏、设置和 vault 事件
 * [POS]: 插件装配根，协调模块但不修改用户 Markdown 原文
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */

import { Editor, MarkdownPostProcessorContext, MarkdownView, Modal, Notice, Plugin, TFile } from "obsidian";

import { createTextAnchor, relocateDocumentAnchors } from "./src/anchor/textAnchor";
import { createHighlightExtension } from "./src/editor/highlightExtension";
import { installReadingViewHighlights } from "./src/editor/readingViewHighlight";
import { SelectionToolbar } from "./src/editor/selectionToolbar";
import { createStickyNoteExtension } from "./src/editor/stickyNoteWidget";
import { PdfAnnotationLayer } from "./src/pdf/pdfAnnotationLayer";
import { AnnotationSettingsTab } from "./src/settings/settingsTab";
import { AnnotationStore } from "./src/storage/annotationStore";
import {
  AnnotationColor,
  AnnotationPluginSettings,
  CommentAnnotation,
  DEFAULT_SETTINGS,
  HighlightAnnotation,
  SelectionSnapshot,
} from "./src/storage/types";
import { AnnotationPopover } from "./src/views/annotationPopover";
import { ANNOTATION_SIDEBAR_VIEW, AnnotationSidebarView } from "./src/views/sidebarView";

export default class OverlayAnnotationsPlugin extends Plugin {
  settings: AnnotationPluginSettings = DEFAULT_SETTINGS;
  store!: AnnotationStore;

  private toolbar!: SelectionToolbar;
  private popover!: AnnotationPopover;
  private pdfLayer!: PdfAnnotationLayer;
  private lastSelection: SelectionSnapshot | null = null;
  private renameMigrationTimer: number | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.store = new AnnotationStore(this.app);
    await this.store.initialize();

    this.registerView(ANNOTATION_SIDEBAR_VIEW, (leaf) => new AnnotationSidebarView(leaf, this));
    this.registerEditorExtension([
      createHighlightExtension({
        getDocument: (filePath) => this.store.getCachedDocument(filePath),
        getVersion: () => this.store.version,
        rememberSelection: (filePath, startOffset, endOffset, selectedText) => {
          this.lastSelection = { filePath, startOffset, endOffset, selectedText };
        },
      }),
      createStickyNoteExtension({
        plugin: this,
        getDocument: (filePath) => this.store.getCachedDocument(filePath),
        getSettings: () => this.settings,
        getVersion: () => this.store.version,
        onCommentChanged: async (filePath, comment) => {
          const file = this.app.vault.getAbstractFileByPath(filePath);
          if (file instanceof TFile) {
            await this.store.updateComment(file, comment);
            await this.refreshAnnotations();
          }
        },
        onCommentDeleted: async (filePath, comment) => {
          const file = this.app.vault.getAbstractFileByPath(filePath);
          if (file instanceof TFile) {
            await this.store.removeAnnotation(file, comment.id);
            await this.refreshAnnotations();
          }
        },
      }),
    ]);

    this.toolbar = new SelectionToolbar({
      onHighlight: (color) => this.createHighlight(color),
      onComment: () => this.createComment(),
      onCopy: () => this.copySelection(),
      onOpenSidebar: () => this.activateSidebar(),
    });
    this.popover = new AnnotationPopover({ app: this.app, component: this });
    this.pdfLayer = new PdfAnnotationLayer({
      app: this.app,
      component: this,
      getSettings: () => this.settings,
      getDocument: (file) => this.store.getDocument(file),
      getCachedDocument: (filePath) => this.store.getCachedDocument(filePath),
      addHighlight: async (file, highlight) => {
        await this.store.addPdfHighlight(file, highlight);
        await this.refreshAnnotations();
      },
      addComment: async (file, comment) => {
        await this.store.addPdfComment(file, comment);
        await this.refreshAnnotations();
      },
      updateComment: async (file, comment) => {
        await this.store.updatePdfComment(file, comment);
        await this.refreshAnnotations();
      },
      deleteAnnotation: async (file, annotationId) => {
        await this.store.removeAnnotation(file, annotationId);
        await this.refreshAnnotations();
      },
    });

    this.addSettingTab(new AnnotationSettingsTab(this));
    this.registerRibbonIcon();
    this.registerCommands();
    this.registerEvents();
    this.pdfLayer.register();
    this.registerMarkdownPostProcessor((element, context) => this.renderReadingHighlights(element, context));
  }

  onunload(): void {
    if (this.renameMigrationTimer !== null) {
      window.clearTimeout(this.renameMigrationTimer);
    }
    this.toolbar?.destroy();
    this.popover?.destroy();
    this.app.workspace.detachLeavesOfType(ANNOTATION_SIDEBAR_VIEW);
  }

  async loadSettings(): Promise<void> {
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...((await this.loadData()) ?? {}),
    };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async refreshAnnotations(): Promise<void> {
    this.app.workspace.updateOptions();
    for (const leaf of this.app.workspace.getLeavesOfType(ANNOTATION_SIDEBAR_VIEW)) {
      const view = leaf.view;
      if (view instanceof AnnotationSidebarView) {
        await view.render();
      }
    }
  }

  private registerRibbonIcon(): void {
    const icon = this.addRibbonIcon("highlighter", "Open Axl Light", () => {
      void this.activateSidebar();
    });
    icon.addClass("oa-ribbon-icon");
  }

  private registerCommands(): void {
    this.addCommand({
      id: "highlight-selection",
      name: "Highlight selected text",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "h" }],
      callback: () => this.createHighlight(this.settings.defaultHighlightColor),
    });

    this.addCommand({
      id: "add-sticky-note",
      name: "Add sticky note to selection",
      hotkeys: [{ modifiers: ["Mod", "Alt"], key: "m" }],
      callback: () => this.createComment(),
    });

    this.addCommand({
      id: "toggle-sticky-notes",
      name: "Toggle sticky note lane",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "n" }],
      callback: async () => {
        this.settings.stickyNotesVisible = !this.settings.stickyNotesVisible;
        await this.saveSettings();
        await this.refreshAnnotations();
      },
    });

    this.addCommand({
      id: "open-annotation-sidebar",
      name: "Open annotation overview",
      callback: () => this.activateSidebar(),
    });
  }

  private registerEvents(): void {
    this.registerDomEvent(document, "selectionchange", () => this.toolbar.showForSelection());
    this.registerDomEvent(document, "mousedown", (event) => {
      if (!(event.target instanceof HTMLElement) || !event.target.closest(".oa-selection-toolbar")) {
        window.setTimeout(() => this.toolbar.showForSelection(), 0);
      }
    });
    this.registerDomEvent(document, "click", (event) => {
      void this.handleAnnotationClick(event);
    });

    this.registerEvent(
      this.app.vault.on("modify", async (file) => {
        if (!(file instanceof TFile) || file.extension !== "md") {
          return;
        }

        const document = await this.store.getDocument(file);
        const source = await this.app.vault.cachedRead(file);
        const relocated = relocateDocumentAnchors(source, document);
        await this.store.saveDocument({
          ...relocated,
          fileHash: await this.store.hashFile(file),
          lastModified: new Date().toISOString(),
        });
        await this.refreshAnnotations();
      }),
    );

    this.registerEvent(
      this.app.vault.on("rename", async (file, oldPath) => {
        if (!this.settings.migrateOnRename || !(file instanceof TFile) || file.extension !== "md") {
          return;
        }

        if (this.renameMigrationTimer !== null) {
          window.clearTimeout(this.renameMigrationTimer);
        }

        this.renameMigrationTimer = window.setTimeout(async () => {
          await this.store.migrateFilePath(oldPath, file);
          await this.refreshAnnotations();
          this.renameMigrationTimer = null;
        }, 100);
      }),
    );

    this.registerEvent(
      this.app.workspace.on("file-open", async (file) => {
        if (file instanceof TFile && ["md", "pdf"].includes(file.extension.toLowerCase())) {
          this.popover.hide();
          await this.store.getDocument(file);
          await this.refreshAnnotations();
        }
      }),
    );
  }

  private async createHighlight(color: AnnotationColor): Promise<void> {
    if (this.pdfLayer.isPdfActive()) {
      await this.pdfLayer.createHighlight(color);
      this.toolbar.hide();
      return;
    }

    const snapshot = await this.resolveSelection();
    if (!snapshot) {
      new Notice("Select text first.");
      return;
    }

    const file = this.app.vault.getAbstractFileByPath(snapshot.filePath);
    if (!(file instanceof TFile)) {
      return;
    }

    const highlight: HighlightAnnotation = {
      id: crypto.randomUUID(),
      color,
      anchor: createTextAnchor(await this.app.vault.cachedRead(file), snapshot.startOffset, snapshot.endOffset),
      createdAt: new Date().toISOString(),
    };

    await this.store.addHighlight(file, highlight);
    await this.refreshAnnotations();
    this.toolbar.hide();
  }

  private async createComment(): Promise<void> {
    if (this.pdfLayer.isPdfActive()) {
      const content = await new CommentModal(this.app, "").openAndRead();
      if (content !== null) {
        await this.pdfLayer.createComment(this.settings.defaultHighlightColor, content, this.settings.defaultAuthor);
      }
      this.toolbar.hide();
      return;
    }

    const snapshot = await this.resolveSelection();
    if (!snapshot) {
      new Notice("Select text first.");
      return;
    }

    const file = this.app.vault.getAbstractFileByPath(snapshot.filePath);
    if (!(file instanceof TFile)) {
      return;
    }

    const content = await new CommentModal(this.app, "").openAndRead();
    if (content === null) {
      return;
    }

    const now = new Date().toISOString();
    const comment: CommentAnnotation = {
      id: crypto.randomUUID(),
      anchor: createTextAnchor(await this.app.vault.cachedRead(file), snapshot.startOffset, snapshot.endOffset),
      content,
      color: this.settings.defaultHighlightColor,
      position: { offsetX: 20, offsetY: 0 },
      collapsed: false,
      author: this.settings.defaultAuthor,
      createdAt: now,
      updatedAt: now,
      replies: [],
      resolved: false,
    };

    await this.store.addComment(file, comment);
    await this.refreshAnnotations();
    this.toolbar.hide();
  }

  private async resolveSelection(): Promise<SelectionSnapshot | null> {
    const editor = this.activeEditor();
    if (editor?.file) {
      const selectedText = editor.editor.getSelection();
      if (selectedText) {
        const from = editor.editor.posToOffset(editor.editor.getCursor("from"));
        const to = editor.editor.posToOffset(editor.editor.getCursor("to"));
        this.lastSelection = { filePath: editor.file.path, startOffset: from, endOffset: to, selectedText };
        return this.lastSelection;
      }
    }

    const file = this.app.workspace.getActiveFile();
    const selectedText = window.getSelection()?.toString().trim() ?? "";
    if (file && selectedText) {
      const source = await this.app.vault.cachedRead(file);
      const start = source.indexOf(selectedText);
      if (start >= 0) {
        this.lastSelection = {
          filePath: file.path,
          startOffset: start,
          endOffset: start + selectedText.length,
          selectedText,
        };
        return this.lastSelection;
      }
    }

    return this.lastSelection;
  }

  private activeEditor(): { editor: Editor; file: TFile | null } | null {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    return view ? { editor: view.editor, file: view.file } : null;
  }

  private async activateSidebar(): Promise<void> {
    let leaf = this.app.workspace.getLeavesOfType(ANNOTATION_SIDEBAR_VIEW)[0];
    if (!leaf) {
      const nextLeaf = this.app.workspace.getRightLeaf(false);
      if (!nextLeaf) {
        return;
      }
      leaf = nextLeaf;
      await leaf.setViewState({ type: ANNOTATION_SIDEBAR_VIEW, active: true });
    }
    this.app.workspace.revealLeaf(leaf);
  }

  private copySelection(): void {
    const text = window.getSelection()?.toString() || this.activeEditor()?.editor.getSelection() || "";
    if (text) {
      navigator.clipboard.writeText(text);
      new Notice("Copied selection");
    }
  }

  private async handleAnnotationClick(event: MouseEvent): Promise<void> {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      this.popover.hide();
      return;
    }

    const mark = target.closest<HTMLElement>(".oa-highlight, .oa-reading-highlight");
    if (!mark) {
      if (!target.closest(".oa-annotation-popover")) {
        this.popover.hide();
      }
      return;
    }

    const annotationId = mark.dataset.oaId;
    const file = this.app.workspace.getActiveFile();
    if (!annotationId || !(file instanceof TFile)) {
      return;
    }

    const document = this.store.getCachedDocument(file.path) ?? (await this.store.getDocument(file));
    const primary =
      document.comments.find((comment) => comment.id === annotationId) ??
      document.highlights.find((highlight) => highlight.id === annotationId);
    if (!primary) {
      return;
    }

    const sameAnchorComments = document.comments.filter((comment) => {
      return (
        comment.id !== primary.id &&
        !comment.orphaned &&
        comment.anchor.startOffset === primary.anchor.startOffset &&
        comment.anchor.endOffset === primary.anchor.endOffset
      );
    });
    const items = [primary, ...sameAnchorComments].map((annotation) => AnnotationPopover.itemFromAnnotation(annotation));

    event.preventDefault();
    event.stopPropagation();
    this.popover.show({
      rect: mark.getBoundingClientRect(),
      sourcePath: file.path,
      items,
    });
  }

  private async renderReadingHighlights(element: HTMLElement, context: MarkdownPostProcessorContext): Promise<void> {
    if (!context.sourcePath) {
      return;
    }

    const file = this.app.vault.getAbstractFileByPath(context.sourcePath);
    if (!(file instanceof TFile)) {
      return;
    }

    const document = await this.store.getDocument(file);
    const marks = [...document.highlights, ...document.comments].filter((item) => !item.orphaned);
    installReadingViewHighlights({ root: element, context, marks });
  }
}

class CommentModal extends Modal {
  private value: string | null = null;
  private resolve!: (value: string | null) => void;

  constructor(app: OverlayAnnotationsPlugin["app"], private readonly initialValue: string) {
    super(app);
  }

  openAndRead(): Promise<string | null> {
    this.open();
    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  onOpen(): void {
    this.contentEl.empty();
    this.contentEl.createEl("h2", { text: "Sticky note" });
    const input = this.contentEl.createEl("textarea", {
      cls: "oa-modal-textarea",
      attr: { rows: "8", placeholder: "Write Markdown..." },
    });
    input.value = this.initialValue;
    const actions = this.contentEl.createDiv({ cls: "oa-modal-actions" });
    const cancel = actions.createEl("button", { text: "Cancel", attr: { type: "button" } });
    const save = actions.createEl("button", { text: "Save", cls: "mod-cta", attr: { type: "button" } });
    cancel.addEventListener("click", () => {
      this.value = null;
      this.close();
    });
    save.addEventListener("click", () => {
      this.value = input.value.trim();
      this.close();
    });
  }

  onClose(): void {
    this.resolve?.(this.value);
  }
}
