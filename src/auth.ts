import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { isAllowedEmail } from "@/lib/auth-domain";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  // Our own sign-in page: it states the domain requirement before the user
  // picks an account, and avoids the default page's externally-hosted logo,
  // which our CSP blocks. `error` points here too so a rejected sign-in lands
  // somewhere that can explain itself.
  pages: {
    signIn: "/signin",
    error: "/signin",
  },
  callbacks: {
    async signIn({ user }) {
      // Rule lives in one place, shared with the sign-in page's copy, so the
      // UI can't promise something this check rejects. See Known Gotchas #4
      // for why this is not a substring match.
      return isAllowedEmail(user.email);
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
});
