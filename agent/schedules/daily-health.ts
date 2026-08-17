import { defineSchedule } from "eve/schedules";
import { bot, channel } from "../channels/resend";
import { requireEnv } from "../lib/messaging/config";

export default defineSchedule({
  cron: "0 14 * * *",
  async run({ to, waitUntil, appAuth }) {
    const recipient = requireEnv("LUNA_OWNER_EMAIL").toLowerCase();
    const threadId = await bot.adapters.resend.openDM(recipient);

    waitUntil(
      to(channel, { adapterName: "resend", threadId }).send(
        "Run Luna's daily operational health check. Check the Agency Gateway's model catalog, liveness, and readiness. Email a concise status summary with actionable details for any degraded component.",
        { auth: appAuth },
      ),
    );
  },
});
