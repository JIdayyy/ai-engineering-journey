import "dotenv/config";
import { streamText } from "ai";
import type { ModelMessage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

// À TOI : définis la personnalité de ton assistant
const SYSTEM_PROMPT = `Tu es un assistant...`;

// L'historique de la conversation, vide au démarrage
const history: ModelMessage[] = [];

async function chat(userInput: string): Promise<void> {
  // Étape 1 : ajouter le message utilisateur à l'historique
  //   - Le role est 'user', le content est userInput
  history.push({ role: "user", content: userInput });

  //
  // Étape 2 : appeler streamText avec :
  //   - model: anthropic('claude-sonnet-4-5')
  //   - system: SYSTEM_PROMPT
  //   - messages: history (l'historique COMPLET, pas juste le dernier message)

  const result = streamText({
    model: anthropic("claude-sonnet-4-5"),
    system: SYSTEM_PROMPT,
    messages: history,
  });

  // Étape 3 : stream les chunks dans le terminal
  //   - parcourir result.textStream avec for await
  //   - afficher chaque chunk avec process.stdout.write(chunk)
  //

  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
  }

  // Étape 4 : une fois le stream fini, récupérer la réponse complète
  //   - await result.text te donne le texte complet
  //   - l'ajouter à l'historique avec role 'assistant'
  //
  const text = await result.text;

  history.push({ role: "assistant", content: text });

  // Étape 5 (bonus) : afficher les tokens consommés
  //   - await result.usage te donne l'objet usage
  //   - log les champs (fais un console.log de usage pour voir la structure)
  const usage = await result.usage;
  console.log(usage);
}

async function main() {
  const rl = createInterface({ input, output });

  console.log("Chat démarré. Commandes : /clear, /exit\n");

  while (true) {
    const userInput = await rl.question("Toi: ");

    // Gérer la commande /exit
    if (userInput === "/exit") {
      console.log("Au revoir !");
      rl.close();
      break;
    }

    // Gérer la commande /clear
    if (userInput === "/clear") {
      // À TOI : vider l'historique et afficher un message de confirmation
      continue;
    }

    process.stdout.write("\nAssistant: ");
    await chat(userInput);
    console.log("\n");
  }
}

main();
