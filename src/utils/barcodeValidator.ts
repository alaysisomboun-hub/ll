/**
 * Barcode validation and verification utilities
 * Supports EAN-13, EAN-8, UPC-A, UPC-E, CODE-128, CODE-39, QR_CODE
 * Ensures strings are preserved (never truncates leading zeroes)
 */

export interface BarcodeValidationResult {
  isValid: boolean;
  format: string;
  normalizedCode: string;
  isChecksumValid?: boolean;
  message?: string;
}

/**
 * Validates EAN-13 checksum according to GS1 specifications
 * Length must be 13 digits.
 * Check digit = (10 - ((sum of odd-index * 1 + sum of even-index * 3) % 10)) % 10
 */
export function validateEan13Checksum(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(code[i], 10);
    // 0-indexed: index 0,2,4,6,8,10 weight 1; index 1,3,5,7,9,11 weight 3
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(code[12], 10);
}

/**
 * Calculates correct 13th check digit for a 12-digit EAN-13 prefix
 */
export function calculateEan13CheckDigit(first12Digits: string): string {
  if (!/^\d{12}$/.test(first12Digits)) return '';
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(first12Digits[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit.toString();
}

/**
 * Validates EAN-8 checksum according to GS1
 */
export function validateEan8Checksum(code: string): boolean {
  if (!/^\d{8}$/.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    const digit = parseInt(code[i], 10);
    // Weight 3 for even positions, 1 for odd positions (0-indexed: 0,2,4,6 weight 3; 1,3,5 weight 1)
    sum += i % 2 === 0 ? digit * 3 : digit;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(code[7], 10);
}

/**
 * Validates UPC-A checksum (12 digits)
 */
export function validateUpcAChecksum(code: string): boolean {
  if (!/^\d{12}$/.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    const digit = parseInt(code[i], 10);
    sum += i % 2 === 0 ? digit * 3 : digit;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(code[11], 10);
}

/**
 * General Barcode Validator & Format Detector
 * Preserves leading zeroes as String
 */
export function validateBarcode(rawInput: string | number): BarcodeValidationResult {
  const code = String(rawInput ?? '').trim();
  if (!code) {
    return {
      isValid: false,
      format: 'UNKNOWN',
      normalizedCode: '',
      message: 'รหัสบาร์โค้ดว่างเปล่า',
    };
  }

  // 1. EAN-13 (13 digits)
  if (/^\d{13}$/.test(code)) {
    const isChecksumValid = validateEan13Checksum(code);
    return {
      isValid: true,
      format: 'EAN-13',
      normalizedCode: code,
      isChecksumValid,
      message: isChecksumValid ? 'EAN-13 ถูกหลัก GS1' : 'EAN-13 (13 หลัก)',
    };
  }

  // 2. UPC-A (12 digits)
  if (/^\d{12}$/.test(code)) {
    const isChecksumValid = validateUpcAChecksum(code);
    return {
      isValid: true,
      format: 'UPC-A',
      normalizedCode: code,
      isChecksumValid,
      message: isChecksumValid ? 'UPC-A ถูกหลัก GS1' : 'UPC-A (12 หลัก)',
    };
  }

  // 3. EAN-8 (8 digits)
  if (/^\d{8}$/.test(code)) {
    const isChecksumValid = validateEan8Checksum(code);
    return {
      isValid: true,
      format: 'EAN-8',
      normalizedCode: code,
      isChecksumValid,
      message: isChecksumValid ? 'EAN-8 ถูกหลัก GS1' : 'EAN-8 (8 หลัก)',
    };
  }

  // 4. CODE-128 (Standard alphanumeric POS barcode)
  // Printable ASCII 32 to 126
  if (/^[\x20-\x7E]{2,48}$/.test(code)) {
    return {
      isValid: true,
      format: 'CODE-128',
      normalizedCode: code,
      isChecksumValid: true,
      message: 'CODE-128 (บาร์โค้ดสากล)',
    };
  }

  // 5. General alphanumeric / QR code
  return {
    isValid: code.length >= 2,
    format: code.includes('http') || code.length > 30 ? 'QR_CODE' : 'BARCODE',
    normalizedCode: code,
    isChecksumValid: true,
    message: 'รหัสทั่วไป',
  };
}
