"use client"

import { useEffect, useState } from "react"
import { MoreVertical } from "lucide-react"
import { LuxuryMark } from "@/components/luxury-mark"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type AccountRow = {
  name: string
  email: string
  phone: string
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2)
  const letters = parts.map((part) => part[0]?.toUpperCase() ?? "").join("")
  return letters || "?"
}

export function UsersPanel() {
  const [accounts, setAccounts] = useState<AccountRow[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/api/admin/customers")
      .then((response) => {
        if (!response.ok) throw new Error("Failed to load accounts")
        return response.json()
      })
      .then((data) => {
        if (!cancelled) setAccounts(data)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.32em] text-stone-400">Customers</p>
        <h1 className="mt-2 font-serif text-4xl text-stone-900">Users</h1>
        <p className="mt-2 text-sm text-stone-500">
          {accounts ? `${accounts.length} account${accounts.length === 1 ? "" : "s"}` : "Names, emails, and phones."}
        </p>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-stone-200 bg-white">
        {failed ? (
          <p className="px-6 py-16 text-center text-sm text-stone-500">Accounts could not be loaded.</p>
        ) : accounts === null ? (
          <LuxuryMark size="block" label="Loading accounts" />
        ) : accounts.length === 0 ? (
          <p className="px-6 py-16 text-center text-sm text-stone-500">No accounts yet.</p>
        ) : (
          <div>
            <div className="flex min-w-[40rem] items-center gap-6 border-b border-[#f3d0db] px-5 py-3 text-[11px] uppercase tracking-[0.18em] text-stone-400">
              <span className="w-10 shrink-0" />
              <span className="w-40 shrink-0">Name</span>
              <span className="min-w-0 flex-1">Email</span>
              <span className="w-36 shrink-0">Phone</span>
              <span className="w-8 shrink-0 sr-only">Menu</span>
            </div>
            <ul>
              {accounts.map((account) => (
                <li
                  key={account.email}
                  className="flex min-w-[40rem] items-center gap-6 border-b border-[#f3d0db] px-5 py-3 last:border-b-0"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-100 font-serif text-sm text-stone-700">
                    {initials(account.name)}
                  </span>
                  <p className="w-40 shrink-0 truncate font-medium text-stone-900">{account.name}</p>
                  <p className="min-w-0 flex-1 truncate text-sm text-stone-500">{account.email}</p>
                  <p className="w-36 shrink-0 text-sm text-stone-700">{account.phone}</p>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="shrink-0 rounded-full p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                        aria-label={`Menu for ${account.name}`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-36 p-1">
                      {["Edit", "Delete", "Block"].map((action) => (
                        <button
                          key={action}
                          type="button"
                          className="block w-full rounded-md px-3 py-2 text-left text-sm text-stone-700 hover:bg-[#fff5f8]"
                        >
                          {action}
                        </button>
                      ))}
                    </PopoverContent>
                  </Popover>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}
