export const ROADMAP_TIER_KEYS = ["essencial", "basico", "completo"] as const;
export const ROADMAP_REQUIRED_FIELDS = [
  "answers",
  "references",
  "stack",
  "costs",
  "next_steps",
  "tiers",
] as const;
export const ROADMAP_TIER_FIELDS = [
  "escopo",
  "profundidade",
  "exclusoes",
  "complexidade",
  "prazo_dias",
  "valor_centavos",
  "faixa",
] as const;

export type RoadmapTierKey = typeof ROADMAP_TIER_KEYS[number];

export type RoadmapTierContent = {
  escopo: string[];
  profundidade: string;
  exclusoes: string[];
  complexidade: string;
  prazo_dias: number;
  valor_centavos: number | null;
  faixa: string | null;
};

export type RoadmapContent = {
  answers: Record<string, unknown>;
  references: unknown[];
  stack: unknown[];
  costs: unknown[];
  next_steps: unknown[];
  tiers: Record<RoadmapTierKey, RoadmapTierContent>;
  preferred_tier?: RoadmapTierKey | null;
  prototype_url?: string | null;
};

export type RoadmapValidation =
  | { valid: true; content: RoadmapContent; invalidFields: [] }
  | { valid: false; content: null; invalidFields: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validateTier(value: unknown, path: string, invalid: Set<string>): void {
  if (!isRecord(value)) {
    invalid.add(path);
    return;
  }

  if (!stringArray(value.escopo)) invalid.add(`${path}.escopo`);
  if (typeof value.profundidade !== "string" || !value.profundidade.trim()) {
    invalid.add(`${path}.profundidade`);
  }
  if (!stringArray(value.exclusoes)) invalid.add(`${path}.exclusoes`);
  if (typeof value.complexidade !== "string" || !value.complexidade.trim()) {
    invalid.add(`${path}.complexidade`);
  }
  if (!Number.isInteger(value.prazo_dias) || Number(value.prazo_dias) < 0) {
    invalid.add(`${path}.prazo_dias`);
  }
  if (value.valor_centavos !== null &&
      (!Number.isInteger(value.valor_centavos) || Number(value.valor_centavos) < 0)) {
    invalid.add(`${path}.valor_centavos`);
  }
  if (value.faixa !== null && typeof value.faixa !== "string") {
    invalid.add(`${path}.faixa`);
  }
}

export function validateRoadmapContent(value: unknown): RoadmapValidation {
  const invalid = new Set<string>();
  if (!isRecord(value)) {
    return { valid: false, content: null, invalidFields: ["content"] };
  }

  if (!isRecord(value.answers)) invalid.add("answers");
  for (const field of ["references", "stack", "costs", "next_steps"] as const) {
    if (!Array.isArray(value[field])) invalid.add(field);
  }

  if (!isRecord(value.tiers)) {
    invalid.add("tiers");
  } else {
    for (const tier of ROADMAP_TIER_KEYS) {
      if (!(tier in value.tiers)) invalid.add(`tiers.${tier}`);
      else validateTier(value.tiers[tier], `tiers.${tier}`, invalid);
    }
  }

  if ("preferred_tier" in value && value.preferred_tier !== null &&
      !ROADMAP_TIER_KEYS.includes(value.preferred_tier as RoadmapTierKey)) {
    invalid.add("preferred_tier");
  }
  if ("prototype_url" in value && value.prototype_url !== null &&
      typeof value.prototype_url !== "string") {
    invalid.add("prototype_url");
  }

  const invalidFields = [...invalid].sort();
  if (invalidFields.length) {
    return { valid: false, content: null, invalidFields };
  }
  return { valid: true, content: value as RoadmapContent, invalidFields: [] };
}
