import { NextResponse } from "next/server";
import { verifyInternalSecret } from "@/lib/firebase-admin/verify-internal-secret";

// POST /api/cache/warm
// Internal endpoint — only callable with the correct x-internal-secret header.
export async function POST(request: Request) {
  if (request.headers.get("authorization")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authError = verifyInternalSecret(request);
  if (authError) return authError;

  try {
    const body = await request.json().catch(() => ({}));
    const tasks: unknown[] = Array.isArray((body as Record<string, unknown>).tasks)
      ? (body as Record<string, unknown>).tasks as unknown[]
      : [];

    // Process each task independently — one failure must not abort the rest
    let tasksProcessed = 0;
    let tasksFailed = 0;
    const taskResults: { index: number; status: string; error?: string }[] = [];

    for (let i = 0; i < tasks.length; i++) {
      try {
        // Future warming logic per task would go here.
        // Currently a no-op that validates the task shape.
        const task = tasks[i] as Record<string, unknown>;
        if (!task || typeof task !== 'object') {
          throw new Error('Invalid task shape');
        }
        tasksProcessed++;
        taskResults.push({ index: i, status: 'ok' });
      } catch (taskErr) {
        tasksFailed++;
        taskResults.push({
          index: i,
          status: 'failed',
          error: taskErr instanceof Error ? taskErr.message : 'Unknown error',
        });
        console.error(`POST /api/cache/warm task[${i}] failed:`, taskErr);
      }
    }

    // If no tasks provided, treat as a general warm (backwards-compatible)
    if (tasks.length === 0) {
      return NextResponse.json({
        warmed: true,
        warmedAt: new Date().toISOString(),
        tasksProcessed: 0,
        tasksFailed: 0,
      });
    }

    return NextResponse.json({
      warmed: tasksFailed < tasks.length, // true if at least one task succeeded
      warmedAt: new Date().toISOString(),
      tasksProcessed,
      tasksFailed,
      taskResults,
    });
  } catch (error) {
    console.error("POST /api/cache/warm error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
