/**
 * The slice of a TanStack Form field this helper reads. Structural, so any
 * field API satisfies it without this module depending on the form library's
 * generics — which is what kept it typed `any` before.
 */
type FieldWithMeta = {
  state: {
    meta: {
      isTouched: boolean;
      errors: readonly unknown[];
    };
  };
};

export function getFieldError(
  field: FieldWithMeta,
): string | undefined {
  if (!field.state.meta.isTouched || !field.state.meta.errors.length) {
    return undefined;
  }

  const error = field.state.meta.errors[0];

  // Handle string errors
  if (typeof error === 'string') {
    return error;
  }

  // Handle object errors with message property (Zod errors)
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }

  // Fallback: convert to string
  return String(error);
}
