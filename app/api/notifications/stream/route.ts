import { NextResponse } from "next/server";
import { subscribe, unsubscribe } from "@/lib/sseHub";

export async function GET() {
  let clientId: string;

  const stream = new ReadableStream({
    start(controller) {
      // Register client and keep the id for cleanup
      clientId = subscribe(controller);
      // Establish the connection with an initial comment
      controller.enqueue(`: connected\n\n`);
    },
    cancel() {
      // Called when the browser closes the connection — clean up immediately
      unsubscribe(clientId);
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
