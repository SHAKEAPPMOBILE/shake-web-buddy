/**
 * Vonage (Nexmo) SMS Service
 * Shared module for sending SMS via Vonage API
 * 
 * Required Environment Variables:
 * - VONAGE_API_KEY: Your Vonage API key
 * - VONAGE_API_SECRET: Your Vonage API secret
 * - VONAGE_FROM: Sender ID (can be "Vonage APIs" or your brand name)
 */

interface VonageConfig {
  apiKey: string;
  apiSecret: string;
  from: string;
}

interface SendSMSParams {
  to: string;
  message: string;
}

interface VonageResponse {
  message_count: string;
  messages: Array<{
    to: string;
    message_id: string;
    status: string;
    remaining_balance: string;
    message_price: string;
    network: string;
    error_text?: string;
  }>;
}

export class VonageSMSService {
  private config: VonageConfig;

  constructor(apiKey: string, apiSecret: string, from: string) {
    if (!apiKey || !apiSecret || !from) {
      throw new Error("Vonage API key, API secret, and sender ID are required");
    }
    this.config = { apiKey, apiSecret, from };
  }

  /**
   * Format phone number to international format
   * Removes + and ensures it's digits only
   */
  private formatPhoneNumber(phone: string): string {
    // Vonage expects numbers without the + prefix
    let formatted = phone.trim().replace(/[^\d]/g, '');
    
    // If it doesn't start with country code, assume Colombia (+57)
    if (formatted.length === 10 && !formatted.startsWith('57')) {
      formatted = '57' + formatted;
    }
    
    return formatted;
  }

  /**
   * Send SMS via Vonage
   * @param params - SMS parameters (to, message)
   * @returns Vonage response object
   */
  async sendSMS(params: SendSMSParams): Promise<VonageResponse> {
    const { to, message } = params;
    
    if (!to || !message) {
      throw new Error("Recipient phone number and message are required");
    }

    // Vonage SMS limit is 1600 characters for concatenated messages
    if (message.length > 1600) {
      throw new Error("Message too long. Maximum 1600 characters allowed.");
    }

    const formattedPhone = this.formatPhoneNumber(to);
    
    console.log(`[Vonage] Sending SMS to ${formattedPhone}`);

    try {
      // Vonage uses form-encoded data
      const formData = new URLSearchParams({
        from: this.config.from,
        text: message,
        to: formattedPhone,
        api_key: this.config.apiKey,
        api_secret: this.config.apiSecret,
      });

      const response = await fetch('https://rest.nexmo.com/sms/json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      const responseData = await response.json() as VonageResponse;

      // Check if the request was successful
      if (!response.ok) {
        console.error(`[Vonage] HTTP error: ${response.status}`);
        throw new Error(`Vonage API HTTP error: ${response.status}`);
      }

      // Check message status
      const firstMessage = responseData.messages[0];
      if (firstMessage.status !== '0') {
        const errorText = firstMessage.error_text || 'Unknown error';
        console.error(`[Vonage] Message error: ${errorText} (status: ${firstMessage.status})`);
        throw new Error(`Vonage API error: ${errorText}`);
      }

      console.log(`[Vonage] SMS sent successfully. Message ID: ${firstMessage.message_id}`);
      console.log(`[Vonage] Remaining balance: ${firstMessage.remaining_balance}, Price: ${firstMessage.message_price}`);
      
      return responseData;
    } catch (error) {
      if (error instanceof Error) {
        console.error(`[Vonage] Failed to send SMS:`, error.message);
        throw error;
      }
      throw new Error('Unknown error sending SMS');
    }
  }

  /**
   * Send bulk SMS to multiple recipients
   * @param recipients - Array of phone numbers
   * @param message - Message to send
   * @returns Array of results with success/failure status
   */
  async sendBulkSMS(
    recipients: string[],
    message: string
  ): Promise<Array<{ phone: string; success: boolean; error?: string; messageId?: string }>> {
    console.log(`[Vonage] Sending bulk SMS to ${recipients.length} recipients`);

    const results = await Promise.allSettled(
      recipients.map(async (phone) => {
        try {
          const result = await this.sendSMS({ to: phone, message });
          const firstMessage = result.messages[0];
          
          return {
            phone,
            success: true,
            messageId: firstMessage.message_id,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          return {
            phone,
            success: false,
            error: errorMessage,
          };
        }
      })
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          phone: recipients[index],
          success: false,
          error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
        };
      }
    });
  }

  /**
   * Get credentials from environment variables
   * @returns VonageSMSService instance
   */
  static fromEnv(): VonageSMSService {
    const apiKey = Deno.env.get('VONAGE_API_KEY');
    const apiSecret = Deno.env.get('VONAGE_API_SECRET');
    const from = Deno.env.get('VONAGE_FROM') || 'SHAKE';

    if (!apiKey || !apiSecret) {
      throw new Error(
        'Vonage credentials not configured. Set VONAGE_API_KEY and VONAGE_API_SECRET environment variables.'
      );
    }

    return new VonageSMSService(apiKey, apiSecret, from);
  }
}
