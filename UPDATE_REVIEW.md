# 本轮更新对照（给代码评审者）

更新时间：2026-10-05。本文件说明已经完成的代码改动，不是待实现的建议。

## 请先确认读到的版本

- 初次公开源码：`229fa4391394bdaedea231aa8243c43bb4cef725`
- 本轮功能更新：`812cf063c6a1c1f0f6501378c52ad308bfdddcea`
- [查看这两个版本的完整差异](https://github.com/XXLDinosaur/chengjian-markdown/compare/229fa4391394bdaedea231aa8243c43bb4cef725...812cf063c6a1c1f0f6501378c52ad308bfdddcea)
- [查看功能更新提交](https://github.com/XXLDinosaur/chengjian-markdown/commit/812cf063c6a1c1f0f6501378c52ad308bfdddcea)

功能提交共修改 33 个文件，新增 580 行、删除 110 行。之后的评审说明提交只补文档，不代表又改了一轮功能。

**package.json 中的版本号仍是 0.5.3，不能用它判断源码是否更新。请以提交 SHA 为准。** 当前更新是开发版，未发布新安装包。GitHub 用户名由 cuiyi919 改为 XXLDinosaur，请使用本文的新地址。

## 修改前与修改后

| 项目 | 初次公开版本 | 本轮更新后的行为 | 核心代码 |
| --- | --- | --- | --- |
| 空白段落 | 编辑内容并保存后，空白段落可能被 Turndown 丢弃 | 显式空段落保存为 `<p></p>`，重开保留 | [rich-editor.js](src/rich-editor.js)，`blankReplacement` |
| 另存为的图片 | 跨目录另存时重算引用，仍依赖原图片位置 | 将本地图片复制到新文档的 `.assets` 目录，使用相对路径；原目录移走后副本仍可显示 | [resources.cjs](src/resources.cjs)，[main.cjs](src/main.cjs) |
| 外部本地图片 | 主要收集程序暂存的图片，已有外部引用可能仍留在文档中 | 保存时收集指向文档目录外的本地图片；同一来源只复制一次，路径中空格、百分号等转义 | [resources.cjs](src/resources.cjs) |
| 缺失图片 | 原有外部引用可以继续保留 | 保存时检查本地引用；缺失图片使本次保存失败并提示 | [resources.cjs](src/resources.cjs) |
| 主界面 | 顶部较高，原生标题栏和多个操作按钮占位 | 窗口控制整合到紧凑顶栏，右侧文件菜单包含新建、打开、保存、另存为、打印、帮助；左侧保留图标和可编辑标语 | [rich.html](src/rich.html)，[document-ui.js](src/document-ui.js)，[document-ui.css](src/document-ui.css) |
| 窗口拖动 | 更新过程曾因伸展的文件名容器覆盖空白区而无法拖动 | 中间独立拖动区，交互按钮为 no-drag；浮窗提供拖动手柄和恢复按钮 | [document-ui.css](src/document-ui.css)，[main.cjs](src/main.cjs) |
| 导航 | 目录以滚动位置高亮为主 | 导航包含目录、查找、替换，并跟随光标所在章节；保留收起状态 | [outline.js](src/outline.js) |
| 编号中的图片/表格 | 图片或表格可能单独占一个列表条目 | 媒体块归入上一个条目，避免单独占编号 | [block-format.js](src/block-format.js)，`ListMedia` |
| 链接操作 | 使用工具栏链接入口 | 文档右键支持复制、剪切、粘贴和网址链接；支持取消/恢复链接跳转及双击访问 | [document-ui.js](src/document-ui.js)，`NoJump` |
| 主题 | 旧默认方案及独立“设为默认”操作 | 老竹新绿为默认；完成后沿用所选方案；独立链接颜色及 RGB/HEX 输入 | [custom-colors.js](src/custom-colors.js) |
| 玻璃下拉菜单 | 原生选择框；迁移时曾出现主题弹窗菜单错位 | 顶层 Popover 避免玻璃弹窗改变定位参照；选项触发 input/change；Esc 仅关闭菜单 | [glass-selects.js](src/glass-selects.js) |
| 背景图片按钮 | 透明文字按钮，不易辨认 | 默认显示底色、边框和轻微阴影 | [document-ui.css](src/document-ui.css)，`#uploadThemeImage` |

## 原本就有的能力，不要误认为本轮新增

- 图片宽度原本就使用 `<img src="..." width="300">` 保存，本轮新增保存、重开和搬移的回归验证。
- 表格原本就以 HTML 序列化，本轮验证合并单元格、列宽、多段内容的保留，没有改成纯 Markdown 管道表格。
- 原有图片导入、缩放、打印、格式刷、快捷键及自动保存能力继续保留。
- 此软件是**成简单文档编辑器**，本轮参考简成笔记的 UI，但没有加入仓库、文件树或多文档标签页。

## 如何复查

先执行 `npm ci` 和 `npm run build`，再在 Windows 桌面会话中运行：

```sh
node --test tests/core.test.mjs
node tests/roundtrip.cjs
node tests/document-ui.cjs
node tests/theme-menu.cjs
```

- `core.test.mjs`：图片定位/尺寸、原子保存，以及外部资源去重、缺失资源、远程图片和代码示例。
- `roundtrip.cjs`：实际编辑、保存、重开，检查空段落、图片宽度、合并表格和列宽；另存并搬走原目录后再检查图片。
- `document-ui.cjs`：文件菜单、拖动区命中与 CSS 属性、玻璃选项、帮助、主题、链接、标语及浮窗恢复。拖动区断言不等同于物理鼠标拖动的端到端验证。
- `theme-menu.cjs`：三种背景类型切换、菜单位置、横向溢出、实际保存配置和 Esc 行为。

以上相关回归在本地修改过程中已运行通过；本次增加说明文档没有再修改业务代码。完整 `npm test` 中历史 v4/v5 测试依赖未提交的本地 Word 图像夹具，详见 README，不应把缺少夹具误判为产品回归。

## 仍需关注的边界

1. 显式空段落使用 HTML 保留，不承诺逐字保留 Markdown 源文件里任意数量的空白分隔行。
2. 图片尺寸和复杂表格依赖第三方阅读器支持内嵌 HTML；不能承诺所有阅读器显示完全一致。
3. 网络图片不会被自动下载，仍需联网；内嵌 data 图片保持原样。
4. 资源文件夹需要随 `.md` 文档一起移动；只移动文档一个文件仍可能破图。
5. 保存失败时，已复制成功的资源可能留在目标目录；可评审是否需要事务式清理。

## 可直接交给 Gemini 的评审指令

请审查 XXLDinosaur/chengjian-markdown 中提交 229fa4391394bdaedea231aa8243c43bb4cef725 到 812cf063c6a1c1f0f6501378c52ad308bfdddcea 的差异。先阅读 UPDATE_REVIEW.md 和 README.md，再检查对应模块的实际实现。请明确你实际读取到的提交 SHA；不要只根据 package.json 的 0.5.3 版本号判断代码未更新。请区分“已实现但需改进”“尚未实现”和“原本已有”，对具体问题注明文件、函数、触发步骤和建议。若无法访问代码，请明确说明访问限制，不要假装已经完成代码审查。
