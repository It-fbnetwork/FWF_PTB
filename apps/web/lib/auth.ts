import { NextResponse } from "next/server";

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function requireOperatorPin(req: Request): NextResponse | null {
  const expected = process.env.OPERATOR_PIN;
  if (!expected) {
    return json({ error: "OPERATOR_PIN is not configured on the server" }, 500);
  }
  const provided = req.headers.get("x-operator-pin") ?? "";
  if (provided !== expected) {
    return json({ error: "Unauthorized (operator PIN)" }, 401);
  }
  return null;
}

export function requireAgentToken(req: Request): NextResponse | null {
  const expected = process.env.AGENT_TOKEN;
  if (!expected) {
    return json({ error: "AGENT_TOKEN is not configured on the server" }, 500);
  }
  const provided = req.headers.get("x-agent-token") ?? "";
  if (provided !== expected) {
    return json({ error: "Unauthorized (agent token)" }, 401);
  }
  return null;
}
