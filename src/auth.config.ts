import { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

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
      // On initial sign-in, user object is provided
      if (user) {
        token.sub = user.id;
        token.email = user.email;
        return token;
      }

      // On subsequent requests, verify the user still exists
      // This handles cases where the user was deleted or JWT has stale data
      if (token.sub && token.email) {
        const dbUser = await db
          .select({ id: users.id, email: users.email, name: users.name, image: users.image })
          .from(users)
          .where(eq(users.id, token.sub))
          .limit(1);

        // If user doesn't exist by ID, try to find by email (handles DB resets)
        if (dbUser.length === 0 && token.email) {
          const userByEmail = await db
            .select({ id: users.id, email: users.email, name: users.name, image: users.image })
            .from(users)
            .where(eq(users.email, token.email as string))
            .limit(1);

          if (userByEmail.length > 0) {
            // Update token with correct user ID
            token.sub = userByEmail[0].id;
            token.name = userByEmail[0].name;
            token.picture = userByEmail[0].image;
          } else {
            // User doesn't exist at all, invalidate token
            throw new Error("User not found in database");
          }
        }
      }

      return token;
    },
  },
} satisfies NextAuthConfig;
