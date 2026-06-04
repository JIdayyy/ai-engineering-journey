import "dotenv/config";
import { generateText, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { ChantierRequestSchema, type ChantierRequest } from "./types.js";

// ============================================
// Extraction function
// ============================================

async function extractChantierRequest(text: string): Promise<ChantierRequest> {
  const result = await generateText({
    model: anthropic("claude-sonnet-4-5"),
    output: Output.object({
      schema: ChantierRequestSchema,
    }),
    system: `You are a data extraction assistant for a tiling/construction business.
             Extract structured information from free-text customer inquiries.
             
             Rules:
             1. Extract ONLY what is explicitly mentioned in the text
             2. Set to null any field where the information is NOT in the text
             3. NEVER invent or guess information
             4. For contraintes, list ALL mentioned constraints as separate strings
             5. Preserve the original language in extracted strings
             6. Output must strictly follow the provided schema, in needs_clarification put the things where we need clarifications. Put only things related to the chantier request, not general questions about the client or the process. DO not put here email, phone or name if they are missing
             `,

    prompt: `Extract the chantier request details from this customer message:

             "${text}"`,
  });

  return result.output;
}

// ============================================
// Tests
// ============================================

const TEST_INPUTS = [
  // Cas 1 : input riche et complet
  `Allô c'est M. Dupont au 06 12 34 56 78, je voudrais un devis pour ma salle de bain à Bayonne. 
C'est une vieille maison, l'accès est compliqué. Faut refaire le carrelage au sol, environ 8 m² je dirais. 
J'aime bien le grès cérame format 60x60 imitation pierre. Pour les murs, j'hésite encore. 
Idéalement avant l'été.`,

  // Cas 2 : input minimaliste
  `Bonjour je m'appelle Sophie Martin. J'aimerais refaire ma cuisine, environ 15m² je crois. 
Pas trop d'idées sur le matériau, je voudrais des conseils.`,

  // Cas 3 : input avec contraintes spéciales
  `Salut Antho, c'est Pierre. Tu te souviens du chantier de ma terrasse à Hasparren ? 
Je dois refaire le sol, 30 m² en grès cérame antidérapant gris. Format 60x60 standard. 
C'est urgent, faut le faire avant fin juin pour les invités. Mon numéro tu l'as déjà.`,
];

async function main() {
  for (let i = 0; i < TEST_INPUTS.length; i++) {
    const input = TEST_INPUTS[i]!;
    console.log(`\n${"═".repeat(80)}`);
    console.log(`TEST ${i + 1}`);
    console.log("═".repeat(80));
    console.log(`\n📝 Input:\n${input}`);

    const result = await extractChantierRequest(input);

    console.log(`\n📦 Extracted:`);
    console.log(JSON.stringify(result, null, 2));
  }
}

main().catch(console.error);
