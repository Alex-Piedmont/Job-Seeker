import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import { isAdminEmail } from "@/lib/admin";
import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/generated/prisma/enums";

const devProviders: NextAuthConfig["providers"] = [];

if (process.env.NODE_ENV !== "production") {
  const adminEmail =
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean)[0] || "dev@localhost";

  devProviders.push(
    Credentials({
      id: "dev-login",
      name: "Dev Login",
      credentials: {},
      async authorize() {
        try {
          const user = await prisma.user.upsert({
            where: { email: adminEmail },
            update: { role: "ADMIN" },
            create: { email: adminEmail, name: "Dev Admin", role: "ADMIN" },
          });
          return { id: user.id, email: user.email, name: user.name };
        } catch {
          // If DB is unavailable, return a stub user for local dev
          return {
            id: "dev-admin-local",
            email: adminEmail,
            name: "Dev Admin",
          };
        }
      },
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [...authConfig.providers, ...devProviders],
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user, trigger }) {
      // On initial sign-in, persist user id and role into token
      if (user) {
        token.id = user.id;

        try {
          // Look up or assign role
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { role: true },
          });

          if (dbUser) {
            // Auto-promote admin emails on first sign-in
            if (dbUser.role === "USER" && isAdminEmail(user.email)) {
              await prisma.user.update({
                where: { id: user.id },
                data: { role: "ADMIN" },
              });
              token.role = "ADMIN" as Role;
            } else {
              token.role = dbUser.role;
            }
          } else if (
            process.env.NODE_ENV !== "production" &&
            isAdminEmail(user.email)
          ) {
            token.role = "ADMIN" as Role;
          }
        } catch {
          // DB unavailable in dev — default to admin for dev-login
          if (process.env.NODE_ENV !== "production") {
            token.role = "ADMIN" as Role;
          }
        }
      }

      // Refresh role from DB periodically (on session update trigger)
      if (trigger === "update" && token.id) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { role: true },
          });
          if (dbUser) token.role = dbUser.role;
        } catch {
          // DB unavailable — keep existing token role
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      // Update lastActiveAt on sign-in
      if (user.id) {
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { lastActiveAt: new Date() },
          });
        } catch {
          // DB unavailable in dev — skip activity tracking
        }
      }
    },
  },
});
