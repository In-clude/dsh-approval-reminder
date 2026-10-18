/**
 * dsh-approval-reminder — browser half.
 *
 * Raises one Windows/Edge desktop notification per pending approval request.
 * The reminder only observes the Client Session status snapshot published by
 * the `uiSession` service; it never joins the `approval/request` waterfall, so
 * it cannot change an approval outcome.
 *
 * No build step: this file is the bundle served through `dsh.client`
 * (`exports["./client"]`).
 */
window.__ModuleLoader__.load({
  id: 'dsh-approval-reminder',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /** Client locale namespace owned by this plugin. */
    const NS = 'approvalReminder';

    /** Simplified Chinese dictionary; its key set is the reference for `en`. */
    const zh = {
      'notify.title': '需要审批',
      'notify.body': '工具 {toolName} 请求以更高权限执行',
      'notify.session': '会话：{title}',
      'notify.untitled': '未命名会话',
      'notify.test.title': '审批桌面通知',
      'notify.test.body': '通知通道可用：命令等待审批时会在这里提醒你。',
      'row.title': '审批桌面通知',
      'row.description': '只在你没看这个页面时提醒：命令等待审批、而本页面在后台或未聚焦时，用 Edge 桌面通知提醒你。',
      'row.granted': '已开启',
      'row.default': '未开启',
      'row.denied': '已被浏览器阻止',
      'row.unsupported': '当前环境不支持通知',
      'row.enable': '开启',
      'row.test': '发送测试通知',
      'hint.denied': '请在 Edge 中允许本站点显示通知（地址栏左侧图标 → 权限）后刷新页面。',
      'hint.unsupported': '桌面通知需要 https 或 localhost 的安全上下文，并使用支持通知的浏览器。',
    };

    /** English dictionary, checked against the Chinese key set. */
    const en = {
      'notify.title': 'Approval needed',
      'notify.body': 'Tool {toolName} requests privileged execution',
      'notify.session': 'Session: {title}',
      'notify.untitled': 'Untitled conversation',
      'notify.test.title': 'Approval desktop notifications',
      'notify.test.body': 'The channel works: a command waiting for approval will appear here.',
      'row.title': 'Approval desktop notifications',
      'row.description': 'Notify me only while I am not looking at this page: an Edge desktop notification appears when a command waits for approval while this page is in the background or unfocused.',
      'row.granted': 'Enabled',
      'row.default': 'Off',
      'row.denied': 'Blocked by the browser',
      'row.unsupported': 'Notifications unavailable',
      'row.enable': 'Enable',
      'row.test': 'Send a test notification',
      'hint.denied': 'Allow notifications for this site in Edge (site icon → Permissions), then reload the page.',
      'hint.unsupported': 'Desktop notifications need a secure context (https or localhost) and a browser that supports them.',
    };

    /**
     * Row styles. Colors come from the public theme tokens only, so light and
     * dark themes follow without overrides; the spacing and type sizes copy an
     * existing General-section row.
     */
    const CSS = [
      '.dsh-approval-reminder-row{display:flex;justify-content:space-between;align-items:center;gap:24px;padding:16px 0;border-bottom:.5px solid var(--dsw-alias-border-l2)}',
      '.dsh-approval-reminder-text{min-width:0}',
      '.dsh-approval-reminder-title{font-size:14px;line-height:20px;color:var(--dsw-alias-label-primary)}',
      '.dsh-approval-reminder-description{margin-top:4px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}',
      '.dsh-approval-reminder-hint{margin-top:4px;font-size:12px;line-height:18px;color:var(--dsw-alias-state-warn-primary)}',
      '.dsh-approval-reminder-actions{display:flex;align-items:center;gap:8px;flex:none}',
      '.dsh-approval-reminder-status{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}',
      '.dsh-approval-reminder-status[data-state="granted"]{color:var(--dsw-alias-state-success-primary)}',
      '.dsh-approval-reminder-status[data-state="denied"]{color:var(--dsw-alias-state-error-primary)}',
      '.dsh-approval-reminder-button{height:28px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l2);border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:18px;cursor:pointer}',
      '.dsh-approval-reminder-button:hover:not(:disabled){background:var(--dsw-alias-bg-layer-1)}',
      '.dsh-approval-reminder-button:disabled{cursor:not-allowed;opacity:.4}',
    ].join('');

    /** @returns {'granted' | 'denied' | 'default' | 'unsupported'} */
    function readPermission() {
      return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
    }

    /**
     * Whether the user is looking at this page right now. While it is true the
     * Host approval panel is on screen, so a desktop notification would only be
     * noise; the reminder waits until the page is in the background or
     * unfocused.
     * @returns true when the page is visible and holds focus
     */
    function isViewingPage() {
      if (typeof document === 'undefined' || document.visibilityState !== 'visible') return false;
      if (typeof document.hasFocus !== 'function') return true;
      return document.hasFocus();
    }

    /** Stable identity of one pending request, used for deduplication. */
    function requestKey(sessionId, interaction) {
      return String(interaction.key === undefined ? sessionId : interaction.key);
    }

    /**
     * One desktop notification per pending approval, keyed by Session identity
     * and request key. Nothing is raised while the notification permission is
     * not granted; the next snapshot change after granting flushes the backlog.
     */
    class ApprovalNotifier {
      constructor(deps) {
        this.deps = deps;
        this.status = undefined;
        /** Open desktop notifications, keyed by Session identity. */
        this.notified = new Map();
        /** Requests already announced, so leaving the page again cannot nag twice. */
        this.delivered = new Map();
      }

      /**
       * Follow the Session status snapshot.
       * @param {{ getSnapshot: () => Map<string, object>, subscribe: (fn: () => void) => () => void }} observable
       * @returns disposer stopping the subscription
       */
      watch(observable) {
        this.status = observable;
        const dispose = observable.subscribe(() => { this.sync(); });
        this.sync();
        return dispose;
      }

      /**
       * Recompute from the snapshot: close what settled or was seen, and raise
       * a notification for each request the user has not been told about while
       * the page is not being viewed.
       */
      sync() {
        if (this.status === undefined) return;
        const pending = this.collect();
        this.reconcile(pending);
        if (isViewingPage()) {
          // The Host approval panel is on screen; a toast would be noise.
          for (const sessionId of [...this.notified.keys()]) this.close(sessionId);
          return;
        }
        if (readPermission() !== 'granted') return;
        for (const [sessionId, interaction] of pending) {
          const key = requestKey(sessionId, interaction);
          if (this.delivered.get(sessionId) === key) continue;
          this.delivered.set(sessionId, key);
          this.raise(sessionId, interaction);
        }
      }

      /** Pending approval interactions, keyed by Session identity. */
      collect() {
        const pending = new Map();
        for (const [sessionId, status] of this.status.getSnapshot()) {
          const interaction = status === undefined ? undefined : status.pendingInteraction;
          if (interaction === undefined || interaction === null) continue;
          if (interaction.kind !== 'approval') continue;
          pending.set(sessionId, interaction);
        }
        return pending;
      }

      /** Forget requests that settled or were replaced. */
      reconcile(pending) {
        for (const sessionId of [...this.notified.keys()]) {
          const entry = this.notified.get(sessionId);
          const current = pending.get(sessionId);
          if (current !== undefined && requestKey(sessionId, current) === entry.key) continue;
          this.close(sessionId);
        }
        for (const sessionId of [...this.delivered.keys()]) {
          const current = pending.get(sessionId);
          if (current !== undefined && requestKey(sessionId, current) === this.delivered.get(sessionId)) continue;
          this.delivered.delete(sessionId);
        }
      }

      /**
       * Ask the browser for the notification permission. Requires a user
       * gesture; without one the call resolves without prompting.
       * @returns the permission observed after the request
       */
      requestPermission() {
        if (readPermission() !== 'default') return Promise.resolve(readPermission());
        try {
          return Promise.resolve(Notification.requestPermission()).then((value) => {
            this.sync();
            return typeof value === 'string' ? value : readPermission();
          }, (error) => {
            this.deps.report(error);
            return readPermission();
          });
        } catch (error) {
          this.deps.report(error);
          return Promise.resolve(readPermission());
        }
      }

      /**
       * Raise one unfiltered notification so the user can prove the channel
       * works without waiting for a real approval request.
       * @returns whether a notification was created
       */
      test() {
        if (readPermission() !== 'granted') return false;
        const t = this.deps.translate();
        try {
          const notification = new Notification(t('notify.test.title'), { body: t('notify.test.body') });
          notification.onclick = () => {
            try { notification.close(); } catch (_error) { /* already closed */ }
          };
          return true;
        } catch (error) {
          this.deps.report(error);
          return false;
        }
      }

      /** Close every notification this plugin raised. */
      dispose() {
        for (const sessionId of [...this.notified.keys()]) this.close(sessionId);
        this.delivered.clear();
      }

      close(sessionId) {
        const entry = this.notified.get(sessionId);
        if (entry === undefined) return;
        this.notified.delete(sessionId);
        if (entry.notification === null) return;
        try { entry.notification.close(); } catch (_error) { /* already closed */ }
      }

      raise(sessionId, interaction) {
        const t = this.deps.translate();
        const reason = this.describe(interaction, t);
        const title = this.deps.sessionTitle(sessionId);
        const sessionLine = t('notify.session', {
          title: typeof title === 'string' && title !== '' ? title : t('notify.untitled'),
        });
        const body = reason === '' ? sessionLine : reason + '\n' + sessionLine;
        const entry = {
          key: requestKey(sessionId, interaction),
          notification: null,
        };
        // Record before constructing: a refused construction must not be
        // retried on every later snapshot change.
        this.notified.set(sessionId, entry);
        try {
          const notification = new Notification(t('notify.title'), {
            body,
            tag: 'dsh-approval:' + String(sessionId),
            requireInteraction: true,
          });
          entry.notification = notification;
          notification.onclick = () => {
            this.deps.openSession(sessionId);
            try { window.focus(); } catch (_error) { /* focus is best-effort */ }
            try { notification.close(); } catch (_error) { /* already closed */ }
          };
        } catch (error) {
          this.deps.report(error);
        }
      }

      /** Human copy for one request: localized reason, raw reason, then tool name. */
      describe(interaction, t) {
        if (interaction.displayReason !== undefined && interaction.displayReason !== null) {
          const text = this.deps.resolveText(interaction.displayReason);
          if (typeof text === 'string' && text !== '') return text;
        }
        if (typeof interaction.reason === 'string' && interaction.reason !== '') return interaction.reason;
        const toolName = interaction.toolName === undefined ? '?' : String(interaction.toolName);
        return t('notify.body', { toolName });
      }
    }

    /**
     * Ask for the notification permission on the first user gesture of this
     * page load. Chromium refuses the request without user activation, so this
     * is the only moment the plugin may prompt without a settings visit.
     * @param {ApprovalNotifier} notifier
     * @returns disposer removing the listeners
     */
    function installPermissionGesture(notifier) {
      const options = { capture: true, passive: true };
      function remove() {
        document.removeEventListener('pointerdown', onGesture, options);
        document.removeEventListener('keydown', onGesture, options);
      }
      function onGesture() {
        remove();
        if (readPermission() === 'default') void notifier.requestPermission();
      }
      document.addEventListener('pointerdown', onGesture, options);
      document.addEventListener('keydown', onGesture, options);
      return remove;
    }

    /**
     * General-settings row: current permission state, the enable path, and a
     * test notification.
     * @param props - slot props: the localized `t` and the injected face.
     * @returns the preference row.
     */
    function ApprovalReminderRow(props) {
      const t = props.t;
      const [permission, setPermission] = React.useState(readPermission);
      const [busy, setBusy] = React.useState(false);

      const enable = () => {
        if (busy) return;
        setBusy(true);
        Promise.resolve(props.requestPermission()).then(
          (value) => {
            setBusy(false);
            setPermission(typeof value === 'string' ? value : readPermission());
          },
          () => {
            setBusy(false);
            setPermission(readPermission());
          },
        );
      };

      const statusKey = permission === 'granted' ? 'row.granted'
        : permission === 'denied' ? 'row.denied'
          : permission === 'unsupported' ? 'row.unsupported'
            : 'row.default';
      const hint = permission === 'denied' ? t('hint.denied')
        : permission === 'unsupported' ? t('hint.unsupported')
          : null;

      const actions = [
        h('span', {
          key: 'status',
          className: 'dsh-approval-reminder-status',
          'data-state': permission,
        }, t(statusKey)),
      ];
      if (permission === 'default') {
        actions.push(h('button', {
          key: 'enable',
          type: 'button',
          className: 'dsh-approval-reminder-button',
          disabled: busy,
          onClick: enable,
        }, t('row.enable')));
      }
      if (permission === 'granted') {
        actions.push(h('button', {
          key: 'test',
          type: 'button',
          className: 'dsh-approval-reminder-button',
          onClick: () => { props.sendTest(); },
        }, t('row.test')));
      }

      return h('div', { className: 'dsh-approval-reminder-row' }, [
        h('style', { key: 'style' }, CSS),
        h('div', { key: 'text', className: 'dsh-approval-reminder-text' }, [
          h('div', { key: 'title', className: 'dsh-approval-reminder-title' }, t('row.title')),
          h('div', { key: 'description', className: 'dsh-approval-reminder-description' }, t('row.description')),
          hint === null ? null : h('div', { key: 'hint', className: 'dsh-approval-reminder-hint' }, hint),
        ]),
        h('div', { key: 'actions', className: 'dsh-approval-reminder-actions' }, actions),
      ]);
    }

    /** Services this Client half cannot activate without. */
    const inject = ['slots', 'locale'];

    /**
     * Install the notification channel (silent while the page is being viewed),
     * the permission gesture, and the General-settings row.
     * @param ctx - Client root context.
     */
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'approval-reminder: dictionaries');

      const t = ctx.locale.bind(NS);
      const notifier = new ApprovalNotifier({
        translate: () => t,
        resolveText: (text) => ctx.locale.resolveText(text),
        openSession: (sessionId) => {
          const navigation = ctx.get('uiWorkspace');
          if (navigation !== undefined && typeof navigation.openSession === 'function') {
            navigation.openSession(sessionId);
          }
        },
        sessionTitle: (sessionId) => {
          const sessions = ctx.get('sessions');
          const list = sessions === undefined ? undefined : sessions.list;
          if (list === undefined || typeof list.getSnapshot !== 'function') return undefined;
          const snapshot = list.getSnapshot();
          const rows = snapshot === undefined ? undefined : snapshot.byId;
          const row = rows === undefined ? undefined : rows[sessionId];
          return row === undefined ? undefined : row.displayTitle;
        },
        report: (error) => {
          try { console.warn('[approval-reminder]', error); } catch (_error) { /* logging is best-effort */ }
        },
      });

      ctx.inject(['uiSession'], (scope) => {
        const uiSession = ctx.get('uiSession');
        const status = uiSession === undefined ? undefined : uiSession.sessionStatus;
        if (status === undefined || typeof status.subscribe !== 'function') return;
        scope.effect(() => notifier.watch(status), 'approval-reminder: pending approvals');
        scope.effect(() => () => notifier.dispose(), 'approval-reminder: notifications');
      });

      ctx.effect(() => {
        // "Looking at the page" is re-evaluated whenever it can change, so a
        // request that arrived while the user was reading is still announced
        // once the page goes to the background.
        const onViewChange = () => { notifier.sync(); };
        document.addEventListener('visibilitychange', onViewChange);
        window.addEventListener('focus', onViewChange);
        window.addEventListener('blur', onViewChange);
        return () => {
          document.removeEventListener('visibilitychange', onViewChange);
          window.removeEventListener('focus', onViewChange);
          window.removeEventListener('blur', onViewChange);
        };
      }, 'approval-reminder: page visibility');

      ctx.effect(() => installPermissionGesture(notifier), 'approval-reminder: permission gesture');

      ctx.slots.inject('settings.general.item', () => ctx.slots.register({
        name: 'settings.general.item',
        id: 'approval-reminder',
        order: 21,
        locale: NS,
        inject: () => ({
          requestPermission: () => notifier.requestPermission(),
          sendTest: () => notifier.test(),
        }),
      }, ApprovalReminderRow));
    }

    return { inject, apply };
  },
});
