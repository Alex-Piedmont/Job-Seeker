import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import { isAdminEmail } from "@/lib/admin";
import type { Role } from "@/generated/prisma/enums";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user, trigger }) {
      // On initial sign-in, persist user id and role into token
      if (user) {
        token.id = user.id;

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
        }
      }

      // Refresh role from DB periodically (on session update trigger)
      if (trigger === "update" && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true },
        });
        if (dbUser) token.role = dbUser.role;
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
        await prisma.user.update({
          where: { id: user.id },
          data: { lastActiveAt: new Date() },
        });
      }
    },
  },
});
