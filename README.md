<picture>
  <img width="1920" alt="Lumina.ai" src="https://github.com/user-attachments/assets/10956cdd-4f57-4c45-bf65-913430fccb46" />
</picture>

<h1 align="center">Lumina.ai - The Future of Personalized AI Tutoring 🤖</h1>

<p align="center">
  <strong>🏆 3rd Place Winner @ GarudaHacks 6.0 (Education & Equity Track)</strong>
</p>

<p align="center">
  <a href="https://devpost.com/software/ngerti-in"><strong>DevPost</strong></a> ·
  <a href="https://drive.google.com/file/d/1LZ0iFlpiVga2wncryG2UlqN82ca6DUkB/view?usp=sharing"><strong>Pitch Deck</strong></a> ·
  <a href="https://www.youtube.com/watch?v=DiydbfVfX2s"><strong>Video Demo</strong></a>
</p>

---

## 🧐 The Problem: Passive Learning & The "Shame Barrier"
Traditional education is often a one-way street. Students struggle with:
- **Passive Consumption:** Watching YouTube or lectures without interaction leads to low retention.
- **Fear of Judgment:** Hesitation to ask "simple" questions in front of peers or teachers.
- **Accessibility Gap:** Quality 1-on-1 tutoring is expensive and geographically limited.
- **Static Content:** Textbooks can't listen, react, or explain a specific image of homework.

## 💡 Our Solution: Lumina.ai
Lumina.ai isn't just a chatbot; it's a **Living Learning Companion**. We bridge the gap between AI intelligence and human empathy through:
- **Two-Way Voice Dialogue:** Real-time natural conversation with an AI tutor.
- **Interactive Shared Whiteboard:** The AI "sees" and "draws" alongside the student.
- **Proactive Empathy:** Emotion detection stops the session if you look confused.
- **Multimodal Learning:** Snap a photo of your homework, and the AI solves it on the board instantly.

---

## ✨ Key Features (Judge's Guide)

### 🎙️ AI Real-time Voice & Vision
Engage in seamless, low-latency voice conversations. The AI doesn't just talk; it understands context and maintains a personal tutor persona.

### ✍️ Shared Whiteboard (Excalidraw)
The first platform to combine **Real-time AI Voice** with a **Shared Interactive Canvas**. The AI can draw diagrams, solve equations, and annotate your uploads.

### 📸 "Snap, Drop, & Solve" (OCR)
Upload a photo of your textbook or homework. Using advanced OCR, Lumina.ai extracts the text and equations, places them on the board, and begins a step-by-step vocal explanation.

### 🧠 Automated Mastery & Quizzes
Once a session ends, Inngest background agents process the entire transcript to generate:
- **Dynamic Summaries:** Key concepts and takeaways.
- **Adaptive Quizzes:** Test your retention immediately.
- **Knowledge Map:** A visual 3D graph of your learning progress.

### 😟 Confusion Detection
Using `face-api.js`, Lumina.ai monitors facial cues. If you look frustrated or lost, the AI tutor proactively offers a simpler explanation.

---

## 🛠️ Technical Excellence & Orchestration

Lumina.ai is built on a high-performance **Real-time AI Stack**:

- **Core:** Next.js 15 (App Router), TypeScript, Tailwind CSS 4.
- **AI Orchestration:**
  - **Voice:** Stream Video SDK + Stream OpenAI Realtime API.
  - **Background Jobs:** **Inngest** for async summary and quiz generation.
  - **LLM:** Google Gemini 1.5 Pro (for reasoning) & GPT-4o (for orchestration).
- **Data & Ops:**
  - **Database:** Neon (Serverless Postgres) + Drizzle ORM.
  - **Auth:** Better Auth (Google OAuth).
  - **Infrastructure:** Cloudflare Tunnels for local-to-remote webhook handling.
- **Edge Capabilities:** OCR via `tesseract.js` and client-side emotion analysis via `face-api.js`.

---

## 🎥 Demos

| Concept | Video Link |
| :--- | :--- |
| **Product Demo 1** | [Watch on YouTube](https://www.youtube.com/watch?v=DiydbfVfX2s) |
| **Product Demo 2** | [Watch on YouTube](https://www.youtube.com/watch?v=4FQ4IhksxB4) |

---

## 📸 Screenshots

<details>
<summary><strong>Dashboard & Setup</strong></summary>
<br/>
<table>
<tr>
<td align="center">
<strong>User Main Dashboard</strong><br/><br/>
<img src="https://github.com/user-attachments/assets/4bc1ac42-e437-481d-8dcf-b844705be74a" alt="User Main Dashboard" width="100%">
</td>
<td align="center">
<strong>Tutor Dashboard</strong><br/><br/>
<img src="https://github.com/user-attachments/assets/95660b68-49d6-4307-b342-ee2ac080fb9e" alt="Tutor Dashboard" width="100%">
</td>
</tr>
</table>
</details>

<details>
<summary><strong>The Learning Experience</strong></summary>
<br/>
<table>
<tr>
<td align="center">
<strong>Meeting Whiteboard</strong><br/><br/>
<img src="https://github.com/user-attachments/assets/027a4046-881f-490a-acff-929fb165ee01" alt="Meeting Whiteboard" width="100%">
</td>
<td align="center">
<strong>Meeting Summary</strong><br/><br/>
<img src="https://github.com/user-attachments/assets/9f3a368c-c29c-47e3-8455-94949b89733e" alt="Meeting Summary" width="100%">
</td>
</tr>
</table>
</details>

---

## 👥 The Team
- **Ratnadeep Patil** - Product Manager
- **Rachit Kothadia** - AI & Backend Architect
- **Siddhi Shendge** - Frontend Engineer

---

## 🚀 Getting Started

Lumina.ai requires **Cloudflare Tunnels** to handle real-time Stream webhooks.

1. **Clone & Install:**
   ```bash
   git clone https://github.com/Ratnadeep-2007/ngerti-in.git
   npm install
   ```
2. **Environment:**
   Copy `.env.example` and fill in your Neon, Better Auth, Stream, and Gemini keys.
3. **Database:**
   ```bash
   npm run db:push
   ```
4. **Run Server:**
   ```bash
   npm run dev # Port 3006
   ```
5. **Tunneling (Mandatory):**
   ```bash
   cloudflared tunnel --url http://localhost:3006
   ```
   *Update `NEXT_PUBLIC_APP_URL` in `.env` with the tunnel URL and restart.*

---

<p align="center">
  Built with ❤️ for GarudaHacks 6.0
</p>
