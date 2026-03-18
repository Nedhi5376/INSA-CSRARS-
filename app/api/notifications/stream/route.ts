import { NextResponse } from 'next/server';
import { subscribe, unsubscribe } from '@/lib/sseHub';

export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      const id = subscribe(controller);
      // send a comment to establish the connection
      controller.enqueue(`: connected\n\n`);

      // keep the stream alive until the client closes
      // store id on controller for cleanup
      // @ts-ignore
      controller._sseId = id;
    },
    cancel() {
      // nothing to do here; unsubscribe handled below by closed promise
    }
  });

  const response = new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    }
  });

  return response;
}
