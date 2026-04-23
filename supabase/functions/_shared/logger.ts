// Log estruturado em JSON numa linha só — fica fácil filtrar no painel Supabase.

type LogLevel = "info" | "warn" | "error";

export function log(level: LogLevel, event: string, data: Record<string, unknown> = {}): void {
  const line = {
    level,
    event,
    ts: new Date().toISOString(),
    ...data,
  };
  const serialized = JSON.stringify(line);
  if (level === "error") {
    console.error(serialized);
  } else if (level === "warn") {
    console.warn(serialized);
  } else {
    console.log(serialized);
  }
}
