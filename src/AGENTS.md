# src/
> L2 | 父级: /Users/epiphanyxiao/Documents/Playground/obsidian-annotation-plugin/AGENTS.md

成员清单
anchor/textAnchor.ts: 文本锚点生成与恢复，维护 offset、selectedText、prefix、suffix 的定位语义。
anchor/fuzzyMatch.ts: 模糊匹配恢复器，处理文件轻微改动后的锚点迁移。
editor/highlightExtension.ts: CodeMirror 6 高亮装饰层，使用 Decoration.mark 非侵入式绘制。
editor/readingViewHighlight.ts: Reading View DOM 高亮层，使用延迟渲染、MutationObserver 与 fuzzy matching 兼容移动端。
editor/selectionToolbar.ts: 选中文本后的浮动工具栏，提供颜色、便签、复制和总览入口。
editor/stickyNoteWidget.ts: 编辑器旁便利贴叠加层，负责 DOM 卡片、滚动同步与连接线。
pdf/pdfAnnotationLayer.ts: PDF 注释控制器，使用页码与矩形百分比坐标绘制非侵入式高亮和右侧便签栏。
storage/types.ts: sidecar JSON、设置、锚点、高亮、便签、索引的类型真相源。
storage/annotationStore.ts: .obsidian-annotations 持久化后端，读写文件 JSON 与全局 index。
views/annotationPopover.ts: 窄屏与阅读模式弹层，点击高亮后展示 sidecar 中的高亮和便签内容。
views/sidebarView.ts: 右侧总览面板，支持搜索、颜色筛选、排序、导出和跳转。
views/stickyNoteView.ts: 单张便利贴卡片组件，支持 Markdown 渲染、折叠与编辑。
settings/settingsTab.ts: 插件设置页，管理默认颜色、便签栏、窄屏折叠、连接线、作者和迁移策略。
utils/positioning.ts: 便签避让布局算法，按原文顺序堆叠并避免重叠。
utils/leaderLine.ts: SVG 连接线绘制器，将便签和原文锚点连接。

法则: 类型单一真相·业务不懂存储·渲染只做投影·UI 只做交互

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
