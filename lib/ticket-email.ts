import { Resend } from "resend"
import { formatDeposit } from "@/lib/deposit"
import { formatTime } from "@/lib/time-slots"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendTicketEmail(booking: {
  email: string
  name: string
  date: string
  timeSlot: string
  ticketId: string
  discountApplied: boolean
  serviceNames: string[]
}) {
  const when = `${booking.date} at ${formatTime(booking.timeSlot)}`
  const services = booking.serviceNames.join(", ")
  const discount = booking.discountApplied ? "A 30% loyalty discount is noted on this visit." : ""
  const text = [
    `Hi ${booking.name},`,
    `Your Lauryn Luxe appointment is confirmed.`,
    `Ticket: ${booking.ticketId}`,
    `When: ${when}`,
    `Services: ${services}`,
    `Deposit: ${formatDeposit()}`,
    discount,
    "Show this ticket at the studio.",
  ]
    .filter(Boolean)
    .join("\n")

  const html = `
    <div style="font-family: Georgia, serif; color: #1f2937; line-height: 1.5;">
      <h1 style="font-size: 22px;">Your appointment is confirmed</h1>
      <p>Hi ${escapeHtml(booking.name)},</p>
      <p><strong>Ticket:</strong> ${escapeHtml(booking.ticketId)}</p>
      <p><strong>When:</strong> ${escapeHtml(when)}</p>
      <p><strong>Services:</strong> ${escapeHtml(services)}</p>
      <p><strong>Deposit:</strong> ${escapeHtml(formatDeposit())}</p>
      ${discount ? `<p>${escapeHtml(discount)}</p>` : ""}
      <p>Show this ticket at the studio.</p>
    </div>
  `

  const { error } = await resend.emails.send({
    from: "Lauryn Luxe Beauty Studio <noreply@laurynbeautystudio.com>",
    to: booking.email,
    subject: `Your Lauryn Luxe booking ${booking.ticketId}`,
    html,
    text,
  })
  if (error) {
    throw new Error(error.message)
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
