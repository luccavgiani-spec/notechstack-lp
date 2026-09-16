export type BillingAddress = { line_1: string; zip_code: string; city: string; state: string; country: "BR" };

export function normalizeBillingAddress(value: unknown): BillingAddress | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const text = (key: string) => typeof source[key] === "string" ? (source[key] as string).trim() : "";
  const line_1 = text("line_1");
  const postal = text("zip_code");
  const zip_code = postal.replace(/\D/g, "");
  const city = text("city");
  const state = text("state").toUpperCase();
  if (line_1.length < 5 || line_1.length > 256 || !/^[\d\s-]+$/.test(postal) || zip_code.length !== 8 ||
      city.length < 2 || city.length > 100 ||
      !/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(state) ||
      text("country").toUpperCase() !== "BR") return null;
  return { line_1, zip_code, city, state, country: "BR" };
}
