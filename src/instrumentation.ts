export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { startSendWorker } = await import("@/services/send-queue");
      await startSendWorker();
      console.log("[Instrumentation] WhatsApp send queue worker initialized");
    } catch (err) {
      console.warn("[Instrumentation] Could not start send queue worker:", err);
    }
  }
}
