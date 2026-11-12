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
  
  // Quick QR code URL using standard image API or data url representation
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(lookupUrl)}`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #000; color: #fff; margin: 0; padding: 40px 20px; }
    .card { max-width: 480px; margin: 0 auto; background: #111; border: 1px solid #333; border-radius: 16px; padding: 32px; text-align: center; }
    .logo { font-size: 20px; font-weight: bold; letter-spacing: 2px; color: #fff; margin-bottom: 24px; text-transform: uppercase; }
    .badge { display: inline-block; background: #f4c6d4; color: #1c1917; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 999px; text-transform: uppercase; margin-bottom: 16px; }
    .amount { font-size: 32px; font-weight: 800; color: #f4c6d4; margin: 8px 0 20px; }
    .details { background: #1a1a1a; border-radius: 12px; padding: 16px; text-align: left; margin: 20px 0; font-size: 14px; line-height: 1.6; color: #ccc; }
    .details strong { color: #fff; }
    .qr-container { margin: 24px 0 16px; }
    .qr-container img { width: 140px; height: 140px; border-radius: 8px; border: 4px solid #fff; }
    .voucher-id { font-family: monospace; font-size: 18px; font-weight: 700; letter-spacing: 2px; color: #fff; margin-top: 8px; }
    .btn { display: inline-block; background: #fff; color: #000; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 999px; margin-top: 20px; }
    .footer { font-size: 12px; color: #666; margin-top: 28px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Lauryn Luxe Beauty Studio</div>
    <div class="badge">Gift Voucher</div>
    <p style="margin: 0; color: #aaa; font-size: 14px;">Special gift for ${recipientName}</p>
    <div class="amount">${formattedAmount}</div>

    <div class="details">
      <div><strong>Voucher ID:</strong> <span style="font-family: monospace;">${voucherId}</span></div>
      <div><strong>From:</strong> ${purchaserName}</div>
      ${message ? `<div style="margin-top: 8px; font-style: italic; color: #f4c6d4;">"${message}"</div>` : ""}
    </div>

    <div class="qr-container">
      <img src="${qrImageUrl}" alt="Voucher QR Code" />
      <div class="voucher-id">${voucherId}</div>
    </div>

    <p style="font-size: 13px; color: #aaa; margin: 12px 0 0;">Present this QR code or Voucher ID during your appointment at the studio.</p>

    <a href="${lookupUrl}" class="btn">View Live Balance & Details</a>

    <div class="footer">
      Lauryn Luxe Beauty Studio • Blantyre, Malawi<br/>
      Luxury & Precision in Every Detail.
    </div>
  </div>
</body>
</html>
`

  const text = [
    `Hi ${recipientName},`,
    `You have received a Lauryn Luxe Beauty Studio Gift Voucher worth ${formattedAmount} from ${purchaserName}!`,
    message ? `Message: "${message}"` : null,
    `Voucher ID: ${voucherId}`,
    `Check balance & details: ${lookupUrl}`,
    `Present this voucher at the studio to redeem.`,
    `Lauryn Luxe Beauty Studio, Blantyre`,
  ].filter(Boolean).join("\n\n")

  try {
    await resend.emails.send({
      from: "Lauryn Luxe Beauty Studio <noreply@laurynbeautystudio.com>",
      to: recipientEmail,
      subject: `You received a ${formattedAmount} Gift Voucher from ${purchaserName}!`,
      html,
      text,
    })
  } catch (err) {
    console.error("[sendVoucherEmail] Resend error:", err)
    // Non-fatal per SDD FR-30
  }
}

