import "dotenv/config";
import { generateText, stepCountIs, streamText, tool } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { evaluate } from "mathjs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { WeatherResponse, WorldTimeApiResponse } from "./types.js";

// ============================================
// À TOI : Définis les tools
// ============================================

// Tool 1 : Météo
// Utilise wttr.in : fetch(`https://wttr.in/${city}?format=j1`) retourne du JSON
// Extrait température, condition, etc.
const getWeatherTool = tool({
  description: "Get weather from wttr api",
  inputSchema: z.object({
    city: z.string().describe("..."),
  }),

  execute: async ({ city }) => {
    try {
      const result = await fetch(`https://wttr.in/${city}?format=j1`);

      const json = (await result.json()) as WeatherResponse;

      return {
        temperature: json.current_condition[0]?.temp_C,
        // condition: json.current_condition[0]?.lang_fr[0]?.value,
      };
    } catch (error) {
      console.log(error);
    }
  },
  outputSchema: z.object({
    temperature: z.string(),
    // condition: z.string(),
  }),
});

// Tool 2 : Heure actuelle
// Utilise worldtimeapi.org : fetch(`https://timeapi.world/`)
const getCurrentTimeTool = tool({
  description: "Get current time in a specific timezone",
  inputSchema: z.object({
    timezone: z
      .string()
      .describe('IANA timezone like "Europe/Paris" or "Asia/Tokyo"'),
  }),
  execute: async ({ timezone }) => {
    return {
      time: new Date().toLocaleString("en-US", {
        timeZone: timezone,
        dateStyle: "full",
        timeStyle: "long",
      }),
    };
  },
});

// Tool 3 : Calculatrice
// Utilise mathjs : evaluate('2 + 2 * 3') retourne 8
const calculateTool = tool({
  description: "Calculate math expressions with mathjs lib",
  inputSchema: z.object({
    expression: z.string(),
  }),
  outputSchema: z.object({
    result: z.string(),
  }),
  execute: async ({ expression }) => {
    const result = evaluate(expression);

    return {
      result: result,
    };
  },
});

// ============================================
// À TOI : La fonction qui appelle le LLM avec les tools
// ============================================

async function ask(question: string) {
  const result = streamText({
    model: anthropic("claude-sonnet-4-5"),
    tools: {
      getWeather: getWeatherTool,
      getCurrentTime: getCurrentTimeTool,
      calculate: calculateTool,
    },
    stopWhen: stepCountIs(5),
    maxRetries: 5,
    prompt: question,
  });

  return result;
}

async function main() {
  const rl = createInterface({ input, output });
  console.log("Agent prêt. Tape une question (/exit pour quitter)\n");

  while (true) {
    const question = await rl.question("Toi: ");
    if (question === "/exit") {
      rl.close();
      break;
    }

    process.stdout.write("\nAssistant: ");

    const result = await ask(question);

    for await (const chunk of result.textStream) {
      process.stdout.write(chunk);
    }

    process.stdout.write("\n\n");

    // Debug optionnel : voir les tools appelés
    const steps = await result.steps;
    if (steps.length > 0) {
      console.log("--- Tools appelés ---");
      steps.forEach((step, i) => {
        step.toolCalls?.forEach((call) => {
          console.log(`  ${call.toolName}(${JSON.stringify(call.input)})`);
        });
      });
      console.log("---\n");
    }
  }
}
main();
