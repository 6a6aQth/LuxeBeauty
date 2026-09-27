import twilio from 'twilio';
import { canonicalPhone } from '@/lib/phone';

function normalizePhoneNumber(phone: string): string {
  const canonical = canonicalPhone(phone);
  if (!canonical) throw new Error('Invalid phone number format.');
  return canonical;
}

export async function sendBookingSMS(to: string, message: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  if (!accountSid || !authToken || !fromNumber) {
    throw new Error('Twilio environment variables are not set.');
  }

  const normalizedTo = normalizePhoneNumber(to);
  const client = twilio(accountSid, authToken);
  return client.messages.create({
    body: message,
    to: normalizedTo,
    from: fromNumber,
  });
} 