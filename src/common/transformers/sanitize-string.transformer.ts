import { Transform } from 'class-transformer';

/**
 * Sanitizes string input by:
 * - trimming whitespace
 * - collapsing repeated spaces
 * - removing ASCII control characters
 */
export function SanitizeString(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }): unknown => {
    if (typeof value !== 'string') {
      return value;
    }

    // eslint-safe alternative to control-char regex
    const withoutControlChars = value
      .split('')
      .filter((char) => char >= ' ' && char !== '\x7F')
      .join('');

    return withoutControlChars.trim().replace(/\s+/g, ' ');
  });
}
