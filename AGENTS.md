# 项目规则 · dsh-approval-reminder

本仓库只做一件事：**在 DeepSeek Harness Web 里，当工具调用等待审批、而用户不在页面上时，发一条 Edge/Windows 桌面通知**。
改代码前先读完这一页；与本文件冲突的临时想法，以本文件为准。

## 1. 不可破坏的约束

1. **不接 `approval/request` waterfall。** 只在 `uiSession.sessionStatus` 上做只读观察，筛 `pendingInteraction.kind === 'approval'`。
   原因：客户端转发会把同一个请求发给所有监听者，任何返回结果/包装 `next()` 的监听器都可能抢走或挡住宿主审批面板，且顺序不可控。观察 pending interaction 是零风险的。
2. **不 import 任何 `@deepseek-ai/dsh-client-*` 包。** 浏览器侧只允许 `require('react')`；`dsh.client.inject` 仅用于加载顺序，不是依赖。
3. **颜色只用 Theme 公开 token**（`--dsw-alias-*`，见 `cordis_inspect_query` 的 `Theme`）；浅/深色必须自动跟随；字面色只允许出现在 `icon.svg` 这类 artwork 里。
4. **可见文案一律走 `ctx.locale`**：命名空间固定 `approvalReminder`；`zh` 是键集基准，`en` 用 `@type {typeof zh}` 约束（缺键/错键必须是类型错误）。
5. **只在用户不看页面时提醒**：`document.visibilityState === 'visible' && document.hasFocus()` 视为正在看页面 → 静默；在 `visibilitychange` / `focus` / `blur` 时重算；同一 `sessionId + request key` 只提醒一次。
6. **不写组件之外的 DOM**：不 portal 到 `document.body`，不读别人的 DOM/样式表，样式随组件卸载或 `ctx.effect` 一起回收。
7. **运行时零依赖、零构建**：`client.js` 就是浏览器加载的产物，`index.js` 是宿主半侧空壳；宿主侧不注册 Service / Tool / Config / 会话事件。

## 2. 代码约定

- `client.js` 第一行必须是 `// @ts-check`；新增函数/字段要带 JSDoc 类型；`npm run typecheck` 必须零错误。
- 外部契约类型只写在 `types/dsh-client.d.ts`（只声明本插件用到的字段），环境全局写在 `types/globals.d.ts`。不要引入 DSH 的包类型。
- 注册、订阅、事件监听、定时器一律放在 `ctx.effect` / `ctx.inject` / `ctx.slots.inject` 里并返回清理函数；插件卸载必须干净（不残留通知、监听、locale 字典、slot 条目）。
- 命名固定：包名 `dsh-approval-reminder`；Loader 行 id `approval-reminder`；slot id `approval-reminder`（`settings.general.item`，`order: 21`）；locale 命名空间 `approvalReminder`；CSS 前缀 `.dsh-approval-reminder-`。
- 通知使用 `tag = 'dsh-approval:<sessionId>'` 去重、`requireInteraction: true`；点击行为是 `uiWorkspace.openSession(sessionId)` + `window.focus()` + `close()`。
- 构造通知失败要“记录后不重试”，不要让每个快照变化都重新抛错。
- 文档：`README.md` 是**中文主版本**，`README.en.md` 是**内容对等的英文版**（不是摘要）；两份顶部互链，新增/修改章节必须同步两份。`scripts/check.mjs` 会校验两个文件存在且互链。

## 3. 提交前检查（必须全绿）

```powershell
npm ci            # 仅 devDependencies：typescript、@types/react
npm test          # = npm run typecheck + node scripts/check.mjs（37 项）
node --check client.js
```

- CI（`.github/workflows/check.yml`）跑同一组命令；**main 上不允许红**。
- 版本与发布：行为变更升 minor（`0.2.0` → `0.2.1`），纯文档不升版本；每次发布同时更新 `package.json` `version` 与 `CHANGELOG.md`（Keep a Changelog 格式）。
- 发布流程：提交 → `git push origin main` → `git tag -a vX.Y.Z -m "..."` → `git push origin vX.Y.Z` → 确认 `git ls-remote` 的远端 refs。
- 提交信息用 Conventional Commits（`feat:` / `fix:` / `docs:` / `chore:`）。

## 4. 隐私与安全

- 提交内容里**不得**出现本机路径（`C:\Users\<用户名>`、`D:\真\...`）、token、密钥、`approval-probe*` 之类测试残留；README 示例只用占位路径。
- 提交身份固定 `In-clude <In-clude@users.noreply.github.com>`（仓库级 `git config`，不改全局）。
- `.env`、日志、`node_modules/` 不提交（`.gitignore` 已覆盖）；不提交 `package-lock.json` 之外的锁文件。
- 推送前自查：`git grep -nE 'C:\\\\Users|AppData|ghp_|sk-[A-Za-z0-9]{16,}|BEGIN (RSA|OPENSSH|PRIVATE)' origin/main`。

## 5. 本机安装与热更新

- 本 profile 以 `link:` 安装本仓库（`dsh plugin --profile web add <本目录>`）；改完 `client.js`，宿主 `client-hmr` 每 ~500ms 轮询 bundle 并热替换，通常无需刷新页面；若行为没变再 F5。
- 其他机器安装：`dsh plugin --profile web add github:In-clude/dsh-approval-reminder`。
- 沙箱提示：`workspace-write` 模式下 git 自带 ssh 无法创建信号管道（Win32 error 5），推送需要 `danger-full-access`。

## 6. 商店收录（dsh-market）

- 条目仓库是 `awesome-dsh-plugin/awesome-dsh-plugin`，**不是** `dsh-market/dsh-market`（后者只是市场应用）。
- 每次只加一个文件：`data/plugins/In-clude__dsh-approval-reminder.yml`；两个 README 由 CI 生成，**不要手改**。
- 收录条件：`package.json` 声明 `dsh.bundle` + 仓库满 1 天 + 仓库带 `dsh-plugin` topic；描述只写行为、不带营销词且必须与代码一致。
- 已提交 PR #8506；本仓库内容变化（版本、能力）时同步检查条目描述是否仍然属实。

## 7. 验证上限（如实标注）

- 本机没有浏览器控制工具：**视觉与通知是否真的弹出只能由用户确认**。可自动验证的是：`npm test` / CI、`plugin_manager` 的 `application: applied`、`Slots.listSubTree` 里的 slot 占用。
- 不要为了让测试通过而改宿主配置或伪造证据；测完要还原（例如把会话权限预设切回 `danger-full-access`）。
