/**
 * workspace-status 的 Host 半。
 *
 * 功能完全在浏览器端：`client.js` 读取会话清单、项目归属与会话 UI 状态，在侧栏
 * 每个项目标题行前渲染聚合状态点。Host 端没有需要持久化或提供的东西，因此这里
 * 保持为空壳，只让 bundle 有一行可加载的 Host 插件。
 *
 * @module dsh-project-status
 */

/** 挂载时不注册任何资源。 */
export function apply() {}
