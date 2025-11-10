import { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      async profile(profile) {
        // Check if user already exists
        const existingUser = await db
          .select()
          .from(users)
          .where(eq(users.email, profile.email))
          .limit(1);

        if (existingUser.length > 0) {
          // User exists, update Google info if needed
          if (!existingUser[0].googleId) {
            await db
              .update(users)
              .set({
                googleId: profile.sub,
                name: profile.name,
                image: profile.picture,
              })
              .where(eq(users.id, existingUser[0].id));
          }
          return {
            id: existingUser[0].id,
            email: existingUser[0].email,
            name: existingUser[0].name || profile.name,
            image: existingUser[0].image || profile.picture,
          };
        } else {
          // Create new user
          const newUser = await db
            .insert(users)
            .values({
              email: profile.email,
              googleId: profile.sub,
              name: profile.name,
              image: profile.picture,
            })
            .returning();

          return {
            id: newUser[0].id,
            email: newUser[0].email,
            name: newUser[0].name,
            image: newUser[0].image,
          };
        }
      },
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await db
          .select()
          .from(users)
          .where(eq(users.email, credentials.email as string))
          .limit(1);

        if (user.length === 0) {
          return null;
        }

        // Check if user has a password (OAuth users might not)
        if (!user[0].password) {
          return null;
        }

        const isValidPassword = await bcrypt.compare(
          credentials.password as string,
          user[0].password
        );

        if (!isValidPassword) {
          return null;
        }

        return {
          id: user[0].id,
          email: user[0].email,
          name: user[0].name,
          image: user[0].image,
        };
      },
    }),
  ],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname.startsWith("/login");
      const isOnSignup = nextUrl.pathname.startsWith("/signup");
      const isOnShare = nextUrl.pathname.startsWith("/share");

      if (isOnShare) {
        return true;
      }

      if (isOnLogin || isOnSignup) {
        if (isLoggedIn) return Response.redirect(new URL("/editor", nextUrl));
        return true;
      }

      if (isLoggedIn) return true;
      return false;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
} satisfies NextAuthConfig;
