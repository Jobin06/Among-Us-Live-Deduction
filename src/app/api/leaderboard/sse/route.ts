import { NextRequest } from "next/server";
import { LeaderboardService } from "@/services/leaderboard.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/leaderboard/sse
 * Public Server-Sent Events stream for real-time live tournament leaderboard updates.
 * Sends initial state immediately upon connection, then streams sanitized updates on commits.
 */
export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  let isClosed = false;

  const stream = new ReadableStream({
    async start(controller) {
      // 1. Send initial sanitized state
      try {
        const initialData = await LeaderboardService.getLeaderboardData();
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialData)}\n\n`));
      } catch (err) {
        console.error("Failed to send initial SSE leaderboard payload:", err);
      }

      // 2. Listener for real-time post-commit updates
      const onUpdate = async () => {
        if (isClosed) return;
        try {
          const freshData = await LeaderboardService.getLeaderboardData();
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(freshData)}\n\n`));
        } catch (err) {
          console.error("Error streaming SSE leaderboard update:", err);
        }
      };

      LeaderboardService.onUpdate(onUpdate);

      // 3. Heartbeat / keepalive comment every 15 seconds
      const heartbeatInterval = setInterval(() => {
        if (isClosed) {
          clearInterval(heartbeatInterval);
          return;
        }
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 15000);

      // 4. Cleanup when client disconnects or request aborts
      const cleanup = () => {
        if (isClosed) return;
        isClosed = true;
        clearInterval(heartbeatInterval);
        LeaderboardService.offUpdate(onUpdate);
        try {
          controller.close();
        } catch {
          // Stream might already be closed
        }
      };

      req.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      isClosed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
