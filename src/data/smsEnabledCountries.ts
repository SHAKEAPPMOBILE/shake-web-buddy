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
  
  // Latin America
  "CO",  // Colombia
  
  // Add more countries as you enable them in Twilio Geo Permissions:
  // "BR",  // Brazil
  // "MX",  // Mexico
  // etc.
];

/**
 * African country codes - SMS delivery may be unreliable in these regions
 */
export const africanCountryCodes: string[] = [
  "DZ", "AO", "BJ", "BW", "BF", "BI", "CV", "CM", "CF", "TD", "KM", "CG", "CD",
  "DJ", "EG", "GQ", "ER", "SZ", "ET", "GA", "GM", "GH", "GN", "GW", "CI", "KE",
  "LS", "LR", "LY", "MG", "MW", "ML", "MR", "MU", "MA", "MZ", "NA", "NE", "NG",
  "RW", "ST", "SN", "SC", "SL", "SO", "ZA", "SS", "SD", "TZ", "TG", "TN", "UG",
  "ZM", "ZW"
];

/**
 * Check if a country is in Africa
 */
export function isAfricanCountry(countryCode: string): boolean {
  return africanCountryCodes.includes(countryCode);
}

/**
 * Get a user-friendly message about SMS availability (only for African countries)
 */
export function getSmsAvailabilityMessage(countryCode: string): string | null {
  if (isAfricanCountry(countryCode)) {
    return "SMS verification may not be available in your region. If you don't receive a code, please try again later or contact support.";
  }
  return null;
}
