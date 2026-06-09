const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.API_KEY || process.env.GITHUB_TOKEN || process.env.NVIDIA_API_KEY || process.env.GROQ_API_KEY;
const PROVIDER = (
  process.env.AI_PROVIDER ||
  (API_KEY?.startsWith("github_pat_") ? "github" : API_KEY?.startsWith("nvapi-") ? "nvidia" : "groq")
).toLowerCase();
const MODEL =
  process.env.AI_MODEL ||
  process.env.GITHUB_MODEL ||
  process.env.NVIDIA_MODEL ||
  process.env.GROQ_MODEL ||
  (PROVIDER === "github"
    ? "openai/gpt-4.1"
    : PROVIDER === "nvidia"
      ? "nvidia/llama-3.3-nemotron-super-49b-v1.5"
      : "llama-3.1-8b-instant");
const CHAT_ENDPOINT =
  PROVIDER === "github"
    ? "https://models.github.ai/inference/chat/completions"
    : PROVIDER === "nvidia"
    ? "https://integrate.api.nvidia.com/v1/chat/completions"
    : "https://api.groq.com/openai/v1/chat/completions";
const ROOT = __dirname;
const SYSTEM_PROMPT =
  "You are Nova, a clear and helpful AI assistant. Your name is Nova only. Use the requested tone. Answer like a polished ChatGPT-style assistant: conversational, interactive, neatly spaced, and easy to scan. Use short paragraphs and bullets when helpful. Use actual native Unicode emoji characters only, so the user's operating system can render them. Never write emoji names, emoji shortcodes like :smile:, HTML entities, replacement boxes, or mojibake text like broken emoji gibberish. When the user sends emojis, mirror a small number of those same emojis when they fit naturally. Include 1 to 3 relevant emojis in most friendly answers, especially in greetings, summaries, encouragement, lists, or follow-up questions. Do not spam emojis. Ask a useful follow-up question when the user might want to continue. If you use or know reliable source URLs, include them as Markdown links near the relevant claims or in a short Sources section. Do not invent sources. If you do not have source links, answer normally without fake citations.";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > 1_000_000) {
        reject(new Error("Request is too large."));
        request.destroy();
      }
    });

    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

async function handleChat(request, response) {
  if (!API_KEY) {
    sendJson(response, 500, {
      error: "Missing API key. Add API_KEY=your_key_here to api.env, then restart the app.",
    });
    return;
  }

  try {
    const body = JSON.parse(await readRequestBody(request));
    const tone = String(body.tone || "Simple");
    const messages = Array.isArray(body.messages) ? body.messages : [];

    const cleanMessages = messages
      .filter((message) => message && typeof message.content === "string")
      .slice(-16)
      .map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content.slice(0, 8000),
      }));

    const headers = {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    };

    if (PROVIDER === "github") {
      headers.Accept = "application/vnd.github+json";
      headers["X-GitHub-Api-Version"] = "2026-03-10";
    }

    const aiResponse = await fetch(CHAT_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.7,
        max_tokens: 1200,
        messages: [
          {
            role: "system",
            content: `${SYSTEM_PROMPT} Current tone: ${tone.toLowerCase()}.`,
          },
          ...cleanMessages,
        ],
      }),
    });

    const data = await aiResponse.json();

    if (!aiResponse.ok) {
      sendJson(response, aiResponse.status, {
        error: data.error?.message || `${PROVIDER} API request failed.`,
      });
      return;
    }

    sendJson(response, 200, {
      reply: data.choices?.[0]?.message?.content || "I could not read the AI response.",
    });
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Server error." });
  }
}

function serveStatic(request, response) {
  const requestPath = request.url === "/" ? "/index.html" : request.url.split("?")[0];
  const filePath = path.normalize(path.join(ROOT, requestPath));

  if (!filePath.startsWith(ROOT)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
    });
    response.end(content);
  });
}

const server = http.createServer((request, response) => {
  if (request.method === "POST" && request.url === "/api/chat") {
    handleChat(request, response);
    return;
  }

  if (request.method === "GET") {
    serveStatic(request, response);
    return;
  }

  response.writeHead(405);
  response.end("Method not allowed");
});

server.listen(PORT, () => {
  console.log(`Nova is running at http://localhost:${PORT}`);
  console.log(`Provider: ${PROVIDER}`);
  console.log(`Model: ${MODEL}`);
});
// Load the variables from the .env file into process.env
require('dotenv').config();

const port = process.env.PORT;
const apiKey = process.env.API_KEY;

console.log(`Server running on port ${port}`);
