import { NextResponse } from "next/server";

import { createServiceSupabase } from "@/lib/supabase/admin";

/**
 * POST /api/clear-acknowledgements
 * Danger-zone reset: wipes the acknowledgements table (deadlines reappear).
 */
export async function POST() {
  const supabase = createServiceSupabase();
  const { error } = await supabase
    .from("deadline_acknowledgements")
    .delete()
    .gte("acknowledged_at", "1970-01-01T00:00:00Z");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
