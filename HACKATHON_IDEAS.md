# Hackathon Feature Ideas for Lumina.ai

## 1. "Snap, Drop, & Solve" (Homework Scanner) 📸✨
*   **The Concept:** Allow students to take a photo of their homework or drop an image into the chat. The AI instantly reads it, drops the problem onto the Excalidraw whiteboard, and begins explaining it step-by-step using its voice.
*   **Why it wins:** Massive UX improvement and looks incredibly impressive in a live demo.
*   **How to build it:** Utilize `tesseract.js` (already in `package.json`) to extract text/equations from images. Pass the extracted text to the OpenAI prompt, and use the Excalidraw API to programmatically insert the image or text onto the canvas.

## 2. Confusion/Emotion Detection (The Empathetic AI) 😟💡
*   **The Concept:** Analyze the student's facial expressions via their webcam using a client-side library. If the student looks confused or frustrated for more than 5 seconds, the AI tutor proactively stops and says, "You look a bit confused. Would you like me to explain this in a simpler way?"
*   **Why it wins:** Hits the "Equity and Accessibility" theme perfectly by catering to students who are too shy to speak up. Makes the AI feel truly human.
*   **How to build it:** Integrate a lightweight library like `face-api.js` or MediaPipe on the frontend alongside the Stream Video SDK. When the "confused" threshold is met, trigger a custom event to the Stream OpenAI Realtime API to inject a system prompt.

## 3. Automated Adaptive Learning Paths & Quizzes 🗺️🎯
*   **The Concept:** After a tutoring session ends, identify the student's weak points and generate a personalized "Next Steps" roadmap with a 3-question interactive quiz to test their retention.
*   **Why it wins:** Demonstrates long-term educational value rather than just being a one-off homework solver.
*   **How to build it:** Trigger an Inngest background job when the meeting ends. The job takes the meeting transcript, asks OpenAI to generate a short JSON-formatted quiz and learning path, and saves it to the Drizzle database.

## 4. Group Study Rooms (AI as a Mediator) 👥🤖
*   **The Concept:** Allow 2 or 3 students to join the same whiteboard call with the AI tutor. The AI acts as a facilitator, encouraging students to help each other, but stepping in if they get the answer wrong.
*   **Why it wins:** Collaborative learning is highly valued in EdTech. It demonstrates the scalability of the platform.
*   **How to build it:** Utilize the Stream Video SDK's native multi-participant call support. Configure the AI's prompt to address multiple users and handle turn-taking.

## 5. Multilingual Native Dialect Support (Ultimate Equity) 🌍🗣️
*   **The Concept:** Add a feature where the AI speaks and writes on the whiteboard in specific regional dialects (e.g., Javanese, Sundanese, or localized slang).
*   **Why it wins:** Breaks down language barriers entirely, aligning perfectly with the Equity theme.
*   **How to build it:** Update the system prompt for the OpenAI Realtime API to strictly respond in the selected dialect and translate technical terms appropriately.

## 6. YouTube Integration & Video Analysis 📺🤖
*   **The Concept:** AI suggests, seamlessly embeds, and analyzes educational YouTube videos based on the student's current learning topic.
*   **Why it wins:** Enhances multi-modal learning by integrating rich visual content and allowing students to query video specifics dynamically.
*   **How to build it:** Implement Stream OpenAI Realtime API function calls (`search_youtube`, `show_video`). Use YouTube Data API v3 for search, embed YouTube iframes via Excalidraw's embeddable elements, and use a library like `youtube-transcript` to inject video captions into the AI's context for analysis.

## 7. "Upload Your Textbook" (Knowledge-Based Tutoring) 📚🧠
*   **The Concept:** Allow students to upload PDFs of their textbooks or notes. The AI tutor uses RAG (Retrieval-Augmented Generation) to answer questions specifically based on the student's local curriculum.
*   **Why it wins:** Ensures educational accuracy and aligns the AI's teaching with exactly what the student will be tested on in class.
*   **How to build it:** Use a PDF parser on the backend, store vector embeddings in a database (like Supabase Vector or Pinecone), and retrieve relevant context to inject into the AI's system prompt during sessions.

## 8. "Smart Knowledge Map" (Progress Tracking) 🗺️📈
*   **The Concept:** A visual "Knowledge Tree" dashboard that maps the student's mastery. Topics turn from red to green based on session performance and quiz scores.
*   **Why it wins:** Provides a gamified sense of progress and helps students/parents identify specific knowledge gaps.
*   **How to build it:** Aggregate performance data from the `meetings` table. Use a graph library like `react-force-graph` or `D3.js` to render an interactive map of the student's learning journey.

## 9. "Export to Flashcards" (Anki/Quizlet Integration) 🗂️⚡
*   **The Concept:** Automatically convert meeting summaries and quizzes into digital flashcards that can be exported to popular study apps.
*   **Why it wins:** Facilitates long-term retention by bridging the gap between active learning and spaced-repetition study.
*   **How to build it:** Add an "Export to Anki" button that generates a `.csv` or `.apkg` file from the quiz JSON data stored in the database.

## 10. "AI Study Buddy" (Peer-to-Peer + AI Matchmaking) 🤝🤖
*   **The Concept:** An intelligent matchmaking system that suggests students join a collaborative whiteboard session if they are currently studying identical or related topics.
*   **Why it wins:** Combines the benefits of social learning with the guidance of a shared AI tutor.
*   **How to build it:** Implement a real-time "active users" tracker. When two users are looking at similar subjects, trigger a notification suggesting a "Group Study Room" session.