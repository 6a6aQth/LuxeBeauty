import { Resend } from "resend"
import { formatDeposit } from "@/lib/deposit"
import { formatTime } from "@/lib/time-slots"

const resend = new Resend(process.env.RESEND_API_KEY)

const cream = "#f6f3ef"
const ink = "#1c1917"
const blush = "#f4c6d4"
const blushInk = "#6e243f"
const stone = "#78716c"

export async function sendTicketEmail(booking: {
  email: string
  name: string
  date: string
  timeSlot: string
  ticketId: string
  discountApplied: boolean
  serviceNames: string[]
}) {
  const visitDate = formatVisitDate(booking.date)
  const visitTime = formatTime(booking.timeSlot)
  const services = booking.serviceNames.filter(Boolean)
  const deposit = formatDeposit()
  const text = [
    `Hi ${booking.name},`,
    `Your Lauryn Luxe appointment is confirmed.`,
    `Ticket: ${booking.ticketId}`,
    `Date: ${visitDate}`,
    `Time: ${visitTime}`,
    `Services: ${services.join(", ")}`,
    `Deposit: ${deposit}`,
    booking.discountApplied ? "A 30% loyalty discount is noted on this visit." : "",
    "Show this ticket at the studio.",
    "Lauryn Luxe Beauty Studio, Blantyre",
  ]
    .filter(Boolean)
    .join("\n")

  const { error } = await resend.emails.send({
    from: "Lauryn Luxe Beauty Studio <noreply@laurynbeautystudio.com>",
    to: booking.email,
    subject: `Your Lauryn Luxe booking ${booking.ticketId}`,
    html: ticketHtml({
      name: booking.name,
      visitDate,
      visitTime,
      services,
      deposit,
      ticketId: booking.ticketId,
      discountApplied: booking.discountApplied,
    }),
    text,
  })
  if (error) {
    throw new Error(error.message)
  }
}

function formatVisitDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number)
  if (!year || !month || !day) return isoDate
  const date = new Date(Date.UTC(year, month - 1, day, 12))
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Blantyre",
  }).format(date)
}

function ticketHtml(booking: {
  name: string
  visitDate: string
  visitTime: string
  services: string[]
  deposit: string
  ticketId: string
  discountApplied: boolean
}): string {
  const serviceRows = booking.services
    .map(
      (service) => `
        <tr>
          <td style="padding:0 0 10px 0;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.4;color:${ink};">
            ${escapeHtml(service)}
          </td>
        </tr>`,
    )
    .join("")

  const loyalty = booking.discountApplied
    ? `
      <tr>
        <td style="padding:0 32px 8px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${blush};border-radius:16px;">
            <tr>
              <td style="padding:14px 18px;font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:1.5;color:${blushInk};">
                A 30% loyalty discount is noted on this visit.
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : ""

  return `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:${cream};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      ${escapeHtml(booking.visitDate)} at ${escapeHtml(booking.visitTime)}. Ticket ${escapeHtml(booking.ticketId)}.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${cream};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:28px;overflow:hidden;">
            <tr>
              <td style="background:#0c0c0c;padding:36px 32px 28px 32px;text-align:center;">
                <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:0.42em;color:#a8a29e;">ESTD — 2022</p>
                <p style="margin:16px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:28px;letter-spacing:0.22em;color:#f4f0ea;">LAURYN</p>
                <p style="margin:2px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:34px;font-style:italic;color:#f4f0ea;">luxe</p>
                <p style="margin:8px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:10px;letter-spacing:0.38em;color:#a8a29e;">BEAUTY STUDIO</p>
              </td>
            </tr>
            <tr>
              <td style="height:3px;background:${blush};font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:32px 32px 8px 32px;">
                <p style="margin:0 0 18px 0;">
                  <span style="display:inline-block;background:${blush};color:${blushInk};font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:0.22em;padding:7px 14px;border-radius:999px;">CONFIRMED</span>
                </p>
                <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.15;color:${ink};">Your appointment is set</p>
                <p style="margin:14px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:${stone};">
                  Hi ${escapeHtml(booking.name)}, your visit at Lauryn Luxe is booked. Keep this note and show it at the studio.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 32px 8px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td width="58%" valign="top" style="background:${cream};border-radius:18px;padding:16px 16px 14px 16px;">
                      <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:10px;letter-spacing:0.2em;color:${stone};">DATE</p>
                      <p style="margin:8px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.35;color:${ink};">${escapeHtml(booking.visitDate)}</p>
                    </td>
                    <td width="16" style="font-size:0;line-height:0;">&nbsp;</td>
                    <td width="42%" valign="top" style="background:${cream};border-radius:18px;padding:16px 16px 14px 16px;">
                      <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:10px;letter-spacing:0.2em;color:${stone};">TIME</p>
                      <p style="margin:8px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.35;color:${ink};">${escapeHtml(booking.visitTime)}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px 6px 32px;">
                <p style="margin:0 0 12px 0;font-family:Georgia,'Times New Roman',serif;font-size:10px;letter-spacing:0.2em;color:${stone};">SERVICES</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${serviceRows || `<tr><td style="font-family:Georgia,'Times New Roman',serif;font-size:16px;color:${ink};">Studio appointment</td></tr>`}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 18px 32px;">
                <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:10px;letter-spacing:0.2em;color:${stone};">DEPOSIT</p>
                <p style="margin:8px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:16px;color:${ink};">${escapeHtml(booking.deposit)}</p>
              </td>
            </tr>
            ${loyalty}
            <tr>
              <td style="padding:16px 32px 32px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0c0c0c;border-radius:20px;">
                  <tr>
                    <td style="padding:22px 20px;text-align:center;">
                      <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:10px;letter-spacing:0.28em;color:#a8a29e;">TICKET</p>
                      <p style="margin:10px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:18px;letter-spacing:0.08em;color:${blush};">${escapeHtml(booking.ticketId)}</p>
                      <p style="margin:12px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:13px;line-height:1.5;color:#d6d3d1;">Show this at the studio.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px 32px;text-align:center;">
                <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:12px;letter-spacing:0.08em;color:${stone};">Lauryn Luxe Beauty Studio · Blantyre</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
