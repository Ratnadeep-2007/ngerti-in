import { db } from "./src/db";
import { meetings } from "./src/db/schema";
import { eq } from "drizzle-orm";

async function getIds() {
  const [meeting] = await db.select().from(meetings).where(eq(meetings.id, "XjV2Pjs-rUMYmH_ozBEoI")).limit(1);
  console.log(JSON.stringify(meeting, null, 2));
}

getIds();
