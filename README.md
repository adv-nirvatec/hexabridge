# HexaBridge website
Fintech-focused corporate website for HexaBridge Technologies Ltd, for local visual approval before OpenClaw deploys to Tencent Lighthouse.

## Local preview
Requires Node.js 22.9+ and pnpm.
1. Run `pnpm install --frozen-lockfile`.
2. Run `pnpm start`.
3. Open http://127.0.0.1:4173.

There is no front-end build step. The Node server serves the public files and handles the inquiry endpoint. Do not expose this entire checkout with a generic static server in production: it contains server source and deployment files.

## Approval and email status
The visual upgrade is awaiting owner approval. Do not deploy automatically on push.

The inquiry recipient is **inquire@hexabridge.com**, as specified by the owner. No real email was tested locally, at the owner's request. Until SMTP is configured, submissions return an honest “not yet connected” message. No inquiry content is written to disk.

## OpenClaw / Tencent Lighthouse deployment
After visual approval:
1. Clone/update `https://github.com/adv-nirvatec/hexabridge.git` in a dedicated directory. Preserve all other sites and server configuration.
2. Use Node.js 22.9+ and run `pnpm install --prod --frozen-lockfile`.
3. Copy `.env.example` to `.env` **on the server only**. Set:
   - `PUBLIC_ORIGIN` to the owner's exact approved HTTPS origin (no trailing slash).
   - `SMTP_HOST`, `SMTP_PORT` (587 STARTTLS or 465 TLS), `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` using the owner's mail provider.
   - `SMTP_FROM` must be a provider-verified sender. Inquiries are always addressed to `inquire@hexabridge.com`; Reply-To is the submitter.
   - `HOST=127.0.0.1`, `PORT=4173`. Change the port if already occupied.
   - `TRUST_PROXY=1` only when the reverse proxy overwrites X-Real-IP with the actual client IP and the Node port is inaccessible to external traffic.
4. Use the existing service manager to keep `node --env-file=.env server.mjs` running with the working directory set to this checkout. Do not put SMTP secrets in service command-line arguments.
5. Reverse proxy the approved hostname to the loopback Node port. See `deployment/nginx-location.conf.example`. Obtain/renew HTTPS using the existing server workflow.
6. After configuring mail, send one owner-authorized inquiry and verify receipt in the target mailbox. SMTP acceptance is not proof of inbox delivery; check spam and provider logs. Confirm SPF/DKIM/DMARC with the mail provider as applicable.
7. Verify desktop/phone layout, tabs, motion pause, privacy dialog, profile download, invalid form handling and successful inquiry. Report deployed commit and URL; retain the previous release for rollback.

If static assets are served directly by nginx, explicitly serve only index.html, styles.css, script.js and assets/, and proxy /api/inquiries to Node. Do not expose .env, .git, node_modules, server source, tests or deployment files. The bundled Node server uses a public-file allowlist.

## Form behavior
POST /api/inquiries accepts JSON and validates field lengths, email, interest and consent on the server. Honeypot, request-size limit, same-origin enforcement and per-client rate limiting are included. SMTP requires encrypted transport; success is returned only after the provider accepts the recipient. Failed or unconfigured delivery never displays success. No auto-reply or marketing subscription is created. Data is sent only to the configured mail service and designated mailbox. Form text remains intact after delivery failure.

Rate limits are in memory per server process; use a single app instance or add shared limits at the reverse proxy before scaling. Monitor the mail service and process with the existing Lighthouse operations setup.

## Verification
`pnpm test` runs validation, public-file restrictions, origin, honeypot, request-size, delivery-state and rate-limit checks. Transport is mocked: these checks do not send emails.

Desktop and phone visual checks cover navigation, interactive journey panels, keyboard controls, privacy dialog, motion pause and responsive overflow. SMTP credentials and production delivery remain OpenClaw's deployment task.

## Content and artwork
See `ASSETS.md` for the generated image's prompt, provenance, source links and boundaries of partner claims. SurePay products are partner platforms for discovery, not claims that they are deployed or licensed in PNG. The original corporate profile remains downloadable.

Fonts are requested from Google Fonts with local fallbacks. No analytics, advertising cookies or tracking integrations are configured.
