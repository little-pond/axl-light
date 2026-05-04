/**
 * [INPUT]: 依赖 Obsidian MarkdownRenderer、CommentAnnotation 数据与便签操作回调
 * [OUTPUT]: 对外提供 renderStickyNoteCard，用于渲染可折叠、可编辑的便签卡片
 * [POS]: views 模块的便签卡片组件，被 editor/stickyNoteWidget 管理
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */

import { App, Component, MarkdownRenderer, setIcon } from "obsidian";

import { CommentAnnotation } from "../storage/types";

interface StickyNoteCardOptions {
  app: App;
  component: Component;
  sourcePath: string;
  comment: CommentAnnotation;
  onToggle: (comment: CommentAnnotation) => void;
  onUpdate: (comment: CommentAnnotation, content: string) => void;
  onDelete: (comment: CommentAnnotation) => void;
}

export function renderStickyNoteCard(container: HTMLElement, options: StickyNoteCardOptions): HTMLElement {
  container.empty();
  const card = container.createDiv({
    cls: "oa-sticky-card",
    attr: {
      "data-oa-color": options.comment.color,
      "data-oa-id": options.comment.id,
    },
  });

  const header = card.createDiv({ cls: "oa-sticky-header" });
  const color = header.createSpan({ cls: "oa-sticky-color", attr: { "data-oa-color": options.comment.color } });
  color.setAttr("aria-hidden", "true");
  header.createSpan({ cls: "oa-sticky-author", text: options.comment.author });

  const edit = header.createEl("button", {
    cls: "oa-icon-button",
    attr: { type: "button", title: "Edit note" },
  });
  setIcon(edit, "pencil");

  const collapse = header.createEl("button", {
    cls: "oa-icon-button",
    attr: { type: "button", title: options.comment.collapsed ? "Expand" : "Collapse" },
  });
  setIcon(collapse, options.comment.collapsed ? "chevron-down" : "chevron-up");
  collapse.addEventListener("click", () => options.onToggle(options.comment));

  const remove = header.createEl("button", {
    cls: "oa-icon-button",
    attr: { type: "button", title: "Delete note" },
  });
  setIcon(remove, "trash-2");
  remove.addEventListener("click", () => options.onDelete(options.comment));

  if (options.comment.collapsed) {
    card.createDiv({ cls: "oa-sticky-excerpt", text: options.comment.anchor.selectedText });
    return card;
  }

  card.createDiv({ cls: "oa-sticky-excerpt", text: options.comment.anchor.selectedText });
  const content = card.createDiv({ cls: "oa-sticky-content" });
  renderDisplayMode(content, options);
  edit.addEventListener("click", () => renderEditMode(content, options));

  return card;
}

function renderDisplayMode(container: HTMLElement, options: StickyNoteCardOptions): void {
  container.empty();
  const body = container.createDiv({ cls: "oa-sticky-body" });
  MarkdownRenderer.render(options.app, options.comment.content, body, options.sourcePath, options.component);
}

function renderEditMode(container: HTMLElement, options: StickyNoteCardOptions): void {
  container.empty();
  const editor = container.createEl("textarea", {
    cls: "oa-sticky-editor",
    attr: { rows: "5", placeholder: "Write a Markdown note..." },
  });
  editor.value = options.comment.content;
  editor.focus();
  editor.setSelectionRange(editor.value.length, editor.value.length);

  const actions = container.createDiv({ cls: "oa-sticky-edit-actions" });
  const save = actions.createEl("button", { text: "Save", cls: "mod-cta", attr: { type: "button" } });
  const cancel = actions.createEl("button", { text: "Cancel", attr: { type: "button" } });

  const saveContent = (): void => {
    options.onUpdate(options.comment, editor.value);
    renderDisplayMode(container, {
      ...options,
      comment: {
        ...options.comment,
        content: editor.value,
      },
    });
  };

  save.addEventListener("click", saveContent);
  cancel.addEventListener("click", () => renderDisplayMode(container, options));
  editor.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      saveContent();
    }
  });
}
