type SSEClient = {
  id: string;
  controller: ReadableStreamDefaultController<string>;
};

const clients: SSEClient[] = [];

/**
 * Register a new SSE client. Returns the assigned id so the caller can
 * pass it to unsubscribe() when the connection closes.
 */
export function subscribe(
  controller: ReadableStreamDefaultController<string>
): string {
  const id = String(Math.random()).slice(2);
  clients.push({ id, controller });
  return id;
}

/** Remove a client by id — call this in the ReadableStream cancel() callback. */
export function unsubscribe(id: string) {
  const idx = clients.findIndex((c) => c.id === id);
  if (idx !== -1) clients.splice(idx, 1);
}

/** Push an SSE event to every connected client. */
export function broadcastEvent(event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  // Iterate a copy so splice inside unsubscribe doesn't skip entries
  for (const c of [...clients]) {
    try {
      c.controller.enqueue(payload);
    } catch {
      // Client disconnected mid-iteration — clean it up
      unsubscribe(c.id);
    }
  }
}

/** Send a keep-alive comment to all clients to prevent proxy timeouts. */
export function pingAll() {
  for (const c of [...clients]) {
    try {
      c.controller.enqueue(`: ping\n\n`);
    } catch {
      unsubscribe(c.id);
    }
  }
}
