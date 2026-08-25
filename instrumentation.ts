export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.ANTHROPIC_API_KEY) {
    console.warn(
      "[orchestrator] PERINGATAN: ANTHROPIC_API_KEY terisi. Agent SDK akan " +
        "menagih ke Console API, bukan ke subscription Claude Code. Hapus " +
        "variabel ini dari environment kalau ingin pakai kredensial subscription."
    );
  }
}
