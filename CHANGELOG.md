# Changelog

本项目的显著变更记录在这里，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [0.2.1] - 2026-10-21

### Added

- `client.js` 顶部改用 `// @ts-check`，配合 `jsconfig.json`（`checkJs`、`strict`）与
  `types/*.d.ts` 本地声明：模块加载器的 `require('react')`、`window.__ModuleLoader__`、
  以及 DSH 客户端契约（`uiSession.sessionStatus`、pending interaction、locale、slots）
  都有类型，编辑器里可直接看到错误与补全，且不引入任何 Harness 客户端包。
- 英文文案表用 `@type {typeof zh}` 约束，缺键/错键变成类型错误。
- `npm run typecheck`（`tsc -p jsconfig.json`）与 CI 的 npm 缓存 + 类型检查步骤；
  `npm test` 现在是「类型检查 + 静态检查」。

### Changed

- 设置行状态色的选择器从 `data-state` 属性改为 `dsh-approval-reminder-status--<state>`
  修饰类（视觉不变，避免在无 JSX 的属性对象里放非标准属性）。

## [0.2.0] - 2026-10-18

### Changed

- 提醒时机收敛为“只在你不看这个页面时”：页面可见且处于前台（`document.hasFocus()`）
  时不发通知，因为宿主审批面板已经在屏上；页面切到后台、最小化或失焦时才提醒。

### Added

- 在 `visibilitychange` / `focus` / `blur` 时重新评估页面状态：请求在你看页面时到达，
  等你切走后才提醒；回到页面时已弹出的通知自动关闭。
- 同一请求只提醒一次（按 `sessionId + request key` 记录），来回切页面不会反复刷屏。

## [0.1.0] - 2026-10-18

### Added

- 首个版本：监听客户端会话状态快照里的待审批交互（`kind === 'approval'`），
  为每个请求发出一次 Edge/Windows 桌面通知；审批结束后自动关闭通知。
- 点击通知跳回对应会话并聚焦窗口。
- 设置 → 通用 的「审批桌面通知」行：权限状态、开启入口、发送测试通知，
  以及被阻止/不支持时的恢复说明。
- 首次用户手势时自动请求通知权限；页面每次加载最多请求一次。
- 无依赖静态检查脚本（`node scripts/check.mjs`）与 GitHub Actions 工作流。

[0.1.0]: https://github.com/In-clude/dsh-approval-reminder/releases/tag/v0.1.0
