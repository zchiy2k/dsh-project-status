/**
 * workspace-status 的 Client 半，做两件事：
 *
 * 1. 在侧栏每个项目（Workspace）标题行的最右侧画一个聚合状态图标，折叠项目时也能
 *    一眼看出该项目在等待处理、进行中还是已完成；行首保持核心原样。
 * 2. 在「工作区」标题栏下方加一条吸顶的「活跃会话」区，把当前有状态的会话（等待
 *    处理 / 进行中 / 已完成未读）临时列在一起，点一下直接进入，状态消失后自动移走。
 *
 * 数据与核心同一套：`sessions.list`（会话清单与标题）、`workspaces.list`（项目与
 * 会话归属、归档集）和 `uiSession.sessionStatus`（运行中、待交互、完成提醒）。聚合
 * 优先级照搬核心会话行的判定：待处理 > 进行中 > 已完成 > 无状态。
 *
 * 核心没有给这两处开装饰插槽，所以这里用「行属性 + 伪元素」以及「自建 DOM 区块」：
 * 项目行上写 `data-dsh-ws-status`，由注入的样式表画行尾状态点；活跃区是插件自己
 * 创建的 DOM 节点，插在 `[data-sidebar-workspace-header]` 与列表区之间，核心
 * 重渲染后由 MutationObserver 重新插回。
 *
 * @module dsh-project-status/client
 */
