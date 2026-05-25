import "dotenv/config";
import { streamText } from "ai";
import type { ModelMessage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const SYSTEM_PROMPT = `Tu es un assistant...`;

const history: ModelMessage[] = [];

async function chat(userInput: string): Promise<void> {
  history.push({ role: "user", content: userInput });

  const result = streamText({
    model: anthropic("claude-sonnet-4-5"),
    system: SYSTEM_PROMPT,
    messages: history,
  });

  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
  }

  const text = await result.text;

  history.push({ role: "assistant", content: text });

  const usage = await result.usage;
  console.log(usage);
}

async function main() {
  const rl = createInterface({ input, output });

  console.log("Chat démarré. Commandes : /clear, /exit\n");

  while (true) {
    const userInput = await rl.question("Toi: ");

    if (userInput === "/exit") {
      console.log("Au revoir !");
      rl.close();
      break;
    }

    if (userInput === "/clear") {
      continue;
    }

    process.stdout.write("\nAssistant: ");
    await chat(userInput);
    console.log("\n");
  }
}

main();
