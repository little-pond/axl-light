/**
 * [INPUT]: 依赖 Reading View 渲染 DOM、TextAnchor 数据与 fuzzyMatch 的容错定位能力
 * [OUTPUT]: 对外提供 installReadingViewHighlights，在非 CodeMirror 阅读模式中注入视觉高亮
 * [POS]: editor 模块的 Reading View 投影层，与 highlightExtension 分别覆盖 HTML DOM 与 CM6
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */

import { MarkdownPostProcessorContext, MarkdownRenderChild, Platform } from "obsidian";

import { findBestFuzzyMatch } from "../anchor/fuzzyMatch";
import { AnnotationColor, CommentAnnotation, HighlightAnnotation, TextAnchor } from "../storage/types";

type ReadingMark = Pick<HighlightAnnotation | CommentAnnotation, "id" | "color" | "anchor" | "orphaned">;

interface InstallReadingHighlightsOptions {
  root: HTMLElement;
  context: MarkdownPostProcessorContext;
  marks: ReadingMark[];
}

interface TextSegment {
  node: Text;
  start: number;
  end: number;
}

interface RenderedRange {
  start: number;
  end: number;
}

const MARK_SELECTOR = ".oa-reading-highlight";
const MOBILE_RENDER_DELAYS = [0, 80, 220, 520, 900];
const DESKTOP_RENDER_DELAYS = [0, 40, 160];

export function installReadingViewHighlights(options: InstallReadingHighlightsOptions): void {
  const component = new MarkdownRenderChild(options.root);
  let frame: number | null = null;
  let disposed = false;

  const render = (): void => {
    if (disposed) {
      return;
    }

    if (frame !== null) {
      cancelAnimationFrame(frame);
    }

    frame = requestAnimationFrame(() => {
      frame = null;
      renderReadingHighlights(options.root, options.marks);
    });
  };

  const delays = Platform.isMobile ? MOBILE_RENDER_DELAYS : DESKTOP_RENDER_DELAYS;
  for (const delay of delays) {
    const timer = window.setTimeout(render, delay);
    component.register(() => window.clearTimeout(timer));
  }

  const observer = new MutationObserver((mutations) => {
    if (mutations.every(isOwnHighlightMutation)) {
      return;
    }

    render();
  });
  observer.observe(options.root, { childList: true, subtree: true, characterData: true });

  component.register(() => {
    disposed = true;
    if (frame !== null) {
      cancelAnimationFrame(frame);
    }
    observer.disconnect();
  });
  options.context.addChild(component);
}

function renderReadingHighlights(root: HTMLElement, marks: ReadingMark[]): void {
  const liveMarks = marks
    .filter((mark) => !mark.orphaned && mark.anchor.selectedText.trim())
    .sort((left, right) => right.anchor.selectedText.length - left.anchor.selectedText.length);

  for (const mark of liveMarks) {
    if (root.querySelector(`${MARK_SELECTOR}[data-oa-id="${cssEscape(mark.id)}"]`)) {
      continue;
    }

    wrapRenderedAnchor(root, mark.anchor, mark.color, mark.id);
  }
}

function wrapRenderedAnchor(root: HTMLElement, anchor: TextAnchor, color: AnnotationColor, id: string): boolean {
  const snapshot = collectText(root);
  if (!snapshot.text.trim()) {
    return false;
  }

  const range = locateRenderedRange(snapshot.text, anchor);
  if (!range || range.start === range.end) {
    return false;
  }

  return wrapRange(snapshot.segments, range, color, id);
}

function locateRenderedRange(renderedText: string, anchor: TextAnchor): RenderedRange | null {
  const exact = renderedText.indexOf(anchor.selectedText);
  if (exact >= 0) {
    return {
      start: exact,
      end: exact + anchor.selectedText.length,
    };
  }

  const fuzzy = findBestFuzzyMatch(
    renderedText,
    anchor.selectedText,
    Math.min(anchor.startOffset, Math.max(0, renderedText.length - anchor.selectedText.length)),
  );
  if (!fuzzy || fuzzy.confidence < 0.55) {
    return null;
  }

  return {
    start: fuzzy.startOffset,
    end: fuzzy.endOffset,
  };
}

function collectText(root: HTMLElement): { text: string; segments: TextSegment[] } {
  const segments: TextSegment[] = [];
  let text = "";
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest(`${MARK_SELECTOR}, script, style, textarea, input`)) {
        return NodeFilter.FILTER_REJECT;
      }

      if (!node.textContent) {
        return NodeFilter.FILTER_REJECT;
      }

      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let node = walker.nextNode() as Text | null;
  while (node) {
    const start = text.length;
    text += node.textContent ?? "";
    segments.push({ node, start, end: text.length });
    node = walker.nextNode() as Text | null;
  }

  return { text, segments };
}

function wrapRange(segments: TextSegment[], range: RenderedRange, color: AnnotationColor, id: string): boolean {
  const touched = segments.filter((segment) => segment.end > range.start && segment.start < range.end);
  if (!touched.length) {
    return false;
  }

  for (const segment of touched) {
    const localStart = Math.max(0, range.start - segment.start);
    const localEnd = Math.min(segment.node.length, range.end - segment.start);
    if (localStart >= localEnd || !segment.node.parentNode) {
      continue;
    }

    const selected = splitTextRange(segment.node, localStart, localEnd);
    const mark = document.createElement("mark");
    mark.className = "oa-reading-highlight oa-highlight";
    mark.dataset.oaColor = color;
    mark.dataset.oaId = id;
    mark.tabIndex = 0;
    selected.parentNode?.insertBefore(mark, selected);
    mark.appendChild(selected);
  }

  return true;
}

function splitTextRange(node: Text, start: number, end: number): Text {
  let selected = node;
  if (start > 0) {
    selected = selected.splitText(start);
  }

  const selectedLength = end - start;
  if (selectedLength < selected.length) {
    selected.splitText(selectedLength);
  }

  return selected;
}

function isOwnHighlightMutation(mutation: MutationRecord): boolean {
  const target = mutation.target;
  if (target instanceof HTMLElement && target.closest(MARK_SELECTOR)) {
    return true;
  }

  return Array.from(mutation.addedNodes).every((node) => {
    return node instanceof HTMLElement && Boolean(node.closest(MARK_SELECTOR));
  });
}

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }

  return value.replace(/["\\]/g, "\\$&");
}
