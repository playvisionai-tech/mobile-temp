import { getFieldError } from '../form-utils';

function field(isTouched: boolean, errors: unknown[]) {
  return { state: { meta: { isTouched, errors } } };
}

describe('getFieldError', () => {
  it('hides errors until the field is touched', () => {
    expect(getFieldError(field(false, ['Required']))).toBeUndefined();
  });

  it('returns no error for a touched valid field', () => {
    expect(getFieldError(field(true, []))).toBeUndefined();
  });

  it.each([
    [['Required'], 'Required'],
    [[{ message: 'Invalid email' }], 'Invalid email'],
    [[42], '42'],
  ])('normalizes the first visible validation error', (errors, expected) => {
    expect(getFieldError(field(true, errors))).toBe(expected);
  });
});
