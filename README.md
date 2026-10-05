# 成简

成简 0.5.3 是面向 Windows 的本地 Markdown 编辑器：像编辑普通文档一样直接修改内容，同时将文档保存为 Markdown。无需账号或服务端，支持图片缩放、表格、标题目录、编号、格式刷、主题和浮窗。

本仓库为原版 **成简** 的源码快照，不是后续的“简成笔记”，也不是轻量版。历史工程名 `moye-markdown` 和部分 `moye` 标识保留，以保持原有行为。

## 技术架构

- 桌面：Electron 44，主进程管理窗口、文件和剪贴板；preload 暴露受限 IPC，渲染进程关闭 Node 集成并开启上下文隔离。
- 界面：原生 JavaScript、HTML、CSS，没有 React/Vue；Tiptap 3（基于 ProseMirror）提供所见即所得编辑。
- 文档转换：Marked 渲染 Markdown，Remark 分析图片位置，DOMPurify 清理 HTML，Turndown + GFM 将编辑内容序列化为 Markdown。
- 构建：esbuild 打包界面和文档核心；electron-builder 生成 Windows x64 安装包。具体依赖版本见 package-lock.json。
- 图片：主进程处理本地图片保存与路径迁移；Windows PowerShell 辅助转换剪贴板矢量图片。

## 运行与构建

使用 Windows、Node.js 22 或更新兼容版本及 npm。首次安装依赖需要联网下载 Electron 等组件。

```sh
npm ci
npm start
```

```sh
npm run build       # 生成 dist
npm test            # 核心测试和 Electron 交互回归（先执行 build）
npm run pack        # Windows x64 免安装目录
npm run installer   # Windows x64 NSIS 安装包
```

安装产物位于 `发行版/安装包/0.5.3/`。界面测试需要可用的桌面会话；测试创建独立临时用户配置。仓库不包含依赖、构建产物或已签名安装包。

## 核心代码导览

| 模块 | 入口及职责 |
| --- | --- |
| 编辑器与图片/表格 | [src/rich-editor.js](src/rich-editor.js)：`new Editor` 初始化、`RichImage` 扩展、TableKit、粘贴/拖入、图片尺寸和编辑工具栏 |
| 解析与序列化 | [src/core.mjs](src/core.mjs)：Markdown 渲染、图片定位和迁移；[src/rich-editor.js](src/rich-editor.js)：`htmlFromMarkdown`、Turndown 自定义规则和 `serialize` |
| 编号与格式刷 | [src/block-format.js](src/block-format.js)、[src/number-label.js](src/number-label.js)、[src/editor-features.js](src/editor-features.js) |
| Word 粘贴样式 | [src/word-format.js](src/word-format.js)、[src/vector-image.cjs](src/vector-image.cjs)、[src/vector-image.ps1](src/vector-image.ps1) |
| 文件安全与 IPC | [src/main.cjs](src/main.cjs)、[src/preload.cjs](src/preload.cjs)、[src/files.cjs](src/files.cjs)：读写、原子保存、外部修改检测 |
| 目录、主题和快捷键 | [src/outline.js](src/outline.js)、[src/custom-colors.js](src/custom-colors.js)、[src/workbench.js](src/workbench.js)、[src/shortcuts.js](src/shortcuts.js) |
| 当前界面 | [src/rich.html](src/rich.html)、src/style.css、src/rich.css、src/glass.css |
| 构建与测试 | [scripts/build.cjs](scripts/build.cjs)、[tests/](tests/) |

当前构建入口是 `rich.html` + `rich-editor.js`；`src/index.html`、`src/renderer.js` 是保留的早期分栏界面，不是当前运行入口。历史公式代码仍存在，但当前产品已取消可编辑公式入口，使用剪贴板图片保留公式外观；不提供 Word 文件导入。

为便于评审，这次发布保留原有模块组织，未为了上传而重构业务逻辑。可重点检查：编辑操作的选区保持和撤销事务、格式刷跨列表转换、图片/表格往返保存、自动保存冲突处理、IPC 与 HTML 清理边界、键盘操作及浮窗交互。

## 文档格式与本地数据

高级格式会使用内嵌 HTML 保存，因此并非所有外部 Markdown 阅读器都能完全一致地呈现。未修改文档时尽量保留原文；编辑后的内容由序列化器生成。图片随文档保存到相邻资源目录，移动文档时需要同时移动资源。自动保存不等同于版本备份。

使用方式见 [使用说明.md](使用说明.md)，版本记录见 [修复记录.md](修复记录.md)，示例见 [示例文档.md](示例文档.md)。

## 发布范围与许可

仅包含源码、测试、图标、示例和开发文档。`.gitignore` 排除本地配置、环境变量、密钥/证书、依赖、日志、测试产物和发行文件。提交前仍需检查实际暂存内容；忽略规则不能清除已提交的秘密。

保留项目原有 [MIT 许可证](LICENSE)。第三方依赖采用各自许可证；构建时生成第三方许可说明。
