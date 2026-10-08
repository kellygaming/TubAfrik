import { NextResponse, type NextRequest } from "next/server";
import { runEmailJobs } from "@/lib/email/jobs";

// Le facteur des emails, toutes les 10 min (vercel.json).
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Refusé." }, { status: 401 });
  }
  return NextResponse.json(await runEmailJobs());
}
