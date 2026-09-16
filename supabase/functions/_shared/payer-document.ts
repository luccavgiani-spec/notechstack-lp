// Validate the CPF for the existing individual-customer checkout contract.
// The document is forwarded to the gateway, never stored in our lead/payment payload.
export function normalizePayerCpf(value: unknown): string | null {
  if (typeof value !== "string" || !/^[\d.\s-]+$/.test(value)) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return null;
  for (let length = 9; length <= 10; length++) {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(digits[i]) * (length + 1 - i);
    const remainder = (sum * 10) % 11;
    if ((remainder === 10 ? 0 : remainder) !== Number(digits[length])) return null;
  }
  return digits;
}
