import mongoose, { Document, Model, Schema } from "mongoose";

export interface IConversation extends Document {
    /** All participant user IDs */
    participants: mongoose.Types.ObjectId[];
    /** Snapshot of the last message text for the list view */
    lastMessage: string;
    /** ID of the user who sent the last message */
    lastSenderId?: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
    {
        participants: [
            { type: Schema.Types.ObjectId, ref: "User", required: true },
        ],
        lastMessage: { type: String, default: "" },
        lastSenderId: { type: Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true }
);

// Fast lookup: "all conversations this user is in"
ConversationSchema.index({ participants: 1, updatedAt: -1 });

const Conversation: Model<IConversation> =
    mongoose.models.Conversation ||
    mongoose.model<IConversation>("Conversation", ConversationSchema);

export default Conversation;
