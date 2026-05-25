import "dotenv/config";
import { generateObject, generateText, Output, streamText } from "ai";
import type { ModelMessage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { z } from "zod";

const TaskSchema = z.object({
  title: z.string().describe("Name of the task"),
  urgency: z.enum(["HIGH", "MEDIUM", "LOW"]).describe("Priority of the task"),
  category: z.enum(["WORK", "PERSONNAL", "FAMILLY", "UNKNOWN"]),
  deadline: z
    .string()
    .nullable()
    .describe("Task must be done before this date"),
  location: z.string().nullable().describe("Where the task must be done"),
  context: z
    .string()
    .nullable()
    .describe("Additional informations about the task"),
});

const TasksSchema = z.array(TaskSchema);

async function extractTasks(text: string) {
  const result = await generateText({
    model: anthropic("claude-sonnet-4-5"),
    experimental_output: Output.object({ schema: TasksSchema }),
    prompt: text,
  });

  return result.output;
}

async function main() {
  const text = `Demain je dois acheter du pain à la boulangerie, 
                appeler le plombier vers 14h pour la fuite, 
                et finir le rapport client avant vendredi soir.`;

  const result = await extractTasks(text);
  console.log(JSON.stringify(result, null, 2));
}

main();
