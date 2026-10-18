# dsh-approval-reminder

命令在 DeepSeek Harness 里等待审批时，用 **Edge / Windows 桌面通知**提醒你。

> 适用对象：DeepSeek Harness（DSH）Web 界面 + Windows 上的 Microsoft Edge。
> 插件本身是纯 JavaScript、无依赖、无构建步骤。

---

## 它做什么

DSH 在命令需要更高权限（例如沙箱拒绝后升级）时会发起一次审批请求，宿主会在会话输入框上方显示审批面板。如果当时你没盯在那一屏——切到别的会话、Edge 被最小化、正在做别的事——很容易漏掉。

这个插件在**每个待审批请求**出现时发一条系统通知：

**只在你不看这个页面时提醒。** 页面可见且处于前台（你正看着对话）时不发通知——审批面板本来就在屏上；页面切到后台、最小化或失去焦点时才提醒。回到页面后，已经弹出的通知会自动关闭。

- 标题：`需要审批`
- 正文：请求方给出的原因（或“工具 `pwsh` 请求以更高权限执行”）+ 所属会话名
- 点击通知：切回对应的会话，并把 Edge 窗口带到前台
- 审批被回答、取消或撤回后：通知自动关闭
- 同一会话的连续请求会替换旧通知，不会堆一屏

它**不参与**审批决策：只读取浏览器端的“会话待审批状态”快照，从不拦截 `approval/request`，因此不会改变任何审批结果。

## 前提条件

1. Windows 的 **设置 → 系统 → 通知** 里允许 **Microsoft Edge**（关闭时系统会丢弃网页通知）。
2. 不要处于专注助手/勿扰模式。
3. DSH Web 页面保持打开（可以最小化；关掉标签页就不会再有通知）。
4. 首次使用需要在 Edge 里允许本站点显示通知（见下一节）。

## 安装

在装好 DSH 的机器上，任选一种：

```powershell
# 从 GitHub 安装（pnpm 的 GitHub 简写）
dsh plugin --profile web add In-clude/dsh-approval-reminder

# 或从本地目录安装（开发时）
dsh plugin --profile web add "D:\path\to\dsh-approval-reminder"
```

也可以在 DSH Web 的 **设置 → 插件** 页里安装/启用/禁用/卸载。

安装后无需重启 DSH：bundle 会作为当前 profile 的一个插件条目激活；浏览器端刷新页面即可看到效果。

## 首次授权

浏览器只允许**用户手势**触发通知授权，所以插件有两条路，任选其一：

- 页面加载后**第一次点击/按键**时，插件会请求一次通知权限（每次页面加载最多一次）；
- 或者打开 **设置 → 通用 → 审批桌面通知**，点「开启」。

授权后，那一行的状态变成「已开启」，并出现 **发送测试通知** 按钮——用它可以在不触发真实审批的情况下确认通道可用。

如果之前点过“阻止”，请在 Edge 地址栏左侧的站点图标里把通知改回允许，然后刷新页面。

## 卸载

```powershell
dsh plugin --profile web remove dsh-approval-reminder
```

或在 **设置 → 插件** 页里停用/卸载。卸载后通知与设置行一并消失，不留下会话数据。

## 实现要点

| 关注点 | 做法 |
| --- | --- |
| 待审批状态来源 | 订阅 `uiSession.sessionStatus`（`getSnapshot` / `subscribe` 的纯 observable），筛出 `pendingInteraction.kind === 'approval'` 的会话 |
| 提醒时机 | `document.visibilityState === 'visible' && document.hasFocus()` 视为“正在看页面”→ 静默；在 `visibilitychange` / `focus` / `blur` 时重新判断，所以离开页面后才懒提醒；同一请求只提醒一次，回到页面即关闭已弹出的通知 |
| 通知 | `new Notification(title, { body, tag, requireInteraction: true })`，`tag` 按会话去重 |
| 点击行为 | `uiWorkspace.openSession(sessionId)` + `window.focus()` |
| 去重 | 每个 `sessionId + request key` 只通知一次；构造失败也记录，避免每次快照变化都重试 |
| 清理 | 订阅、手势监听、设置行、已发通知全部随插件卸载回收 |
| 宿主侧 | 空壳（`index.js` 只有 `apply() {}`）：不注册 Service / Tool / Config / 会话事件 |

生命周期：通知由**页面**发起，因此标签页关闭即停止；DSH 换端口后通知权限按源重新授权。

## 项目结构

```
client.js              # 浏览器 bundle：通知通道 + 设置行（核心逻辑）
index.js               # 宿主半侧空壳
cordis.patch.yml       # bundle 的 Loader patch：插入 approval-reminder 条目
locale/en.json|zh.json # 插件页显示名与描述
icon.svg               # 插件卡片图标
scripts/check.mjs      # 无依赖静态检查（npm test）
.github/workflows/     # CI：push/PR 跑 check
```

## 开发

无依赖、无构建：`client.js` 就是浏览器加载的 bundle，`index.js` 就是宿主加载的 ES 模块。

```powershell
node scripts/check.mjs   # 或 npm test
```

检查内容：manifest 字段、`exports` 指向的文件、locale 元数据、patch 行、两个 JS 文件的语法（`node:vm` 编译检查，不执行代码）。

## 验证状态

在 Windows + Edge（DSH Web `127.0.0.1`）上实测通过：

- 命令等待审批时**弹出** Edge/Windows 桌面通知；
- **点击**通知后该通知消失（同时切回对应会话、聚焦窗口）；
- 审批作出决定（允许或拒绝）后，插件会关闭该请求对应的通知；
- 设置 → 通用 的「发送测试通知」可独立验证通道；
- **0.2.0 提醒时机**：请求挂起时你正看着对话页 → **不弹**；切到别的窗口/最小化后 → **弹出**；回到页面 → 通知自动关闭。

未覆盖：headless / API 会话、页面关闭后的提醒、macOS / Linux 桌面通知、多标签页同时打开时的表现。

## 已知限制

- 仅对**浏览器会话**生效；headless / API 会话没有通知。
- Chromium（Edge）在 Windows 上不支持通知上的“允许/拒绝”按钮，所以通知只做提醒；点通知回到会话里作答。
- 通知是否真能弹出取决于 Windows 通知设置与专注助手，插件无法覆盖。
- 打开多个标签页时，每个页面各自通知自己收到的请求。
- 页面关闭后不再提醒（未使用 Service Worker / Push）。

## English

A DSH Web plugin that raises an Edge/Windows desktop notification whenever a
command is waiting for approval, and closes it once the request is answered.
It only observes the client Session status snapshot (`uiSession.sessionStatus`)
and never joins the `approval/request` waterfall, so approval outcomes are
unaffected. Notifications need a one-time permission grant (first click or the
General-settings row). No dependencies, no build step.

## License

MIT © 2026 In-clude
