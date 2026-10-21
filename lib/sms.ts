import { canonicalPhone } from '@/lib/phone';

function normalizePhoneNumber(phone: string): string {
  const canonical = canonicalPhone(phone);
  if (!canonical) throw new Error('Invalid phone number format.');
  return canonical;
}

type SmsRecipient = {
  statusCode?: number;
  status?: string;
  messageId?: string;
};

type SmsResponse = {
  SMSMessageData?: {
    Message?: string;
    Recipients?: SmsRecipient[];
  };
};

const ACCEPTED_STATUS = new Set([100, 101, 102]);

export async function sendBookingSMS(to: string, message: string) {
  const apiKey = process.env.AFRICAS_TALKING_API_KEY;
  const username = process.env.AFRICAS_TALKING_USERNAME;
  if (!apiKey || !username) {
    throw new Error("Africa's Talking environment variables are not set.");
  }

  const normalizedTo = normalizePhoneNumber(to);
  const host = username.toLowerCase() === 'sandbox'
    ? 'https://api.sandbox.africastalking.com'
    : 'https://api.africastalking.com';
  const response = await fetch(`${host}/version1/messaging`, {
    method: 'POST',
    headers: {
      apiKey,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      username,
      to: normalizedTo,
      message,
    }),
  });

  const raw = await response.text();
  let payload: SmsResponse;
  try {
    payload = JSON.parse(raw) as SmsResponse;
  } catch {
    throw new Error(`Africa's Talking returned HTTP ${response.status}.`);
  }

  const recipient = payload.SMSMessageData?.Recipients?.[0];
  if (!response.ok || !recipient || !ACCEPTED_STATUS.has(recipient.statusCode ?? -1)) {
    const detail = recipient?.status || payload.SMSMessageData?.Message || `HTTP ${response.status}`;
    throw new Error(`Africa's Talking rejected the SMS: ${detail}.`);
  }

  return {
    messageId: recipient.messageId ?? null,
    statusCode: recipient.statusCode,
    status: recipient.status ?? 'Success',
  };
}
