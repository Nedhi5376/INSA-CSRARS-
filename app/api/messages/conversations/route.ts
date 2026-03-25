/**
 * POST /api/messages/conversations — create a new conversation
 * GET  /api/messages/conversations — list conversations for the current user
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Conversation from "@/models/Conversation";
import Message from "@/models/Message";
import User from "@/models/User";
import { validate, CreateConversationSchema } from "@/lib/validation";
import mongoose from "mongoose";

function sessionUser(session: Awaited<ReturnType<typeof getSession>>) {
    return session?.user as { id: string; name?: string | null; email?: string | null } | undefined;
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET() {
    const session = await getSession();
    const me = sessionUser(session);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await dbConnect();

    const conversations = await Conversation.find({ participants: me.id })
        .sort({ updatedAt: -1 })
        .populate("participants", "name email")
        .lean();

    // Attach unread count per conversation
    const withUnread = await Promise.all(
        conversations.map(async (conv) => {
            const unread = await Message.countDocuments({
                conversationId: conv._id,
                readBy: { $ne: new mongoose.Types.ObjectId(me.id) },
                senderId: { $ne: new mongoose.Types.ObjectId(me.id) },
            });
            return { ...conv, _id: String(conv._id), unread };
        })
    );

    return NextResponse.json({ success: true, conversations: withUnread });
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    const session = await getSession();
    const me = sessionUser(session);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const v = validate(CreateConversationSchema, await req.json());
    if (!v.success) return v.response;

    const { participantIds } = v.data;

    // Deduplicate and include the caller
    const allIds = Array.from(new Set([me.id, ...participantIds]));

    await dbConnect();

    // Verify all participants exist
    const users = await User.find({ _id: { $in: allIds } }).select("_id").lean();
    if (users.length !== allIds.length) {
        return NextResponse.json({ error: "One or more users not found" }, { status: 400 });
    }

    // For 1-to-1: reuse existing conversation if one already exists
    if (allIds.length === 2) {
        const existing = await Conversation.findOne({
            participants: { $all: allIds, $size: 2 },
        }).populate("participants", "name email").lean();

        if (existing) {
            return NextResponse.json({
                success: true,
                conversation: { ...existing, _id: String(existing._id) },
            });
        }
    }

    const conv = await Conversation.create({ participants: allIds, lastMessage: "" });
    const populated = await conv.populate("participants", "name email");

    return NextResponse.json(
        { success: true, conversation: { ...populated.toObject(), _id: String(conv._id) } },
        { status: 201 }
    );
}
