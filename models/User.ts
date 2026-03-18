import mongoose, { Document, Model, Schema } from "mongoose";

export type UserRole = "Director" | "Division Head" | "Risk Analyst" | "Staff";

export interface IUser extends Document {
  email: string;
  password: string;
  role: UserRole;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
}
const UserSchema: Schema<IUser> = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["Director",
        "Division Head",
        "Risk Analyst",
        "Staff"],
      required: true,
    },
    name: { type: String },
  },
  {
    timestamps: true,
  }
);
const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;

