const nvidiaApiKey = process.env.NVIDIA_API_KEY;

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export const generateNvidiaResponse = async (messages: Message[]) => {
  if (!nvidiaApiKey) {
    throw new Error("Missing NVIDIA_API_KEY environment variable. Please add it to your .env file.");
  }

  const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${nvidiaApiKey}`,
    },
    body: JSON.stringify({
      model: "meta/llama-3.1-8b-instruct",
      messages,
      max_tokens: 150, // Keep responses concise for fast voice/text-to-speech feedback
      temperature: 0.7,
      top_p: 0.9,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`NVIDIA NIM API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content as string;
};
