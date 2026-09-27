"use client"

import { useEffect, useId, useRef, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"

const STORAGE_KEY = "lauryn-luxe-first-guide"

const steps = [
  {
    label: "Welcome",
    kicker: "First visit",
    title: "A short guide, then the studio.",
    body: "This walks through booking, creating an account, and what you receive after you pay. Skip it whenever you like.",
  },
  {
    label: "Look around",
    kicker: "The menu",
    title: "Services, prices, and the story.",
    body: "Services is nails, brows, and lashes. Prices is the current list. About and Contact are there if you want the studio before you book.",
  },
  {
    label: "Book",
    kicker: "Booking",
    title: "Choose a service, then a time.",
    body: "Open Booking, pick a category and a service, then a day and a time. Add your name, phone, and email. An account is not required to book.",
  },
  {
    label: "Pay",
    kicker: "The deposit",
    title: "Confirm it on your phone.",
    body: "A non-refundable deposit holds the chair. Choose TNM Mpamba or Airtel Money and approve the prompt on your phone. Stay on the page until your ticket appears.",
  },
  {
    label: "Account",
    kicker: "Sign in",
    title: "Come back as yourself.",
    body: "Create an account with your email, a password, and your phone. The blush Sign in button in the header is where you return. Guest booking still works without one.",
  },
  {
    label: "Ticket",
    kicker: "Afterwards",
    title: "Show the ticket at the studio.",
    body: "A copy is emailed to you. Need another time? Reschedule uses that ticket. Deposits and changes are explained under Policies.",
  },
]

export function FirstVisitGuide() {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const current = steps[step]
  const last = step === steps.length - 1

  useEffect(() => {
    if (window.localStorage.getItem(STORAGE_KEY) === "done") return
    const id = window.setTimeout(() => setOpen(true), 600)
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    panelRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  function dismiss() {
    window.localStorage.setItem(STORAGE_KEY, "done")
    setOpen(false)
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/55 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="presentation"
          onClick={dismiss}
        >
          <motion.div
            ref={panelRef}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="flex h-[min(720px,calc(100svh-1.5rem-env(safe-area-inset-bottom,0px)))] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] bg-[#f6f3ef] shadow-2xl outline-none md:grid md:grid-cols-[240px_1fr]"
          >
            <div className="shrink-0 bg-black px-6 py-4 text-[#f4f0ea] md:flex md:flex-col md:px-7 md:py-8">
              <div className="flex items-end justify-between gap-4 md:block">
                <div>
                  <p className="text-[10px] tracking-[0.42em] text-stone-500">ESTD — 2022</p>
                  <p className="mt-1 font-serif text-xl tracking-[0.16em] md:mt-2 md:text-2xl">LAURYN</p>
                  <p className="-mt-1 font-great-vibes text-2xl text-stone-100 md:text-3xl">luxe</p>
                </div>
                <p className="pb-1 font-serif text-sm tracking-[0.2em] text-stone-500 md:hidden">
                  {String(step + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}
                </p>
              </div>
              <div className="mt-3 h-px bg-gradient-to-r from-[#f4c6d4] via-[#f4c6d4]/50 to-transparent" />
              <ol className="mt-5 hidden space-y-2 md:block">
                {steps.map((item, index) => (
                  <li key={item.label}>
                    <button
                      type="button"
                      onClick={() => setStep(index)}
                      className={`text-left text-sm tracking-wide ${
                        index === step ? "text-[#f4c6d4]" : "text-stone-500 hover:text-stone-300"
                      }`}
                    >
                      <span className="mr-2 text-[10px] tracking-[0.2em]">0{index + 1}</span>
                      {item.label}
                    </button>
                  </li>
                ))}
              </ol>
              <p className="mt-auto hidden pt-4 font-serif text-sm tracking-[0.2em] text-stone-500 md:block">
                {String(step + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}
              </p>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex shrink-0 items-center justify-between gap-4 px-6 pt-4 sm:px-8 sm:pt-7">
                <div className="flex gap-1.5" aria-hidden="true">
                  {steps.map((item, index) => (
                    <span
                      key={item.label}
                      className={`h-1.5 rounded-full transition-all ${
                        index === step ? "w-6 bg-[#f4c6d4]" : "w-1.5 bg-[#e7d5dc]"
                      }`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={dismiss}
                  className="text-sm text-[#6e243f] underline decoration-[#f4c6d4] underline-offset-4 hover:text-[#e7b4c4]"
                >
                  Skip
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 sm:px-8">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.22 }}
                    className="py-5"
                  >
                    <p className="text-[11px] uppercase tracking-[0.28em] text-[#6e243f]">{current.kicker}</p>
                    <h2 id={titleId} className="mt-3 font-serif text-3xl leading-tight text-stone-900 sm:text-4xl">
                      {current.title}
                    </h2>
                    <p className="mt-4 max-w-md text-base leading-relaxed text-stone-600">{current.body}</p>
                    {last ? (
                      <div className="mt-6 flex flex-wrap gap-3">
                        <Link
                          href="/booking"
                          onClick={dismiss}
                          className="rounded-full bg-[#f4c6d4] px-5 py-2.5 text-sm text-[#6e243f] hover:bg-[#e7b4c4]"
                        >
                          Book a visit
                        </Link>
                        <Link
                          href="/sign-up"
                          onClick={dismiss}
                          className="rounded-full border border-[#f4c6d4] px-5 py-2.5 text-sm text-[#6e243f] hover:bg-[#f4c6d4]/40"
                        >
                          Create an account
                        </Link>
                      </div>
                    ) : null}
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#f3d0db] px-6 py-4 sm:px-8">
                <button
                  type="button"
                  onClick={() => setStep((value) => Math.max(0, value - 1))}
                  disabled={step === 0}
                  className="text-sm text-stone-500 disabled:invisible"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => (last ? dismiss() : setStep((value) => value + 1))}
                  className="rounded-full bg-black px-6 py-2.5 text-sm text-white hover:bg-stone-800"
                >
                  {last ? "Done" : "Next"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
