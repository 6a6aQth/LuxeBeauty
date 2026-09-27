import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import prisma from '@/lib/prisma';
import { renderNewsletterEmail } from '@/emails/newsletter-template';

const resend = new Resend(process.env.RESEND_API_KEY);
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

export async function POST(req: NextRequest) {
  try {
    const { subject, content } = await req.json();

    if (!subject || !content) {
      return NextResponse.json({ error: 'Subject and content are required' }, { status: 400 });
    }

    const subscribers = await prisma.newsletterSubscription.findMany({
      select: { email: true },
    });

    if (subscribers.length === 0) {
      return NextResponse.json({ message: 'No subscribers to send to.' }, { status: 200 });
    }

    const emailsToSend = await Promise.all(
      subscribers.map(async (subscriber) => {
        const unsubscribeUrl = `${siteUrl}/api/newsletter/unsubscribe?email=${encodeURIComponent(subscriber.email)}`;
        const htmlBody = await renderNewsletterEmail({ 
          subject, 
          content, 
          unsubscribeUrl,
          baseUrl: siteUrl, 
        });
        const textBody = `${subject}\n\n${content}\n\nUnsubscribe here: ${unsubscribeUrl}`;

        return {
          from: 'Lauryn Luxe Beauty Studio <noreply@laurynbeautystudio.com>',
          to: subscriber.email,
          subject: subject,
          html: htmlBody,
          text: textBody,
        };
      })
    );

    const { data, error } = await resend.batch.send(emailsToSend);

    if (error) {
      console.error('Resend batch error:', error);
      return NextResponse.json({ error: 'Failed to send newsletter batch' }, { status: 500 });
    }

    // Check for individual email failures in the batch
    if (data && data.data) {
      const failedEmails = data.data.filter((result: any) => result.error);
      if (failedEmails.length > 0) {
          console.error('Some emails in the batch failed to send:', failedEmails);
          return NextResponse.json({ error: 'Some emails failed to send.', details: failedEmails }, { status: 500 });
      }
    }

    return NextResponse.json({ message: 'Newsletter sent successfully', data });

  } catch (error) {
    console.error('Send newsletter error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 