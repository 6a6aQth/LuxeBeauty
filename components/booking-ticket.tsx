"use client"

import { forwardRef, useRef } from "react"
import Logo from "@/components/logo"
import { formatTime } from "@/lib/time-slots"
import { format, parseISO } from "date-fns"
import { Button } from "@/components/ui/animated-download-button"

export type TicketDetails = {
  name: string
  date: string
  timeSlot: string
  services: string[]
  fee: string
  ticketId: string
  discountApplied?: boolean
  isReschedule?: boolean
  originalDate?: string | null
}

export const TicketFace = forwardRef<HTMLDivElement, { details: TicketDetails; serviceNames: string[] }>(
  function TicketFace({ details, serviceNames }, ref) {
    return (
      <div ref={ref} className="relative w-[320px] rounded-xl bg-white shadow-2xl">
        <div className="absolute -top-6 left-1/2 h-12 w-12 -translate-x-1/2 rounded-full bg-gray-200" />
        <div className="p-8 text-center">
          <div className="mb-6 flex justify-center">
            <Logo />
          </div>
          {details.discountApplied && (
            <div className="mb-4 inline-block rounded-full border border-green-300 bg-green-100 px-4 py-2 text-sm font-semibold text-green-800">
              30% Loyalty Discount Applied
            </div>
          )}
          {details.isReschedule && (
            <div className="mb-4 inline-block rounded-full border border-blue-300 bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-800">
              Rescheduled Appointment
            </div>
          )}
          <div className="space-y-3 text-sm text-gray-700">
            <p><strong>Name:</strong> {details.name}</p>
            <p><strong>Date:</strong> {details.date}</p>
            <p><strong>Time:</strong> {formatTime(details.timeSlot)}</p>
            <p><strong>Services:</strong> {serviceNames.join(", ")}</p>
            <p><strong>Booking Fee:</strong> {details.fee}</p>
            {details.isReschedule && details.originalDate && (
              <p><strong>Originally Scheduled:</strong> {format(parseISO(details.originalDate), "MMMM dd, yyyy")}</p>
            )}
          </div>
          <div className="mt-6">
            <p className="text-sm font-semibold text-gray-800">Ticket ID: {details.ticketId}</p>
            <p className="mt-1 text-xs text-gray-500">Show this ticket at the studio for your appointment.</p>
          </div>
        </div>
        <div className="absolute -bottom-6 left-1/2 h-12 w-12 -translate-x-1/2 rounded-full bg-gray-200" />
      </div>
    )
  }
)

export async function downloadTicketPng(node: HTMLElement, ticketId: string) {
  const { default: html2canvas } = await import("html2canvas")
  const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#e5e7eb" })
  const link = document.createElement("a")
  link.href = canvas.toDataURL("image/png")
  link.download = `booking-ticket-${ticketId}.png`
  link.click()
}

export function BookingTicket({
  details,
  serviceNames,
}: {
  details: TicketDetails
  serviceNames: string[]
}) {
  const ticketRef = useRef<HTMLDivElement>(null)

  return (
    <div>
      <TicketFace ref={ticketRef} details={details} serviceNames={serviceNames} />
      <div className="mt-10 flex justify-center">
        <Button
          onClick={() => ticketRef.current && downloadTicketPng(ticketRef.current, details.ticketId)}
          className="bg-black text-white hover:ring-black"
        >
          Download Ticket
        </Button>
      </div>
    </div>
  )
}
