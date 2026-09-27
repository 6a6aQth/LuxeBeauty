/**
 * Rewrite Booking.phone and CustomerProfile.phone to E.164.
 * Dry-run unless --apply is passed.
 * If two profiles collapse to one number, print them and exit without writing.
 *
 * Usage: node --experimental-strip-types scripts/rewrite-phones.ts [--apply]
 */
import { readFileSync } from "node:fs"
import { PrismaClient } from "@prisma/client"
import { canonicalPhone } from "../lib/phone.ts"

function loadEnvLocal() {
  try {
    const text = readFileSync(".env.local", "utf8")
    for (const line of text.split("\n")) {
      const match = line.match(/^([^#=\s]+)=(.*)$/)
      if (!match) continue
      const key = match[1]
      if (process.env[key]) continue
      process.env[key] = match[2].replace(/^["']|["']$/g, "")
    }
  } catch {
    // Prisma also reads .env when DATABASE_URL is already exported.
  }
}

loadEnvLocal()

const apply = process.argv.includes("--apply")
const prisma = new PrismaClient()

async function main() {
  const profiles = await prisma.customerProfile.findMany()
  const groups = new Map<string, typeof profiles>()
  for (const profile of profiles) {
    const canonical = canonicalPhone(profile.phone)
    if (!canonical) continue
    const list = groups.get(canonical) ?? []
    list.push(profile)
    groups.set(canonical, list)
  }

  const collisions = [...groups.entries()].filter(([, list]) => list.length > 1)
  if (collisions.length > 0) {
    console.error("Two or more profiles collapse to one number. No rows were changed.")
    for (const [phone, list] of collisions) {
      console.error(phone, list.map((profile) => profile.id).join(", "))
    }
    process.exitCode = 1
    return
  }

  let bookingRewrites = 0
  let bookingUnchanged = 0
  let profileRewrites = 0
  const bookings = await prisma.booking.findMany({ select: { id: true, phone: true } })

  for (const booking of bookings) {
    const canonical = canonicalPhone(booking.phone)
    if (!canonical) {
      bookingUnchanged += 1
      console.log("leave", JSON.stringify(booking.phone))
      continue
    }
    if (canonical === booking.phone) continue
    bookingRewrites += 1
    console.log("booking", JSON.stringify(booking.phone), "->", canonical)
    if (apply) {
      await prisma.booking.update({ where: { id: booking.id }, data: { phone: canonical } })
    }
  }

  for (const profile of profiles) {
    const canonical = canonicalPhone(profile.phone)
    if (!canonical || canonical === profile.phone) continue
    profileRewrites += 1
    console.log("profile", profile.id, JSON.stringify(profile.phone), "->", canonical)
    if (apply) {
      await prisma.customerProfile.update({ where: { id: profile.id }, data: { phone: canonical } })
    }
  }

  console.log(
    apply ? "applied" : "dry-run",
    `bookings rewritten: ${bookingRewrites}`,
    `bookings left unchanged: ${bookingUnchanged}`,
    `profiles rewritten: ${profileRewrites}`
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
