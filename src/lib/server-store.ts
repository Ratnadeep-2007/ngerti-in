export interface ServerMeeting {
  id: string;
  topic: string;
  host: string;
  createdAt: string;
  active: boolean;
}

export interface ServerLeaderboardEntry {
  username: string;
  role: string;
  dailyScore: number;
  weeklyScore: number;
  avatar: string;
}

export interface MeetingParticipant {
  participantId: string;
  meetingId: string;
  username: string;
  role: string;
  focusScore: number;
  isDistracted: boolean;
  isMuted?: boolean;
  isVideoOn?: boolean;
  micLevel?: number;
  videoFrame?: string;
  joinedAt: string;
  lastSeen: number;
}

interface GlobalStore {
  meetings: ServerMeeting[];
  leaderboard: ServerLeaderboardEntry[];
  users: { email: string; username: string }[];
  participants: MeetingParticipant[];
}

declare global {
  var serverStore: GlobalStore | undefined;
}

const store: GlobalStore = globalThis.serverStore ?? {
  meetings: [],
  leaderboard: [
    { username: "Mei Tanaka", role: "student", dailyScore: 96, weeklyScore: 95, avatar: "🏮" },
    { username: "Alex Rivera", role: "student", dailyScore: 92, weeklyScore: 94, avatar: "🎨" },
    { username: "Taylor Chen", role: "student", dailyScore: 88, weeklyScore: 90, avatar: "⚡" },
    { username: "Jordan Smith", role: "student", dailyScore: 84, weeklyScore: 86, avatar: "🧠" },
    { username: "Sarah Connor", role: "student", dailyScore: 79, weeklyScore: 82, avatar: "💪" },
    { username: "Chris Evans", role: "student", dailyScore: 72, weeklyScore: 75, avatar: "🛡️" },
  ],
  users: [],
  participants: [],
};

if (process.env.NODE_ENV !== "production") {
  globalThis.serverStore = store;
}

export { store };
