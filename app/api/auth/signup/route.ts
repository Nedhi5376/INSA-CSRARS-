import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import { validate, SignupSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  try {
    const v = validate(SignupSchema, await req.json());
    if (!v.success) return v.response;
    const { email, password, role, name } = v.data;

    await dbConnect();

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
      name: name || "",
    });

    await user.save();

    return NextResponse.json(
      { success: true, message: "User created successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Signup error:", error);
    const message = error instanceof Error ? error.message : "Failed to create user";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
