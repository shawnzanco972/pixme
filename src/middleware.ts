import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

// Only run on admin routes (session refresh + guard).
export const config = {
  matcher: ["/admin/:path*"],
};
