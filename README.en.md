# Project status and active sessions

English | [简体中文](README.md)

A **DeepSeek Harness (DSH) sidebar plugin**: it adds status hints to every project and to the
sessions that currently have a status, so a collapsed project still tells you which one is waiting
for you, which one is running, and which one just finished.

[GitHub](https://github.com/zchiy2k/dsh-project-status) ·
[npm](https://www.npmjs.com/package/dsh-project-status) ·
[Issues](https://github.com/zchiy2k/dsh-project-status/issues) ·
[Releases](https://github.com/zchiy2k/dsh-project-status/releases) ·
[MIT license](LICENSE)

## What it solves

DSH only shows status dots on session rows. Once there are many projects, or a project is
collapsed, you cannot tell which project is working or waiting for your approval. This plugin adds
two surfaces:

1. **Project status dot**: an aggregated status at the far right of every project header row. The
   leading edge of the row stays exactly as shipped.
2. **Active sessions area**: a sticky list at the top of the workspaces that shows sessions with a
   status; click one to open it, and it leaves the list when its status ends.

## Features

### Project status dot

All sessions of a project collapse into one icon, using the same priority as core session rows:

| Icon | Meaning | Trigger |
| --- | --- | --- |
| Amber dot | Waiting for you | At least one session is waiting for an approval, a plan review, or an answer |
| Spinning ring | Running | No waiting session, but at least one is running |
| Green dot | Finished | Nothing waiting or running, but at least one session finished unopened |
| Nothing | Idle | None of the above |

The icon only appears on rows that have a status (8px, flush with the row end); rows without a
status gain no extra spacing. The "Ungrouped" row gets the same aggregated icon. A screen-reader
hint (`aria-description`) carries the counts, for example "2 sessions running, 1 session waiting for
you".

### Active sessions area

- Position: between the "Workspaces" header and the project list, pinned while the sidebar scrolls.
- Membership: waiting for you (approval / plan review / question), running, and finished-unread.
- Each row: status dot + session title + a small project name at the row end. Long titles
  ellipsize; the project name is capped at 45% width.
- Hovering (or keyboard focus) for about 0.35 s opens a dark card on the right of the row — the
  same placement, palette, and size as core session hover cards — showing the full session title,
  the project name, and the status. If there is no room on the right, it flips to the left.
- Order: waiting first, then running, then finished; newest update first within a group.
- Click: opens the session and expands its project group.
- Removal: a row leaves automatically when its status ends; the whole block hides when empty.
- Archived, blank (new-session placeholder), and subagent sessions are excluded. The block stays
  visible while searching.

## Install

Requires DSH `>=0.2.2-rc.3 <0.3.0` (verified on 0.2.2-rc.3 and 0.2.2-rc.5). Refresh the page after
installing.

- **Desktop**: open **Plugins**, choose **Add plugin**, and enter `dsh-project-status`.
- **npm (CLI)**: `dsh plugin --profile <profile> add dsh-project-status`
- **GitHub (pinned)**: `dsh plugin --profile <profile> add github:zchiy2k/dsh-project-status#v1.0.1`
  (plain JavaScript, no build step, no `allowBuilds` authorization needed)
- **Local development**: `dsh plugin --profile <profile> add ./dsh-workspace-status`

## Usage

- Expand or collapse projects: the dot/ring at the end of a project row always reflects the highest
  priority status inside that project.
- To jump back to a running session, click its row in "Active sessions"; its project expands too.
- For full context, hover an active row: the card shows the complete title, project, and status.

## How it works

- Same data as core: `sessions.list` (catalog and titles), `workspaces.list` (project/session
  membership and archive set), and `uiSession.sessionStatus` (running, pending interaction,
  completion reminder).
- Core exposes no decoration slot on project rows or at this position, so:
  - The project dot writes `data-dsh-ws-status` on the row (`[data-row-key^="workspace:"]`) and an
    injected stylesheet draws it with a row-end pseudo-element; no React-managed child node is
    inserted.
  - The active-sessions area is a self-built DOM block between `[data-sidebar-workspace-header]`
    and `[data-sidebar-list-area]`.
- Core re-renders can rebuild rows and move injected nodes, so a `MutationObserver` watches the
  sidebar region, re-inserts the block when it is gone, and repaints; three data subscriptions
  recompute the aggregates.
- Colors come from theme tokens (`--dsw-alias-state-warn-primary`,
  `--dsw-alias-state-success-primary`, `--dsw-alias-hovercard-*`) and follow light/dark themes;
  the spinner stops under reduced motion.

## Compatibility and limitations

- Depends on core DOM markers: `data-row-key="workspace:<id>"`, `data-sidebar-list-area`,
  `data-sidebar-scrollport`, and `data-sidebar-workspace-header`. If a DSH release changes them,
  both surfaces silently disappear without affecting other UI.
- The active-sessions area is injected DOM, so an extreme re-layout may cause a brief flicker; rows
  are intentionally duplicated with the project groups (it is a temporary working set).
- The flat view (no project grouping) has no project rows, but the active sessions area still
  works; the collapsed rail does not show it.
- The sticky position relies on the sidebar scroll hierarchy; if core ever adds
  `overflow: hidden` in between, the block falls back to scrolling with the list.

## Files

| File | Purpose |
| --- | --- |
| `package.json` | Bundle manifest: `dsh.bundle.patch`, `dsh.client` |
| `cordis.patch.yml` | Inserts the `project-status` row |
| `index.js` | Host half; a no-op (everything happens in the browser) |
| `client.js` | Client half: aggregation, style injection, row marking, active-area rendering |
| `locale/*.json` | Plugin Manager title and description |
| `icon.svg` | Plugin icon |
| `market/` | Plugin index draft for the Discover tab (optional) |

## License

[MIT](LICENSE) © 2026 kelimaca
