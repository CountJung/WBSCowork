import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getRuntimeEnv } from "@/lib/env";
import { syncAuthenticatedUserIfPossible } from "@/lib/repositories/user-repository";
import type { UserRole } from "@/models/user";

const runtimeEnv = getRuntimeEnv();
const googleClientId = runtimeEnv.auth.googleClientId;
const googleClientSecret = runtimeEnv.auth.googleClientSecret;
const superuserEmail = runtimeEnv.auth.superuserEmail;

export const authProvidersConfigured = runtimeEnv.auth.googleProviderConfigured;
export const superuserConfigured = runtimeEnv.auth.superuserConfigured;

export function isSuperuserEmail(email?: string | null) {
  return Boolean(email && superuserEmail && email.toLowerCase() === superuserEmail);
}

function getRoleForEmail(email?: string | null): UserRole {
  return isSuperuserEmail(email) ? "admin" : "member";
}

export const authOptions = {
  providers: authProvidersConfigured
    ? [
        GoogleProvider({
          clientId: googleClientId!,
          clientSecret: googleClientSecret!,
        }),
      ]
    : [],
  secret: runtimeEnv.auth.nextAuthSecret,
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user }) {
      await syncAuthenticatedUserIfPossible({
        email: user.email,
        name: user.name,
        role: getRoleForEmail(user.email),
      });

      return true;
    },
    jwt({ token, profile, user }) {
      const email = user?.email ?? token.email ?? (typeof profile?.email === "string" ? profile.email : undefined);

      token.email = email;
      token.role = getRoleForEmail(email);
      token.isSuperuser = isSuperuserEmail(email);

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.email = token.email ?? session.user.email;
        session.user.role = token.role ?? getRoleForEmail(session.user.email);
        session.user.isSuperuser = Boolean(token.isSuperuser);
      }

      return session;
    },
  },
} satisfies NextAuthOptions;

export async function getAuthSession() {
  return getServerSession(authOptions);
}

export function getSignInPath(callbackPath: string) {
  const searchParams = new URLSearchParams({
    callbackUrl: callbackPath,
  });

  return `/api/auth/signin?${searchParams.toString()}`;
}

export async function requireSuperuserSession() {
  const session = await getAuthSession();

  if (!session?.user?.isSuperuser) {
    return null;
  }

  return session;
}