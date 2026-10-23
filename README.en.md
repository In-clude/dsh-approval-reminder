# dsh-approval-reminder

**English** | [中文](README.md)

[![check](https://github.com/In-clude/dsh-approval-reminder/actions/workflows/check.yml/badge.svg)](https://github.com/In-clude/dsh-approval-reminder/actions/workflows/check.yml)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](package.json)

Raise an **Edge / Windows desktop notification** while a command waits for approval, the agent waits for you to pick an option, or a Session finishes a turn in DeepSeek Harness.

Target: **the DeepSeek Harness (DSH) Web UI with Microsoft Edge on Windows.**
The plugin is plain JavaScript — **no runtime dependencies, no build step** — and the Host half is an empty shell entry.

- 🔔 A command waits for approval → one Windows notification (it lands in the Action Center)
- ❓ The agent offers options through `ask_user_question` and waits for your choice → one notification too (**exactly the same rules as the approval reminder**)
- ✅ A task finishes (the Session goes idle) → a light notification, **toggleable in Settings**
- 🙈 **Only while you are not looking at the page**: silent while you are on the conversation, announced once you switch away or minimize
- 🔊 **A chime with every reminder**: a desktop notification can be dropped silently (Edge/Windows suppress it in some states, fullscreen especially). With this switch on, the plugin plays a short two-tone chime and marks the notification `silent` so it does not sound twice (**off by default; turn it on in Settings**)
- 🖱 Click the notification → opens that conversation and brings Edge to the front
- 🧹 Once the request settles (answered, allowed, rejected, cancelled or withdrawn) → that notification closes
- 🔒 Reads local state only, **never takes part in the decision and never answers for you**, makes no network request

---

## Contents

- [What it does](#what-it-does)
- [Requirements](#requirements)
- [Install](#install)
- [First-time permission](#first-time-permission)
- [Using it and testing the channel](#using-it-and-testing-the-channel)
- [How it works](#how-it-works)
- [Security and privacy](#security-and-privacy)
- [Repository layout](#repository-layout)
- [Development](#development)
- [Verification status](#verification-status)
- [Known limitations](#known-limitations)
- [Uninstall](#uninstall)
- [Market listing](#market-listing)
- [Version and changelog](#version-and-changelog)
- [License](#license)

## What it does

When a command needs higher privileges, DSH raises an approval request (for example an escalation after the sandbox denied a write) and the Host shows an approval panel above the composer.

Another wait is just as common: the agent calls `ask_user_question` and puts a handful of options in front of you (the `plan-review` plan card is the same kind of request). Until you choose, it stays parked.

The problem is timing: you switched to another conversation, minimized Edge, or walked away — the panel is waiting, but you cannot see it.

This plugin closes that gap: **when a Session has a pending approval request, the agent waits for your choice, or the Session finishes a turn and goes idle, and you are not looking at the DSH page, it raises a system notification.**

One approval notification carries:

| Part | Content |
| --- | --- |
| Title | `Approval needed` |
| Body | The reason supplied by the requester (or “Tool `pwsh` requests privileged execution”) + a newline + the Session name |
| Click | Opens that conversation and focuses the Edge window, then closes the notification |
| Lifetime | Closed as soon as the request is answered, cancelled or withdrawn; a newer request in the same Session replaces the older notification |

One question notification carries (**exactly the same rules as the approval one**, only the copy and the `tag` differ):

| Part | Content |
| --- | --- |
| Title | `A choice is needed` |
| Body | The first question of the request + a newline + the Session name (a fixed line when the request carries no readable question text) |
| Trigger | `pendingInteraction.kind === 'question'` or `'plan-review'`; the read-only “review” card of an already answered question is skipped |
| Click | Opens that conversation and focuses the Edge window, then closes the notification |
| Lifetime | Closed as soon as the question is answered or cancelled; a newer request in the same Session replaces the older notification |

The task-finished notification (**on by default, can be switched off in Settings**):

| Part | Content |
| --- | --- |
| Title | `Task finished` |
| Body | The Session name |
| Trigger | That Session goes from running to idle (a turn ended); subagent Sessions are skipped |
| Lifetime | Transient (not pinned), so the system may collect it; returning to the page also closes it |

What it does **not** do: it does not change outcomes, does not touch sandbox policy, does not answer for you, and does not collect anything.

## Requirements

1. Windows **Settings → System → Notifications** must allow **Microsoft Edge** (when it is off, Windows drops web notifications).
2. Do not be in Focus assist / Do not disturb.
3. Keep the DSH Web page open — minimizing is fine, but a closed tab stops the notifications (no Service Worker / Push here).
4. Allow notifications for this site in Edge once — see [First-time permission](#first-time-permission).

## Install

Pick one, on the machine that runs DSH:

```powershell
# 1) From GitHub (pnpm's GitHub shorthand)
dsh plugin --profile web add In-clude/dsh-approval-reminder

# 2) From a local directory (development)
dsh plugin --profile web add "D:\path\to\dsh-approval-reminder"
```

```text
3) Or use Settings → Plugins in the DSH Web UI to install / enable / disable / remove it.
```

How to tell it is live: three rows named **Approval desktop notifications**, **Task-finished notifications** and **Reminder chime** appear under **Settings → General**. The bundle activates as one plugin entry of the current profile; usually no DSH restart is needed, and a browser reload is enough.

## First-time permission

Browsers only grant notification permission on a **user gesture**, so there are two paths — either one is enough:

- on the **first click or key press** after the page loads, the plugin asks once (at most once per page load);
- or open **Settings → General → Approval desktop notifications** and press **Enable**.

Once granted, that row reads **Enabled** and gains a **Send a test notification** button. That same gesture also unlocks the chime's audio context (browsers only allow audio after a user gesture; without it the notification keeps the system sound).

If you accidentally pressed “Block”: click the site icon at the left of Edge's address bar → Permissions → Notifications → allow, then reload the page. The row then reports **Blocked by the browser** with that same hint.

## Using it and testing the channel

- **Self-test**: Settings → General → **Approval desktop notifications** → with the state at **Enabled**, press **Send a test notification**; a system notification titled “Approval desktop notifications” should appear. This needs no real approval.
- **Real check**: any tool call that needs approval triggers it. If you are looking at the page it deliberately stays silent — switch the window away and the pending request is announced.
- **Question check**: have the agent call `ask_user_question` (for example, ask it to “ask me with options what I should do first today”). It also stays silent while you are looking at the page; switch the window away and the pending question is announced with the title “A choice is needed”.
- **Task-finished notifications**: use the switch in Settings → General → **Task-finished notifications** to enable or disable them (on by default; the choice is stored in this browser). Send a message, switch the window away, and the end of the turn raises a “Task finished” notification.
- **Reminder chime**: the switch in Settings → General → **Reminder chime** (**off by default**; turn it on when you need the audio fallback). With it on, every reminder plays a two-tone chime and the desktop notification is marked silent so it does not sound twice — the chime is still heard when the notification is suppressed (browser fullscreen, Windows suppression). With it off, notifications keep the system sound. The **Play the chime** button next to it checks the audio channel at any time (the click itself counts as the user gesture that unlocks the audio context).
- **Troubleshooting "no notice / no sound"**: in the DSH page, open F12 → Console and run `localStorage.setItem('dsh-approval-reminder:debug','1')` (clear it with `localStorage.removeItem('dsh-approval-reminder:debug')` when done). Every reminder decision is then written to this tab's `sessionStorage` (key `dsh-approval-reminder:log`, up to 100 entries) and mirrored to the console. **After** reproducing, read it back with the command below — DevTools does not have to be open while the event happens:

  ```js
  JSON.parse(sessionStorage.getItem('dsh-approval-reminder:log') || '[]').forEach(e => console.log(e.at, e.label, e.details))
  ```

  Key fields: `viewing` (whether the page counts as “being viewed”), `visibility` / `focused`, the `outer` / `inner` / `screen` sizes, `permission`, `soundEnabled` / `doneEnabled`, `chimeReady`, `soundPlayed`, and `pendingKinds` (the kinds of interaction waiting for you in that snapshot).
- **Too noisy?** One `sessionId + request key` is announced exactly once, and a notification that is already on screen is closed when you come back to the page.

## How it works

| Concern | Approach |
| --- | --- |
| Where the state comes from | Subscribe to the client's `uiSession.sessionStatus` (a plain `getSnapshot` / `subscribe` observable): approvals are `pendingInteraction.kind === 'approval'`, questions are `'question'` / `'plan-review'` (a `review` card that only replays history is skipped), completions are the `running` `true → false` transition |
| When to announce | `document.visibilityState === 'visible' && document.hasFocus()` means “the user is looking” → stay silent; the check runs again on `visibilitychange` / `focus` / `blur`, so a request that arrived while reading is announced once you leave; one request (`sessionId + request key`) is announced at most once |
| Approval notification | `new Notification(title, { body, tag, requireInteraction: true })` with `tag = 'dsh-approval:<sessionId>'` so notifications of one Session replace each other |
| Question notification | The same rules as an approval: the same “only while off-page” decision, the same deduplication and auto-close, `requireInteraction: true`; only the title (`A choice is needed`), the body (the first question) and `tag = 'dsh-question:<sessionId>'` differ |
| Completion notification | `tag = 'dsh-done:<sessionId>'` without `requireInteraction` (the system may collect it); subagent Sessions are skipped; the switch lives in `localStorage` under `dsh-approval-reminder:task-finished` |
| Reminder chime | A desktop notification can be dropped silently: Chromium suppresses popups while a browser window is fullscreen, and Windows may suppress them in other states (web-fullscreen video, for example). So, when the **switch is on and** the chime is available (the `AudioContext` was unlocked by a user gesture and is running), the notification is created `silent` and a two-tone Web Audio chime plays — the reminder sounds **exactly once** whichever channel survives; when the switch is off or audio is unavailable the notification stays audible. The switch lives in `localStorage` under `dsh-approval-reminder:chime`, **off by default** |
| Click | `uiWorkspace.openSession(sessionId)` + `window.focus()` + `close()` |
| Failure handling | A refused construction is logged under the `[approval-reminder]` console prefix and marked as attempted, so later snapshot changes do not retry it |
| Cleanup | Subscriptions, gesture and visibility listeners, the settings rows, and open notifications are all released with the plugin |
| Host half | An empty shell (`index.js` is just `apply() {}`): no Service, no Tool, no Config, no session events |

**Why not listen to `approval/request` / `user-questions/request`?** On the client those waterfalls are forwarded to every listener; any listener that returns a result (or wraps `next()`) can claim or block the Host panel, and registration order is not under our control. Reading the pending-interaction snapshot is read-only and cannot change an outcome.

**Why a desktop notification instead of an in-page banner?** The reminder is for the moment you are *not* looking; when you are looking, the Host panel (approval or question options) is already on screen.

## Security and privacy

- Reads the browser's existing Session status snapshot: the approval reason text and the question text (only for the notification body) — **no message content, no command text**.
- **No network requests at all**; the notification is rendered by the local browser.
- **Never part of the decision and never answers for you**: no `approval/request` or `user-questions/request` listener, no policy, option or outcome changes.
- Zero runtime dependencies: the only `require` is the `react` the Host already provides; no `@deepseek-ai/dsh-client-*` package is imported.
- Styling uses public theme tokens (`--dsw-alias-*`) only.

## Repository layout

| Path | Purpose |
| --- | --- |
| `client.js` | The browser bundle: notification channel + reminder chime + all three settings rows (first line `// @ts-check`) |
| `index.js` | Host-half shell (makes the package an installable Loader entry) |
| `cordis.patch.yml` | The bundle's Loader patch: inserts the `approval-reminder` row |
| `locale/en.json`, `locale/zh.json` | Plugin card title and description |
| `icon.svg` | Plugin card icon |
| `types/globals.d.ts` | Declarations for the loader's `require('react')` and `window.__ModuleLoader__` |
| `types/dsh-client.d.ts` | Minimal local declarations of the DSH client contract (status snapshot, pending interaction, locale, slots) |
| `jsconfig.json` | Type-check configuration (`checkJs` + `strict`) |
| `scripts/check.mjs` | Dependency-free static checks (37 of them) |
| `AGENTS.md` | Project rules: constraints, naming, pre-push checks, privacy and listing flow |
| `.github/workflows/check.yml` | CI: `npm ci` → type check → static checks |

## Development

No runtime dependencies and no build: `client.js` is the artifact the browser loads, `index.js` is the ES module the Host loads. Only two devDependencies (`typescript`, `@types/react`) exist, both for type checking.

```powershell
npm install              # dev dependencies only
npm run typecheck        # tsc -p jsconfig.json
npm test                 # = typecheck + node scripts/check.mjs (37 checks)
```

`client.js` starts with `// @ts-check`; together with `jsconfig.json` (`checkJs`, `strict`) and `types/*.d.ts`, both `window.__ModuleLoader__` and `require('react')` are genuinely typed, and the DSH client contract is described by minimal local declarations. Editors such as VS Code therefore give completions and errors out of the box — **without importing any Harness client package**.

The static checks cover: manifest fields and `exports` targets, locale metadata, the patch row, the presence of `AGENTS.md`, the `// @ts-check` opt-in, and the syntax of both JS files (compiled through `node:vm`, never executed).

Read [AGENTS.md](AGENTS.md) before changing code: it lists the constraints that must not break, the fixed names, the release flow and the privacy rules.

## Verification status

Verified on Windows + Edge (DSH Web on `127.0.0.1`):

- a command waiting for approval **raises** an Edge/Windows desktop notification; **clicking** it closes the notification and returns to that conversation;
- once the approval is decided (allow or reject) the notification for that request closes;
- **Send a test notification** proves the channel independently;
- **announcement timing (0.2.0)**: while you look at the conversation page → **no toast**; after switching away or minimizing → **toast**; coming back → the notification closes;
- **types and static checks (0.2.1)**: `npm test` and GitHub Actions both pass (clean runner: `npm ci` + typecheck + 37 checks);
- **reminder chime (0.5.0)**: verified on Windows + Edge — the chime is audible for task-finished reminders both in true fullscreen and in Bilibili “web fullscreen”; the “notification `silent` while the chime plays, exactly one sound per reminder” pairing is covered by `npm test` / `node --check` and a sandbox behaviour harness.
- **question reminder (0.5.0)**: recognising `ask_user_question` / `plan-review`, the copy, the `tag`, deduplication, “silent while you look, announced once you leave” and skipping review cards are each asserted in a local stub environment (a fake `uiSession.sessionStatus` plus a fake `Notification`); **whether the real system notification appears still needs a real run to confirm**.

Not covered: headless / API Sessions, reminders after the page is closed, macOS / Linux desktop notifications, and multiple tabs open at the same time.

## Known limitations

- Browser Sessions only; headless / API Sessions produce no notifications.
- Chromium (Edge) on Windows does not support “allow / reject” actions on notifications, so a notification only reminds you — open the conversation to answer.
- Whether a notification is actually displayed depends on Windows notification settings and Focus assist; the plugin cannot override that.
- **Desktop notifications can be dropped silently**: Chromium suppresses web-notification popups while a browser window is fullscreen (its fullscreen notification blocker), and Windows may suppress them in other states such as web-fullscreen video playback; no web API can guarantee the popup, so the chime is the reliable channel.
- The chime needs an audio context unlocked by a user gesture: if the page was never clicked or typed into after loading, no sound is produced (browser autoplay policy); the notification then keeps the system sound.
- During web fullscreen (e.g. Bilibili “web fullscreen”) the popup may not appear if the system suppresses notifications; the chime still plays.
- With several tabs open, each page notifies about the requests it received.
- After the tab is closed there are no reminders (no Service Worker / Push).
- Task-finished notifications key off the running → idle transition only; they do not distinguish a completed turn from an aborted or failed one, and subagent Sessions are skipped.
- The task-finished switch lives in browser `localStorage` (per origin): another port, another browser, or cleared site data falls back to the default (on).
- A question notification only carries the **first question** (one request may contain several); the remaining questions and the options are visible only after opening the conversation.
- Question notifications have no switch of their own — like the approval reminder they only fire while you cannot see the page.
- Styling and copy follow the DSH version; if a contract changes, `npm run typecheck` reports it first.

## Uninstall

```powershell
dsh plugin --profile web remove dsh-approval-reminder
```

Or disable / remove it from **Settings → Plugins**. Uninstalling removes the notifications and all three settings rows and leaves no Session data behind.

## Market listing

The plugin reaches dsh-market through the [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) curated list (the market repository itself does not take plugin entries). The entry file is:

```yaml
# data/plugins/In-clude__dsh-approval-reminder.yml
category: notify
```

Listing requirements: `package.json` declares `dsh.bundle`, the repository is at least one day old, it carries the `dsh-plugin` topic, and the description matches the code.

## Version and changelog

Current version `0.5.0`. See [CHANGELOG.md](CHANGELOG.md); the project follows semantic versioning — behaviour changes bump minor, documentation-only changes do not bump the version.

## License

[MIT](LICENSE) © 2026 In-clude
