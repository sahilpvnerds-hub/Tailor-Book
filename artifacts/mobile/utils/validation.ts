export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

// Mobile: exactly 10 digits, numbers only
export function validateMobile(value: string): string | undefined {
  if (!value.trim()) return "Mobile number is required";
  if (!/^\d+$/.test(value.trim())) return "Only numbers allowed";
  if (value.trim().length !== 10) return "Must be exactly 10 digits";
  return undefined;
}

// Email: proper format
export function validateEmail(value: string): string | undefined {
  if (!value.trim()) return "Email is required";
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(value.trim())) return "Enter a valid email address";
  return undefined;
}

// Password: min 8, uppercase, lowercase, number, special char
export function validatePassword(value: string): string | undefined {
  if (!value) return "Password is required";
  if (value.length < 8) return "Minimum 8 characters";
  if (!/[A-Z]/.test(value)) return "At least 1 uppercase letter required";
  if (!/[a-z]/.test(value)) return "At least 1 lowercase letter required";
  if (!/[0-9]/.test(value)) return "At least 1 number required";
  if (!/[^A-Za-z0-9]/.test(value)) return "At least 1 special character required";
  return undefined;
}

export function validateRequired(value: string, label: string): string | undefined {
  if (!value.trim()) return `${label} is required`;
  return undefined;
}

export function validateConfirmPassword(password: string, confirm: string): string | undefined {
  if (!confirm) return "Please confirm your password";
  if (password !== confirm) return "Passwords do not match";
  return undefined;
}

// Generic validator: runs all rules and returns errors object
export function runValidation(
  rules: Array<{ field: string; error: string | undefined }>
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const rule of rules) {
    if (rule.error) {
      errors[rule.field] = rule.error;
    }
  }
  return errors;
}
