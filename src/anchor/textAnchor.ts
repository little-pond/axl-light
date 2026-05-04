/**
 * [INPUT]: 依赖 Markdown 原文、选区 offset 与 fuzzyMatch 的容错结果
 * [OUTPUT]: 对外提供 createTextAnchor、resolveTextAnchor、relocateDocumentAnchors
 * [POS]: anchor 模块的文本锚点算法核心，承担非侵入式注释的定位恢复
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */

import { FileAnnotationDocument, LocatedAnchor, TextAnchor } from "../storage/types";
import { findBestFuzzyMatch } from "./fuzzyMatch";

const CONTEXT_LENGTH = 20;

export function createTextAnchor(source: string, startOffset: number, endOffset: number): TextAnchor {
  const normalizedSource = normalizeLineEndings(source);
  const start = Math.max(0, Math.min(startOffset, normalizedSource.length));
  const end = Math.max(start, Math.min(endOffset, normalizedSource.length));

  return {
    startOffset: start,
    endOffset: end,
    selectedText: normalizedSource.slice(start, end),
    prefix: normalizedSource.slice(Math.max(0, start - CONTEXT_LENGTH), start),
    suffix: normalizedSource.slice(end, Math.min(normalizedSource.length, end + CONTEXT_LENGTH)),
  };
}

export function resolveTextAnchor(source: string, anchor: TextAnchor): LocatedAnchor {
  const normalizedSource = normalizeLineEndings(source);
  const normalizedAnchor = normalizeAnchor(anchor);
  const direct = normalizedSource.slice(normalizedAnchor.startOffset, normalizedAnchor.endOffset);
  if (direct === normalizedAnchor.selectedText) {
    return {
      anchor: normalizedAnchor,
      orphaned: false,
      confidence: 1,
    };
  }

  const contextual = findContextualMatch(normalizedSource, normalizedAnchor);
  if (contextual) {
    return contextual;
  }

  const fuzzy = findBestFuzzyMatch(normalizedSource, normalizedAnchor.selectedText, normalizedAnchor.startOffset);
  if (fuzzy) {
    return {
      anchor: createTextAnchor(normalizedSource, fuzzy.startOffset, fuzzy.endOffset),
      orphaned: fuzzy.confidence < 0.55,
      confidence: fuzzy.confidence,
    };
  }

  return {
    anchor: normalizedAnchor,
    orphaned: true,
    confidence: 0,
  };
}

export function relocateDocumentAnchors(source: string, document: FileAnnotationDocument): FileAnnotationDocument {
  return {
    ...document,
    highlights: document.highlights.map((highlight) => {
      const resolved = resolveTextAnchor(source, highlight.anchor);
      return {
        ...highlight,
        anchor: resolved.anchor,
        orphaned: resolved.orphaned,
      };
    }),
    comments: document.comments.map((comment) => {
      const resolved = resolveTextAnchor(source, comment.anchor);
      return {
        ...comment,
        anchor: resolved.anchor,
        orphaned: resolved.orphaned,
      };
    }),
  };
}

function findContextualMatch(source: string, anchor: TextAnchor): LocatedAnchor | null {
  let cursor = source.indexOf(anchor.selectedText);
  let best: LocatedAnchor | null = null;

  while (cursor >= 0) {
    const end = cursor + anchor.selectedText.length;
    const prefix = source.slice(Math.max(0, cursor - CONTEXT_LENGTH), cursor);
    const suffix = source.slice(end, Math.min(source.length, end + CONTEXT_LENGTH));
    const confidence = contextScore(anchor.prefix, prefix) * 0.45 + contextScore(anchor.suffix, suffix) * 0.45 + 0.1;

    if (!best || confidence > best.confidence) {
      best = {
        anchor: createTextAnchor(source, cursor, end),
        orphaned: confidence < 0.5,
        confidence,
      };
    }

    cursor = source.indexOf(anchor.selectedText, cursor + 1);
  }

  return best && best.confidence >= 0.5 ? best : null;
}

function contextScore(expected: string, actual: string): number {
  if (!expected && !actual) {
    return 1;
  }

  if (!expected || !actual) {
    return 0;
  }

  if (actual.endsWith(expected) || expected.endsWith(actual)) {
    return 1;
  }

  let shared = 0;
  const max = Math.min(expected.length, actual.length);
  for (let index = 1; index <= max; index += 1) {
    if (expected.slice(-index) === actual.slice(-index)) {
      shared = index;
    }
  }

  return shared / Math.max(expected.length, actual.length);
}

function normalizeAnchor(anchor: TextAnchor): TextAnchor {
  return {
    ...anchor,
    selectedText: normalizeLineEndings(anchor.selectedText),
    prefix: normalizeLineEndings(anchor.prefix),
    suffix: normalizeLineEndings(anchor.suffix),
  };
}

function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n/g, "\n");
}
