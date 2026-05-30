import 'dotenv/config';
import { streamVideo } from './stream-video';

async function test() {
  try {
    console.log("streamVideo type:", typeof streamVideo);
    console.log("streamVideo.video type:", typeof streamVideo.video);
    console.log("streamVideo.video.connectOpenAi type:", typeof streamVideo.video?.connectOpenAi);
    
    // Just to check if it's a function
    if (typeof streamVideo.video?.connectOpenAi === 'function') {
      console.log("✅ connectOpenAi exists!");
    } else {
      console.log("❌ connectOpenAi is missing!");
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

test();
