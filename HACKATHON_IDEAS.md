# Hackathon Feature Ideas for Ngerti.In

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