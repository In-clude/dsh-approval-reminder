# dsh-approval-reminder

[English](README.en.md) | **中文**

[![check](https://github.com/In-clude/dsh-approval-reminder/actions/workflows/check.yml/badge.svg)](https://github.com/In-clude/dsh-approval-reminder/actions/workflows/check.yml)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](package.json)

命令在 DeepSeek Harness 里等待审批、智能体提问等你选择、或会话跑完一轮时，用 **Edge / Windows 桌面通知**提醒你。

适用对象：**DeepSeek Harness（DSH）Web 界面 + Windows 上的 Microsoft Edge**。
插件本体是纯 JavaScript：**运行时零依赖、零构建**，宿主侧只是一个空壳条目。

- 🔔 命令等待审批 → 弹一条 Windows 通知（进通知中心，可点开）
- ❓ 智能体用 `ask_user_question` 给出选项等你选择 → 同样弹一条通知（**规则与审批提醒完全一致**）
- ✅ 任务完成（会话转为空闲）→ 弹一条轻量通知，**可在设置里开关**
- 🙈 **只在你不看页面时提醒**：你正看着对话页就不打扰，切走/最小化才提醒
- 🔊 **提醒时响一声提示音**：桌面通知可能被 Edge/Windows 静默丢弃（浏览器全屏时尤其常见），打开这个开关后会播放两声短提示音，并把桌面通知设为静音避免响两次（**默认关闭，可在设置里打开**）
- 🖱 点通知 → 切回对应会话并把 Edge 带到前台
- 🧹 审批结束或问题被回答（允许/拒绝/取消/撤回）→ 对应通知自动关闭
- 🔒 只读本地状态，**不参与审批决策、不代替你答题**，不发起任何网络请求

---

## 目录

- [它做什么](#它做什么)
- [前提条件](#前提条件)
- [安装](#安装)
- [首次授权](#首次授权)
- [使用与自测](#使用与自测)
- [工作原理](#工作原理)
- [安全与隐私](#安全与隐私)
- [项目结构](#项目结构)
- [开发](#开发)
- [验证状态](#验证状态)
- [已知限制](#已知限制)
- [卸载](#卸载)
- [商店收录](#商店收录)
- [版本与更新记录](#版本与更新记录)
- [License](#license)

## 它做什么

DSH 在命令需要更高权限时会发起一次审批请求（例如沙箱拒绝后的升级重试），宿主会在会话输入框上方显示审批面板。

另一种等待也很常见：智能体调用 `ask_user_question`，把几个选项摆出来让你选（计划审阅卡 `plan-review` 也是同一类请求）。你不选，它就停在那里。

问题在于时机：你切到别的会话、把 Edge 最小化、或者干脆去做别的事了——面板就在那儿等着，但你看不见。

这个插件补上这一环：**当某个会话出现待审批请求、智能体在等你选择、或某个会话跑完一轮转为空闲时，如果你没有看着 DSH 页面，就发一条系统通知。**

一条审批通知的内容：

| 部分 | 内容 |
| --- | --- |
| 标题 | `需要审批` |
| 正文 | 请求方给出的原因（没有原因时是“工具 `pwsh` 请求以更高权限执行”）+ 换行 + 所属会话名 |
| 点击 | 打开对应会话，并聚焦 Edge 窗口；该通知随后关闭 |
| 生命周期 | 请求被回答 / 取消 / 撤回后自动关闭；同一会话的新请求会替换旧通知 |

一条提问通知的内容（**规则与审批通知完全一致**，只是文案与 `tag` 不同）：

| 部分 | 内容 |
| --- | --- |
| 标题 | `需要你的选择` |
| 正文 | 请求里的第一道题 + 换行 + 所属会话名（没有题目文本时用固定文案） |
| 触发 | `pendingInteraction.kind === 'question'` 或 `'plan-review'`；已答问题的“回顾卡”（只回放历史）不提醒 |
| 点击 | 打开对应会话，并聚焦 Edge 窗口；该通知随后关闭 |
| 生命周期 | 问题被回答 / 取消后自动关闭；同一会话的新请求会替换旧通知 |

任务完成通知（**默认开启，可在设置里关掉**）：

| 部分 | 内容 |
| --- | --- |
| 标题 | `任务完成` |
| 正文 | 所属会话名 |
| 触发 | 该会话从“运行中”变为“空闲”（一轮结束）；子代理会话不提醒 |
| 生命周期 | 普通（非驻留）通知，由系统自动收走；回到页面时也会被关闭 |

它**不做**的事：不改审批结果、不动沙箱策略、不代替你作答、不收集任何数据。

## 前提条件

1. Windows **设置 → 系统 → 通知** 里允许 **Microsoft Edge**（关掉时系统会直接丢弃网页通知）。
2. 不要处于专注助手 / 勿扰模式。
3. DSH Web 页面保持打开——可以最小化，但**关掉标签页就没有通知了**（插件不用 Service Worker / Push）。
4. 首次使用要在 Edge 里允许本站点显示通知（见[首次授权](#首次授权)）。

## 安装

在装好 DSH 的机器上任选一种：

```powershell
# 1) 从 GitHub 安装（pnpm 的 GitHub 简写）
dsh plugin --profile web add In-clude/dsh-approval-reminder

# 2) 从本地目录安装（开发/改代码时）
dsh plugin --profile web add "D:\path\to\dsh-approval-reminder"
```

```text
3) 也可以在 DSH Web 的 设置 → 插件 页里安装/启用/禁用/卸载。
```

安装生效的判断标准：**设置 → 通用** 里出现「审批桌面通知」「任务完成通知」「提醒提示音」三行。bundle 会作为当前 profile 的一个插件条目激活，通常不需要重启 DSH；浏览器端刷新一次页面即可。

## 首次授权

浏览器硬性要求通知授权必须由**用户手势**触发，所以有两条路，任选其一：

- 页面加载后你**第一次点击/按键**时，插件请求一次通知权限（每次页面加载最多一次）；
- 或者打开 **设置 → 通用 → 审批桌面通知**，点「开启」。

授权成功后，该行状态变成「已开启」，并出现 **发送测试通知** 按钮。这同一个手势还会解锁提示音的音频上下文（浏览器的自动播放限制要求先有用户手势，否则提示音出不来；没有解锁时通知会退回系统自带提示音）。

如果不小心点过「阻止」：点 Edge 地址栏左侧的站点图标 → 权限 → 通知改回允许 → 刷新页面。该行会显示「已被浏览器阻止」并给出这条指引。

## 使用与自测

- **自测**：设置 → 通用 → 「审批桌面通知」→ 已开启状态下点「发送测试通知」，应当出现一条标题为「审批桌面通知」的系统通知。这条链路不需要真实审批。
- **真实验证**：任何一次需要审批的工具调用都会触发；如果你正看着页面，它**故意不弹**——把窗口切走，挂起的请求就会补发一条通知。
- **提问验证**：让智能体调用 `ask_user_question`（例如让它「用选项问我今天先做哪件事」）。你正看着页面时它同样不弹；把窗口切走，挂起的提问会补发一条标题为「需要你的选择」的通知
- **任务完成通知**：设置 → 通用 → 「任务完成通知」里用开关启用/停用（默认开启，选择存在本机浏览器里）。发一条消息、把窗口切走，等一轮跑完就会收到「任务完成」。
- **提醒提示音**：设置 → 通用 → 「提醒提示音」开关（**默认关闭**，需要声音兜底时打开）。打开后有提醒时响两声短「叮」，桌面通知会被设为静音以免响两次，通知没弹出来（浏览器全屏、系统抑制）时也能听到；关闭时通知使用系统自带提示音。旁边的 **试听提示音** 按钮可以随时确认声音通道（点击本身就是用户手势，会顺带解锁音频上下文）。
- **排查「没提醒 / 没声音」**：打开 F12 → Console 执行 `localStorage.setItem('dsh-approval-reminder:debug','1')`（排查完 `localStorage.removeItem('dsh-approval-reminder:debug')`）。之后每次提醒判定都会写入本标签页的 `sessionStorage`（键 `dsh-approval-reminder:log`，最多 100 条），并在 Console 打印 `[approval-reminder]`。**发完测试后**执行下面这条命令即可回看（不需要在事件发生时开着 DevTools）：

  ```js
  JSON.parse(sessionStorage.getItem('dsh-approval-reminder:log') || '[]').forEach(e => console.log(e.at, e.label, e.details))
  ```

  关键字段：`viewing`（是否判定「正在看页面」）、`visibility` / `focused`、`outer` / `inner` / `screen` 尺寸、`permission`、`soundEnabled` / `doneEnabled`、`chimeReady`、`soundPlayed`、`pendingKinds`（本轮快照里等你处理的交互类型）。
- **通知太多？** 同一 `sessionId + request key` 永远只提醒一次；回到页面时已弹出的通知会被主动关闭。

## 工作原理

| 关注点 | 做法 |
| --- | --- |
| 状态来源 | 订阅客户端 `uiSession.sessionStatus`（`getSnapshot` / `subscribe` 的纯 observable）：审批看 `pendingInteraction.kind === 'approval'`，提问看 `'question'` / `'plan-review'`（`review` 非空的回顾卡跳过），完成看 `running` 的 `true → false` 跳变 |
| 提醒时机 | `document.visibilityState === 'visible' && document.hasFocus()` 视为“正在看页面”→ 静默；在 `visibilitychange` / `focus` / `blur` 时重新判断，所以**离开页面后才懒提醒**；同一请求（`sessionId + request key`）只提醒一次 |
| 审批通知 | `new Notification(title, { body, tag, requireInteraction: true })`；`tag = 'dsh-approval:<sessionId>'` 让同一会话的通知互相替换 |
| 提问通知 | 与审批同一套规则：同样的“只在页面外提醒”判定、同样的去重与自动关闭、`requireInteraction: true`；只有标题（`需要你的选择`）、正文（第一道题）与 `tag = 'dsh-question:<sessionId>'` 不同 |
| 完成通知 | `tag = 'dsh-done:<sessionId>'`，不设 `requireInteraction`（由系统自动收走）；子代理会话跳过；开关存在 `localStorage` 的 `dsh-approval-reminder:task-finished` |
| 提醒提示音 | 桌面通知可能被静默丢弃：Chromium 在浏览器窗口全屏时会拦掉弹窗，Windows 在网页全屏/视频播放等场景也可能抑制它。所以发提醒时，若**开关打开且**提示音可用（`AudioContext` 由首次用户手势解锁且处于 running），就把通知创建为 `silent` 并播放两声短提示音——保证**恰好响一次**；开关关闭或音频不可用时不静音、退回系统通知声。开关存在 `localStorage` 的 `dsh-approval-reminder:chime`，**默认关闭** |
| 点击行为 | `uiWorkspace.openSession(sessionId)` + `window.focus()` + `close()` |
| 失败处理 | 构造通知抛错时记录到控制台（`[approval-reminder]` 前缀）并标记为已尝试，不会每次状态变化都重试 |
| 清理 | 订阅、手势监听、可见性监听、设置行、已发通知全部随插件卸载回收 |
| 宿主侧 | 空壳（`index.js` 只有 `apply() {}`）：不注册 Service / Tool / Config，不写会话事件 |

**为什么不直接拦 `approval/request` / `user-questions/request`？** 这些 waterfall 在客户端会被转发给所有监听者，任何返回结果（或包装 `next()`）的监听器都可能抢走或挡住宿主面板，且注册顺序不可控。只读观察“待处理交互快照”在语义上是零风险的。

**为什么是桌面通知而不是页面内横幅？** 提醒的价值在于“你没在看页面”；你已经在看的时候，宿主的面板（审批或提问选项）本来就在屏上。

## 安全与隐私

- 只读取浏览器端已有的会话状态快照：审批的原因文本、提问的**题目文本**（只用于通知正文），**不读取会话消息内容、不读取命令文本**。
- **不发起任何网络请求**；通知内容由本机浏览器渲染。
- **不参与审批、不代替你答题**：不注册 `approval/request` 或 `user-questions/request` 监听器，不修改任何策略、选项或结果。
- 运行时零依赖：唯一的 `require` 是宿主已经提供的 `react`；不 import 任何 `@deepseek-ai/dsh-client-*` 包。
- 样式只使用 Theme 公开 token（`--dsw-alias-*`），不注入自己的颜色。

## 项目结构

| 路径 | 作用 |
| --- | --- |
| `client.js` | 浏览器 bundle：通知通道 + 提醒提示音 + 三个设置行（核心逻辑，首行 `// @ts-check`） |
| `index.js` | 宿主半侧空壳（让本包成为一个可安装的 Loader 条目） |
| `cordis.patch.yml` | bundle 的 Loader patch：插入 `approval-reminder` 条目 |
| `locale/en.json`、`locale/zh.json` | 插件页显示名与描述 |
| `icon.svg` | 插件卡片图标 |
| `types/globals.d.ts` | 模块加载器 `require('react')`、`window.__ModuleLoader__` 的声明 |
| `types/dsh-client.d.ts` | DSH 客户端契约的本地最小声明（状态快照、pending interaction、locale、slots） |
| `jsconfig.json` | `checkJs` + `strict` 的类型检查配置 |
| `scripts/check.mjs` | 无依赖静态检查（37 项） |
| `AGENTS.md` | 项目规则：不可破坏的约束、命名、提交前检查、隐私与收录流程 |
| `.github/workflows/check.yml` | CI：`npm ci` → 类型检查 → 静态检查 |

## 开发

运行时无依赖、无构建：`client.js` 就是浏览器加载的产物，`index.js` 就是宿主加载的 ES 模块。开发期只装两个 devDependency（`typescript`、`@types/react`），全部用于类型检查。

```powershell
npm install              # 只装开发期依赖
npm run typecheck        # tsc -p jsconfig.json
npm test                 # = typecheck + node scripts/check.mjs（37 项）
```

`client.js` 首行是 `// @ts-check`，配合 `jsconfig.json`（`checkJs`、`strict`）与 `types/*.d.ts`：`window.__ModuleLoader__`、`require('react')` 都有真实类型，DSH 客户端契约用本地最小声明描述。于是 VS Code 这类编辑器打开仓库即有补全与错误提示，**不需要引入任何 Harness 客户端包**。

静态检查覆盖：manifest 字段与 `exports` 指向、locale 元数据、patch 行、`AGENTS.md` 存在、`// @ts-check` 未被移除、两个 JS 文件的语法（`node:vm` 编译检查，不执行代码）。

改代码前请先读 [AGENTS.md](AGENTS.md)：里面写着不能破坏的约束、固定命名、发布流程与隐私规则。

## 验证状态

在 Windows + Edge（DSH Web `127.0.0.1`）上实测通过：

- 命令等待审批时**弹出** Edge/Windows 桌面通知；**点击**后通知消失并回到对应会话；
- 审批作出决定（允许或拒绝）后，插件关闭该请求对应的通知；
- 「发送测试通知」可独立验证通道；
- **提醒时机（0.2.0）**：请求挂起时你正看着对话页 → **不弹**；切到别的窗口/最小化后 → **弹出**；回到页面 → 通知自动关闭；
- **类型与静态检查（0.2.1 起）**：`npm test` 与 GitHub Actions 均通过（干净 runner 上 `npm ci` + typecheck + 37 项检查）。
- **提醒提示音（0.5.0）**：已在 Windows + Edge 实测：真全屏与 B站「网页全屏」看视频时，任务完成提醒都能听到提示音；「提示音可用时通知设为 `silent`、每次提醒恰好响一次」的配对由 `npm test` / `node --check` 与沙箱行为校验覆盖。
- **提问提醒（0.5.0）**：`ask_user_question` / `plan-review` 的识别、文案、`tag`、去重、“正在看页面时不弹、切走后补发”、回顾卡跳过，均由本地桩环境（假 `uiSession.sessionStatus` + 假 `Notification`）逐条断言通过；**真实提问场景下的系统通知是否弹出仍需实测确认**。

未覆盖：headless / API 会话、页面关闭后的提醒、macOS / Linux 桌面通知、多标签页同时打开时的表现。

## 已知限制

- 仅对**浏览器会话**生效；headless / API 会话没有通知。
- Chromium（Edge）在 Windows 上不支持通知上的「允许/拒绝」按钮，所以通知只做提醒，点开回到会话里作答。
- 通知能否真的弹出取决于 Windows 通知设置与专注助手，插件无法覆盖。
- **桌面通知可能被静默丢弃**：浏览器窗口全屏时 Chromium 会拦掉网页通知弹窗（fullscreen notification blocker），Windows 在网页全屏、播放视频等场景也可能抑制通知；网页侧没有 API 可以保证弹窗出现，所以用**提示音**作为可靠通道。
- 提示音依赖用户手势解锁的音频上下文：页面加载后若从未点击/按键，就不会出声（浏览器自动播放限制）；此时通知保留系统自带提示音。
- 网页全屏（例如 B站「网页全屏」）时若系统抑制了网页通知，弹窗可能不出现；提示音仍会响。
- 打开多个标签页时，每个页面各自通知自己收到的请求。
- 页面关闭后不再提醒（未使用 Service Worker / Push）。
- 「任务完成通知」只按“运行中 → 空闲”判断，不区分正常完成、被中止或出错；子代理会话的完成不提醒。
- 「任务完成通知」的开关存在浏览器 `localStorage`（按源隔离）：换端口、换浏览器或清掉站点数据后回到默认（开启）。
- 「提问通知」的正文只放**第一道题**（一次请求可以包含多道题）；其余题目与选项要打开会话才能看到。
- 「提问通知」没有单独开关，和审批提醒一样只在你看不到页面时触发。
- 样式/文案随 DSH 版本演进；如遇契约变化，`npm run typecheck` 会先报错。

## 卸载

```powershell
dsh plugin --profile web remove dsh-approval-reminder
```

或在 **设置 → 插件** 页里停用/卸载。卸载后通知与设置行一并消失，不残留任何会话数据。

## 商店收录

本插件通过 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 精选列表进入 dsh-market（市场仓库本身不收插件条目）。条目文件：

```yaml
# data/plugins/In-clude__dsh-approval-reminder.yml
category: notify
```

收录条件：`package.json` 声明 `dsh.bundle`、仓库创建满 1 天、仓库带 `dsh-plugin` topic、描述与代码一致。

## 版本与更新记录

当前版本 `0.5.0`。变更记录见 [CHANGELOG.md](CHANGELOG.md)，遵循语义化版本：行为变更升 minor，纯文档不升版本。

## License

[MIT](LICENSE) © 2026 In-clude
