import mongoose, { Document, Model, Schema } from "mongoose";

export type UserRole = "Director" | "Division Head" | "Risk Analyst" | "Staff";

export interface IUser extends Document {
  email: string;
  password?: string;
  role: UserRole;
  name?: string;
  ssoProvider?: string;
  // MFA fields
  mfaEnabled: boolean;
  mfaSecret?: string;          // TOTP secret (stored encrypted-at-rest via env key)
  mfaBackupCodes?: string[];   // bcrypt-hashed backup codes
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema<IUser> = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: false },
    role: {
      type: String,
      enum: ["Director", "Division Head", "Risk Analyst", "Staff"],
      required: true,
    },
    name: { type: String },
    ssoProvider: { type: String },
    // MFA
    mfaEnabled: { type: Boolean, default: false },
    mfaSecret: { type: String, select: false }, // never returned by default
    mfaBackupCodes: { type: [String], select: false },
  },
  { timestamps: true }
);

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
