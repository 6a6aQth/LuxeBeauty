import { NextResponse } from "next/server";
import { getNeonAuth } from "@/lib/auth/neon";

type Params = { path: string[] };

async function handle(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  request: Request,
  context: { params: Params | Promise<Params> }
) {
  const neon = getNeonAuth();
  if (!neon) {
    return NextResponse.json(
      { error: "Neon Auth is not configured. Set NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET." },
      { status: 503 }
    );
  }
  const handlers = neon.handler();
  const params = Promise.resolve(context.params);
  return handlers[method](request, { params });
}

export const GET = (req: Request, ctx: { params: Params | Promise<Params> }) => handle("GET", req, ctx);
export const POST = (req: Request, ctx: { params: Params | Promise<Params> }) => handle("POST", req, ctx);
export const PUT = (req: Request, ctx: { params: Params | Promise<Params> }) => handle("PUT", req, ctx);
export const PATCH = (req: Request, ctx: { params: Params | Promise<Params> }) => handle("PATCH", req, ctx);
export const DELETE = (req: Request, ctx: { params: Params | Promise<Params> }) => handle("DELETE", req, ctx);
