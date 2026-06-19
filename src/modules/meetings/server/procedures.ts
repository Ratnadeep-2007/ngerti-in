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
import { getGeminiModel } from "@/lib/gemini";

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

      if (
        Object.keys(finalUpdateData).length === 0 ||
        Object.values(finalUpdateData).every((v) => v === undefined)
      ) {
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
      const [[createdMeeting], [existingAgent]] = await Promise.all([
        db
          .insert(meetings)
          .values({
            ...input,
            userId: ctx.userId.user.id,
          })
          .returning(),
        db.select().from(agents).where(eq(agents.id, input.agentId)),
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
        ]),
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
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Meeting not found",
        });
      }

      let finalRecordingUrl = existingMeeting.recordingUrl;
      let finalTranscriptUrl = existingMeeting.transcriptUrl;
      let finalStatus = existingMeeting.status;

      if (!finalRecordingUrl || !finalTranscriptUrl) {
        try {
          const [recordingsRes, transcriptionsRes] = await Promise.all([
            !finalRecordingUrl
              ? streamVideo.video.listRecordings({
                  type: "default",
                  id: input.id,
                })
              : null,
            !finalTranscriptUrl
              ? streamVideo.video.listTranscriptions({
                  type: "default",
                  id: input.id,
                })
              : null,
          ]);

          if (
            recordingsRes?.recordings &&
            recordingsRes.recordings.length > 0
          ) {
            finalRecordingUrl = recordingsRes.recordings[0].url;
          }

          if (
            transcriptionsRes?.transcriptions &&
            transcriptionsRes.transcriptions.length > 0
          ) {
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
            if (finalTranscriptUrl)
              updateData.transcriptUrl = finalTranscriptUrl;
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
          console.error(
            "Failed to query recordings/transcriptions from Stream:",
            e,
          );
        }
      } else if (
        existingMeeting.status === "processing" &&
        finalTranscriptUrl
      ) {
        // Fallback: If the meeting is stuck in 'processing' but we already have the transcript url,
        // trigger Inngest processing again.
        try {
          await inngest.send({
            name: "meetings/processing",
            data: {
              meeting_id: input.id,
              transcript_url: finalTranscriptUrl,
            },
          });
        } catch (e) {
          console.error("Failed to re-trigger Inngest processing:", e);
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
          const res = await streamVideo.video.listTranscriptions({
            type: "default",
            id: input.id,
          });
          if (res.transcriptions && res.transcriptions.length > 0) {
            transcriptUrl = res.transcriptions[0].url;
            await db
              .update(meetings)
              .set({ transcriptUrl })
              .where(eq(meetings.id, input.id));
          }
        } catch (e) {
          console.error(
            "Failed to query transcriptions from Stream in getTranscript:",
            e,
          );
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
    const [aggregate] = await db
      .select({
        totalHours: sql<string>`
          COALESCE(
            ROUND(
              SUM(
                CASE
                  WHEN ${meetings.startedAt} IS NOT NULL AND ${meetings.endedAt} IS NOT NULL
                  THEN EXTRACT(EPOCH FROM (${meetings.endedAt} - ${meetings.startedAt})) / 3600.0
                  ELSE 0
                END
              )::numeric,
              2
            ),
            0
          )::text
        `,
      })
      .from(meetings)
      .where(eq(meetings.userId, ctx.userId.user.id));

    return aggregate?.totalHours ?? "0.00";
  }),

  getDashboardStats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.userId.user.id;

    const [meetingRows, tutorRows] = await Promise.all([
      db
        .select({
          totalMeetings: count(),
          totalHours: sql<string>`
            COALESCE(
              ROUND(
                SUM(
                  CASE
                    WHEN ${meetings.startedAt} IS NOT NULL AND ${meetings.endedAt} IS NOT NULL
                    THEN EXTRACT(EPOCH FROM (${meetings.endedAt} - ${meetings.startedAt})) / 3600.0
                    ELSE 0
                  END
                )::numeric,
                2
              ),
              0
            )::text
          `,
        })
        .from(meetings)
        .where(eq(meetings.userId, userId)),
      db
        .select({
          totalTutors: count(),
        })
        .from(agents)
        .where(eq(agents.userId, userId)),
    ]);

    const meetingAggregate = meetingRows[0];
    const tutorAggregate = tutorRows[0];

    return {
      totalMeetings: meetingAggregate?.totalMeetings ?? 0,
      totalTutors: tutorAggregate?.totalTutors ?? 0,
      totalHours: meetingAggregate?.totalHours ?? "0.00",
    };
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

    const nodeWeights = new Map<string, number>();
    const linkWeights = new Map<string, number>();

    allMeetings.forEach((meeting) => {
      if (!meeting.topics) return;

      let topics: string[] = [];
      try {
        topics = JSON.parse(meeting.topics);
      } catch {
        return;
      }

      const uniqueTopics = [...new Set(topics.filter(Boolean))];

      uniqueTopics.forEach((topic) => {
        nodeWeights.set(topic, (nodeWeights.get(topic) ?? 0) + 1);
      });

      for (let i = 0; i < uniqueTopics.length; i += 1) {
        for (let j = i + 1; j < uniqueTopics.length; j += 1) {
          const source = uniqueTopics[i];
          const target = uniqueTopics[j];
          const key = [source, target].sort().join("::");

          linkWeights.set(key, (linkWeights.get(key) ?? 0) + 1);
        }
      }
    });

    const nodes = Array.from(nodeWeights.entries()).map(([id, value]) => ({
      id,
      group: 1,
      val: value,
    }));

    const links = Array.from(linkWeights.entries()).map(([key, value]) => {
      const [source, target] = key.split("::");

      return {
        source,
        target,
        value,
      };
    });

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
        personality: z.enum(["socratic", "eli5", "coach"]).optional(),
        language: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { meetingId, text, personality, language } = input;
      console.log(
        `[TRPC talkToAgent] Request for meetingId: ${meetingId}, user: ${ctx.userId.user.id}, text: "${text.substring(0, 50)}...", personality: ${personality}, language: ${language}`,
      );

      let existingMeeting;
      try {
        const results = await db
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
        existingMeeting = results[0];
      } catch (dbErr) {
        console.error(
          `[TRPC talkToAgent] Database select error for meeting ${meetingId}:`,
          dbErr,
        );
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database query failed",
          cause: dbErr,
        });
      }

      if (!existingMeeting) {
        console.warn(
          `[TRPC talkToAgent] Meeting not found or unauthorized: ${meetingId} for user ${ctx.userId.user.id}`,
        );
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Meeting not found",
        });
      }

      const agentData = existingMeeting.agent;

      let channel;
      let messages: any = { messages: [] };
      try {
        channel = streamChat.channel("messaging", meetingId, {
          created_by_id: ctx.userId.user.id,
        });
        await channel.create();
        messages = await channel.query({ messages: { limit: 10 } });
      } catch (streamChatErr) {
        console.error(
          `[TRPC talkToAgent] Stream Chat API failure for meeting ${meetingId}:`,
          streamChatErr,
        );
      }

      const history = (messages.messages || [])
        .filter((msg: any) => msg.text && msg.text.trim() !== "")
        .map((message: any) => ({
          role: message.user?.id === agentData.id ? "model" : "user",
          parts: [{ text: message.text || "" }],
        }));

      let personalityInstruction = "";
      if (personality === "socratic") {
        personalityInstruction = `
          PERSONALITY TUTORING STYLE: Socratic Method.
          - Never give the answer directly under any circumstances.
          - Ask short, leading questions to make the student think and realize the answer on their own.
          - Validate their progress but encourage them to take the next step.
        `;
      } else if (personality === "eli5") {
        personalityInstruction = `
          PERSONALITY TUTORING STYLE: ELI5 (Explain Like I'm 5).
          - Use funny analogies, extremely simple child-friendly terms, and visual comparisons.
          - Use a few emojis occasionally to make it fun.
          - Break down complex terms into simple parts immediately.
        `;
      } else if (personality === "coach") {
        personalityInstruction = `
          PERSONALITY TUTORING STYLE: Coding/Logic Coach.
          - Focus heavily on debugging, logical flow, optimal programming code, and code complexity.
          - Help identify edge cases.
          - Be analytical, encouraging, and detail-oriented.
        `;
      }

      let languageInstruction = "";
      let langName = "English";
      if (language) {
        const langMap: Record<string, string> = {
          "en-US": "English",
          "id-ID": "Indonesian",
          "es-ES": "Spanish",
          "hi-IN": "Hindi",
        };
        langName = langMap[language] || "English";
        languageInstruction = `
          CRITICAL MULTILINGUAL INSTRUCTION:
          You MUST conduct the tutoring session and respond in the following language: ${langName} (${language}).
          All explanations, responses, and questions should be written in ${langName}.
        `;
      }

      const drawingInstruction = `
        WHITEBOARD INTERACTIVE CAPABILITY:
        If you want to draw or write math formulas, equations, shapes, or text on the whiteboard to illustrate your explanation, you can append a code block of type "excalidraw" containing a JSON array of new elements at the end of your response.
        
        Example format:
        \`\`\`excalidraw
        [
          {
            "type": "text",
            "x": 300,
            "y": 150,
            "width": 200,
            "height": 50,
            "text": "y = 2x + 5",
            "fontSize": 20,
            "strokeColor": "#a855f7"
          },
          {
            "type": "arrow",
            "x": 300,
            "y": 210,
            "width": 100,
            "height": 50,
            "points": [[0, 0], [100, 50]],
            "strokeColor": "#3b82f6"
          }
        ]
        \`\`\`
        
        Available shapes: "rectangle", "ellipse", "arrow", "line", "text".
        Coordinate ranges: x: 150 to 750, y: 150 to 550.
        Ensure elements are correctly spaced.
        Keep the JSON valid. Do NOT speak this block out loud; it will be parsed by the client automatically. Keep the spoken text conversational and short (maximum 3 sentences).
      `.trim();

      const systemInstruction = `
        You are an AI Tutor named ${agentData.name}.
        Your subject is ${agentData.subject}.
        Your system instructions/persona are:
        ${agentData.prompt}
        
        ${personalityInstruction}
        
        ${languageInstruction}
        
        ${drawingInstruction}
        
        Current Meeting Context:
        ${existingMeeting.currentPrompt || "No additional context."}
        
        Currently you are in a live virtual meeting call with one or more students.
        Explain concepts step-by-step, be helpful, concise, and encourage interactive learning.
        You are responding to a student's voice/text question. Keep your answers brief and readable, as they will be spoken out loud via text-to-speech.
      `.trim();

      let aiResponse = "";
      try {
        const model = getGeminiModel("models/gemini-3.5-flash", {
          systemInstruction,
        });
        const chat = model.startChat({
          history,
        });
        const promptWithLang = `${text}\n\n(IMPORTANT: Remember to reply and explain strictly in ${langName})`;
        const result = await chat.sendMessage(promptWithLang);
        aiResponse = result.response.text();
      } catch (geminiErr) {
        console.error(
          `[TRPC talkToAgent] Gemini API invocation failure for meeting ${meetingId}:`,
          geminiErr,
        );
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "No response from Gemini API",
          cause: geminiErr,
        });
      }

      const avatarUrl = generatedAvatarUri({
        seed: agentData.name,
        variant: "botttsNeutral",
      });

      // Run Stream Chat sync in the background to avoid blocking the voice response (saves ~400-800ms latency)
      const fakeMessageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      if (channel) {
        streamChat
          .upsertUser({
            id: agentData.id,
            name: agentData.name,
            image: avatarUrl,
            role: "user",
          })
          .then(() => channel.addMembers([agentData.id]))
          .then(() =>
            channel.sendMessage({
              text: aiResponse,
              user: {
                id: agentData.id,
                name: agentData.name,
                image: avatarUrl,
              },
            }),
          )
          .then(() => {
            console.log(
              `[TRPC talkToAgent] Successfully synchronized AI response message to Stream Chat channel ${meetingId}`,
            );
          })
          .catch((chatError) => {
            console.error(
              `[TRPC talkToAgent] Failed to sync AI response to Stream Chat in background:`,
              chatError,
            );
          });
      } else {
        console.warn(
          `[TRPC talkToAgent] Stream Chat channel was not initialized; skipping background chat message sync.`,
        );
      }

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
          }),
        ),
      }),
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

      // Convert history to Gemini format (mapping "assistant" to "model")
      const lastMessage = messages[messages.length - 1];
      const chatHistory = messages.slice(0, -1).map((m) => ({
        role: m.role === "assistant" ? ("model" as const) : ("user" as const),
        parts: [{ text: m.content }],
      }));

      let aiResponse = "";
      try {
        const model = getGeminiModel("models/gemini-3.5-flash", {
          systemInstruction,
        });
        const chat = model.startChat({
          history: chatHistory,
        });
        const result = await chat.sendMessage(lastMessage.content);
        aiResponse = result.response.text();
      } catch (geminiErr) {
        console.error(
          `[TRPC askAi] Gemini API invocation failure for meeting ${meetingId}:`,
          geminiErr,
        );
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "No response from Gemini API",
          cause: geminiErr,
        });
      }

      return {
        text: aiResponse,
      };
    }),
});
