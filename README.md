# 项目状态与活跃会话

给左侧侧栏补两处状态提示：

1. **项目状态点**：每个项目（Workspace）标题行最右侧显示该项目的聚合状态，折叠起来时
   也能一眼看出哪个项目在等你、哪个在跑、哪个刚跑完。行首保持核心原样，不占位。
2. **活跃会话区**：「工作区」标题栏下方吸顶列出当前有状态的会话，点一下直接进入，
   状态消失后自动从该区域移走。

## 安装

- Desktop：打开**插件**页，点**添加插件**，输入 `dsh-project-status`，安装后刷新页面。
- CLI：`dsh plugin --profile <profile> add dsh-project-status`。
- 本地开发：`dsh plugin --profile <profile> add ./dsh-workspace-status`（目录名可自取）。
- GitHub：`dsh plugin --profile <profile> add github:zchiy2k/dsh-project-status`（纯 JS，无构建步骤）。

要求 DSH `>=0.2.2-rc.3 <0.3.0`（已在 0.2.2-rc.3 与 0.2.2-rc.5 上验证）。

## 项目状态点

一个项目下所有会话聚合成一个图标，优先级和核心的会话行一致：

| 图标 | 含义 | 触发条件 |
| --- | --- | --- |
| 黄色圆点 | 等待处理 | 该项目里至少有一个会话在等待审批、计划待审或等待回答 |
| 旋转圆环 | 进行中 | 没有等待中的会话，但至少有一个会话在运行 |
| 绿色圆点 | 已完成 | 没有等待和运行，但至少有一个会话跑完还没打开 |
| 不显示 | 空闲 | 以上都没有 |

图标只在有状态的行出现（8px，贴行尾），没有状态的行不多占任何间距；「未分组」那一行
也会显示同样的聚合图标。鼠标悬停时行上的读屏提示（`aria-description`）会给出数量，
例如「2 个会话进行中，1 个会话等待处理」。

## 活跃会话区

- 位置：「工作区」标题栏与项目列表之间，滚动时吸顶常驻。
- 收录：等待处理（审批 / 计划待审 / 提问）、进行中、已完成未读，三种会话都列。
- 每一行：状态点 + 会话标题 + 行尾小字项目名；标题过长时自动省略，项目名最多占 45% 宽度。
- 悬停（或键盘聚焦）约 0.35 秒后，在行的右侧弹出深色卡片（位置、配色、宽高都对齐
  核心会话行的悬停卡片），显示完整的会话名、项目名和状态（未分组的会话显示「未分组」）。
  右侧空间不足时翻到行的左侧。
- 排序：待处理在前，其次进行中，再次已完成；同类按最近更新倒序。
- 点击：打开该会话，并展开它所属的项目分组。
- 消失：会话状态结束时该行自动移除；一条都没有时整个区块隐藏。
- 归档、空白占位（新建会话）和子智能体会话不收录；搜索状态下区块保留（搜索只换列表）。

区块标题为「活跃会话」，右侧带条数；按钮行的读屏文案是「待处理：会话标题」这样的格式。
系统开启「减少动态效果」时，旋转图标停止动画。

## 实现方式

- 数据与核心同一套：`sessions.list`（会话清单与标题）、`workspaces.list`（项目与会话
  归属、归档集）、`uiSession.sessionStatus`（运行中、待交互、完成提醒）。
- 核心没有给项目标题行或该位置开装饰插槽，所以：
  - 项目状态点：在行元素（`[data-row-key^="workspace:"]`）上写入 `data-dsh-ws-status`，
    由注入的样式表用行尾伪元素画图标，不插入 React 管理的子节点。
  - 活跃会话区：插件自建 DOM 区块，插在 `[data-sidebar-workspace-header]` 与
    `[data-sidebar-list-area]` 之间（`listArea.parentElement` 的第 2 个子节点）。
- 核心重渲染会重建行节点、也可能把注入节点移走，插件用 `MutationObserver` 观察侧栏
  区域，发现区块不在位置就重新插回、并重画状态；订阅三份数据变更重算。
- 颜色取自主题 token（`--dsw-alias-state-warn-primary`、
  `--dsw-alias-state-success-primary`、`--dsw-alias-label-secondary`），跟随明暗主题。
- 窄侧栏（rail）不显示活跃会话区，因为没有列表空间；`[data-sidebar-scrollport]` 只在
  宽侧栏存在，插件以它判断。

## 发布

- `npm publish` 即可发布；包内只有 `index.js`、`client.js`、`cordis.patch.yml`、`locale/*.json`、`icon.svg`、`README.md`、`LICENSE`，没有构建步骤。
- 插件索引草稿在 `market/`：`index.json` + `icons/project-status.svg`，放到任意静态主机后，用户可在「发现 → 添加索引源」里填它的 URL。
- 发布前用 `npm pack --dry-run` 核对文件清单；版本号遵循 semver，`engines.dsh` 会阻止不兼容的版本安装。

## 已知限制

- 依赖核心的项目行标记 `data-row-key="workspace:<id>"`、侧栏列表区域
  `data-sidebar-list-area` 与 `data-sidebar-scrollport`；DSH 升级若改动这些标记，两处
  提示会静默消失（不影响其它界面）。
- 活跃会话区是注入 DOM，核心极端重排时可能有轻微闪动；区块与项目分组里的会话行会
  重复展示（预期行为，临时区）。
- 平铺视图（不按项目分组）下没有项目行，但活跃会话区照常工作。
- 吸顶依赖侧栏滚动容器的层级；若未来核心在中间层加 `overflow: hidden`，区块会退化为
  随列表滚动。

## 文件

| 文件 | 作用 |
| --- | --- |
| `package.json` | Bundle 清单：`dsh.bundle.patch`、`dsh.client` |
| `cordis.patch.yml` | 插入 `workspace-status` 这一行 |
| `index.js` | Host 半；无操作（功能全部在浏览器端） |
| `client.js` | Client 半：聚合计算、样式注入、项目行标注、活跃区渲染与重绘 |
| `locale/*.json` | 插件管理器标题与描述 |
| `icon.svg` | 插件图标 |
