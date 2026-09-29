import { AnthropicVertex } from "@anthropic-ai/vertex-sdk";
import dotenv from "dotenv";

dotenv.config();

const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT;
console.log("Using Project ID:", projectId);

async function testOpus() {
  try {
    if (!projectId) throw new Error("GOOGLE_CLOUD_PROJECT or GCP_PROJECT is required.");

    const client = new AnthropicVertex({ region: "global", projectId });
    console.log("Sending test ping to claude-opus-5-5 via Vertex...");

    const response = await client.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 150,
      messages: [{ role: "user", content: 'Ping. Output valid JSON: {"status": "ok"}' }],
    });

    console.log("SUCCESS:", JSON.stringify(response.content, null, 2));
  } catch (err) {
    console.error("--- OPUS 5.5 VERTEX ERROR DETAILS ---");
    console.error("Status:", err.status);
    console.error("Message:", err.message);
    console.error("Stack:", err.stack);
    if (err.error) console.error("Underlying API Error:", JSON.stringify(err.error, null, 2));
    process.exitCode = 1;
  }
}

await testOpus();
