// ============================================
// Few-shot examples
// ============================================

import z from "zod";

export type FewShotExample = {
  input: string;
  output: ChantierRequest;
};

// ============================================
// Schema : structured representation of a chantier request
// ============================================

export const ChantierTypeEnum = z.enum([
  "salle_de_bain",
  "cuisine",
  "salon",
  "chambre",
  "terrasse",
  "exterieur",
  "autre",
]);

export const MaterialSchema = z.object({
  type: z
    .string()
    .nullable()
    .describe("Material type (e.g. 'grès cérame', 'faïence')"),
  format: z.string().nullable().describe("Format (e.g. '60x60', '30x60')"),
  finition: z
    .string()
    .nullable()
    .describe("Finish (e.g. 'imitation pierre', 'mat')"),
});

export const ChantierRequestSchema = z.object({
  client: z.object({
    name: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    location: z
      .string()
      .nullable()
      .describe("City or area where the work will be done"),
  }),
  chantier: z.object({
    type: ChantierTypeEnum,
    surface_m2: z.number().nullable().describe("Surface in square meters"),
    contraintes: z
      .array(z.string())
      .describe(
        "Specific constraints mentioned (access, condition of building, etc.)",
      ),
    materiaux: z.object({
      sol: MaterialSchema.nullable(),
      murs: MaterialSchema.nullable(),
    }),
    deadline: z
      .string()
      .nullable()
      .describe(
        "When the work should be done (free text like 'before summer 2026')",
      ),
  }),
  needs_clarification: z
    .array(z.string())
    .describe(
      "Put here the things where we need clarifications. Put only things related to the chantier request, not general questions about the client or the process. DO not put here email, phone or name if they are missing",
    ),
  confidence: z
    .enum(["high", "medium", "low"])
    .describe("Put your confidence indice here"),
});

export type ChantierRequest = z.infer<typeof ChantierRequestSchema>;
