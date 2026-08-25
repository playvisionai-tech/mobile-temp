/**
 * Every feature flag the app reads, with the value it takes when Remote Config
 * has nothing to say — no network yet, first launch, Jest, or a build without a
 * Firebase config. This map ships inside the binary, so it is the app's real
 * baseline behavior rather than a fallback of last resort.
 *
 * The keys here are the keys published in the Firebase console. A key that is
 * not declared here cannot be read: the module is typed against this object, so
 * a console-only flag is a compile error at the call site rather than a silent
 * `false`.
 *
 * **These two entries are placeholders.** This repository is a template and has
 * no product flags yet. They exist to show the shape — one boolean, one number
 * — and nothing in the app reads them. Replace them with real flags; do not
 * build behavior on these.
 */
export const FEATURE_FLAG_DEFAULTS = {
  example_new_feed_layout_enabled: false,
  example_feed_page_size: 20,
} as const;

/** The name of a declared flag. */
export type FeatureFlagKey = keyof typeof FEATURE_FLAG_DEFAULTS;

/**
 * Widen a literal default to the type the flag can actually hold. Declaring
 * `false` as a default must not type the flag as `false` — the whole point is
 * that the server can change it — so the literal is widened back to `boolean`.
 */
type WidenFlagValue<TValue>
  = TValue extends boolean ? boolean
    : TValue extends number ? number
      : TValue extends string ? string
        : never;

/** The type a flag's value has once read: the widened type of its default. */
export type FeatureFlagValue<TKey extends FeatureFlagKey>
  = WidenFlagValue<(typeof FEATURE_FLAG_DEFAULTS)[TKey]>;

/**
 * The flags that are on/off switches. `isFeatureEnabled` accepts only these, so
 * asking whether a page-size flag is "enabled" does not compile.
 */
export type BooleanFeatureFlagKey = {
  [TKey in FeatureFlagKey]: FeatureFlagValue<TKey> extends boolean ? TKey : never;
}[FeatureFlagKey];
