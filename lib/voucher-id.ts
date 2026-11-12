import { randomInt } from "crypto"
import prisma from "@/lib/prisma"

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no I, O, 0, 1 to avoid confusion
const LENGTH = 6

function generate(): string {
  let id = "LB-"
  for (let i = 0; i < LENGTH; i++) id += ALPHABET[randomInt(ALPHABET.length)]
  return id
}

/** Generate a collision-safe unique voucherId in the format LB-XXXXXX. */
export async function newVoucherId(maxAttempts = 10): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const candidate = generate()
    const existing = await prisma.giftVoucher.findUnique({ where: { voucherId: candidate } })
    if (!existing) return candidate
  }
  throw new Error("Could not generate a unique voucher ID after multiple attempts.")
}