window.__ModuleLoader__.load({
  id: 'dsh-project-status',
  factory() {
    /** Client 语言命名空间。 */
    const NS = 'workspaceStatus';
    /** 核心项目标题行的稳定标记：`data-row-key="workspace:<workspaceId|>"`。 */
    const ROW_SELECTOR = '[data-row-key^="workspace:"]';
    /** 行属性前缀；去掉后剩下的就是项目 id（未分组项目为空串）。 */
    const ROW_PREFIX = 'workspace:';
    /** 本插件写入的状态属性，取值为 pending / running / done。 */
    const STATE_ATTR = 'data-dsh-ws-status';
    /** 本插件写入的提示文案属性，同时用于判断这行是否被本插件标注过。 */
    const DETAIL_ATTR = 'data-dsh-ws-detail';
    /** 侧栏列表区域；活跃区插在它的前面。 */
    const LIST_AREA_SELECTOR = '[data-sidebar-list-area]';
    /** 侧栏滚动容器；只有宽侧栏才有，窄栏（rail）不显示活跃区。 */
    const SCROLLPORT_SELECTOR = '[data-sidebar-scrollport]';
    /** 视为「等待用户」的交互类型，与核心项目行/会话行的判定一致。 */
    const PENDING_KINDS = new Set(['approval', 'plan-review', 'question']);
    /** 悬停卡片出现前的延迟（毫秒）。 */
    const TIP_DELAY_MS = 350;

    /**
     * 项目行尾状态点与活跃会话区的样式。
     *
     * 项目行部分全部以 `[data-row-key^="workspace:"]` 作用域开头，只影响项目标题行：
     * 伪元素是行的最后一个 flex 子项，`.projectText` 是 `flex: 1`，会把状态点顶到
     * 行尾；悬停出现的行尾按钮排在它左边。伪元素只在 `data-dsh-ws-status` 存在时
     * 生成，没有状态的行不会多出任何间距。
     *
     * 活跃区部分使用插件自己的 `dsh-ws-live-*` 类名，不覆盖核心样式；颜色沿用主题
     * token，跟随明暗主题。
     */
    const STYLE_TEXT = `
[data-row-key^="workspace:"][data-dsh-ws-status]::after {
  content: "";
  flex: none;
  box-sizing: border-box;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
[data-row-key^="workspace:"][data-dsh-ws-status="pending"]::after {
  background: radial-gradient(circle at center, var(--dsw-alias-state-warn-primary) 0 3px, transparent 3.2px);
}
[data-row-key^="workspace:"][data-dsh-ws-status="done"]::after {
  background: radial-gradient(circle at center, var(--dsw-alias-state-success-primary) 0 3px, transparent 3.2px);
}
[data-row-key^="workspace:"][data-dsh-ws-status="running"]::after {
  border: 1.5px solid var(--dsw-alias-label-secondary);
  border-inline-end-color: transparent;
  animation: dsh-ws-status-spin 0.8s linear infinite;
}
@keyframes dsh-ws-status-spin {
  to { transform: rotate(360deg); }
}
@media (prefers-reduced-motion: reduce) {
  [data-row-key^="workspace:"][data-dsh-ws-status="running"]::after {
    animation: none;
    opacity: 0.6;
  }
}
.dsh-ws-live {
  position: sticky;
  top: 0;
  z-index: 3;
  flex: none;
  display: flex;
  flex-direction: column;
  margin: 0 0 4px;
  padding: 2px 0 4px;
  border-radius: var(--dsw-radius-md, 8px);
  background: var(--dsw-specific-sidebar-fill, var(--dsw-alias-bg-base, transparent));
}
.dsh-ws-live[hidden] { display: none; }
.dsh-ws-live-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 12px;
  font-size: 12px;
  line-height: 16px;
  color: var(--dsw-alias-label-secondary);
}
.dsh-ws-live-count { opacity: 0.7; font-variant-numeric: tabular-nums; }
.dsh-ws-live-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 40vh;
  overflow-y: auto;
  padding: 0 4px;
}
.dsh-ws-live-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  padding: 3px 8px;
  border: 0;
  border-radius: var(--dsw-radius-md, 8px);
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  text-align: start;
  cursor: pointer;
}
.dsh-ws-live-row:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dsh-ws-live-row:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: -2px;
}
.dsh-ws-live-dot {
  flex: none;
  box-sizing: border-box;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.dsh-ws-live-dot[data-state="pending"] {
  background: radial-gradient(circle at center, var(--dsw-alias-state-warn-primary) 0 3px, transparent 3.2px);
}
.dsh-ws-live-dot[data-state="done"] {
  background: radial-gradient(circle at center, var(--dsw-alias-state-success-primary) 0 3px, transparent 3.2px);
}
.dsh-ws-live-dot[data-state="running"] {
  border: 1.5px solid var(--dsw-alias-label-secondary);
  border-inline-end-color: transparent;
  animation: dsh-ws-status-spin 0.8s linear infinite;
}
.dsh-ws-live-title {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 13px;
  line-height: 18px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-ws-live-project {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 45%;
  font-size: 11px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-ws-live-tip {
  position: fixed;
  z-index: 100;
  box-sizing: border-box;
  width: 244px;
  max-width: calc(100vw - 16px);
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  border-radius: var(--dsw-radius-lg, 12px);
  background: var(--dsw-alias-hovercard-bg, #2c2c2e);
  box-shadow: var(--dsw-shadow-lv3, 0 8px 24px rgba(0, 0, 0, 0.24));
  pointer-events: none;
}
.dsh-ws-live-tip[hidden] { display: none; }
.dsh-ws-live-tip-title {
  color: var(--dsw-alias-hovercard-label-primary, #ffffff);
  font-size: 14px;
  line-height: 20px;
  overflow-wrap: break-word;
}
.dsh-ws-live-tip-project {
  color: var(--dsw-alias-hovercard-label-secondary, #cfd3d6);
  font-size: 12px;
  line-height: 16px;
  word-break: break-all;
}
.dsh-ws-live-tip-status {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--dsw-alias-hovercard-label-tertiary, #adb2b8);
  font-size: 12px;
  line-height: 20px;
}
.dsh-ws-live-tip .dsh-ws-live-dot[data-state="running"] {
  border-color: var(--dsw-alias-hovercard-label-tertiary, #adb2b8);
  border-inline-end-color: transparent;
}
@media (prefers-reduced-motion: reduce) {
  .dsh-ws-live-dot[data-state="running"] { animation: none; opacity: 0.6; }
}
`;

    /** English dictionary. */
    const en = {
      'detail.pending.one': '{n} session waiting for you',
      'detail.pending.other': '{n} sessions waiting for you',
      'detail.running.one': '{n} session running',
      'detail.running.other': '{n} sessions running',
      'detail.done.one': '{n} session finished',
      'detail.done.other': '{n} sessions finished',
      'detail.separator': ', ',
      'live.title': 'Active sessions',
      'live.ungrouped': 'Ungrouped',
      'live.untitled': 'Untitled session',
      'live.status.pending': 'Waiting for you',
      'live.status.running': 'Running',
      'live.status.done': 'Finished',
      'live.row.aria': '{status}: {title} ({project})',
    };

    /** 中文词典。 */
    const zh = {
      'detail.pending.one': '{n} 个会话等待处理',
      'detail.pending.other': '{n} 个会话等待处理',
      'detail.running.one': '{n} 个会话进行中',
      'detail.running.other': '{n} 个会话进行中',
      'detail.done.one': '{n} 个会话已完成',
      'detail.done.other': '{n} 个会话已完成',
      'detail.separator': '，',
      'live.title': '活跃会话',
      'live.ungrouped': '未分组',
      'live.untitled': '未命名会话',
      'live.status.pending': '待处理',
      'live.status.running': '进行中',
      'live.status.done': '已完成',
      'live.row.aria': '{status}：{title}（{project}）',
    };

    /**
     * 订阅一个可观察来源；来源不存在时返回空清理函数。
     * @param source - 带 `subscribe` 的来源，通常是 `xxx.list` / `sessionStatus`。
     * @param listener - 变化回调。
     * @returns 取消订阅函数。
     */
    function track(source, listener) {
      if (source === undefined || typeof source.subscribe !== 'function') return () => {};
      const unsubscribe = source.subscribe(listener);
      return typeof unsubscribe === 'function' ? unsubscribe : () => {};
    }

    /**
     * 一个会话当前该算哪种状态；没有状态时返回 undefined。
     * @param summary - `sessions.list` 的会话摘要。
     * @param status - `uiSession.sessionStatus` 中该会话的条目。
     * @returns pending / running / done，或 undefined。
     */
    function stateOf(summary, status) {
      if (PENDING_KINDS.has(status?.pendingInteraction?.kind)) return 'pending';
      if ((status?.running ?? summary.running) === true) return 'running';
      if (status?.completionUnread === true) return 'done';
      return undefined;
    }

    /**
     * 聚合一个项目下所有会话的状态。
     *
     * 与核心会话行一致：一个会话只贡献一个状态，等待用户处理的交互优先，其次才是
     * 运行中，最后是「跑完但还没打开」的完成提醒。归档、空白（新建会话占位）的
     * 会话不参与。
     * @param ids - 该项目下的会话 id。
     * @param list - `sessions.list` 快照。
     * @param archived - 归档会话集合。
     * @param statuses - `uiSession.sessionStatus` 快照，缺失时退化为只看运行状态。
     * @returns 聚合结果，完全没有状态时为 undefined。
     */
    function aggregateProject(ids, list, archived, statuses) {
      let pending = 0;
      let running = 0;
      let done = 0;
      for (const id of ids) {
        if (archived.has(id)) continue;
        const summary = list.byId?.[id];
        // 与核心一致：空白占位会话与子智能体会话不单独成行，也不单独贡献状态。
        if (summary === undefined || summary.blank === true || summary.origin === 'subagent') continue;
        const status = typeof statuses?.get === 'function' ? statuses.get(id) : undefined;
        const state = stateOf(summary, status);
        if (state === 'pending') pending += 1;
        else if (state === 'running') running += 1;
        else if (state === 'done') done += 1;
      }
      if (pending === 0 && running === 0 && done === 0) return undefined;
      return {
        state: pending > 0 ? 'pending' : running > 0 ? 'running' : 'done',
        pending,
        running,
        done,
      };
    }

    /**
     * 计算「项目 id → 聚合状态」的快照。
     * @param ctx - Client 插件上下文。
     * @returns 项目 id 到聚合状态的映射；未分组项目用空串作 key。
     */
    function buildStatuses(ctx) {
      const sessions = ctx.get('sessions');
      const workspaces = ctx.get('workspaces');
      const uiSession = ctx.get('uiSession');
      const list = sessions?.list?.getSnapshot();
      const workspaceState = workspaces?.list?.getSnapshot();
      if (list === undefined || workspaceState === undefined) return new Map();
      const statuses = uiSession?.sessionStatus?.getSnapshot();
      const archived = new Set(workspaceState.archivedSessionIds ?? []);
      const result = new Map();
      const accounted = new Set();
      for (const workspace of workspaceState.items ?? []) {
        const ids = workspace.sessionIds ?? [];
        for (const id of ids) accounted.add(id);
        const aggregate = aggregateProject(ids, list, archived, statuses);
        if (aggregate !== undefined) result.set(workspace.workspaceId, aggregate);
      }
      // 不属于任何项目的会话集中在「未分组」桶里，它同样是一行项目标题。
      const stray = (list.ids ?? []).filter(id => !accounted.has(id));
      const ungrouped = aggregateProject(stray, list, archived, statuses);
      if (ungrouped !== undefined) result.set('', ungrouped);
      return result;
    }

    /**
     * 项目在活跃区里显示的小字名字：优先用项目标题，其次目录名。
     * @param workspace - `workspaces.list` 中的项目条目。
     * @returns 展示名，没有可用名字时为空串。
     */
    function projectLabel(workspace) {
      const title = workspace?.title?.trim();
      if (title !== undefined && title !== '') return title;
      const path = workspace?.path ?? '';
      const base = path.split(/[\\/]/).filter(Boolean).pop();
      return base ?? '';
    }

    /**
     * 计算活跃会话清单。
     *
     * 收录所有有状态的顶层会话（等待处理 / 进行中 / 已完成未读），先按状态优先级
     * （待处理 > 进行中 > 已完成）再按最近更新倒序。归档、空白占位和子智能体会话
     * 不收录。
     * @param ctx - Client 插件上下文。
     * @returns 排好序的会话条目。
     */
    function buildLiveSessions(ctx) {
      const sessions = ctx.get('sessions');
      const workspaces = ctx.get('workspaces');
      const uiSession = ctx.get('uiSession');
      const list = sessions?.list?.getSnapshot();
      const workspaceState = workspaces?.list?.getSnapshot();
      if (list === undefined || workspaceState === undefined) return [];
      const statuses = uiSession?.sessionStatus?.getSnapshot();
      const archived = new Set(workspaceState.archivedSessionIds ?? []);
      const projectOf = new Map();
      const projects = new Map();
      for (const workspace of workspaceState.items ?? []) {
        projects.set(workspace.workspaceId, workspace);
        for (const id of workspace.sessionIds ?? []) projectOf.set(id, workspace.workspaceId);
      }
      const items = [];
      for (const id of list.ids ?? []) {
        const summary = list.byId?.[id];
        if (summary === undefined || summary.blank === true || summary.origin === 'subagent' || archived.has(id)) continue;
        const status = typeof statuses?.get === 'function' ? statuses.get(id) : undefined;
        const state = stateOf(summary, status);
        if (state === undefined) continue;
        const workspaceId = projectOf.get(id);
        items.push({
          id,
          state,
          rank: state === 'pending' ? 0 : state === 'running' ? 1 : 2,
          title: summary.displayTitle?.trim() ?? '',
          project: workspaceId === undefined ? '' : projectLabel(projects.get(workspaceId)),
          workspaceId,
          updatedAt: summary.updatedAt ?? 0,
        });
      }
      items.sort((left, right) => left.rank - right.rank || right.updatedAt - left.updatedAt);
      return items;
    }

    /**
     * 把聚合结果写成人话，作为读屏提示与 DOM 上的文案属性。
     * @param aggregate - 一个项目的聚合结果。
     * @param t - 本插件的翻译函数。
     * @returns 形如「2 个会话进行中，1 个会话等待处理」的文案。
     */
    function describe(aggregate, t) {
      const parts = [];
      const part = (count, key) => {
        if (count === 0) return;
        parts.push(t(count === 1 ? `${key}.one` : `${key}.other`, { n: count }));
      };
      part(aggregate.pending, 'detail.pending');
      part(aggregate.running, 'detail.running');
      part(aggregate.done, 'detail.done');
      return parts.join(t('detail.separator'));
    }

    /**
     * 把当前快照写到侧栏的项目标题行上。
     * @param statuses - 项目 id 到聚合状态的映射。
     * @param t - 本插件的翻译函数。
     */
    function paint(statuses, t) {
      for (const row of document.querySelectorAll(ROW_SELECTOR)) {
        const key = (row.getAttribute('data-row-key') ?? '').slice(ROW_PREFIX.length);
        const aggregate = statuses.get(key);
        if (aggregate === undefined) {
          if (row.hasAttribute(STATE_ATTR)) row.removeAttribute(STATE_ATTR);
          if (row.hasAttribute(DETAIL_ATTR)) {
            row.removeAttribute(DETAIL_ATTR);
            row.removeAttribute('aria-description');
          }
          continue;
        }
        const detail = describe(aggregate, t);
        if (row.getAttribute(STATE_ATTR) !== aggregate.state) {
          row.setAttribute(STATE_ATTR, aggregate.state);
        }
        if (row.getAttribute(DETAIL_ATTR) !== detail) {
          row.setAttribute(DETAIL_ATTR, detail);
          row.setAttribute('aria-description', detail);
        }
      }
    }

    /**
     * 建好活跃区的骨架：标题行（名字 + 数量）与行容器；之后只换行。
     * @returns 区块节点与需要更新的子节点。
     */
    function createLiveBlock() {
      const block = document.createElement('section');
      block.className = 'dsh-ws-live';
      block.setAttribute('data-dsh-ws-live', '');
      block.hidden = true;
      const head = document.createElement('div');
      head.className = 'dsh-ws-live-head';
      const label = document.createElement('span');
      label.className = 'dsh-ws-live-label';
      const count = document.createElement('span');
      count.className = 'dsh-ws-live-count';
      head.appendChild(label);
      head.appendChild(count);
      const list = document.createElement('div');
      list.className = 'dsh-ws-live-list';
      block.appendChild(head);
      block.appendChild(list);
      return { block, label, count, list };
    }

    /**
     * 建一行活跃会话：状态点、会话标题、行尾小字项目名；完整信息在悬停卡片里。
     * @param item - 一个活跃会话条目。
     * @param t - 本插件的翻译函数。
     * @param handlers - 点击与悬停回调。
     * @returns 行按钮。
     */
    function buildLiveRow(item, t, handlers) {
      const project = item.project === '' ? t('live.ungrouped') : item.project;
      const titleText = item.title === '' ? t('live.untitled') : item.title;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'dsh-ws-live-row';
      button.setAttribute('data-state', item.state);
      button.setAttribute('aria-label', t('live.row.aria', {
        status: t(`live.status.${item.state}`),
        title: titleText,
        project,
      }));
      const dot = document.createElement('span');
      dot.className = 'dsh-ws-live-dot';
      dot.setAttribute('data-state', item.state);
      dot.setAttribute('aria-hidden', 'true');
      const title = document.createElement('span');
      title.className = 'dsh-ws-live-title';
      title.textContent = titleText;
      const projectLabel = document.createElement('span');
      projectLabel.className = 'dsh-ws-live-project';
      projectLabel.textContent = project;
      button.appendChild(dot);
      button.appendChild(title);
      button.appendChild(projectLabel);
      button.addEventListener('click', () => {
        handlers.hideTip();
        handlers.open(item);
      });
      button.addEventListener('mouseenter', () => { handlers.showTip(button, item); });
      button.addEventListener('mouseleave', () => { handlers.hideTip(); });
      button.addEventListener('focus', () => { handlers.showTip(button, item); });
      button.addEventListener('blur', () => { handlers.hideTip(); });
      return button;
    }

    /**
     * 展开某个项目分组；平铺视图或拿不到视图 store 时什么也不做。
     * @param ctx - Client 插件上下文。
     * @param workspaceId - 要展开的项目 id。
     */
    function expandProject(ctx, workspaceId) {
      const slots = ctx.get('slots');
      if (slots === undefined || typeof slots.entries !== 'function') return;
      let entries;
      try {
        entries = slots.entries('sidebar.workspaces');
      } catch (error) {
        return;
      }
      for (const entry of entries ?? []) {
        const handle = entry?.store;
        if (handle === undefined || typeof handle.create !== 'function') continue;
        let store;
        try {
          store = handle.create();
        } catch (error) {
          continue;
        }
        if (store?.getSnapshot?.()?.groupBy === 'flat') return;
        try {
          store?.actions?.setGroupExpanded?.(workspaceId, true);
        } catch (error) {
          // 展开失败不影响打开会话本身。
        }
        return;
      }
    }

    /**
     * 点击活跃行：展开所属项目，再打开该会话。
     * @param ctx - Client 插件上下文。
     * @param item - 被点击的活跃会话条目。
     */
    function openLiveSession(ctx, item) {
      if (item.workspaceId !== undefined) expandProject(ctx, item.workspaceId);
      try {
        ctx.get('uiWorkspace')?.openSession?.(item.id);
      } catch (error) {
        console.warn('[workspace-status] 打开会话失败：', error);
      }
    }

    /**
     * 悬停卡片：一个复用的深色浮层，显示完整会话名、项目名与状态。
     * @returns 浮层节点与需要更新的子节点。
     */
    function createLiveTip() {
      const tip = document.createElement('div');
      tip.className = 'dsh-ws-live-tip';
      tip.setAttribute('data-dsh-ws-tip', '');
      tip.setAttribute('role', 'tooltip');
      tip.hidden = true;
      const title = document.createElement('div');
      title.className = 'dsh-ws-live-tip-title';
      const project = document.createElement('div');
      project.className = 'dsh-ws-live-tip-project';
      const status = document.createElement('div');
      status.className = 'dsh-ws-live-tip-status';
      const dot = document.createElement('span');
      dot.className = 'dsh-ws-live-dot';
      dot.setAttribute('aria-hidden', 'true');
      const statusLabel = document.createElement('span');
      status.appendChild(dot);
      status.appendChild(statusLabel);
      tip.appendChild(title);
      tip.appendChild(project);
      tip.appendChild(status);
      document.body.appendChild(tip);
      return { element: tip, title, project, dot, statusLabel };
    }

    /**
     * 把悬停卡片放到行右侧，和核心会话行的悬停卡片一致：左边距贴行的右边缘，
     * 顶边对齐行顶；下方放不下时上移夹进视口，右侧放不下时翻到左侧。
     * @param tip - 浮层节点。
     * @param anchor - 行按钮。
     */
    function positionTip(tip, anchor) {
      if (typeof anchor.getBoundingClientRect !== 'function') return;
      const rect = anchor.getBoundingClientRect();
      const width = tip.offsetWidth ?? 244;
      const height = tip.offsetHeight ?? 0;
      const gap = 8;
      const inset = 8;
      const viewportWidth = window.innerWidth ?? 1024;
      const viewportHeight = window.innerHeight ?? 768;
      let left = rect.right + gap;
      if (left + width > viewportWidth - inset) left = Math.max(inset, rect.left - width - gap);
      let top = rect.top;
      if (top + height > viewportHeight - inset) top = Math.max(inset, viewportHeight - height - inset);
      tip.style.left = `${Math.round(left)}px`;
      tip.style.top = `${Math.round(top)}px`;
    }

    /**
     * 把活跃会话清单画到侧栏顶部；没有条目或窄侧栏时整块隐藏。
     * @param parts - `createLiveBlock` 建好的节点。
     * @param state - 记录上一次渲染签名，避免无意义重建。
     * @param items - 活跃会话条目。
     * @param t - 本插件的翻译函数。
     * @param handlers - 点击与悬停回调。
     */
    function paintLive(parts, state, items, t, handlers) {
      const listArea = document.querySelector(LIST_AREA_SELECTOR);
      const region = listArea?.parentElement;
      // 窄侧栏（rail）没有滚动容器，列表也不渲染，活跃区没有意义。
      if (listArea === undefined || region === undefined || region === null
        || document.querySelector(SCROLLPORT_SELECTOR) === null) {
        handlers.hideTip();
        if (parts.block.parentElement !== null && parts.block.parentElement !== undefined) parts.block.remove();
        state.signature = '';
        return;
      }
      if (parts.block.parentElement !== region || parts.block.nextElementSibling !== listArea) {
        region.insertBefore(parts.block, listArea);
      }
      parts.block.setAttribute('aria-label', t('live.title'));
      parts.block.hidden = items.length === 0;
      const signature = `${t('live.title')}\u0002${items
        .map(item => `${item.id}\u0000${item.state}\u0000${item.title}\u0000${item.project}`)
        .join('\u0001')}`;
      if (signature === state.signature) return;
      state.signature = signature;
      handlers.hideTip();
      parts.label.textContent = t('live.title');
      parts.count.textContent = items.length === 0 ? '' : String(items.length);
      parts.list.replaceChildren(...items.map(item => buildLiveRow(item, t, handlers)));
    }

    /**
     * 安装两块界面：注入样式、订阅数据、在侧栏 DOM 变化后重画。
     * @param ctx - Client 插件上下文（已注入 sessions / workspaces / uiSession）。
     * @param t - 本插件的翻译函数。
     * @returns 清理函数。
     */
    function install(ctx, t) {
      const style = document.createElement('style');
      style.setAttribute('data-dsh-ws-style', '');
      style.textContent = STYLE_TEXT;
      document.head.appendChild(style);

      const live = createLiveBlock();
      const liveState = { signature: '' };
      const tip = createLiveTip();
      let tipTimer = 0;
      let tipAnchor = null;
      let statuses = new Map();
      let items = [];
      let frame = 0;

      const hideTip = () => {
        if (tipTimer !== 0) {
          clearTimeout(tipTimer);
          tipTimer = 0;
        }
        if (tipAnchor !== null) {
          tip.element.hidden = true;
          tipAnchor = null;
        }
      };
      const showTip = (anchor, item) => {
        hideTip();
        tipTimer = setTimeout(() => {
          tipTimer = 0;
          tipAnchor = anchor;
          tip.title.textContent = item.title === '' ? t('live.untitled') : item.title;
          tip.project.textContent = item.project === '' ? t('live.ungrouped') : item.project;
          tip.dot.setAttribute('data-state', item.state);
          tip.statusLabel.textContent = t(`live.status.${item.state}`);
          tip.element.hidden = false;
          positionTip(tip.element, anchor);
        }, TIP_DELAY_MS);
      };
      const handlers = {
        open: (item) => { openLiveSession(ctx, item); },
        showTip,
        hideTip,
      };
      // 侧栏滚动后卡片的位置不再准确，直接收起。
      const onScroll = () => { hideTip(); };
      window.addEventListener('scroll', onScroll, true);

      const paintNow = () => {
        frame = 0;
        try {
          paint(statuses, t);
        } catch (error) {
          console.warn('[workspace-status] 项目状态点绘制失败：', error);
        }
        try {
          paintLive(live, liveState, items, t, handlers);
        } catch (error) {
          console.warn('[workspace-status] 活跃会话区绘制失败：', error);
        }
      };
      const schedule = () => {
        if (frame !== 0) return;
        frame = requestAnimationFrame(paintNow);
      };
      const recompute = () => {
        try {
          statuses = buildStatuses(ctx);
        } catch (error) {
          console.warn('[workspace-status] 项目状态计算失败：', error);
          statuses = new Map();
        }
        try {
          items = buildLiveSessions(ctx);
        } catch (error) {
          console.warn('[workspace-status] 活跃会话计算失败：', error);
          items = [];
        }
        schedule();
      };

      // 核心 React 重渲染会重建行节点和区块容器：属性与注入节点可能丢失，所以在
      // 侧栏区域的 DOM 变化后重画，被移走时重新插回。
      const observer = new MutationObserver((records) => {
        const listArea = document.querySelector(LIST_AREA_SELECTOR);
        const region = listArea?.parentElement;
        if (region === undefined || region === null) return;
        if (!live.block.isConnected) {
          // 窄侧栏本来就不显示活跃区，不必为了重插反复重画。
          if (document.querySelector(SCROLLPORT_SELECTOR) !== null) schedule();
          return;
        }
        for (const record of records) {
          if (region.contains(record.target)) {
            schedule();
            return;
          }
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      const disposers = [
        track(ctx.get('sessions')?.list, recompute),
        track(ctx.get('workspaces')?.list, recompute),
        track(ctx.get('uiSession')?.sessionStatus, recompute),
        track(ctx.get('locale'), recompute),
      ];

      recompute();
      return () => {
        observer.disconnect();
        window.removeEventListener('scroll', onScroll, true);
        if (tipTimer !== 0) clearTimeout(tipTimer);
        for (const dispose of disposers) dispose();
        if (frame !== 0) cancelAnimationFrame(frame);
        live.block.remove();
        tip.element.remove();
        style.remove();
      };
    }

    /**
     * 挂载 Client 半：注册词典，待三个服务就绪后在侧栏安装状态点与活跃会话区。
     * @param ctx - Client 插件上下文。
     */
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'workspace-status: dictionaries');
      ctx.inject(['sessions', 'workspaces', 'uiSession'], (scope) => {
        scope.effect(() => install(scope, scope.locale.bind(NS)), 'workspace-status: sidebar status surfaces');
      });
    }

    return { inject: ['locale'], apply };
  },
});
