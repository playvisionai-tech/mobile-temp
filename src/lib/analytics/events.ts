/**
 * The event registry — the reason this module exists.
 *
 * Every event the app is allowed to send is declared here, together with the
 * exact parameters it carries. `trackEvent` is typed against this map, so a
 * call site can neither invent an event name nor pass a parameter the event
 * does not declare. The same declaration is read at runtime, which is what
 * lets `trackEvent` drop anything a JavaScript caller smuggles past the types.
 *
 * A parameter is declared by its *kind*:
 *   'string'   a machine-readable token — an id, a slug, a route, an error code
 *   'number'   any finite number
 *   'boolean'  true / false
 *   [...]      a closed set of literals, which is the preferred form
 *
 * Prefer a literal set. It is the only declaration that makes the "no free-text
 * user input" rule structural rather than advisory: a value outside the set
 * fails to compile and is dropped at runtime.
 */

/** Values Firebase Analytics accepts for an event parameter. */
export type AnalyticsParamValue = string | number | boolean;

/** A validated parameter object, as handed to the native SDK. */
export type AnalyticsParams = Record<string, AnalyticsParamValue>;

/** How a single parameter is declared: a scalar kind, or a closed set of literals. */
export type ParamKind = 'string' | 'number' | 'boolean' | readonly string[];

/** What one event declares: its parameter names and each one's kind. */
export type EventSchema = Readonly<Record<string, ParamKind>>;

/**
 * The TypeScript type a declared kind stands for. Left unconstrained on
 * purpose: constraining it to `ParamKind` would force an intersection at the
 * use site below, and intersecting a literal tuple with the `ParamKind` union
 * produces a `… & 'string'` branch that resolves back to plain `string` —
 * quietly widening every closed set to any string at all.
 */
type ParamType<TKind>
  = TKind extends 'string' ? string
    : TKind extends 'number' ? number
      : TKind extends 'boolean' ? boolean
        : TKind extends readonly (infer TLiteral)[] ? TLiteral
          : never;

/**
 * Literal sets used by more than one event. Declared here as literals rather
 * than imported from the module that owns the union (`ColorSchemeType`,
 * `Language`): an analytics dimension has to keep meaning the same thing for as
 * long as the reports are read, so it must not change silently when the app's
 * own union does.
 */
const AUTH_METHODS = ['email', 'oauth'] as const;

export const ANALYTICS_EVENTS = {
  /** Sign-in succeeded. */
  login: { method: AUTH_METHODS },
  /** Account creation succeeded. */
  sign_up: { method: AUTH_METHODS },
  /** The user signed out deliberately — not a token expiry. */
  logout: {},
  /** The onboarding flow ended, whether it was read through or skipped. */
  onboarding_completed: { skipped: 'boolean' },
  /** The feed was re-fetched, and why. */
  feed_refreshed: { source: ['pull_to_refresh', 'retry'] },
  /** A post detail screen was opened. `post_id` is the server id, not the title. */
  post_opened: { post_id: 'number' },
  /** A post was submitted. Lengths, never the text itself. */
  post_created: { title_length: 'number', body_length: 'number' },
  /** The theme preference changed. */
  theme_changed: { theme: ['light', 'dark', 'system'] },
  /** The app language changed. */
  language_changed: { language: ['en', 'ar'] },
  /** An API call failed. `endpoint` is the route template, never a full URL with query. */
  request_failed: { endpoint: 'string', status: 'number' },
} as const satisfies Readonly<Record<string, EventSchema>>;

/** Every event name the app may send. */
export type AnalyticsEventName = keyof typeof ANALYTICS_EVENTS;

/** The parameter object a given event carries. */
export type AnalyticsEventParams<TName extends AnalyticsEventName> = {
  [TParam in keyof (typeof ANALYTICS_EVENTS)[TName]]:
  ParamType<(typeof ANALYTICS_EVENTS)[TName][TParam]>;
};

/**
 * The argument list `trackEvent` takes after the name. An event that declares
 * no parameters may be tracked with the name alone.
 */
export type AnalyticsParamsArg<TName extends AnalyticsEventName>
  = keyof AnalyticsEventParams<TName> extends never
    ? [params?: AnalyticsEventParams<TName>]
    : [params: AnalyticsEventParams<TName>];
