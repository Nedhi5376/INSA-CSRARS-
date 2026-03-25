/**
 * POST /api/messages/read — mark all messages in a conversation as read
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Conversation from "@/models/Conversation";
import Message from "@/models/Message";
import { validate, ReadMessagesSchema } from "@/lib/validation";
import { pushToUsers } from "@/lib/msgHub";
import mongoose from "mongoose";

export async function POST(req: NextRequest) {
    const session = await getSession();
    const me = session?.user as { id: string } | undefined;
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const v = validate(ReadMessagesSchema, await req.json());
    if (!v.success) return v.response;

    const { conversationId } = v.data;

    await dbConnect();

    // Security: caller must be a participant
    const conv = await Conversation.findOne({
        _id: conversationId,
        participants: new mongoose.Types.ObjectId(me.id),
    }).lean();
    if (!conv) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    await Message.updateMany(
        {
            conversationId,
            readBy: { $ne: new mongoose.Types.ObjectId(me.id) },
        },
        { $addToSet: { readBy: me.id } }
    );

    // Notify other participants that messages were read
    const others = conv.participants
        .map((p) => String(p))
        .filter((id) => id !== me.id);
    pushToUsers(others, "messages_read", { conversationId, readBy: me.id });

    return NextResponse.json({ success: true });
}
