/**
 * WhatsApp Phone Number Formatter & Egypt / MENA Auto-Prefix Utility
 */

export function formatWhatsAppPhone(rawPhone: string, defaultCountryCode: string = '20'): string {
  if (!rawPhone) return '';

  // Clean all non-digit characters
  let cleaned = String(rawPhone).trim().replace(/[^\d]/g, '');
  if (!cleaned) return '';

  const countryDigits = defaultCountryCode.replace(/[^\d]/g, '') || '20';

  // 1. Egypt Mobile Numbers: 010..., 011..., 012..., 015... (11 digits starting with 01)
  if (/^01[0125]\d{8}$/.test(cleaned)) {
    return '20' + cleaned.substring(1); // 01012345678 -> 201012345678
  }

  // 2. Egypt Mobile Numbers missing leading 0: 1012345678, 11..., 12..., 15... (10 digits starting with 1)
  if (/^1[0125]\d{8}$/.test(cleaned)) {
    return '20' + cleaned; // 1012345678 -> 201012345678
  }

  // 3. Numbers starting with 00 (e.g. 002010... or 00966...)
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }

  // 4. Numbers starting with single 0 (e.g. 0501234567 in KSA/UAE)
  if (cleaned.startsWith('0') && cleaned.length >= 9) {
    cleaned = countryDigits + cleaned.substring(1);
  }

  // 5. Short numbers missing country prefix (8 to 10 digits that don't start with country prefix)
  if (cleaned.length >= 8 && cleaned.length <= 10 && !cleaned.startsWith(countryDigits)) {
    cleaned = countryDigits + cleaned;
  }

  return cleaned;
}

export function formatWhatsAppJid(rawPhone: string, defaultCountryCode: string = '20'): string {
  const formattedDigits = formatWhatsAppPhone(rawPhone, defaultCountryCode);
  if (!formattedDigits) return '';
  return `${formattedDigits}@c.us`;
}
