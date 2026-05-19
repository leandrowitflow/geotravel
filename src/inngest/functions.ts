import { cron } from "inngest";
import { runGeotravelBookingsDeltaSync } from "@/lib/geotravel/run-bookings-delta-sync";
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

export const inngestFunctions = [geotravelBookingsDeltaSync];
