/**
 * The DSH Client shapes this bundle reads.
 *
 * Deliberately minimal and local: a Harness Client plugin must not import
 * Harness packages, so these declarations describe only the fields this plugin
 * touches. They are the contract to re-check when DSH changes — a renamed field
 * becomes a type error here instead of a silent no-op in the browser.
 */

/** Requester-supplied localized copy (`displayReason` on an approval request). */
interface ApprovalDisplayReason {
  readonly en: string;
  readonly [locale: string]: string;
}

/** Fields this plugin reads from a pending interaction. */
interface ApprovalInteraction {
  /** Domain discriminator; only `approval` is honored. */
  readonly kind?: string;
  /** Opaque request identity; a replacement request uses a new key. */
  readonly key?: string;
  /** Tool requesting the decision. */
  readonly toolName?: string;
  /** Human-readable reason supplied by the requester. */
  readonly reason?: string;
  /** Localized presentation copy. */
  readonly displayReason?: ApprovalDisplayReason;
}

/** One Session's entry in the status snapshot published by `uiSession`. */
interface SessionStatusEntry {
  /** Highest-precedence pending interaction of one Session. */
  readonly pendingInteraction?: ApprovalInteraction | undefined;
}

/** The observable pair exposed as `uiSession.sessionStatus`. */
interface SessionStatusObservable {
  getSnapshot(): ReadonlyMap<string, SessionStatusEntry>;
  subscribe(listener: () => void): () => void;
}

/** Notification permission as this plugin reports it. */
type ApprovalPermission = NotificationPermission | 'unsupported';

/** Locale translate function bound to one namespace. */
type Translate = (key: string, params?: Readonly<Record<string, string | number>>) => string;

/** Registration options this plugin passes to `ctx.slots.register`. */
interface ClientSlotOptions {
  name: string;
  id: string;
  order?: number;
  locale?: string;
  inject?: () => Readonly<Record<string, unknown>>;
}

/** The slice of the Client Cordis context this plugin uses. */
interface ClientPluginContext {
  effect(callback: () => (() => void) | void, label?: string): () => void;
  inject(services: readonly string[], callback: (scope: ClientPluginContext) => void): () => void;
  get(name: string): any;
  slots: {
    inject(key: string, callback: () => unknown): () => void;
    register(options: ClientSlotOptions, component: (props: any) => unknown): () => void;
  };
  locale: {
    register(namespace: string, dictionaries: Readonly<Record<string, Readonly<Record<string, string>>>>): () => void;
    bind(namespace: string): Translate;
    resolveText(text: string | ApprovalDisplayReason): string;
  };
}

/** The collaborators the notifier needs from `apply`. */
interface NotifierDeps {
  translate(): Translate;
  resolveText(text: string | ApprovalDisplayReason): string;
  openSession(sessionId: string): void;
  sessionTitle(sessionId: string): string | undefined;
  report(error: unknown): void;
}

/** Props the General-settings row receives (owner props are empty). */
interface ApprovalReminderRowProps {
  t: Translate;
  requestPermission(): Promise<ApprovalPermission>;
  sendTest(): boolean;
}
