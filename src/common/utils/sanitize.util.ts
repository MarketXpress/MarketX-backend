import * as xss from 'xss';

export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    return xss(input.trim());
  }

  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }

  if (typeof input === 'object' && input !== null) {
    const sanitizedObj = {};
    for (const key in input) {
      sanitizedObj[key] = sanitizeInput(input[key]);
    }
    return sanitizedObj;
  }

  return input;
}