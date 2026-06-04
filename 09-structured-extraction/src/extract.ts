import "dotenv/config";
import { generateText, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { ChantierRequestSchema, type ChantierRequest } from "./types.js";

const FEW_SHOT_EXAMPLES: FewShotExample[] = [
  {
    input: `Bonjour, Marc Lefevre ici, je vous appelle pour un devis. 
J'ai une cuisine de 12m² à carreler à Anglet, mon numéro c'est le 0612345678. 
Je veux du grès cérame mat blanc en 30x60 au sol. Au mur, faïence blanche brillante 20x20. 
Pour septembre si possible.`,
    output: {
      needs_clarification: [],
      confidence: "high",
      client: {
        name: "Marc Lefevre",
        phone: "0612345678",
        email: null,
        location: "Anglet",
      },
      chantier: {
        type: "cuisine",
        surface_m2: 12,
        contraintes: [],
        materiaux: {
          sol: {
            type: "grès cérame",
            format: "30x60",
            finition: "mat blanc",
          },
          murs: {
            type: "faïence",
            format: "20x20",
            finition: "blanche brillante",
          },
        },
        deadline: "septembre",
      },
    },
  },
  {
    input: `Salut, c'est Léa. Faudrait carreler ma terrasse, c'est pas urgent. 
Genre 25m² je pense, j'ai pas encore choisi le matériau. Je suis sur Bidart.`,
    output: {
      needs_clarification: [
        "Quel type de matériau pour le sol ?",
        "Format des carreaux souhaité ?",
        "Finition souhaitée (antidérapant, etc.) ?",
        "Numéro de téléphone ?",
        "Nom de famille ?",
        "Date approximative pour les travaux ?",
      ],
      confidence: "low",
      client: {
        name: "Léa",
        phone: null,
        email: null,
        location: "Bidart",
      },
      chantier: {
        type: "terrasse",
        surface_m2: 25,
        contraintes: [],
        materiaux: {
          sol: null,
          murs: null,
        },
        deadline: null,
      },
    },
  },
];

// ============================================
// Extraction function
// ============================================

async function extractChantierRequest(
  text: string,
  useFewShots,
): Promise<ChantierRequest> {
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
             5. Preserve the original language in extracted strings`,

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
