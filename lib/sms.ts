import twilio from 'twilio';
import { canonicalPhone } from '@/lib/phone';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

if (!accountSid || !authToken || !fromNumber) {
  throw new Error('Twilio environment variables are not set.');
}

const client = twilio(accountSid, authToken);

function normalizePhoneNumber(phone: string): string {
  const canonical = canonicalPhone(phone);
  if (!canonical) throw new Error('Invalid phone number format.');
  return canonical;
}

export async function sendBookingSMS(to: string, message: string) {
  const normalizedTo = normalizePhoneNumber(to);
  if (!normalizedTo) throw new Error('Recipient phone number is required');
  return client.messages.create({
    body: message,
    to: normalizedTo,
    from: fromNumber,
  });
} 