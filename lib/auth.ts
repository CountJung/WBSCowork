import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

export const authProvidersConfigured = Boolean(googleClientId && googleClientSecret);

export const authOptions = {
  providers: authProvidersConfigured
    ? [
        GoogleProvider({
          clientId: googleClientId!,
          clientSecret: googleClientSecret!,
        }),
      ]
    : [],
  session: {
    strategy: "jwt",
  },
} satisfies NextAuthOptions;