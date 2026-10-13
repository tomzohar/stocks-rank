import { BUILD_ID } from "@/features/pwa/version";

/** The build this deployment is running; open windows compare it with their own to offer a reload. */
export function GET() {
  return Response.json({ build: BUILD_ID }, { headers: { "Cache-Control": "no-store" } });
}
