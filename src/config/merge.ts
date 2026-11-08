/**
 * Layering rules for configuration files.
 *
 * Objects merge key by key so a project file can override one nested option
 * without restating its siblings. Arrays replace wholesale, because a list
 * like `args` is a complete statement of intent, not something to append to.
 */

type PlainObject = Record<string, unknown>;

const isPlainObject = (value: unknown): value is PlainObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const mergeTwo = (base: PlainObject, override: PlainObject): PlainObject => {
  const merged: PlainObject = { ...base };

  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) {
      continue;
    }

    const existing = merged[key];
    merged[key] = isPlainObject(existing) && isPlainObject(value) ? mergeTwo(existing, value) : value;
  }

  return merged;
};

/** Merges layers left to right, so later layers win. */
export const mergeConfigLayers = (...layers: readonly unknown[]): PlainObject =>
  layers.filter(isPlainObject).reduce<PlainObject>(mergeTwo, {});
