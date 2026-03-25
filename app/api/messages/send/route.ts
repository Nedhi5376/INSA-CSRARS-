/**
 * POST /api/messages/send — send a message to a conversation
 *
 * Rate-limit: max 30 messages per user per minute (in-memory, resets on restart).
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Conversation from "@/models/Conversation";
import Message from "@/models/Message";
import { validate, SendMessageSchema } from "@/lib/validation";
import { pushToUsers } from "@/lib/msgHub";
import mongoose from "mongoose";

// ── Simple in-memory rate limiter ─────────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(userId: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(userId);
    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return false;
    }
    if (entry.count >= RATE_LIMIT) return true;
    entry.count++;
    return false;
}

// ── Sanitize: strip HTML tags to prevent XSS stored in DB ────────────────────
function sanitize(text: string): string {
    return text.replace(/<[^>]*>/g, "").trim();
}

export async function POST(req: NextRequest) {
    const session = await getSession();
    const me = session?.user as { id: string; name?: string | null } | undefined;
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (isRateLimited(me.id)) {
        return NextResponse.json(
            { error: "Too many messages. Please slow down." },
            { status: 429 }
        );
    }

    const v = validate(SendMessageSchema, await req.json());
    if (!v.success) return v.response;

    const { conversationId, text } = v.data;
    const cleanText = sanitize(text);
    if (!cleanText) {
        return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });
    }

    await dbConnect();

    // Security: caller must be a participant
    const conv = await Conversation.findOne({
        _id: conversationId,
        participants: new mongoose.Types.ObjectId(me.id),
    });
    if (!conv) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const msg = await Message.create({
        conversationId,
        senderId: me.id,
        text: cleanText,
        readBy: [me.id], // sender has already "read" their own message
    });

    // Update conversation snapshot
    conv.lastMessage = cleanText.length > 80 ? cleanText.slice(0, 80) + "…" : cleanText;
    conv.lastSenderId = new mongoose.Types.ObjectId(me.id);
    await conv.save();

    // Populate sender for the SSE payload
    await msg.populate("senderId", "name email");

    // Push real-time event to all participants
    const recipientIds = conv.participants
        .map((p) => String(p))
        .filter((id) => id !== me.id);

    const payload = {
        _id: String(msg._id),
        conversationId,
        senderId: msg.senderId,
        text: msg.text,
        readBy: msg.readBy.map(String),
        createdAt: msg.createdAt,
    };

    // Push to recipients (new message)
    pushToUsers(recipientIds, "new_message", payload);
    // Push back to sender too so multi-tab works
    pushToUsers([me.id], "new_message", payload);

    return NextResponse.json({ success: true, message: payload }, { status: 201 });
}
