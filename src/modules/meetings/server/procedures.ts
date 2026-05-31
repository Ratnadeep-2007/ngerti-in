import {
  createTRPCRouter,
  baseProcedure,
  protectedProcedure,
} from "@/trpc/init";
import { db } from "@/db";
import { inngest } from "@/inngest/client";
import { meetings, agents } from "@/db/schema";
// import
//   import { agentsInsertSchema } from "../schemas";
import { z } from "zod";
import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  ilike,
  inArray,
  or,
  sql,
} from "drizzle-orm";
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
} from "@/constant";
import { TRPCError } from "@trpc/server";
import { meetingsInsertSchema, meetingsUpdateSchema } from "../schema";
import { MeetingStatus, StreamTranscriptItem } from "../types";
import { streamVideo } from "@/lib/stream-video";
import { generatedAvatarUri } from "@/lib/avatar";
import { languages } from "humanize-duration";
import JSONL from "jsonl-parse-stringify";
import { user } from "@/db/schema";
import { streamChat } from "@/lib/stream-chat";
import { generateNvidiaResponse } from "@/lib/nvidia";

export const meetingsRouter = createTRPCRouter({
  generateChatToken: protectedProcedure.mutation(async ({ ctx }) => {
    const token = streamChat.createToken(ctx.userId.user.id);
    console.log(token);
    await streamChat.upsertUser({
      id: ctx.userId.user.id,
      role: "admin",
    });
    return token;
  }),
  generateToken: protectedProcedure.mutation(async ({ ctx }) => {
    await streamVideo.upsertUsers([
      {
        id: ctx.userId.user.id,
        name: ctx.userId.user.name,
        role: "admin",
        image:
          ctx.userId.user.image ??
          generatedAvatarUri({ seed: ctx.userId.user.id, variant: "initials" }),
      },
    ]);

    const expirationTime = Math.floor(Date.now() / 1000) + 3600;
    const issuedAt = Math.floor(Date.now() / 1000) - 60;
    const token = streamVideo.generateUserToken({
      user_id: ctx.userId.user.id,
      validity_in_seconds: issuedAt,
      exp: expirationTime,
    });
    return token;
  }),

  generateAgentToken: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .mutation(async ({ input }) => {
      const expirationTime = Math.floor(Date.now() / 1000) + 3600;
      const issuedAt = Math.floor(Date.now() / 1000) - 60;
      const token = streamVideo.generateUserToken({
        user_id: input.agentId,
        validity_in_seconds: issuedAt,
        exp: expirationTime,
      });
      return token;
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...updateData } = input;
      const [removedMeeing] = await db
        .delete(meetings)
        .where(
          and(eq(meetings.id, id), eq(meetings.userId, ctx.userId.user.id)),
        )
        .returning();

      if (!removedMeeing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Meeting not found",
        });
      }

      return removedMeeing;
    }),

  update: protectedProcedure
    .input(meetingsUpdateSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, ...updateData } = input;

      const [existingMeeting] = await db
        .select()
        .from(meetings)
        .where(eq(meetings.id, id));

      if (!existingMeeting) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Meeting not found",
        });
      }

      const isOwner = existingMeeting.userId === ctx.userId.user.id;
      const isPublicActive =
        existingMeeting.isPublic && existingMeeting.status === "active";

      if (!isOwner && !isPublicActive) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You are not authorized to update this meeting",
        });
      }

      // ✅ Security: If not owner, ONLY allow updating currentPrompt
      const finalUpdateData = isOwner
        ? updateData
        : { currentPrompt: updateData.currentPrompt };

      console.log("finalUpdateData", finalUpdateData);

      if (Object.keys(finalUpdateData).length === 0 || Object.values(finalUpdateData).every(v => v === undefined)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No valid fields provided for update",
        });
      }

      const [updatedMeeting] = await db
        .update(meetings)
        .set(finalUpdateData)
        .where(eq(meetings.id, id))
        .returning();

      return updatedMeeting;
    }),

  create: protectedProcedure
    .input(meetingsInsertSchema)
    .mutation(async ({ input, ctx }) => {
      // 1. Parallelize Database Calls
      const [
        [createdMeeting],
        [existingAgent]
      ] = await Promise.all([
        db
          .insert(meetings)
          .values({
            ...input,
            userId: ctx.userId.user.id,
          })
          .returning(),
        db
          .select()
          .from(agents)
          .where(eq(agents.id, input.agentId))
      ]);

      if (!existingAgent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent not found",
        });
      }

      // 2. Parallelize Stream API Calls
      const call = streamVideo.video.call("default", createdMeeting.id);
      
      await Promise.all([
        call.create({
          data: {
            created_by_id: ctx.userId.user.id,
            custom: {
              meetingId: createdMeeting.id,
              meetingName: createdMeeting.name,
            },
            settings_override: {
              transcription: {
                language: "en",
                mode: "auto-on",
                closed_caption_mode: "auto-on",
              },
              recording: {
                mode: "auto-on",
                quality: "1080p",
              },
            },
          },
        }),
        streamVideo.upsertUsers([
          {
            id: existingAgent.id,
            name: existingAgent.name,
            role: "user",
            image: generatedAvatarUri({
              seed: existingAgent.name,
              variant: "botttsNeutral",
            }),
          },
        ])
      ]);

      return createdMeeting;
    }),

  getOne: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const [existingMeeting] = await db
        .select({
          ...getTableColumns(meetings),
          agent: agents,
          duration: sql<number>`EXTRACT(EPOCH FROM (ended_at - started_at))`.as(
            "duration",
          ),
        })
        .from(meetings)
        .innerJoin(agents, eq(meetings.agentId, agents.id))
        .where(
          and(
            eq(meetings.id, input.id),
            or(
              eq(meetings.userId, ctx.userId.user.id),
              eq(meetings.isPublic, true),
            ),
          ),
        );

      if (!existingMeeting) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Meeting not found" });
      }

      let finalRecordingUrl = existingMeeting.recordingUrl;
      let finalTranscriptUrl = existingMeeting.transcriptUrl;
      let finalStatus = existingMeeting.status;

      if (!finalRecordingUrl || !finalTranscriptUrl) {
        try {
          const [recordingsRes, transcriptionsRes] = await Promise.all([
            !finalRecordingUrl
              ? streamVideo.video.listRecordings({ type: "default", id: input.id })
              : null,
            !finalTranscriptUrl
              ? streamVideo.video.listTranscriptions({ type: "default", id: input.id })
              : null,
          ]);

          if (recordingsRes?.recordings && recordingsRes.recordings.length > 0) {
            finalRecordingUrl = recordingsRes.recordings[0].url;
          }

          if (transcriptionsRes?.transcriptions && transcriptionsRes.transcriptions.length > 0) {
            finalTranscriptUrl = transcriptionsRes.transcriptions[0].url;
          }

          if (finalRecordingUrl || finalTranscriptUrl) {
            finalStatus = "completed";
          }

          if (
            finalRecordingUrl !== existingMeeting.recordingUrl ||
            finalTranscriptUrl !== existingMeeting.transcriptUrl ||
            finalStatus !== existingMeeting.status
          ) {
            const updateData: any = {};
            if (finalRecordingUrl) updateData.recordingUrl = finalRecordingUrl;
            if (finalTranscriptUrl) updateData.transcriptUrl = finalTranscriptUrl;
            if (finalStatus) updateData.status = finalStatus;
            
            // If meeting has ended but endedAt is not set, set it now
            const endedAtValue = existingMeeting.endedAt || new Date();
            updateData.endedAt = endedAtValue;

            await db
              .update(meetings)
              .set(updateData)
              .where(eq(meetings.id, input.id));

            // Trigger Inngest processing if we just found the transcript and meeting wasn't processed yet
            if (finalTranscriptUrl && existingMeeting.status !== "completed") {
              await inngest.send({
                name: "meetings/processing",
                data: {
                  meeting_id: input.id,
                  transcript_url: finalTranscriptUrl,
                },
              });
            }
            
            return {
              ...existingMeeting,
              recordingUrl: finalRecordingUrl,
              transcriptUrl: finalTranscriptUrl,
              status: finalStatus as any,
              endedAt: endedAtValue,
            };
          }
        } catch (e) {
          console.error("Failed to query recordings/transcriptions from Stream:", e);
        }
      }

      return existingMeeting;
    }),

  getMany: protectedProcedure
    .input(
      z.object({
        page: z.number().default(DEFAULT_PAGE),
        pageSize: z
          .number()
          .min(MIN_PAGE_SIZE)
          .max(MAX_PAGE_SIZE)
          .default(DEFAULT_PAGE_SIZE),
        search: z.string().nullish(),
        agentId: z.string().nullish(),
        status: z
          .enum([
            MeetingStatus.Upcoming,
            MeetingStatus.Active,
            MeetingStatus.Completed,
            MeetingStatus.Processing,
            MeetingStatus.Cancelled,
          ])
          .nullish(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { search, page, pageSize, status, agentId } = input;

      const data = await db
        .select({
          ...getTableColumns(meetings),
          agent: agents,
          duration: sql<number>`EXTRACT(EPOCH FROM (ended_at - started_at))`.as(
            "duration",
          ),
        })
        .from(meetings)
        .innerJoin(agents, eq(meetings.agentId, agents.id))
        .where(
          and(
            eq(meetings.userId, ctx.userId.user.id),
            search ? ilike(meetings.name, `%${search}%`) : undefined,
            status ? eq(meetings.status, status) : undefined,
            agentId ? eq(meetings.agentId, agentId) : undefined,
          ),
        )
        .orderBy(desc(meetings.createdAt), desc(meetings.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      const [total] = await db
        .select({ count: count() })
        .from(meetings)
        .where(
          and(
            eq(meetings.userId, ctx.userId.user.id),
            search ? ilike(meetings.name, `%${search}%`) : undefined,
          ),
        );

      const totalPages = Math.ceil(total.count / pageSize);

      return { items: data, total: total.count, totalPages };
    }),

  getTranscript: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const [existingMeeting] = await db
        .select()
        .from(meetings)
        .where(
          and(
            eq(meetings.id, input.id),
            eq(meetings.userId, ctx.userId.user.id),
          ),
        );

      if (!existingMeeting) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Meeting not found",
        });
      }

      let transcriptUrl = existingMeeting.transcriptUrl;

      if (!transcriptUrl) {
        try {
          const res = await streamVideo.video.listTranscriptions({ type: "default", id: input.id });
          if (res.transcriptions && res.transcriptions.length > 0) {
            transcriptUrl = res.transcriptions[0].url;
            await db
              .update(meetings)
              .set({ transcriptUrl })
              .where(eq(meetings.id, input.id));
          }
        } catch (e) {
          console.error("Failed to query transcriptions from Stream in getTranscript:", e);
        }
      }

      if (!transcriptUrl) {
        return [];
      }

      // If you store the transcript as a URL and want to fetch its content:

      const transcript = await fetch(transcriptUrl)
        .then((res) => res.text())
        .then((text) => JSONL.parse<StreamTranscriptItem>(text))
        .catch(() => {
          return [];
        });

      const speakerIds = [
        ...new Set(transcript.map((item) => item.speaker_id)),
      ];

      const userSpeakers = await db
        .select()
        .from(user)
        .where(inArray(user.id, speakerIds))
        .then((users) =>
          users.map((user) => ({
            ...user,
            image:
              user.image ??
              generatedAvatarUri({ seed: user.name, variant: "initials" }),
          })),
        );
      const agentSpeaker = await db
        .select()
        .from(agents)
        .where(inArray(agents.id, speakerIds))
        .then((agents) =>
          agents.map((agent) => ({
            ...agent,
            image: generatedAvatarUri({
              seed: agent.name,
              variant: "botttsNeutral",
            }),
          })),
        );

      const speakers = [...userSpeakers, ...agentSpeaker];
      const transcriptWithSpeakers = transcript.map((item) => {
        const speaker = speakers.find(
          (speaker) => speaker.id === item.speaker_id,
        );
        if (!speaker) {
          return {
            ...item,
            user: {
              name: "Unknown",
              image: generatedAvatarUri({
                seed: "Unknown",
                variant: "initials",
              }),
            },
          };
        }
        return {
          ...item,
          user: {
            name: speaker.name,
            image: speaker.image,
          },
        };
      });
      return transcriptWithSpeakers;
    }),

  getHours: protectedProcedure.query(async ({ input, ctx }) => {
    const meetingArr = await db
      .select()
      .from(meetings)
      .where(eq(meetings.userId, ctx.userId.user.id)); // Fix: changed from meetings.id to meetings.userId

    if (meetingArr.length === 0) {
      return "0.00";
    }

    let totalHours = 0;

    for (const { startedAt, endedAt } of meetingArr) {
      if (!endedAt || !startedAt) {
        totalHours += 0;
        continue;
      }

      const diffMs = endedAt.getTime() - startedAt.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      totalHours += diffHours;
    }

    return totalHours.toFixed(2);
  }),

  getLatestMeeting: protectedProcedure.query(async ({ input, ctx }) => {
    const [latestMeeting] = await db
      .select({
        ...getTableColumns(meetings),
        agent: agents,
        duration: sql<number>`EXTRACT(EPOCH FROM (ended_at - started_at))`.as(
          "duration",
        ),
      })
      .from(meetings)
      .innerJoin(agents, eq(meetings.agentId, agents.id))
      .where(eq(meetings.userId, ctx.userId.user.id))
      .orderBy(desc(meetings.createdAt), desc(meetings.id))
      .limit(1);

    return latestMeeting || null;
  }),

  getKnowledgeMap: protectedProcedure.query(async ({ ctx }) => {
    const allMeetings = await db
      .select({
        id: meetings.id,
        name: meetings.name,
        topics: meetings.topics,
      })
      .from(meetings)
      .where(
        and(
          eq(meetings.userId, ctx.userId.user.id),
          eq(meetings.status, "completed"),
        ),
      );

    const nodes: any[] = [];
    const links: any[] = [];
    const topicToMeetings: Record<string, string[]> = {};

    allMeetings.forEach((meeting) => {
      if (!meeting.topics) return;
      let topics: string[] = [];
      try {
        topics = JSON.parse(meeting.topics);
      } catch (e) {
        return;
      }

      topics.forEach((topic) => {
        if (!topicToMeetings[topic]) {
          topicToMeetings[topic] = [];
          nodes.push({ id: topic, group: 1, val: 1 });
        } else {
          // Increase node size if topic appears multiple times
          const node = nodes.find((n) => n.id === topic);
          if (node) node.val += 1;
        }
        topicToMeetings[topic].push(meeting.id);
      });
    });

    // Create links between topics that appear in the same meeting
    const topicList = Object.keys(topicToMeetings);
    for (let i = 0; i < topicList.length; i++) {
      for (let j = i + 1; j < topicList.length; j++) {
        const t1 = topicList[i];
        const t2 = topicList[j];

        const sharedMeetings = topicToMeetings[t1].filter((m) =>
          topicToMeetings[t2].includes(m),
        );
        if (sharedMeetings.length > 0) {
          links.push({
            source: t1,
            target: t2,
            value: sharedMeetings.length,
          });
        }
      }
    }

    return { nodes, links };
  }),

  getDiscoverableMeetings: protectedProcedure.query(async ({ ctx }) => {
    const discoverable = await db
      .select({
        ...getTableColumns(meetings),
        agent: agents,
        creator: user,
      })
      .from(meetings)
      .innerJoin(agents, eq(meetings.agentId, agents.id))
      .innerJoin(user, eq(meetings.userId, user.id))
      .where(
        and(
          eq(meetings.status, "active"),
          eq(meetings.isPublic, true),
          sql`${meetings.userId} != ${ctx.userId.user.id}`,
        ),
      )
      .orderBy(desc(meetings.createdAt))
      .limit(5);

    return discoverable;
  }),

  talkToAgent: protectedProcedure
    .input(
      z.object({
        meetingId: z.string(),
        text: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { meetingId, text } = input;

      const [existingMeeting] = await db
        .select({
          ...getTableColumns(meetings),
          agent: agents,
        })
        .from(meetings)
        .innerJoin(agents, eq(meetings.agentId, agents.id))
        .where(
          and(
            eq(meetings.id, meetingId),
            or(
              eq(meetings.userId, ctx.userId.user.id),
              eq(meetings.isPublic, true),
            ),
          ),
        );

      if (!existingMeeting) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Meeting not found",
        });
      }

      const agentData = existingMeeting.agent;

      const channel = streamChat.channel("messaging", meetingId, {
        created_by_id: ctx.userId.user.id,
      });
      await channel.create();
      
      const messages = await channel.query({ messages: { limit: 10 } });
      const history = (messages.messages || [])
        .filter((msg) => msg.text && msg.text.trim() !== "")
        .map((message) => ({
          role: message.user?.id === agentData.id ? "model" : "user",
          parts: [{ text: message.text || "" }],
        }));

      const systemInstruction = `
        You are an AI Tutor named ${agentData.name}.
        Your subject is ${agentData.subject}.
        Your system instructions/persona are:
        ${agentData.prompt}
        
        Current Meeting Context:
        ${existingMeeting.currentPrompt || "No additional context."}
        
        Currently you are in a live virtual meeting call with one or more students.
        Explain concepts step-by-step, be helpful, concise, and encourage interactive learning.
        You are responding to a student's voice/text question. Keep your answers brief and readable, as they will be spoken out loud via text-to-speech.
      `.trim();

      const formattedMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
        { role: "system", content: systemInstruction },
        ...history.map((h) => ({
          role: h.role === "model" ? ("assistant" as const) : ("user" as const),
          content: h.parts[0].text,
        })),
        { role: "user" as const, content: text },
      ];

      const aiResponse = await generateNvidiaResponse(formattedMessages);

      if (!aiResponse) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "No response from NVIDIA NIM",
        });
      }

      const avatarUrl = generatedAvatarUri({
        seed: agentData.name,
        variant: "botttsNeutral",
      });

      // Run Stream Chat sync in the background to avoid blocking the voice response (saves ~400-800ms latency)
      const fakeMessageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      streamChat.upsertUser({
        id: agentData.id,
        name: agentData.name,
        image: avatarUrl,
        role: "user",
      })
      .then(() => channel.addMembers([agentData.id]))
      .then(() => channel.sendMessage({
        text: aiResponse,
        user: {
          id: agentData.id,
          name: agentData.name,
          image: avatarUrl,
        },
      }))
      .catch((chatError) => {
        console.error("Failed to sync message to Stream Chat in background:", chatError);
      });

      return {
        text: aiResponse,
        messageId: fakeMessageId,
      };
    }),

  askPostMeetingAI: protectedProcedure
    .input(
      z.object({
        meetingId: z.string(),
        messages: z.array(
          z.object({
            role: z.enum(["user", "assistant"]),
            content: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { meetingId, messages } = input;

      const [existingMeeting] = await db
        .select({
          ...getTableColumns(meetings),
          agent: agents,
        })
        .from(meetings)
        .innerJoin(agents, eq(meetings.agentId, agents.id))
        .where(
          and(
            eq(meetings.id, meetingId),
            or(
              eq(meetings.userId, ctx.userId.user.id),
              eq(meetings.isPublic, true),
            ),
          ),
        );

      if (!existingMeeting) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Meeting not found",
        });
      }

      const agentData = existingMeeting.agent;

      // Fetch meeting transcript from transcriptUrl if it exists
      let transcriptText = "";
      if (existingMeeting.transcriptUrl) {
        try {
          const transcriptData = await fetch(existingMeeting.transcriptUrl)
            .then((res) => res.text())
            .then((text) => JSONL.parse<StreamTranscriptItem>(text))
            .catch(() => []);

          if (transcriptData.length > 0) {
            transcriptText = transcriptData
              .map((item) => `${item.speaker_id}: ${item.text}`)
              .join("\n");
          }
        } catch (e) {
          console.error("Failed to parse transcript for post-meeting AI:", e);
        }
      }

      const systemInstruction = `
        You are ${agentData.name}, an AI Tutor specializing in ${agentData.subject}.
        Your system instructions/persona are:
        ${agentData.prompt}
        
        This meeting has ended. You are now assisting the student post-meeting, answering questions they have about the session, the transcript, or any follow-up questions they have about the subject matter.
        
        Here is the info about the meeting:
        - Meeting Name: ${existingMeeting.name}
        - Meeting Summary: ${existingMeeting.summary || "No summary available."}
        - Meeting Transcript:
        ${transcriptText ? transcriptText : "No transcript available. (Either the call was empty, or transcript is processing)"}
        
        Answer the user's questions clearly, accurately, and in accordance with your tutor persona. Use markdown formatting where appropriate.
      `.trim();

      const formattedMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
        { role: "system", content: systemInstruction },
        ...messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      ];

      const aiResponse = await generateNvidiaResponse(formattedMessages);

      if (!aiResponse) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "No response from NVIDIA NIM",
        });
      }

      return {
        text: aiResponse,
      };
    }),
});
