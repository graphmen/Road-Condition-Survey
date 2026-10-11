import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function corsHeaders(origin: string | null) {
  const allowed =
    origin &&
    (origin.includes("localhost") ||
      origin.includes("127.0.0.1") ||
      origin.endsWith(".vercel.app"));
  if (!allowed || !origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
  };
}

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin");
  const extra = corsHeaders(origin);

  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: extra });
  }

  const res = NextResponse.next();
  for (const [key, value] of Object.entries(extra)) {
    res.headers.set(key, value);
  }
  return res;
}

export const config = {
  matcher: "/api/:path*",
};
