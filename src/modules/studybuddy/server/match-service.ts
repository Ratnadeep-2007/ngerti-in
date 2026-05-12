import { db } from "@/db";
import { user } from "@/db/schema";
import { eq, not } from "drizzle-orm";

export async function findStudyBuddies(currentUserId: string, subjectInterest: string) {
  // Simple naive implementation to find other users
  // In a real app, we'd match on a 'interests' or 'subjects' column
  const matches = await db.select({
    id: user.id,
    name: user.name,
    image: user.image
  }).from(user).where(not(eq(user.id, currentUserId))).limit(5);

  return matches;
}
