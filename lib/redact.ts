/**
 * Utility functions to redact PII from logs and data for privacy protection
 */

export interface RedactionOptions {
  maskChar?: string;
  preserveLength?: boolean;
  showFirst?: number;
  showLast?: number;
}

const DEFAULT_OPTIONS: RedactionOptions = {
  maskChar: '•',
  preserveLength: true,
  showFirst: 0,
  showLast: 0,
};

/**
 * Redact email addresses - show first char and domain
 */
export function redactEmail(email: string, options: RedactionOptions = {}): string {
  if (!email || typeof email !== 'string') return email;
  
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const mc = opts.maskChar ?? DEFAULT_OPTIONS.maskChar!;
  const [localPart, domain] = email.split('@');
  
  if (!localPart || !domain) return email; // Invalid email format
  
  if (opts.showFirst && opts.showLast) {
    const visibleChars = opts.showFirst + opts.showLast;
    if (localPart.length <= visibleChars) {
      return `${localPart}@${domain}`;
    }
    const start = localPart.slice(0, opts.showFirst);
    const end = localPart.slice(-opts.showLast);
    const middle = mc.repeat(localPart.length - visibleChars);
    return `${start}${middle}${end}@${domain}`;
  }
  
  // Default: show first char + full domain
  const maskedLocal = localPart[0] + mc.repeat(Math.max(0, localPart.length - 1));
  return `${maskedLocal}@${domain}`;
}

/**
 * Redact phone numbers - show country code and last 4 digits
 */
export function redactPhone(phone: string, options: RedactionOptions = {}): string {
  if (!phone || typeof phone !== 'string') return phone;
  
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const mc = opts.maskChar ?? DEFAULT_OPTIONS.maskChar!;
  const cleanPhone = phone.replace(/\D/g, ''); // Remove non-digits
  
  if (cleanPhone.length < 6) return phone; // Too short to redact meaningfully
  
  // Show country code (if starts with +) and last 4 digits
  if (phone.startsWith('+')) {
    const countryCode = phone.match(/^\+\d{1,3}/)?.[0] || '+';
    const lastFour = cleanPhone.slice(-4);
    const middleLength = cleanPhone.length - countryCode.length + 1 - 4;
    const middle = mc.repeat(Math.max(0, middleLength));
    return `${countryCode}${middle}${lastFour}`;
  }
  
  // For local numbers, show last 4 digits
  const lastFour = cleanPhone.slice(-4);
  const middle = mc.repeat(Math.max(0, cleanPhone.length - 4));
  return `${middle}${lastFour}`;
}

/**
 * Redact names - show first name initial and last name initial
 */
export function redactName(name: string, options: RedactionOptions = {}): string {
  if (!name || typeof name !== 'string') return name;
  
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const mc = opts.maskChar ?? DEFAULT_OPTIONS.maskChar!;
  const parts = name.trim().split(/\s+/);
  
  if (parts.length === 1) {
    // Single name - show first and last char
    if (parts[0].length <= 2) return parts[0];
    return parts[0][0] + mc.repeat(parts[0].length - 2) + parts[0].slice(-1);
  }
  
  // Multiple parts - show initials
  return parts.map(part => part[0] + mc.repeat(Math.max(0, part.length - 1))).join(' ');
}

/**
 * Generic string redaction
 */
export function redactString(str: string, options: RedactionOptions = {}): string {
  if (!str || typeof str !== 'string') return str;
  
  const opts = { ...DEFAULT_OPTIONS, showFirst: 1, showLast: 1, ...options };
  const mc = opts.maskChar ?? DEFAULT_OPTIONS.maskChar!;
  
  if (str.length <= (opts.showFirst! + opts.showLast!)) {
    return str;
  }
  
  const start = str.slice(0, opts.showFirst);
  const end = str.slice(-opts.showLast);
  const middle = mc.repeat(str.length - (opts.showFirst as number) - (opts.showLast as number));
  
  return `${start}${middle}${end}`;
}

/**
 * Redact an object recursively, applying appropriate redaction to known PII fields
 */
export function redactObject(obj: any, options: RedactionOptions = {}): any {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => redactObject(item, options));
  }
  
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const redacted: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    if (typeof value === 'string') {
      // Apply specific redaction based on field name
      if (lowerKey.includes('email')) {
        redacted[key] = redactEmail(value, options);
      } else if (lowerKey.includes('phone') || lowerKey.includes('mobile')) {
        redacted[key] = redactPhone(value, options);
      } else if (lowerKey.includes('name') || lowerKey === 'fullname' || lowerKey === 'full_name') {
        redacted[key] = redactName(value, options);
      } else if (lowerKey.includes('password') || lowerKey.includes('token') || lowerKey.includes('secret')) {
        const mc = opts.maskChar ?? DEFAULT_OPTIONS.maskChar!;
        redacted[key] = mc.repeat(8); // Always fully redact sensitive fields
      } else {
        redacted[key] = value; // Leave other strings as-is
      }
    } else if (typeof value === 'object') {
      redacted[key] = redactObject(value, options);
    } else {
      redacted[key] = value;
    }
  }
  
  return redacted;
}

/**
 * Utility for safe console logging with automatic PII redaction
 */
export function safeLog(message: string, data?: any, options: RedactionOptions = {}) {
  if (data) {
    console.log(message, redactObject(data, options));
  } else {
    console.log(message);
  }
}

/**
 * Utility for safe error logging with automatic PII redaction
 */
export function safeError(message: string, error?: any, data?: any, options: RedactionOptions = {}) {
  const logData: any = {};
  
  if (error) {
    logData.error = {
      name: error.name,
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n') // Limit stack trace
    };
  }
  
  if (data) {
    logData.data = redactObject(data, options);
  }
  
  console.error(message, logData);
}
