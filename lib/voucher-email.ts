import { Resend } from "resend"
import { formatMwk } from "@/lib/money"

const resend = new Resend(process.env.RESEND_API_KEY)

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://laurynluxebeauty.com"

export async function sendVoucherEmail({
  voucherId,
  originalAmount,
  recipientName,
  recipientEmail,
  purchaserName,
  message,
}: {
  voucherId: string
  originalAmount: number
  recipientName: string
  recipientEmail: string
  purchaserName: string
  message?: string | null
}) {
  const lookupUrl = `${siteUrl}/gift-voucher/${voucherId}`
  const formattedAmount = formatMwk(originalAmount)
  
  // High quality QR code URL for email display
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(lookupUrl)}`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0b0b; color: #ffffff; margin: 0; padding: 40px 20px; }
    .card { max-width: 480px; margin: 0 auto; background: #141414; border: 1px solid #2e2e2e; border-radius: 20px; padding: 36px 28px; text-align: center; }
    .logo-main { font-family: Georgia, serif; font-size: 22px; font-weight: normal; letter-spacing: 4px; color: #ffffff; margin: 0; text-transform: uppercase; }
    .logo-script { font-family: Georgia, serif; font-style: italic; font-size: 28px; color: #f4c6d4; margin: -2px 0 2px; }
    .logo-sub { font-size: 9px; letter-spacing: 3px; color: #a1a1aa; text-transform: uppercase; margin-bottom: 24px; }
    .badge { display: inline-block; background: rgba(244, 198, 212, 0.15); border: 1px solid rgba(244, 198, 212, 0.35); color: #f4c6d4; font-size: 11px; font-weight: 700; letter-spacing: 2px; padding: 5px 14px; border-radius: 999px; text-transform: uppercase; margin-bottom: 16px; }
    .amount { font-family: Georgia, serif; font-size: 36px; font-weight: normal; color: #ffffff; margin: 8px 0 20px; letter-spacing: -0.5px; }
    .details { background: #1c1c1e; border: 1px solid #2c2c2e; border-radius: 14px; padding: 18px; text-align: left; margin: 20px 0; font-size: 14px; line-height: 1.6; color: #d4d4d8; }
    .details strong { color: #ffffff; }
    .qr-container { margin: 24px 0 16px; }
    .qr-container img { width: 130px; height: 130px; border-radius: 12px; border: 4px solid #ffffff; }
    .voucher-id { font-family: monospace; font-size: 18px; font-weight: 700; letter-spacing: 3px; color: #f4c6d4; margin-top: 10px; }
    .appointment-notice { background: rgba(244, 198, 212, 0.1); border: 1px solid rgba(244, 198, 212, 0.25); border-radius: 12px; padding: 14px; margin: 20px 0; font-size: 13px; color: #f4c6d4; line-height: 1.5; text-align: center; }
    .btn { display: inline-block; background: #ffffff; color: #000000; text-decoration: none; font-weight: 700; font-size: 13px; letter-spacing: 1px; padding: 14px 28px; border-radius: 999px; margin-top: 14px; }
    .footer { font-size: 12px; color: #71717a; margin-top: 32px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo-main">LAURYN</div>
    <div class="logo-script">luxe</div>
    <div class="logo-sub">BEAUTY STUDIO • ESTD 2022</div>

    <div class="badge">✦ Official Gift Voucher ✦</div>
    <p style="margin: 0; color: #a1a1aa; font-size: 13px;">Special gift presented to</p>
    <div style="font-size: 18px; font-weight: 600; color: #ffffff; margin-top: 4px;">${recipientName}</div>
    <div class="amount">${formattedAmount}</div>

    <div class="details">
      <div><strong>Voucher ID:</strong> <span style="font-family: monospace; color: #f4c6d4;">${voucherId}</span></div>
      <div><strong>From:</strong> ${purchaserName}</div>
      ${message ? `<div style="margin-top: 10px; font-style: italic; color: #f4c6d4; background: rgba(244, 198, 212, 0.08); padding: 8px 12px; border-radius: 8px;">"${message}"</div>` : ""}
    </div>

    <div class="qr-container">
      <img src="${qrImageUrl}" alt="Voucher QR Code" />
      <div class="voucher-id">${voucherId}</div>
    </div>

    <div class="appointment-notice">
      <strong>Important:</strong> Please contact the studio at least <strong>24 hours in advance</strong> to book your appointment slot. Present this QR code or Voucher ID when you arrive.
    </div>

    <a href="${lookupUrl}" class="btn">VIEW LIVE BALANCE & DETAILS</a>

    <div class="footer">
      Lauryn Luxe Beauty Studio • Blantyre, Malawi<br/>
      Phone: 0997940419 • Luxury & Precision in Every Detail.
    </div>
  </div>
</body>
</html>
`

  const text = [
    `Hi ${recipientName},`,
    `You have received a Lauryn Luxe Beauty Studio Gift Voucher worth ${formattedAmount} from ${purchaserName}!`,
    message ? `Personal Message: "${message}"` : null,
    `Voucher ID: ${voucherId}`,
    `Important: Please contact the studio at least 24 hours in advance (Phone: 0997940419) to reserve your appointment slot.`,
    `Check live balance & details: ${lookupUrl}`,
    `Present this voucher at the studio to redeem.`,
    `Lauryn Luxe Beauty Studio, Blantyre, Malawi`,
  ].filter(Boolean).join("\n\n")

  // Send to recipient
  const { data, error } = await resend.emails.send({
    from: "Lauryn Luxe Beauty Studio <noreply@laurynbeautystudio.com>",
    to: recipientEmail,
    subject: `You received a ${formattedAmount} Gift Voucher from ${purchaserName}!`,
    html,
    text,
  })

  if (error) {
    console.error("[sendVoucherEmail] Resend error delivering to recipient:", error)
    throw new Error(`Resend email delivery failed: ${error.message}`)
  }

  // Also send a studio notification copy (non-blocking)
  try {
    await resend.emails.send({
      from: "Lauryn Luxe Beauty Studio <noreply@laurynbeautystudio.com>",
      to: "lambatlauryn@gmail.com",
      subject: `[Studio Notice] New Gift Voucher ${voucherId} (${formattedAmount}) for ${recipientName}`,
      html: `
        <p>A new gift voucher has been purchased:</p>
        <ul>
          <li><strong>Voucher ID:</strong> ${voucherId}</li>
          <li><strong>Amount:</strong> ${formattedAmount}</li>
          <li><strong>Recipient:</strong> ${recipientName} (${recipientEmail})</li>
          <li><strong>Purchaser:</strong> ${purchaserName}</li>
          ${message ? `<li><strong>Message:</strong> "${message}"</li>` : ""}
        </ul>
        <p><a href="${lookupUrl}">View Voucher Page</a></p>
      `,
      text: `New Gift Voucher ${voucherId} (${formattedAmount}) purchased for ${recipientName} (${recipientEmail}) by ${purchaserName}. Link: ${lookupUrl}`,
    })
  } catch (studioCopyErr) {
    console.error("[sendVoucherEmail] Studio copy notice failed:", studioCopyErr)
  }

  return data
}
