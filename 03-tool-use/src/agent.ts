import "dotenv/config";
import { generateText, stepCountIs, streamText, tool } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { evaluate } from "mathjs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { WeatherResponse } from "./types.js";
import { Spinner } from "./misc/spinner.js";

const spinner = new Spinner();

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
      };
    } catch (error) {
      console.log(error);
    }
  },
  outputSchema: z.object({
    temperature: z.string(),
  }),
});

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

const calculateTool = tool({
  description: "Calculate math expressions with mathjs lib",
  inputSchema: z.object({
    expression: z.string(),
  }),
  outputSchema: z.object({
    result: z.number(),
  }),
  execute: async ({ expression }) => {
    const result = evaluate(expression);

    return {
      result: result,
    };
  },
});

async function ask(question: string) {
  const result = streamText({
    model: anthropic("claude-sonnet-4-5"),
    system:
      "Tu es un assistant qui répond en français aux questions de l'utilisateur. Après avoir utilisé un tool, formule toujours une réponse claire en langage naturel qui présente le résultat.",
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

    spinner.start("Réflexion en cours");

    const result = await ask(question);

    let firstChunk = true;
    let chunkCount = 0;
    for await (const chunk of result.textStream) {
      chunkCount++;
      if (firstChunk) {
        spinner.stop();
        process.stdout.write("\nAssistant: ");
        firstChunk = false;
      }
      process.stdout.write(chunk);
    }

    spinner.stop();
    process.stdout.write("\n\n");

    const steps = await result.steps;
    if (steps.length > 0) {
      console.log("--- Tools appelés ---");
      steps.forEach((step, i) => {
        step.toolCalls?.forEach((call) => {
          console.log(
            `  ${call.toolName}(${JSON.stringify(call.input)}) -- step ${step.stepNumber}`,
          );
        });
      });
      console.log("---\n");
    }
  }
}
main();
