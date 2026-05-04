/**
 * [INPUT]: 依赖 Obsidian ItemView、AnnotationStore 数据与插件主类回调
 * [OUTPUT]: 对外提供 AnnotationSidebarView，总览当前 Markdown/PDF 注释并支持搜索、过滤、排序、导出、跳转
 * [POS]: views 模块的右侧 Leaf 总览面板，被 main.ts 注册
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */

import { ItemView, MarkdownRenderer, MarkdownView, Notice, setIcon, TFile, WorkspaceLeaf } from "obsidian";

import type OverlayAnnotationsPlugin from "../../main";
import {
  ANNOTATION_COLORS,
  AnnotationColor,
  AnnotationSortMode,
  CommentAnnotation,
  PdfCommentAnnotation,
} from "../storage/types";

export const ANNOTATION_SIDEBAR_VIEW = "axl-light-sidebar";

type SidebarRow =
  | {
      id: string;
      type: "highlight" | "pdf highlight";
      color: AnnotationColor;
      text: string;
      content: "";
      createdAt: string;
      startOffset: number;
      pageNumber: number | null;
      orphaned?: boolean;
      comment: null;
    }
  | {
      id: string;
      type: "note";
      color: AnnotationColor;
      text: string;
      content: string;
      createdAt: string;
      startOffset: number;
      pageNumber: null;
      orphaned?: boolean;
      comment: CommentAnnotation;
    }
  | {
      id: string;
      type: "pdf note";
      color: AnnotationColor;
      text: string;
      content: string;
      createdAt: string;
      startOffset: number;
      pageNumber: number;
      orphaned?: boolean;
      comment: PdfCommentAnnotation;
    };

export class AnnotationSidebarView extends ItemView {
  private query = "";
  private color: AnnotationColor | "all" = "all";
  private sort: AnnotationSortMode = "document";

  constructor(leaf: WorkspaceLeaf, private readonly plugin: OverlayAnnotationsPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return ANNOTATION_SIDEBAR_VIEW;
  }

  getDisplayText(): string {
    return "Annotations";
  }

  getIcon(): string {
    return "sticky-note";
  }

  async onOpen(): Promise<void> {
    this.containerEl.addClass("oa-sidebar");
    await this.render();
  }

  async render(): Promise<void> {
    const container = this.containerEl.children[1] ?? this.containerEl;
    container.empty();

    const file = this.app.workspace.getActiveFile();
    container.createEl("h3", { text: "Annotations" });
    this.renderControls(container, file);

    if (!file) {
      container.createDiv({ cls: "oa-empty", text: "Open a Markdown or PDF file to inspect annotations." });
      return;
    }

    const document = await this.plugin.store.getDocument(file);
    const rawRows: SidebarRow[] = [
      ...document.highlights.map((item) => ({
        id: item.id,
        type: "highlight" as const,
        color: item.color,
        text: item.anchor.selectedText,
        content: "" as const,
        createdAt: item.createdAt,
        startOffset: item.anchor.startOffset,
        pageNumber: null,
        orphaned: item.orphaned,
        comment: null,
      })),
      ...document.comments.map((item) => ({
        id: item.id,
        type: "note" as const,
        color: item.color,
        text: item.anchor.selectedText,
        content: item.content,
        createdAt: item.createdAt,
        startOffset: item.anchor.startOffset,
        pageNumber: null,
        orphaned: item.orphaned,
        comment: item,
      })),
      ...document.pdfHighlights.map((item) => ({
        id: item.id,
        type: "pdf highlight" as const,
        color: item.color,
        text: item.anchor.selectedText,
        content: "" as const,
        createdAt: item.createdAt,
        startOffset: Number.MAX_SAFE_INTEGER,
        pageNumber: item.anchor.pageNumber,
        orphaned: item.orphaned,
        comment: null,
      })),
      ...document.pdfComments.map((item) => ({
        id: item.id,
        type: "pdf note" as const,
        color: item.color,
        text: item.anchor.selectedText,
        content: item.content,
        createdAt: item.createdAt,
        startOffset: Number.MAX_SAFE_INTEGER,
        pageNumber: item.anchor.pageNumber,
        orphaned: item.orphaned,
        comment: item,
      })),
    ];
    const rows = rawRows
      .filter((row) => this.color === "all" || row.color === this.color)
      .filter((row) => {
        const haystack = `${row.text} ${row.content}`.toLowerCase();
        return haystack.includes(this.query.toLowerCase());
      })
      .sort((a, b) => {
        if (this.sort === "newest") {
          return b.createdAt.localeCompare(a.createdAt);
        }
        if (this.sort === "oldest") {
          return a.createdAt.localeCompare(b.createdAt);
        }
        return (a.pageNumber ?? 0) - (b.pageNumber ?? 0) || a.startOffset - b.startOffset;
      });

    if (!rows.length) {
      container.createDiv({ cls: "oa-empty", text: "No matching annotations." });
      return;
    }

    const list = container.createDiv({ cls: "oa-sidebar-list" });
    for (const row of rows) {
      const item = list.createDiv({ cls: "oa-sidebar-item" });
      item.toggleClass("is-orphaned", !!row.orphaned);
      const meta = item.createDiv({ cls: "oa-sidebar-meta" });
      meta.createSpan({ cls: "oa-color-chip", text: row.color, attr: { "data-oa-color": row.color } });
      meta.createSpan({ text: row.type });
      if (row.pageNumber) {
        meta.createSpan({ text: `page ${row.pageNumber}` });
      }
      meta.createSpan({ text: new Date(row.createdAt).toLocaleString() });
      item.createDiv({ cls: "oa-sidebar-quote", text: row.text });
      if (row.content) {
        const content = item.createDiv({ cls: "oa-sidebar-content" });
        MarkdownRenderer.render(this.app, row.content, content, file.path, this);
      }

      const actions = item.createDiv({ cls: "oa-sidebar-actions" });
      if (row.comment) {
        const edit = actions.createEl("button", { cls: "oa-icon-button", attr: { type: "button", title: "Edit note" } });
        setIcon(edit, "pencil");
        edit.addEventListener("click", () => this.renderInlineEditor(item, file, row));
      }
      const jump = actions.createEl("button", { text: "Jump", attr: { type: "button" } });
      jump.addEventListener("click", () => this.jumpTo(file, row.startOffset, row.pageNumber));
      const remove = actions.createEl("button", { text: "Delete", attr: { type: "button" } });
      remove.addEventListener("click", async () => {
        await this.plugin.store.removeAnnotation(file, row.id);
        new Notice("Annotation deleted");
        await this.plugin.refreshAnnotations();
      });
    }
  }

