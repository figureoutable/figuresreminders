import { NextResponse } from "next/server";

import { parseClientDescription } from "@/lib/parse-client";

/**
 * POST /api/parse-client
 * Runs the regex / keyword parser over free-text client descriptions.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { text?: string };
    const text = body.text?.trim() ?? "";
    if (!text) {
      return NextResponse.json(
        { error: "Missing `text` in request body." },
        { status: 400 }
      );
    }
    const { fields, meta } = parseClientDescription(text);
    return NextResponse.json({ fields, meta });
  } catch {
    return NextResponse.json(
      { error: "Unable to parse client description." },
      { status: 500 }
    );
  }
}
