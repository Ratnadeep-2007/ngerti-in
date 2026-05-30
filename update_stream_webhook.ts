import { StreamChat } from 'stream-chat';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const apiKey = process.env.NEXT_PUBLIC_STREAM_VIDEO_API_KEY;
  const secret = process.env.STREAM_VIDEO_SECRET;
  const newUrl = process.argv[2];

  if (!apiKey || !secret) {
    console.error('Missing STREAM_VIDEO keys in .env');
    process.exit(1);
  }

  if (!newUrl) {
    console.error('Missing new webhook URL argument');
    process.exit(1);
  }

  const serverClient = StreamChat.getInstance(apiKey, secret);
  
  const maxRetries = 6;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const settings = await serverClient.getAppSettings();

      // Fix TS error: settings.app is possibly undefined
      if (!settings || !settings.app) {
        console.log("No app settings returned from Stream API.");
        return;
      }

      // Check if we use hook v2
      if (!settings.app.use_hook_v2 || !settings.app.event_hooks) {
        console.log("No v2 event_hooks found. Stream webhook might be configured differently.");
        return;
      }

      const updatedHooks = settings.app.event_hooks.map(hook => {
        if (hook.hook_type === 'webhook') {
          return { ...hook, webhook_url: newUrl };
        }
        return hook;
      });

      await serverClient.updateAppSettings({ event_hooks: updatedHooks });
      console.log(`✅ Stream webhook successfully updated to: ${newUrl}`);
      return; // Success!
    } catch (err: any) {
      console.error(`❌ Attempt ${attempt} failed:`, err?.response?.data?.message || err?.message || err);
      if (attempt === maxRetries) {
        console.error("❌ Max retries reached. Stream webhook was not updated.");
        process.exit(1);
      }
      console.log("Waiting 5 seconds for Cloudflare DNS to propagate before retrying...");
      await new Promise(res => setTimeout(res, 5000));
    }
  }
}
main();
