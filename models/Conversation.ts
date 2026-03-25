import mongoose, { Document, Model, Schema } from "mongoose";

export interface IConversation extends Document {
    participants: mongoose.Types.ObjectId[];
    lastMessage: string;
    lastMessageAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
    {
        participants: [
            {
                type: Schema.Types.ObjectId,
                ref: "User",
                required: true,
            },
        ],
        lastMessage: { type: String, default: "" },
        lastMessageAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

// Fast lookup: "all conversations this user is in"
ConversationSchema.index({ participants: 1, lastMessageAt: -1 });

const Conversation: Model<IConversation> =
    mongoose.models.Conversation ||
    mongoose.model<IConversation>("Conversation", ConversationSchema);

export default Conversation;
