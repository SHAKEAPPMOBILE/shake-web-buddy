/**
 * Bird.com Messaging Service (SMS & WhatsApp)
 * Shared module for sending messages via Bird.com API
 * 
 * Required Environment Variables:
 * - BIRD_API_KEY: Your Bird.com API access key
 * - BIRD_WORKSPACE_ID: Your Bird.com workspace ID
 * - BIRD_CHANNEL_ID: Your Bird.com channel ID (SMS or WhatsApp)
 * - BIRD_CHANNEL_TYPE: 'sms' or 'whatsapp'
 * - BIRD_ORIGINATOR: Sender phone number (E.164 format)
 * 
 * For WhatsApp:
 * - BIRD_WHATSAPP_TEMPLATE_NAME: Template name for verification codes
 * - BIRD_WHATSAPP_TEMPLATE_NAMESPACE: Template namespace
 */

interface BirdConfig {
  apiKey: string;
  workspaceId: string;
  channelId: string;
  channelType: 'sms' | 'whatsapp';
  originator: string;
  whatsappTemplate?: {
    name: string;
    namespace: string;
  };
}

interface SendSMSParams {
  to: string;
  message: string;
}

interface BirdResponse {
  id: string;
  status: string;
  createdDatetime: string;
  recipients: Array<{
    recipient: string;
    status: string;
  }>;
}

interface BirdError {
  message: string;
  code?: string;
}

export class MessageBirdSMSService {
  private config: BirdConfig;

  constructor(
    apiKey: string, 
    workspaceId: string, 
    channelId: string, 
    channelType: 'sms' | 'whatsapp',
    originator: string,
    whatsappTemplate?: { name: string; namespace: string }
  ) {
    if (!apiKey || !workspaceId || !channelId || !originator) {
      throw new Error("Bird.com API key, workspace ID, channel ID, and originator are required");
    }
    
    if (channelType === 'whatsapp' && !whatsappTemplate) {
      throw new Error("WhatsApp template configuration required for WhatsApp channel");
    }
    
    this.config = { 
      apiKey, 
      workspaceId, 
      channelId, 
      channelType,
      originator,
      whatsappTemplate 
    };
  }

  /**
   * Format phone number to E.164 format
   * Ensures phone has country code
   */
  private formatPhoneNumber(phone: string): string {
    let formatted = phone.trim();
    
    // Remove any non-numeric characters except leading +
    formatted = formatted.replace(/[^\d+]/g, '');
    
    // Add + if missing
    if (!formatted.startsWith('+')) {
      formatted = '+1' + formatted; // Default to US if no country code
    }
    
    return formatted;
  }

  /**
   * Send message via Bird.com (SMS or WhatsApp)
   * @param params - Message parameters (to, message)
   * @returns Bird response object
   */
  async sendSMS(params: SendSMSParams): Promise<BirdResponse> {
    const { to, message } = params;
    
    if (!to || !message) {
      throw new Error("Recipient phone number and message are required");
    }

    if (message.length > 1600) {
      throw new Error("Message too long. Maximum 1600 characters allowed.");
    }

    const formattedPhone = this.formatPhoneNumber(to);
    
    console.log(`[Bird.com] Sending ${this.config.channelType.toUpperCase()} to ${formattedPhone}`);

    let requestBody: any;

    if (this.config.channelType === 'whatsapp') {
      // WhatsApp requires template format
      // Extract code from message (assumes format: "Your ... code is 123456")
      const codeMatch = message.match(/\b\d{6}\b/);
      const code = codeMatch ? codeMatch[0] : '';
      const appName = message.includes('Shake') ? 'Shake' : 'SHAKE';
      
      requestBody = {
        receiver: {
          contacts: [
            {
              identifierValue: formattedPhone
            }
          ]
        },
        template: {
          projectId: this.config.whatsappTemplate!.namespace,
          version: "1",
          locale: "en",
          variables: {
            "1": appName,  // App name
            "2": code      // Verification code
          }
        }
      };
    } else {
      // SMS format
      requestBody = {
        receiver: {
          contacts: [
            {
              identifierValue: formattedPhone
            }
          ]
        },
        body: {
          type: "text",
          text: {
            text: message
          }
        }
      };
    }

    try {
      const response = await fetch(
        `https://api.bird.com/workspaces/${this.config.workspaceId}/channels/${this.config.channelId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `AccessKey ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      const responseData = await response.json();

      if (!response.ok) {
        const errorData = responseData as BirdError;
        const errorMessage = errorData.message || 'Unknown error';
        console.error(`[Bird.com] Error sending ${this.config.channelType} to ${formattedPhone}:`, errorMessage);
        throw new Error(`Bird.com API error: ${errorMessage}`);
      }

      const result = responseData as BirdResponse;
      console.log(`[Bird.com] ${this.config.channelType.toUpperCase()} sent successfully. ID: ${result.id}`);
      
      return result;
    } catch (error) {
      if (error instanceof Error) {
        console.error(`[Bird.com] Failed to send ${this.config.channelType}:`, error.message);
        throw error;
      }
      throw new Error('Unknown error sending message');
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
    console.log(`[Bird.com] Sending bulk SMS to ${recipients.length} recipients`);

    const results = await Promise.allSettled(
      recipients.map(async (phone) => {
        try {
          const result = await this.sendSMS({ to: phone, message });
          return {
            phone,
            success: true,
            messageId: result.id,
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
   * @returns MessageBirdSMSService instance
   */
  static fromEnv(): MessageBirdSMSService {
    const apiKey = Deno.env.get('BIRD_API_KEY');
    const workspaceId = Deno.env.get('BIRD_WORKSPACE_ID');
    const channelId = Deno.env.get('BIRD_CHANNEL_ID');
    const channelType = (Deno.env.get('BIRD_CHANNEL_TYPE') || 'sms') as 'sms' | 'whatsapp';
    const originator = Deno.env.get('BIRD_ORIGINATOR');

    if (!apiKey || !workspaceId || !channelId || !originator) {
      throw new Error(
        'Bird.com credentials not configured. Set BIRD_API_KEY, BIRD_WORKSPACE_ID, BIRD_CHANNEL_ID, and BIRD_ORIGINATOR environment variables.'
      );
    }

    let whatsappTemplate: { name: string; namespace: string } | undefined;
    
    if (channelType === 'whatsapp') {
      const templateName = Deno.env.get('BIRD_WHATSAPP_TEMPLATE_NAME');
      const templateNamespace = Deno.env.get('BIRD_WHATSAPP_TEMPLATE_NAMESPACE');
      
      if (!templateName || !templateNamespace) {
        throw new Error(
          'WhatsApp template configuration required. Set BIRD_WHATSAPP_TEMPLATE_NAME and BIRD_WHATSAPP_TEMPLATE_NAMESPACE.'
        );
      }
      
      whatsappTemplate = {
        name: templateName,
        namespace: templateNamespace
      };
    }

    return new MessageBirdSMSService(apiKey, workspaceId, channelId, channelType, originator, whatsappTemplate);
  }
}
