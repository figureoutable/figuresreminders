import { NextResponse } from "next/server";

import { createServiceSupabase } from "@/lib/supabase/admin";

/**
 * POST /api/acknowledge
 * Inserts a unique acknowledgement for a concrete generated deadline.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      client_id?: string;
      obligation_type?: string;
      deadline_date?: string;
      acknowledged_by?: string;
    };
    const clientId = body.client_id?.trim();
    const obligationType = body.obligation_type?.trim();
    const deadlineDate = body.deadline_date?.trim();
    const by = (body.acknowledged_by ?? "").trim().slice(0, 20);
    if (!clientId || !obligationType || !deadlineDate) {
      return NextResponse.json(
        { error: "client_id, obligation_type, and deadline_date are required." },
        { status: 400 }
      );
    }
    if (!by) {
      return NextResponse.json(
        { error: "acknowledged_by is required (max 20 characters)." },
        { status: 400 }
      );
    }
    const supabase = createServiceSupabase();
    const { data, error } = await supabase
      .from("deadline_acknowledgements")
      .insert({
        client_id: clientId,
        obligation_type: obligationType,
        deadline_date: deadlineDate,
        acknowledged_by: by,
      })
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "This deadline was already acknowledged." },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ acknowledgement: data });
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
}
