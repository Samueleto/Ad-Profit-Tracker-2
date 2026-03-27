/**
 * POST /api/networks/propush/scheduled-sync
 *
 * Internal endpoint for automated daily sync of Propush revenue data.
 * NOT intended for direct client/browser calls — call only from a trusted scheduler.
 *
 * Authentication: requires x-internal-secret header matching INTERNAL_SYNC_SECRET env var.
 * Requests without this header are rejected with 401.
 *
 * --- Scheduler configuration ---
 *
 * Vercel Cron (vercel.json):
 *   {
 *     "crons": [{ "path": "/api/networks/propush/scheduled-sync", "schedule": "0 3 * * *" }]
 *   }
 *   Set INTERNAL_SYNC_SECRET in Vercel environment variables.
 *
 * Google Cloud Scheduler:
 *   Target URL: https://<your-domain>/api/networks/propush/scheduled-sync
 *   HTTP method: POST
 *   Schedule: 0 3 * * *  (daily at 03:00 UTC)
 *   Headers: x-internal-secret: <value of INTERNAL_SYNC_SECRET env var>
 *
 * GitHub Actions:
 *   Schedule: cron: '0 3 * * *'
 *   Step: curl -X POST https://<your-domain>/api/networks/propush/scheduled-sync \
 *           -H "x-internal-secret: ${{ secrets.INTERNAL_SYNC_SECRET }}"
 *
 * Environment variables:
 *   INTERNAL_SYNC_SECRET — shared secret used to authenticate scheduler requests.
 *   Set in .env.local (dev) and deployment environment config (prod).
 */
import { makeScheduledSyncHandler } from "@/lib/networks/network-route-factory";
export const POST = makeScheduledSyncHandler("propush");
