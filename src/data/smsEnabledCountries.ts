/**
 * List of country codes where SMS delivery is enabled via Twilio Geo Permissions.
 * 
 * IMPORTANT: Keep this list in sync with your Twilio Console settings:
 * https://console.twilio.com → Messaging → Settings → Geo Permissions
 * 
 * When you enable a new country in Twilio, add its ISO code here.
 */
export const smsEnabledCountryCodes: string[] = [
  // North America (typically enabled by default)
  "US",  // United States
  "CA",  // Canada
  
  // Europe (commonly enabled)
  "PT",  // Portugal
  "ES",  // Spain
  "GB",  // United Kingdom
  "FR",  // France
  "DE",  // Germany
  "IT",  // Italy
  "NL",  // Netherlands
  "BE",  // Belgium
  "CH",  // Switzerland
  "AT",  // Austria
  "IE",  // Ireland
  
  // Add more countries as you enable them in Twilio Geo Permissions:
  // "CO",  // Colombia - Enable in Twilio first
  // "BR",  // Brazil
  // "MX",  // Mexico
  // etc.
];

/**
 * Check if SMS is enabled for a given country code
 */
export function isSmsEnabledForCountry(countryCode: string): boolean {
  return smsEnabledCountryCodes.includes(countryCode);
}

/**
 * Get a user-friendly message about SMS availability
 */
export function getSmsAvailabilityMessage(countryCode: string): string | null {
  if (isSmsEnabledForCountry(countryCode)) {
    return null; // No message needed
  }
  return "SMS verification may not be available in your region. If you don't receive a code, please try again later or contact support.";
}
