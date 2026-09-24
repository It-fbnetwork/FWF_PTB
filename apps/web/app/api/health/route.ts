import { json } from "@/lib/auth";
import { getPool } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    await getPool().query("select 1");
    return json({
      ok: true,
      db: true,
      time: new Date().toISOString(),
    });
  } catch (error) {
    return json(
      {
        ok: false,
        db: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}
