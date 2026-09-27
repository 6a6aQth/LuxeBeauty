"use client"

import { CalendarClock, CalendarDays, Home, LogOut, Mail, Scissors, Tag, Users, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export const adminSections = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "bookings", label: "Bookings", icon: CalendarDays },
  { id: "availability", label: "Availability", icon: CalendarClock },
  { id: "services", label: "Services", icon: Scissors },
  { id: "users", label: "Users", icon: Users },
  { id: "newsletter", label: "Newsletter", icon: Mail },
  { id: "price-list", label: "Price list", icon: Tag },
] as const

export type AdminSectionId = (typeof adminSections)[number]["id"]

type AdminNavProps = {
  section: AdminSectionId
  onSectionChange: (section: AdminSectionId) => void
  onLogout: () => void
}

export function AdminNav({ section, onSectionChange, onLogout }: AdminNavProps) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-black text-[#f4f0ea]">
      <div className="shrink-0 px-6 pb-3 pt-6">
        <p className="text-[10px] tracking-[0.42em] text-stone-500">ESTD — 2022</p>
        <p className="mt-3 font-serif text-[1.65rem] leading-none tracking-[0.16em]">LAURYN</p>
        <p
          className="-mt-2 ml-8 text-[2rem] leading-none text-stone-100"
          style={{ fontFamily: '"Great Vibes", cursive' }}
        >
          luxe
        </p>
        <p className="mt-1 text-[9px] tracking-[0.34em] text-stone-500">BEAUTY STUDIO</p>
        <div className="mt-4 h-px bg-gradient-to-r from-[#e91e63]/70 via-[#e91e63]/25 to-transparent" />
      </div>

      <nav className="shrink-0 space-y-0.5 px-3" aria-label="Admin">
        {adminSections.map((item) => (
          <NavButton
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={section === item.id}
            onClick={() => onSectionChange(item.id)}
          />
        ))}
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-full px-4 py-2 text-left text-sm text-stone-500 transition hover:bg-white/5 hover:text-stone-200"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </nav>

      <div className="relative mt-3 min-h-0 flex-1 overflow-hidden">
        <img
          src="/Admin-Image.png"
          alt=""
          className="h-full w-full object-contain object-bottom"
        />
      </div>
    </div>
  )
}

function NavButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-full items-center gap-3 rounded-full px-4 py-2 text-left text-sm tracking-wide transition",
        active ? "bg-[#2a2422] text-white" : "text-stone-400 hover:bg-white/5 hover:text-stone-100",
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-[#e7b4c4]" : "text-stone-500")} />
      {label}
    </button>
  )
}
