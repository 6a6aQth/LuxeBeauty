import prisma from "@/lib/prisma"

/** Sum the current catalog price of each selected service id once. */
export async function sumServicePrices(
  serviceIds: string[],
): Promise<{ total: number } | { message: string }> {
  const ids = [...new Set(serviceIds.map(String).filter(Boolean))]
  if (ids.length === 0) return { message: "Choose at least one service." }

  const services = await prisma.service.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, price: true },
  })
  const byId = new Map(services.map((service) => [service.id, service]))
  let total = 0
  for (const id of ids) {
    const service = byId.get(id)
    if (!service) return { message: "One of the selected services is no longer listed." }
    if (service.price == null || service.price <= 0) {
      return { message: `${service.name} has no price yet.` }
    }
    total += service.price
  }
  return { total }
}
