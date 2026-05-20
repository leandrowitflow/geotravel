import { cron } from "inngest";
import { runGeotravelBookingsDeltaSync } from "@/lib/geotravel/run-bookings-delta-sync";
import { runLifecycleWhatsappAutomation } from "@/lib/geotravel/run-lifecycle-whatsapp-automation";
import { inngest } from "@/inngest/client";

/**
 * Every 5 minutes: fetch booking rows updated since last watermark (Geotravel `updated_from`).
 * No outbound messages — highlights + cursor only for the admin bookings table.
 */
export const geotravelBookingsDeltaSync = inngest.createFunction(
  {
    id: "geotravel-bookings-delta-sync",
    name: "Geotravel bookings delta sync",
    triggers: [cron("*/5 * * * *")],
  },
  async ({ step, logger }) => {
    const result = await step.run("pull-geotravel-delta", () =>
      runGeotravelBookingsDeltaSync(),
    );

    if (!result.ok) {
      logger.error("Geotravel delta sync failed", { error: result.error });
      throw new Error(result.error);
    }

    if (result.skipped) {
      logger.info("Geotravel delta sync skipped", { reason: result.reason });
      return result;
    }

    logger.info("Geotravel delta sync completed", {
      updatedFrom: result.updatedFrom,
      rowsInWindow: result.rowsInWindow,
      cursorAdvancedTo: result.cursorAdvancedTo,
    });

    return result;
  },
);

/**
 * Every 5 minutes (same cadence as bookings sync): one lifecycle WhatsApp per case,
 * pilot phone 966915976 only. Requires GEOTRAVEL_WHATSAPP_LIFECYCLE_AUTOMATION=true.
 */
export const geotravelLifecycleWhatsappPilot = inngest.createFunction(
  {
    id: "geotravel-lifecycle-whatsapp-pilot",
    name: "Geotravel lifecycle WhatsApp (pilot 966915976)",
    triggers: [cron("*/5 * * * *")],
  },
  async ({ step, logger }) => {
    const result = await step.run("lifecycle-whatsapp-pilot", () =>
      runLifecycleWhatsappAutomation(),
    );

    if (!result.ok) {
      logger.error("Lifecycle WhatsApp automation failed", { error: result.error });
      throw new Error(result.error);
    }

    if (result.skipped) {
      logger.info("Lifecycle WhatsApp automation skipped", {
        reason: result.reason,
      });
      return result;
    }

    const sent = result.attempts.filter((a) => a.ok && !a.skipped);
    const failed = result.attempts.filter((a) => !a.ok);

    logger.info("Lifecycle WhatsApp automation completed", {
      bookingsScanned: result.bookingsScanned,
      sent: sent.length,
      failed: failed.length,
      phases: sent.map((a) => ({
        bookingId: a.bookingId,
        phase: a.phase,
      })),
    });

    if (failed.length > 0) {
      logger.warn("Lifecycle WhatsApp send failures", { failed });
    }

    return result;
  },
);

export const inngestFunctions = [
  geotravelBookingsDeltaSync,
  geotravelLifecycleWhatsappPilot,
];
