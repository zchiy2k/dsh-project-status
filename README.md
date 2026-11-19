# 项目状态与活跃会话

[English](README.en.md) | 简体中文

**DeepSeek Harness（DSH）侧栏插件**：在左侧工作区给每个项目和当前有状态的会话加上状态提示，
项目折叠时也能一眼看到哪个在等你、哪个在跑、哪个刚跑完。

[GitHub 仓库](https://github.com/zchiy2k/dsh-project-status) ·
[npm](https://www.npmjs.com/package/dsh-project-status) ·
[问题反馈](https://github.com/zchiy2k/dsh-project-status/issues) ·
[版本发布](https://github.com/zchiy2k/dsh-project-status/releases) ·
[MIT 许可](LICENSE)

## 它解决什么问题

DSH 默认只在会话行前面显示状态点。项目一多、分组一折叠，就看不出哪个项目正在工作、哪个在等你
审批。这个插件补两处提示：

1. **项目状态点**：每个项目标题行最右侧显示该项目的聚合状态，行首保持核心原样、不占位。
2. **活跃会话区**：工作区顶部吸顶列出当前有状态的会话，点一下直接进入，状态消失后自动移走。

## 功能

### 项目状态点

一个项目下所有会话聚合成一个图标，优先级和核心的会话行一致：

| 图标 | 含义 | 触发条件 |
| --- | --- | --- |
| 黄色圆点 | 等待处理 | 该项目里至少有一个会话在等待审批、计划待审或等待回答 |
| 旋转圆环 | 进行中 | 没有等待中的会话，但至少有一个会话在运行 |
| 绿色圆点 | 已完成 | 没有等待和运行，但至少有一个会话跑完还没打开 |
| 不显示 | 空闲 | 以上都没有 |

图标只在有状态的行出现（8px，贴行尾），没有状态的行不多占任何间距；「未分组」那一行也会显示
同样的聚合图标。行上的读屏提示（`aria-description`）会给出数量，例如「2 个会话进行中，1 个会话
等待处理」。

### 活跃会话区

- 位置：「工作区」标题栏与项目列表之间，滚动时吸顶常驻。
- 收录：等待处理（审批 / 计划待审 / 提问）、进行中、已完成未读，三种会话都列。
- 每一行：状态点 + 会话标题 + 行尾小字项目名；标题过长时自动省略，项目名最多占 45% 宽度。
- 悬停（或键盘聚焦）约 0.35 秒后，在行的右侧弹出深色卡片（位置、配色、宽高都对齐核心会话行的
  悬停卡片），显示完整的会话名、项目名和状态；右侧空间不足时翻到行的左侧。
- 排序：待处理在前，其次进行中，再次已完成；同类按最近更新倒序。
- 点击：打开该会话，并展开它所属的项目分组。
- 消失：会话状态结束时该行自动移除；一条都没有时整个区块隐藏。
- 归档、空白占位（新建会话）和子智能体会话不收录；搜索状态下区块保留（搜索只换列表）。

## 安装

要求 DSH `>=0.2.2-rc.3 <0.3.0`（已在 0.2.2-rc.3 与 0.2.2-rc.5 上验证），安装后刷新页面生效。

- **Desktop**：打开**插件**页，点**添加插件**，输入 `dsh-project-status`。
- **npm（CLI）**：`dsh plugin --profile <profile> add dsh-project-status`
- **GitHub（锁定版本）**：`dsh plugin --profile <profile> add github:zchiy2k/dsh-project-status#v1.0.1`
  （纯 JS，无构建步骤，不需要 `allowBuilds` 授权）
- **本地开发**：`dsh plugin --profile <profile> add ./dsh-workspace-status`（目录名可自取）

## 使用

- 展开或折叠项目：项目行最右侧的圆点/圆环始终反映该项目整体的最高优先级状态。
- 想快速回到正在跑的会话：点顶部「活跃会话」里的那一行，会同时展开它所在的项目。
- 想看完整信息：把鼠标停在活跃行上，卡片会显示完整标题、项目名和状态。

## 实现方式

- 数据与核心同一套：`sessions.list`（会话清单与标题）、`workspaces.list`（项目与会话归属、
  归档集）、`uiSession.sessionStatus`（运行中、待交互、完成提醒）。
- 核心没有给项目标题行或该位置开装饰插槽，所以：
  - 项目状态点：在行元素（`[data-row-key^="workspace:"]`）上写入 `data-dsh-ws-status`，由注入的
    样式表用行尾伪元素画图标，不插入 React 管理的子节点。
  - 活跃会话区：插件自建 DOM 区块，插在 `[data-sidebar-workspace-header]` 与
    `[data-sidebar-list-area]` 之间。
- 核心重渲染会重建行节点、也可能把注入节点移走，插件用 `MutationObserver` 观察侧栏区域，发现
  区块不在位置就重新插回并重画状态；订阅三份数据变更重算。
- 颜色取自主题 token（`--dsw-alias-state-warn-primary`、
  `--dsw-alias-state-success-primary`、`--dsw-alias-hovercard-*`），跟随明暗主题；系统开启
  「减少动态效果」时旋转动画停止。
- 纯 JavaScript，无构建步骤：npm 包里就是运行时文件。

## 兼容性与已知限制

- 依赖核心的 DOM 标记：`data-row-key="workspace:<id>"`、`data-sidebar-list-area`、
  `data-sidebar-scrollport`、`data-sidebar-workspace-header`。DSH 改版若改动这些标记，两处提示会
  静默消失，不影响其它界面。
- 活跃会话区是注入 DOM，核心极端重排时可能有轻微闪动；区块与项目分组里的会话行会重复展示
  （预期行为，它是临时区）。
- 平铺视图（不按项目分组）下没有项目行，但活跃会话区照常工作；窄侧栏（rail）不显示活跃区。
- 吸顶依赖侧栏滚动容器的层级；若未来核心在中间层加 `overflow: hidden`，区块会退化为随列表滚动。

## 文件

| 文件 | 作用 |
| --- | --- |
| `package.json` | Bundle 清单：`dsh.bundle.patch`、`dsh.client` |
| `cordis.patch.yml` | 插入 `project-status` 这一行 |
| `index.js` | Host 半；无操作（功能全部在浏览器端） |
| `client.js` | Client 半：聚合计算、样式注入、项目行标注、活跃区渲染与重绘 |
| `locale/*.json` | 插件管理器标题与描述 |
| `icon.svg` | 插件图标 |
| `market/` | 插件索引草稿（可选，用于「发现」页） |

## 许可

[MIT](LICENSE) © 2026 kelimaca
