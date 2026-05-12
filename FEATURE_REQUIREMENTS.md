# Feature Requirements & Setup Guide

This document outlines the free tools, APIs, and libraries required to implement the planned features in the Ngerti.In roadmap.

## 8. YouTube Integration
- **Functionality:** AI suggests and embeds relevant educational YouTube videos.
- **Library to Install:** `yt-search` (NPM package)
- **API/Cost:** Completely free. It scrapes YouTube search results, so no official API key (like Google Cloud) is required.

## 9. "Upload Your Textbook" (RAG)
- **Functionality:** RAG-based tutoring via PDF parsing and vector databases.
- **PDF Parsing Library:** `pdf-parse` (NPM package, free).
- **Embeddings Model:** `@xenova/transformers` (NPM package). This allows generating embeddings locally/on-server for completely free without relying on OpenAI's paid API. We will use a small free model like `Xenova/all-MiniLM-L6-v2`.
- **Vector Database:** `pgvector` extension on your existing Neon PostgreSQL database. Completely free on Neon's free tier (no need for Pinecone or Supabase Vector).

## 10. "Smart Knowledge Map"
- **Functionality:** Visual representation of mastery.
- **Library to Install:** `react-force-graph-2d` or `react-force-graph-3d` (NPM package).
- **API/Cost:** Completely free, open-source visualization library.

## 11. Confusion/Emotion Detection
- **Functionality:** Proactive AI intervention by evaluating facial expressions.
- **Library to Install:** `@vladmandic/face-api` (NPM package, modern actively maintained fork of face-api.js).
- **Models to Download:** You will need to host the pre-trained model weights (like `tiny_face_detector` and `face_expression_model`) in your `public/models` directory. These are completely free and open-source.

## 12. "Export to Flashcards"
- **Functionality:** Exporting AI-generated quizzes to Anki/Quizlet.
- **Library/Tool:** Built-in Node.js / Browser capabilities to generate and download `.csv` or `.txt` files.
- **API/Cost:** Completely free.

## 13. "AI Study Buddy"
- **Functionality:** Suggesting collaborative study sessions via real-time presence.
- **Library/Tool:** Existing Drizzle ORM to match users based on subjects/interests, and Better Auth for user sessions.
- **API/Cost:** Completely free using existing infrastructure.

---

### Action Items for the User (What you need to provide/do):
1. No paid APIs are needed!
2. You will just need to let the system download the `face-api` weights and `@xenova/transformers` models automatically when running, or place them in the `public/` directory.
