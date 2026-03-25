/* eslint-disable @typescript-eslint/no-explicit-any */
import { getServerSession } from "next-auth/next";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import bcrypt from "bcryptjs";
import dbConnect from "./mongodb";
import User, { UserRole } from "@/models/User";
import {
  signMfaPendingToken,
  verifyMfaPendingToken,
  MFA_COOKIE,
} from "@/app/api/mfa/verify/route";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        // mfaVerified is a client-side flag set after /mfa-verify succeeds
        mfaVerified: { label: "MFA Verified", type: "text" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        await dbConnect();

        const user = await User.findOne({
          email: credentials.email.toLowerCase(),
        }).select("+mfaSecret +mfaBackupCodes");

        if (!user || !user.password) return null;

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );
        if (!isPasswordValid) return null;

        // ── MFA gate ──────────────────────────────────────────────────────
        if (user.mfaEnabled) {
          // Check for a valid mfa_verified cookie
          const cookieHeader = (req as any)?.headers?.cookie ?? "";
          const mfaVerifiedMatch = cookieHeader.match(
            /mfa_verified=([^;]+)/
          );
          const mfaVerifiedToken = mfaVerifiedMatch?.[1];

          if (!mfaVerifiedToken) {
            // No MFA cookie — set a pending cookie and signal the client
            // We can't set cookies from here directly, so we encode the
            // userId in a special error string that the login page reads.
            // The login page will redirect to /mfa-verify.
            // We throw with a special prefix so the login page can parse it.
            throw new Error(`MFA_REQUIRED:${String(user._id)}`);
          }

          // Verify the mfa_verified cookie
          const verifiedPayload = verifyMfaPendingToken(mfaVerifiedToken);
          if (verifiedPayload !== `verified:${String(user._id)}`) {
            throw new Error("MFA_INVALID");
          }
          // Cookie is valid — fall through to issue session
        }

        return {
          id: String(user._id),
          email: user.email,
          role: user.role,
          name: user.name,
        };
      },
    }),

    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" || account?.provider === "github") {
        await dbConnect();

        const email = user.email?.toLowerCase();
        if (!email) return false;

        let dbUser = await User.findOne({ email });

        if (!dbUser) {
          dbUser = await User.create({
            email,
            name: user.name ?? "",
            role: "Staff" as UserRole,
            ssoProvider: account.provider,
          });
        } else if (!dbUser.ssoProvider) {
          dbUser.ssoProvider = account.provider;
          await dbUser.save();
        }

        (user as any).id = String(dbUser._id);
        (user as any).role = dbUser.role;
      }
      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
    signOut: "/login",
  },

  secret: process.env.NEXTAUTH_SECRET,
};

export async function getSession() {
  return await getServerSession(authOptions);
}

export function requireAuth(roles?: UserRole[]) {
  return async (req: any, res: any, next: any) => {
    const session = await getSession();
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (roles && !roles.includes((session.user as any).role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return next();
  };
}

/** Set the mfa_pending cookie (called from the login page API helper) */
export { signMfaPendingToken, MFA_COOKIE };
