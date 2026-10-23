# Changelog

本项目的显著变更记录在这里，格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [0.5.0] - 2026-10-23

### Added

- **提问提醒**：智能体用 `ask_user_question` 给出选项、等你选择时，也发一条桌面通知
  （标题「需要你的选择」，正文是第一道题 + 换行 + 会话名）。规则与审批提醒完全一致：
  只在你不看这个页面时提醒、同一 `sessionId + request key` 只提醒一次、
  `requireInteraction: true` 钉在通知中心、点击回到对应会话并聚焦窗口、
  `tag = 'dsh-question:<sessionId>'`、有提示音时通知设为 `silent` 且只响一次。
  `plan-review`（计划审阅卡）同属提问，同样提醒。
- 已答问题的“回顾卡”（`review` 非空，只回放历史、不接受作答）不提醒，翻旧题时不会误弹。

### Changed

- 待处理交互的本地类型由 `ApprovalInteraction` 扩展为 `PendingInteraction`（新增
  `questions`、`review` 字段）；`ApprovalNotifier` 更名 `ReminderNotifier`，审批与提问
  共用同一套去重 / 关闭 / 点击逻辑，只有文案与 `tag` 不同。
- 设置 → 通用「审批桌面通知」行的说明文案同时覆盖提问提醒；插件页描述同步更新。
- 排查日志新增 `pendingKinds` 字段（本轮快照里等你处理的交互类型）。

## [0.4.0] - 2026-10-23

### Added

- **提醒提示音**：桌面通知可能被静默丢弃——浏览器窗口全屏时 Chromium 会拦掉网页通知弹窗
  （上游 `chrome/browser/notifications/fullscreen_notification_blocker.cc`），Windows 在网页全屏、
  播放视频等场景也可能抑制通知，网页侧没有 API 可以保证弹窗出现。所以开关打开、且提示音可用
  （`AudioContext` 由首次用户手势解锁且处于 running）时，就把通知创建为 `silent` 并播放两声短
  提示音（Web Audio 现场合成）——保证**恰好响一次**；开关关闭或音频不可用时不静音、退回系统通知声。
  审批、提问与任务完成提醒共用。
- **开关**：设置 → 通用新增「提醒提示音」行（`role="switch"`、`aria-checked`），**默认关闭**，
  开关值存在本机浏览器 `localStorage` 的 `dsh-approval-reminder:chime`；打开后通知才设为 `silent`
  并只响提示音，关闭时通知保留系统提示音。
- 「提醒提示音」行带**「试听提示音」按钮**：点击即播放两声，同时用这次用户手势解锁/唤醒
  音频上下文，不必等真实审批就能验证声音通道。
- **排查开关**：`localStorage` 的 `dsh-approval-reminder:debug` 置 `1` 后，每次提醒判定会打印
  `[approval-reminder]` 前缀的 `console.debug`，并写入 `sessionStorage` 的
  `dsh-approval-reminder:log`（上限 100 条，事故后可用 `JSON.parse(...)` 回看，不需要当时开着 DevTools）。

### Changed

- 两个 `localStorage` 开关行改由同一个 `createSwitchRow` 工厂生成；`NotifierDeps` 增加
  `alertSoundEnabled` / `chimeReady` / `playAlertSound`；`CompletionReminderRowProps` 合并为 `SwitchRowProps`。
- 设置 → 通用 现在按顺序是三行：「审批桌面通知」「任务完成通知」「提醒提示音」。
- 首次用户手势除了请求通知权限，还会解锁提示音的音频上下文（浏览器的自动播放限制）。

### Removed

- 删除了窗口尺寸启发式的全屏判定（`isBrowserFullscreen` 与 24px 容差）：实测 Edge 在 Windows
  全屏时 `outerWidth/outerHeight` 比 `screen` 小约 12px，且自动隐藏任务栏会误判最大化窗口；
  改为「每次提醒都响提示音并把通知设为 silent」，不再需要猜窗口状态。

## [0.3.1] - 2026-10-23

### Fixed

- 设置 → 通用 的两行（「审批桌面通知」「任务完成通知」）改由**同一个** `ctx.slots.inject`
  生成器统一注册：对同一个 `settings.general.item` slot 调两次独立 `inject` 时，后注册的
  「任务完成通知」行不保证与前一行共存，可能整行不显示。除注册方式外行为不变。

## [0.3.0] - 2026-10-21

### Added

- **任务完成通知**：会话从“运行中”转为“空闲”时，发一条轻量桌面通知（标题「任务完成」，
  正文为会话名）；点击同样回到对应会话。子代理会话跳过，避免工作流里刷屏。
- **开关**：设置 → 通用新增「任务完成通知」行（`role="switch"`、`aria-checked`），
  默认开启，开关值存在本机浏览器 `localStorage` 的 `dsh-approval-reminder:task-finished`。
- 完成通知沿用同一套“只在你不看页面时提醒”的判定；回到页面时会被主动关闭。

### Changed

- 状态快照的本地类型补充 `running` 字段；`NotifierDeps` 增加 `isSubagent`。

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
