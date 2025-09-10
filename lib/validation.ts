// Validation utilities for form fields

const PLACEHOLDER_PATTERNS = [
  // Email placeholders
  /^(john|jane|test|example|demo|user|admin)@(example|test|demo|mail)\.(com|org|net)$/i,
  /^your[\-_.]?email@/i,
  /^email@/i,
  
  // Name placeholders
  /^(your[\s_-]?name|full[\s_-]?name|first[\s_-]?name|last[\s_-]?name)$/i,
  /^(john|jane)[\s_-]?(doe|smith)$/i,
  /^(test|demo|example|sample)[\s_-]?(user|person|name)$/i,
  
  // Phone placeholders
  /^\+?[0-9]{1,3}[\s-]?1234[\s-]?5678?$/,
  /^555[\s-]?555[\s-]?5555$/,
  /^123[\s-]?456[\s-]?7890$/,
  
  // URL placeholders
  /^(https?:\/\/)?(www\.)?(example|test|demo|portfolio|yoursite|website)\.(com|org|net)$/i,
  /^(https?:\/\/)?(www\.)?your[\-_]?(portfolio|website|site)\./i,
];

export function isPlaceholderText(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  
  const trimmed = value.trim();
  if (!trimmed) return false;
  
  return PLACEHOLDER_PATTERNS.some(pattern => pattern.test(trimmed));
}

export function validateNotPlaceholder(value: string, fieldName: string): string | undefined {
  if (isPlaceholderText(value)) {
    return `Please enter a valid ${fieldName}, not a placeholder`;
  }
  return undefined;
}

export function validateEmail(email: string): string | undefined {
  if (!email) return 'Email is required';
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'Please enter a valid email address';
  }
  
  if (isPlaceholderText(email)) {
    return 'Please enter your actual email address';
  }
  
  return undefined;
}

export function validateName(name: string): string | undefined {
  if (!name || name.trim().length < 2) {
    return 'Name must be at least 2 characters';
  }
  
  if (isPlaceholderText(name)) {
    return 'Please enter your actual name';
  }
  
  // Check for suspicious patterns
  if (/^[a-z]{20,}$/i.test(name)) {
    return 'Please enter a valid name';
  }
  
  return undefined;
}

export function validatePhone(phone: string): string | undefined {
  if (!phone) return 'Phone number is required';
  
  // Remove spaces and dashes for validation
  const cleaned = phone.replace(/[\s-]/g, '');
  
  if (cleaned.length < 7 || cleaned.length > 15) {
    return 'Please enter a valid phone number';
  }
  
  if (isPlaceholderText(phone)) {
    return 'Please enter your actual phone number';
  }
  
  return undefined;
}

export function validateURL(url: string): string | undefined {
  if (!url) return undefined; // URLs are typically optional
  
  try {
    new URL(url);
  } catch {
    return 'Please enter a valid URL';
  }
  
  if (isPlaceholderText(url)) {
    return 'Please enter a real website URL';
  }
  
  return undefined;
}
