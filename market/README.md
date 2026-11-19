# 插件索引草稿

发布顺序：

1. 在插件目录执行 `npm publish`（首次发布前把 `version` 保持为索引里的版本）。
2. 发布后把 `index.json` 里该版本的 `publishTimestamp` 换成真实发布时间（秒级 Unix 时间戳）。
3. 把 `index.json` 与 `icons/` 一起放到任意静态主机，例如 GitHub Pages 的 `dsh/` 目录。
4. 用户在插件页启用「自定义插件索引」，在「发现 → 添加索引源」填入索引 URL。

索引里的 `title` / `description` 支持按语言给对象（必须含 `en`）；`icon` 可以是相对索引地址的路径。
索引格式参考 DSH 文档 `docs/user/guide/plugin-market.zh.md`。
