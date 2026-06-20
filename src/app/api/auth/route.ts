import { NextResponse } from "next/server";
import { store } from "@/lib/server-store";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, email, username } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (action === "signup") {
      if (!username) {
        return NextResponse.json({ error: "Username is required" }, { status: 400 });
      }

      if (db) {
        // Check if user already exists in Postgres
        const existing = await db.select().from(users).where(eq(users.email, email));
        if (existing.length > 0) {
          return NextResponse.json({ error: "Email already registered" }, { status: 400 });
        }

        // Insert new user
        const newUser = {
          email,
          username,
          createdAt: new Date().toISOString(),
        };
        await db.insert(users).values(newUser);
        return NextResponse.json({ success: true, user: newUser });
      }

      // Fallback in-memory
      const existing = store.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (existing) {
        return NextResponse.json({ error: "Email already registered" }, { status: 400 });
      }

      const newUser = {
        email,
        username,
        createdAt: new Date().toISOString(),
      };
      store.users.push(newUser);
      return NextResponse.json({ success: true, user: newUser });
    }

    if (action === "login") {
      if (db) {
        // Find user in Postgres database
        const list = await db.select().from(users).where(eq(users.email, email));
        if (list.length === 0) {
          return NextResponse.json({ error: "Email not registered" }, { status: 404 });
        }
        return NextResponse.json({ success: true, user: list[0] });
      }

      // Fallback in-memory
      const found = store.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (!found) {
        return NextResponse.json({ error: "Email not registered" }, { status: 404 });
      }
      return NextResponse.json({ success: true, user: found });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
