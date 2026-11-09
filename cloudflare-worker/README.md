# DANZO FREE FIRE — Cloudflare Worker

This is the Cloudflare Workers version of the Telegram bot. It uses Telegram webhooks, so it does not need a computer or a continuously running polling process.

## What is included

- Start menu and navigation buttons
- Phone catalog sections: Samsung, iPhone, Redmi and POCO, with pagination
- LITE and PRO information pages
- Subscription information page (payments are intentionally not enabled)
- Support forwarding to configured admin IDs
- /id command for getting a user's Telegram ID
- Optional Cloudflare D1 user counter and protected admin statistics

The phone lists are a starter catalog, not a guarantee that every regional model/release is included. Sensitivity values are deliberately not fabricated; those pages say when verified settings have not yet been added.

## Deploy from GitHub

For the account setup and deployment, have a parent or guardian manage the Cloudflare account and review its terms and privacy policy.

1. Open Cloudflare Dashboard -> Workers & Pages -> Create application.
2. Choose GitHub, connect the GitHub account, and select `ghghbj36-glitch/DANZO-FREE-FIRE`.
3. In build settings, set the root directory to `cloudflare-worker`.
4. Leave the build command blank and use `npx wrangler deploy` as the deploy command.
5. Confirm the Worker name is `danzo-free-fire` (it must match wrangler.toml), then select Save and Deploy.
6. Open the new `workers.dev` URL. It should display: DANZO FREE FIRE worker is online.

Cloudflare's Git integration can build and deploy from GitHub; its Root directory setting lets it deploy a project inside a subfolder. See the official guide: https://developers.cloudflare.com/workers/ci-cd/builds/

## Required Worker secrets / variables

In the Worker, open Settings -> Variables and Secrets and add:

- BOT_TOKEN — a newly generated Telegram bot token, stored as a Secret
- ADMIN_IDS — comma-separated numeric Telegram user IDs, e.g. 123456789 (can be left blank initially)
- SETUP_SECRET — a temporary long random string used once to configure the webhook
- WEBHOOK_SECRET — a long random string containing only letters, numbers, underscores or hyphens

Never put BOT_TOKEN in this repository or send it in chat. If a token has been exposed, revoke it with @BotFather and use the new token only as a Cloudflare Secret.

## Connect Telegram

1. Add the four secrets/variables above in the Worker's settings.
2. Open this URL in a browser, replacing the examples with your real Worker URL and temporary setup secret:
   https://YOUR-WORKER-URL/configure-webhook?key=YOUR-SETUP-SECRET
3. The page should say that the webhook was configured.
4. Immediately remove SETUP_SECRET from Worker settings. Keep WEBHOOK_SECRET and BOT_TOKEN.
5. Open the Telegram bot and send /start.

The setup URL contains only the temporary setup secret, not the bot token. Remove that secret as soon as webhook setup succeeds.

## Optional D1 database

Create a D1 database named danzo-free-fire in Cloudflare, run the SQL in schema.sql, then add a D1 binding to the Worker with variable name DB (Worker -> Settings/Bindings -> D1 database). Without D1, the bot's main menus still work, but user statistics are unavailable.

## Admin

Send /id to the bot to see your own numeric Telegram ID. Add that number to ADMIN_IDS in Cloudflare Worker settings. Then reopen the bot and send /admin. Do not share your ID publicly with your bot token.

## Current intentional limitations

- Payment processing is not connected. Do not collect payments until a provider and its legal/business setup are configured.
- LITE/PRO sensitivity profiles are placeholders until tested values are supplied and verified.
- The catalog is a starter list and may need additions for regional variants and newly released phones.
- A free hosting plan has platform limits; registered-user count is not the same as simultaneous traffic. No capacity guarantee is made for 1,000 active users without load testing.
