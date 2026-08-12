import NextAuth from "next-auth";
import { authOptions } from "@/src/entities/user/index.server";

export const runtime = "nodejs";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
