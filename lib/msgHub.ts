/**
 * lib/msgHub.ts — Isolated SSE hub for real-time messaging (Feature 3).
 * Does NOT import or modify lib/sseHub.ts.
 */
type MsgClient = {
    clientId: string;
    userId: string;
    controller: ReadableStreamDefaultController<string>;
};

const msgClients: MsgClient[] = [];

export function msgSubscribe(
    userId: string,
    controller: ReadableStreamDefaultController<string>
): string {
    const clientId = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    msgClients.push({ clientId, userId, controller });
    return clientId;
}

export function msgUnsubscribe(clientId: string) {
    const idx = msgClients.findIndex((c) => c.clientId === clientId);
    if (idx !== -1) msgClients.splice(idx, 1);
}

export function pushToUsers(userIds: string[], event: string, data: unknown) {
    if (userIds.length === 0) return;
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const c of [...msgClients]) {
        if (!userIds.includes(c.userId)) continue;
        try {
            c.controller.enqueue(payload);
        } catch {
            msgUnsubscribe(c.clientId);
        }
    }
}
