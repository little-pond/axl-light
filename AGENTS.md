# obsidian-annotation-plugin/ - Axl Light overlay annotation plugin for Obsidian reading
> L2 | 父级: /Users/epiphanyxiao/Documents/Playground/AGENTS.md

成员清单
.github/AGENTS.md: GitHub 自动化地图，描述 release workflow 的发布职责。
.gitignore: 发布仓库忽略规则，排除依赖、构建产物、本地 vault 数据。
LICENSE: MIT 开源许可证，满足 Obsidian 社区插件提交前置要求。
annotation-layout-mocks.html: 四种阅读注释布局的静态视觉 mock，用于决策便利贴显示策略。
docs/AGENTS.md: 文档资产地图，管理 README 使用的安装与使用流程图。
package.json: 插件工程依赖与脚本入口，定义构建与开发命令。
manifest.json: Obsidian 插件清单，声明插件标识、版本与最低兼容版本。
versions.json: Obsidian 版本到插件版本的发布映射。
tsconfig.json: TypeScript 编译约束，收紧类型边界与构建目标。
esbuild.config.mjs: esbuild 打包入口，把 src/main.ts 编译为 Obsidian 可加载产物。
styles.css: 标注面板与阅读视图高亮样式。
main.ts: 插件主入口，装配 sidecar store、CM6 extension、floating toolbar、sticky note lane、sidebar、settings 与 vault 事件。
README.md: 使用说明与非侵入式 sidecar 存储承诺。
scripts/AGENTS.md: 安装脚本地图，描述一条命令安装器的职责。
src/AGENTS.md: src 模块地图，描述 Markdown/PDF 注释通道与核心代码分层。

法则: overlay 优先·原文不动·服务单一·视图解耦

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
