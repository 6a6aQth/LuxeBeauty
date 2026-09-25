"use client"

import { useRef } from "react"
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

export function BookingTicket({
  details,
  serviceNames,
}: {
  details: TicketDetails
  serviceNames: string[]
}) {
  const ticketRef = useRef<HTMLDivElement>(null)

  const handleDownload = async () => {
    const { default: html2canvas } = await import("html2canvas")
    if (!ticketRef.current) return
    const canvas = await html2canvas(ticketRef.current, { scale: 2 })
    const link = document.createElement("a")
    link.href = canvas.toDataURL("image/png")
    link.download = `booking-ticket-${details.ticketId}.png`
    link.click()
  }

  return (
    <div>
      <div ref={ticketRef} className="bg-white rounded-xl shadow-2xl relative">
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-gray-300 rounded-full" />
        <div className="p-8">
          <div className="text-center mb-8">
            <Logo />
          </div>
          {details.discountApplied && (
            <div className="inline-block mb-4 px-4 py-2 rounded-full bg-green-100 text-green-800 font-semibold text-sm border border-green-300">
              30% Loyalty Discount Applied
            </div>
          )}
          {details.isReschedule && (
            <div className="inline-block mb-4 px-4 py-2 rounded-full bg-blue-100 text-blue-800 font-semibold text-sm border border-blue-300">
              Rescheduled Appointment
            </div>
          )}
          <div className="space-y-4 text-center text-gray-700">
            <p>
              <strong>Name:</strong> {details.name}
            </p>
            <p>
              <strong>Date:</strong> {details.date}
            </p>
            <p>
              <strong>Time:</strong> {formatTime(details.timeSlot)}
            </p>
            <p>
              <strong>Services:</strong> {serviceNames.join(", ")}
            </p>
            <p>
              <strong>Booking Fee:</strong> {details.fee}
            </p>
            {details.isReschedule && details.originalDate && (
              <p>
                <strong>Originally Scheduled:</strong> {format(parseISO(details.originalDate), "MMMM dd, yyyy")}
              </p>
            )}
          </div>
          <div className="mt-8 text-center">
            <p className="text-sm font-semibold text-gray-800">Ticket ID: {details.ticketId}</p>
            <p className="text-xs text-gray-500 mt-1">Show this ticket at the studio for your appointment.</p>
          </div>
        </div>
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-gray-300 rounded-full" />
      </div>
      <div className="flex justify-center mt-10">
        <Button onClick={handleDownload} className="bg-black text-white hover:ring-black">
          Download Ticket
        </Button>
      </div>
    </div>
  )
}
