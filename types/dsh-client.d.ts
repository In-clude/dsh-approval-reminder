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

/** One question of a pending question request (only the fields this plugin reads). */
interface PendingQuestionItem {
  /** The question to display; the first one becomes the notification body. */
  readonly question?: string;
}

/** Fields this plugin reads from a pending interaction. */
interface PendingInteraction {
  /** Domain discriminator: `approval`, `question` and `plan-review` are honored. */
  readonly kind?: string;
  /** Opaque request identity; a replacement request uses a new key. */
  readonly key?: string;
  /** Tool requesting the decision. */
  readonly toolName?: string;
  /** Human-readable reason supplied by the requester. */
  readonly reason?: string;
  /** Localized presentation copy. */
  readonly displayReason?: ApprovalDisplayReason;
  /** Question requests: the questions to answer. */
  readonly questions?: readonly PendingQuestionItem[];
  /**
   * Recorded answers of an already settled question. Present only on the
   * read-only review card that replays history, which is never a live request.
   */
  readonly review?: readonly unknown[];
}

/** One Session's entry in the status snapshot published by `uiSession`. */
interface SessionStatusEntry {
  /** Highest-precedence pending interaction of one Session. */
  readonly pendingInteraction?: PendingInteraction | undefined;
  /** Latest known running state; absent until a baseline or event establishes it. */
  readonly running?: boolean | undefined;
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
  /** Subagent Sessions run on the user's behalf; their completions stay silent. */
  isSubagent(sessionId: string): boolean;
  /** Whether the reminder chime is enabled. */
  alertSoundEnabled(): boolean;
  /** Whether the chime can sound right now (audio context running). */
  chimeReady(): boolean;
  /** Play the reminder chime; no-op when audio is unavailable. */
  playAlertSound(): void;
  report(error: unknown): void;
}

/** Props the General-settings row receives (owner props are empty). */
interface ApprovalReminderRowProps {
  t: Translate;
  requestPermission(): Promise<ApprovalPermission>;
  sendTest(): boolean;
}

/** Props a General-settings switch row receives. */
interface SwitchRowProps {
  t: Translate;
  /** Injected by the sound row only: preview the reminder chime. */
  playSound?(): void;
}
