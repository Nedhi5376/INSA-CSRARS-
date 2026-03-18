type SSEClient = {
  id: string;
  controller: ReadableStreamDefaultController<string> | ReadableStreamDefaultController<any>;
};

const clients: SSEClient[] = [];

export function subscribe(controller: ReadableStreamDefaultController) {
  const id = String(Math.random()).slice(2);
  clients.push({ id, controller });
  return id;
}

export function unsubscribe(id: string) {
  const idx = clients.findIndex(c => c.id === id);
  if (idx !== -1) clients.splice(idx, 1);
}

export function broadcastEvent(event: string, data: any) {
  const payload = `event: ${event}\n` + `data: ${JSON.stringify(data)}\n\n`;
  for (const c of clients) {
    try {
      // @ts-ignore
      c.controller.enqueue(payload);
    } catch (err) {
      // swallow per-client errors
    }
  }
}

export function pingAll() {
  for (const c of clients) {
    try {
      // @ts-ignore
      c.controller.enqueue(`: ping\n\n`);
    } catch (err) {}
  }
}
