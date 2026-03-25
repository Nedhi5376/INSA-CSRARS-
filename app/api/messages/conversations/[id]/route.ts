/**
 * GET /api/messages/conversations/[id] — fetch messages in a conversation
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Conversation from "@/models/Conversation";
import Message from "@/models/Message";
import mongoose from "mongoose";

export async function GET(
    _req: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getSession();
    const me = session?.user as { id: string } | undefined;
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!/^[a-f\d]{24}$/i.test(params.id)) {
        return NextResponse.json({ error: "Invalid conversation ID" }, { status: 400 });
    }

    await dbConnect();

    // Security: caller must be a participant
    const conv = await Conversation.findOne({
        _id: params.id,
        participants: new mongoose.Types.ObjectId(me.id),
    }).lean();

    if (!conv) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const messages = await Message.find({ conversationId: params.id })
        .sort({ createdAt: 1 })
        .populate("senderId", "name email")
        .lean();

    return NextResponse.json({
        success: true,
        messages: messages.map((m) => ({ ...m, _id: String(m._id) })),
    });
}
