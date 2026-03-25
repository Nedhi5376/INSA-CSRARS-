import "next-auth";
import { UserRole } from "@/models/User";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      role: UserRole;
      name?: string;
    };
  }

  interface User {
    id: string;
    email: string;
    role: UserRole;
    name?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
  }
}

