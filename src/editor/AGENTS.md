# editor/
> L2 | 父级: /Users/epiphanyxiao/Documents/Playground/obsidian-annotation-plugin/src/AGENTS.md

成员清单
highlightExtension.ts: CodeMirror 6 Decoration 高亮层，只渲染视觉标记不修改文档。
readingViewHighlight.ts: Reading View DOM 高亮层，兼容移动端延迟渲染与虚拟滚动补注入。
selectionToolbar.ts: 浮动选择工具栏，提供颜色、便签、复制与总览入口。
stickyNoteWidget.ts: 便利贴叠加层，使用 coordsAtPos、ResizeObserver、scroll 同步定位。

法则: 编辑器只投影·原文不写入·交互从选区出发

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
