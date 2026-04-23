import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getRuntimeEnv } from "@/lib/env";
import { logError, logInfo, serializeError } from "@/lib/logger";
import { resolveUserRoleForSession, syncAuthenticatedUserIfPossible } from "@/lib/repositories/user-repository";
import { getDefaultUserRole } from "@/models/user";

const runtimeEnv = getRuntimeEnv();
const googleClientId = runtimeEnv.auth.googleClientId;
const googleClientSecret = runtimeEnv.auth.googleClientSecret;

export function isSuperuserEmail(email?: string | null) {
  const superuserEmail = getRuntimeEnv().auth.superuserEmail;

  return Boolean(email && superuserEmail && email.toLowerCase() === superuserEmail);
}

function getRoleForEmail(email?: string | null) {
  return getDefaultUserRole(email, getRuntimeEnv().auth.superuserEmail);
}

function getProfilePicture(profile: unknown) {
  if (!profile || typeof profile !== "object") {
    return null;
  }

  const picture = (profile as { picture?: unknown }).picture;

  return typeof picture === "string" ? picture : null;
}

export const authOptions = {
  providers: runtimeEnv.auth.googleProviderConfigured
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
    async signIn({ user, profile }) {
      try {
        await syncAuthenticatedUserIfPossible({
          email: user.email,
          name: user.name,
          role: getRoleForEmail(user.email),
          googleId: typeof profile?.sub === "string" ? profile.sub : null,
          avatarUrl:
            typeof user.image === "string"
              ? user.image
              : getProfilePicture(profile),
        });

        await logInfo("auth", "Authenticated user sign-in completed", {
          email: user.email ?? null,
          role: getRoleForEmail(user.email),
        });
      } catch (error) {
        await logError("auth", "Authenticated user sign-in failed", {
          email: user.email ?? null,
          error: serializeError(error),
        });

        throw error;
      }

      return true;
    },
    async jwt({ token, profile, user }) {
      const email = user?.email ?? token.email ?? (typeof profile?.email === "string" ? profile.email : undefined);

      token.email = email;
      token.isSuperuser = isSuperuserEmail(email);
      token.role = await resolveUserRoleForSession(email);

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