/**
 * GET /api/messages/stream — per-user SSE stream for real-time messaging.
 * Completely isolated from /api/notifications/stream (Feature 2).
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { msgSubscribe, msgUnsubscribe } from "@/lib/msgHub";

export async function GET() {
    const session = await getSession();
    const me = session?.user as { id: string } | undefined;
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let clientId: string;

    const stream = new ReadableStream({
        start(controller) {
            clientId = msgSubscribe(me.id, controller);
            controller.enqueue(`: connected\n\n`);
        },
        cancel() {
            msgUnsubscribe(clientId);
        },
    });

    return new NextResponse(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
        },
    });
}
