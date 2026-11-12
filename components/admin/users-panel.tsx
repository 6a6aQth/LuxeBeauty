"use client"

import { useEffect, useState } from "react"
import { MoreVertical, ShieldAlert, ShieldCheck, Trash2, Ban } from "lucide-react"
import { LuxuryMark } from "@/components/luxury-mark"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

export type AccountRow = {
  id: string
  name: string
  email: string
  phone: string
  blocked: boolean
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2)
  const letters = parts.map((part) => part[0]?.toUpperCase() ?? "").join("")
  return letters || "?"
}

export function UsersPanel({ adminPassword = "luxe" }: { adminPassword?: string }) {
  const [accounts, setAccounts] = useState<AccountRow[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [accountToDelete, setAccountToDelete] = useState<AccountRow | null>(null)
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)
  const { toast } = useToast()

  const fetchAccounts = () => {
    fetch("/api/admin/customers")
      .then((response) => {
        if (!response.ok) throw new Error("Failed to load accounts")
        return response.json()
      })
      .then((data) => {
        setAccounts(data)
        setFailed(false)
      })
      .catch(() => {
        setFailed(true)
      })
  }

  useEffect(() => {
    fetchAccounts()
  }, [])

  const handleBlock = async (account: AccountRow) => {
    setActionInProgress(account.id)
    try {
      const res = await fetch(`/api/admin/users/${account.id}/block`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({ adminPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to block user")

      setAccounts((prev) =>
        prev
          ? prev.map((a) => (a.id === account.id ? { ...a, blocked: true } : a))
          : null
      )
      toast({
        title: "User Blocked",
        description: `${account.name} has been blocked from booking and logging in.`,
      })
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to block user.",
        variant: "destructive",
      })
    } finally {
      setActionInProgress(null)
    }
  }

  const handleUnblock = async (account: AccountRow) => {
    setActionInProgress(account.id)
    try {
      const res = await fetch(`/api/admin/users/${account.id}/unblock`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({ adminPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to unblock user")

      setAccounts((prev) =>
        prev
          ? prev.map((a) => (a.id === account.id ? { ...a, blocked: false } : a))
          : null
      )
      toast({
        title: "User Unblocked",
        description: `${account.name} has been unblocked.`,
      })
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to unblock user.",
        variant: "destructive",
      })
    } finally {
      setActionInProgress(null)
    }
  }

  const handleDelete = async () => {
    if (!accountToDelete) return
    const target = accountToDelete
    setActionInProgress(target.id)
    try {
      const res = await fetch(`/api/admin/users/${target.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({ adminPassword }),
      })
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to delete user profile")
      }

      setAccounts((prev) => (prev ? prev.filter((a) => a.id !== target.id) : null))
      toast({
        title: "User Deleted",
        description: `Profile for ${target.name} has been permanently deleted. Bookings were kept.`,
      })
      setAccountToDelete(null)
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to delete user.",
        variant: "destructive",
      })
    } finally {
      setActionInProgress(null)
    }
  }

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
            <div className="flex min-w-[44rem] items-center gap-6 border-b border-[#f3d0db] px-5 py-3 text-[11px] uppercase tracking-[0.18em] text-stone-400">
              <span className="w-10 shrink-0" />
              <span className="w-44 shrink-0">Name</span>
              <span className="min-w-0 flex-1">Email</span>
              <span className="w-36 shrink-0">Phone</span>
              <span className="w-24 shrink-0 text-center">Status</span>
              <span className="w-8 shrink-0 sr-only">Menu</span>
            </div>
            <ul>
              {accounts.map((account) => (
                <li
                  key={account.id || account.email}
                  className={`flex min-w-[44rem] items-center gap-6 border-b border-[#f3d0db] px-5 py-3 last:border-b-0 ${
                    account.blocked ? "bg-red-50/40" : ""
                  }`}
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-serif text-sm ${
                    account.blocked ? "bg-red-100 text-red-700 font-bold" : "bg-stone-100 text-stone-700"
                  }`}>
                    {initials(account.name)}
                  </span>
                  <div className="w-44 shrink-0">
                    <p className="truncate font-medium text-stone-900">{account.name}</p>
                  </div>
                  <p className="min-w-0 flex-1 truncate text-sm text-stone-500">{account.email}</p>
                  <p className="w-36 shrink-0 text-sm text-stone-700">{account.phone}</p>
                  <div className="w-24 shrink-0 text-center">
                    {account.blocked ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        <Ban className="h-3 w-3" />
                        Blocked
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        Active
                      </span>
                    )}
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="shrink-0 rounded-full p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700 disabled:opacity-50"
                        aria-label={`Menu for ${account.name}`}
                        disabled={actionInProgress === account.id}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-40 p-1.5 shadow-md border-stone-200">
                      {account.blocked ? (
                        <button
                          type="button"
                          onClick={() => handleUnblock(account)}
                          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-emerald-700 hover:bg-emerald-50"
                        >
                          <ShieldCheck className="h-4 w-4" />
                          Unblock
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleBlock(account)}
                          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-stone-700 hover:bg-red-50 hover:text-red-700"
                        >
                          <Ban className="h-4 w-4" />
                          Block
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setAccountToDelete(account)}
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </PopoverContent>
                  </Popover>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={Boolean(accountToDelete)} onOpenChange={(open) => !open && setAccountToDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-serif text-stone-900">Delete Customer Profile</DialogTitle>
            <DialogDescription className="text-sm text-stone-600 mt-2">
              Are you sure you want to delete the profile for{" "}
              <strong className="text-stone-900 font-semibold">{accountToDelete?.name}</strong> (
              {accountToDelete?.phone})?
              <br />
              <br />
              This will permanently delete the customer profile record. Historical booking receipts and
              appointments remain intact, and the customer may register anew with this phone later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAccountToDelete(null)}
              disabled={Boolean(actionInProgress)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={handleDelete}
              disabled={Boolean(actionInProgress)}
            >
              {actionInProgress ? "Deleting…" : "Confirm Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
