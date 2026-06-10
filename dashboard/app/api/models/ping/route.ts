import { NextResponse } from "next/server";

import { pingProvider } from "@/lib/server/models";

export const runtime = "nodejs";

const KNOWN = new Set(["openai", "anthropic", "deepseek", "mistral", "qwen", "openrouter", "ollama"]);

export async function POST(req: Request) {
  let provider: unknown;
  try {
    ({ provider } = await req.json());
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (typeof provider !== "string" || !KNOWN.has(provider)) {
    return NextResponse.json({ error: "provider must be one of " + [...KNOWN].join(", ") }, { status: 400 });
  }
  const result = await pingProvider(provider);
  return NextResponse.json({ provider, ...result });
}