  private renderInlineEditor(item: HTMLElement, file: TFile, row: SidebarRow): void {
    if (!row.comment) {
      return;
    }

    item.empty();
    const meta = item.createDiv({ cls: "oa-sidebar-meta" });
    meta.createSpan({ cls: "oa-color-chip", text: row.color, attr: { "data-oa-color": row.color } });
    meta.createSpan({ text: row.type });
    meta.createSpan({ text: "editing" });
    item.createDiv({ cls: "oa-sidebar-quote", text: row.text });

    const editor = item.createEl("textarea", {
      cls: "oa-sidebar-editor",
      attr: { rows: "6", placeholder: "Edit note..." },
    });
    editor.value = row.comment.content;
    editor.focus();
    editor.setSelectionRange(editor.value.length, editor.value.length);

    const actions = item.createDiv({ cls: "oa-sidebar-actions" });
    const save = actions.createEl("button", { text: "Save", cls: "mod-cta", attr: { type: "button" } });
    const cancel = actions.createEl("button", { text: "Cancel", attr: { type: "button" } });

    const saveContent = async (): Promise<void> => {
      const next = {
        ...row.comment,
        content: editor.value,
        updatedAt: new Date().toISOString(),
      };

      if (row.type === "pdf note") {
        await this.plugin.store.updatePdfComment(file, next as PdfCommentAnnotation);
      } else {
        await this.plugin.store.updateComment(file, next as CommentAnnotation);
      }
      await this.plugin.refreshAnnotations();
    };

    save.addEventListener("click", () => {
      void saveContent();
    });
    cancel.addEventListener("click", () => {
      void this.render();
    });
    editor.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void saveContent();
      }
    });
  }

  private renderControls(container: Element, file: TFile | null): void {
    const controls = container.createDiv({ cls: "oa-sidebar-controls" });
    const search = controls.createEl("input", {
      cls: "oa-sidebar-search",
      attr: { type: "search", placeholder: "Search annotations" },
    });
    search.value = this.query;
    search.addEventListener("input", async () => {
      this.query = search.value;
      await this.render();
    });

    const color = controls.createEl("select");
    color.createEl("option", { text: "All colors", value: "all" });
    for (const item of ANNOTATION_COLORS) {
      color.createEl("option", { text: item, value: item });
    }
    color.value = this.color;
    color.addEventListener("change", async () => {
      this.color = color.value as AnnotationColor | "all";
      await this.render();
    });

    const sort = controls.createEl("select");
    for (const item of ["document", "newest", "oldest"] as const) {
      sort.createEl("option", { text: item, value: item });
    }
    sort.value = this.sort;
    sort.addEventListener("change", async () => {
      this.sort = sort.value as AnnotationSortMode;
      await this.render();
    });

    const exportButton = controls.createEl("button", { text: "Export", attr: { type: "button" } });
    exportButton.disabled = !file;
    exportButton.addEventListener("click", async () => {
      if (!file) {
        return;
      }
      const exported = await this.plugin.store.exportNotes(file);
      new Notice(`Exported notes to ${exported.path}`);
    });
  }

  private async jumpTo(file: TFile, offset: number, pageNumber: number | null): Promise<void> {
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file);
    if (file.extension.toLowerCase() === "pdf") {
      window.setTimeout(() => {
        const page = document.querySelector<HTMLElement>(
          `.workspace-leaf.mod-active .pdf-page[data-page-number="${pageNumber}"], .workspace-leaf.mod-active .page[data-page-number="${pageNumber}"]`,
        );
        page?.scrollIntoView({ block: "center" });
        page?.addClass("oa-flash-target");
        window.setTimeout(() => page?.removeClass("oa-flash-target"), 850);
      }, 120);
      return;
    }

    const view = leaf.view instanceof MarkdownView ? leaf.view : this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) {
      return;
    }

    const pos = view.editor.offsetToPos(offset);
    view.editor.setCursor(pos);
    view.editor.scrollIntoView({ from: pos, to: pos }, true);
    view.containerEl.addClass("oa-flash-target");
    window.setTimeout(() => view.containerEl.removeClass("oa-flash-target"), 850);
  }
}
