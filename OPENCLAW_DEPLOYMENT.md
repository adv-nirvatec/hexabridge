# OpenClaw handoff: HexaBridge → Tencent Lighthouse

## Approved outcome

Deploy the owner-approved HexaBridge corporate website from **https://github.com/adv-nirvatec/hexabridge**, branch **main**, to the owner's existing Tencent Lighthouse environment. Use the exact release commit supplied in the owner's handoff message; compare it with GitHub before deployment. Approval was given on **11 November 2026, Asia/Manila**. This document prepares deployment; no server changes have been made by Codex.

Preserve the approved design and content: HexaBridge leads, client-focused solutions come first, the delivery process is prominent, and SurePay appears in one strategic partnership section. No additional partners are named. The recipient for inquiries is **inquire@hexabridge.com**.

## 1. Resolve the target from the existing environment

Use the owner's established OpenClaw access and deployment conventions. Inspect the selected Lighthouse instance before changing it. Confirm:

- Correct instance, operating system, SSH identity and existing websites.
- Intended public hostname and canonical origin. The mailbox uses hexabridge.com, but that alone does not establish the approved website hostname or DNS access.
- Existing web server, certificate manager, process manager, application directories and occupied ports.
- Mail provider, verified sender, mailbox availability and SMTP credentials available through the owner's existing secret-management workflow.

The instance IP, SSH account, hostname choice and SMTP credentials are **not contained in this repository**. Discover them from existing authorized configuration; ask the owner only for details that are actually missing. Do not invent credentials, replace unrelated virtual hosts or reuse an occupied port.

The examples below assume Linux with nginx and systemd. If this instance uses Docker, a hosting panel, PM2 or another established stack, adapt to that stack while preserving the same application contract. The example paths are a proposed layout, not facts about the server.

## 2. Application contract

| Item | Requirement |
| --- | --- |
| Runtime | Supported Node.js release satisfying >=22.9 |
| Package manager | pnpm; lockfile is committed |
| Dependencies | Nodemailer; no database |
| Build | None; HTML/CSS/JS are served directly by Node |
| Entry point | `server.mjs` at repository root |
| Bind address | `HOST=127.0.0.1` |
| App port | `PORT=4173`, or another verified free local port |
| Public serving | HTTPS reverse proxy to Node, including `/api/inquiries` |
| Persistent data | No local inquiry store or uploads |
| Email | Provider-configured SMTP; encrypted STARTTLS on 587 or TLS on 465 |

Do not deploy this as a static-only website: the inquiry form needs the Node endpoint. Do not publish the entire Git checkout as a web document root. The application has an explicit public-file allowlist and serves only the homepage, styles, script and assets.

## 3. Prepare a pinned release

Use the existing release layout where one exists. Otherwise, a suitable layout is:

```text
/srv/hexabridge/releases/<full-commit-sha>/   # immutable application release
/srv/hexabridge/current                     # symlink to active release
/etc/hexabridge/website.env                  # server-only environment
```

1. Record the current release target (if any), service configuration and virtual-host configuration so they can be restored.
2. Fetch the repository using the owner's authorized GitHub access. Do not put tokens in Git URLs, logs or committed files.
3. Check out the exact handoff commit into a new release directory. Run `git rev-parse HEAD` and compare the full SHA with the handoff. Do not deploy a newer moving `main` without checking that it is the intended release.
4. In that release, run:

```bash
pnpm install --prod --frozen-lockfile
node --check server.mjs
node --check script.js
pnpm test
```

Tests use mocked mail and send no real inquiries. No build command is required. Use the existing dependency/runtime provisioning method; avoid replacing shared server-wide tooling.

## 4. Configure environment and inquiry delivery

Use `.env.example` as the field reference. Keep actual values outside Git. If using the systemd example, store them in `/etc/hexabridge/website.env`, owned by root with mode 0600, and let systemd inject them. If using the existing process manager instead, load the same variables through its protected configuration.

```dotenv
HOST=127.0.0.1
PORT=4173
PUBLIC_ORIGIN=https://YOUR_CONFIRMED_HOSTNAME
TRUST_PROXY=1
SMTP_HOST=YOUR_MAIL_PROVIDER_HOST
SMTP_PORT=587
SMTP_USER=YOUR_PROVIDER_USERNAME
SMTP_PASS=YOUR_PROVIDER_SECRET
SMTP_FROM="HexaBridge <YOUR_VERIFIED_SENDER>"
```

Replace every placeholder. `PUBLIC_ORIGIN` must exactly match the browser's final HTTPS origin, with no trailing slash. Redirect other hostnames to that canonical origin. Preserve the Host header through the proxy.

Set `TRUST_PROXY=1` only when Node binds to loopback and the trusted proxy overwrites `X-Real-IP` with the client address. If a CDN or another proxy sits ahead of nginx, configure the trusted real-IP chain correctly; do not trust arbitrary visitor-supplied forwarding headers. Otherwise leave `TRUST_PROXY=0` and account for its shared proxy-IP rate limit.

`SMTP_FROM` must be a sender accepted by the owner's provider. The application always sends to **inquire@hexabridge.com**; Reply-To uses the submitter's address. A mailbox address alone is not an SMTP configuration. Confirm the receiving mailbox exists and configure sender authentication with the provider as needed.

No real emails were tested locally, at the owner's request. Without SMTP settings the form deliberately reports that it is not connected; it never reports a fake success. Do not call deployment fully complete until live form delivery is verified. If credentials are unavailable, report that exact remaining dependency and the visible form behavior.

## 5. Run the application as a managed service

Reuse the established process manager. For a new Linux/systemd service, adapt `deployment/hexabridge.service.example` after verifying the Node executable path, service account and release directories. The example uses `/usr/bin/node`, a dedicated unprivileged `hexabridge` account and the layout above. Grant that account read/traverse access to the release and installed dependencies.

After the environment is set and the intended release is ready, switch `current` using the existing atomic release procedure. For a new systemd service, install the adapted unit, reload unit definitions and enable/start `hexabridge.service`. For an existing service, restart only the HexaBridge process after switching the release.

Check service status and its logs, then check the selected loopback port:

```bash
curl --fail --silent --show-error http://127.0.0.1:4173/ -o /dev/null
```

The application logs must not contain inquiry contents or credentials. Keep SMTP secrets out of command arguments and shared logs. There is no requirement to expose port 4173 to the internet.

## 6. Configure hostname, reverse proxy and HTTPS

1. Use the approved hostname and existing DNS workflow. Point the correct DNS records at the selected Lighthouse instance. Publish IPv6 records only if IPv6 serving is configured and verified.
2. Verify TCP 80/443 access in both the Lighthouse instance firewall and any OS firewall, preserving existing SSH and unrelated-service rules. Keep the internal Node port closed publicly. [Tencent Lighthouse firewall documentation](https://intl.cloud.tencent.com/document/product/1103/41393?lang=en).
3. Add or update only the intended virtual host. For nginx, adapt `deployment/nginx-location.conf.example` inside the correct HTTPS server block. Preserve certificate paths and other domains. If port 4173 was changed, change the proxy upstream too.
4. Obtain or renew a certificate through the existing certificate manager. Configure the canonical hostname and HTTP-to-HTTPS redirect without disrupting existing certificate challenges.
5. Validate nginx configuration with `nginx -t` before reloading it. Verify the application through the public HTTPS hostname, not only through loopback. The proxy must forward `/api/inquiries` as well as asset requests. [nginx proxy header documentation](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_set_header).

If the server has an existing security/header policy, merge rather than blindly overwrite it. Avoid logging POST bodies. The app's response policy already blocks framing and limits resource origins; Google Fonts is the only external display dependency and has local font fallbacks.

## 7. Acceptance checks

Before declaring success:

- Confirm the deployed full SHA matches the approved release.
- Confirm valid HTTPS and the canonical redirect; verify the selected domain from outside the instance.
- Review desktop and phone layouts. Confirm the site leads with HexaBridge, has one SurePay partnership section and contains no removed partner catalogue or future partner names.
- Check solution-to-inquiry links, EOR category selection, the three collections tabs, phone menu, motion pause, privacy dialog and corporate profile download.
- Confirm `/assets/hexabridge.css`, `/assets/eor.css` and the generated WebP artwork return successful responses.
- Confirm `/.env`, `/.git/config`, `/server.mjs`, `/node_modules/` and deployment files are not publicly exposed.
- Confirm invalid forms produce useful feedback. After SMTP is connected, send one clearly labeled deployment test inquiry to inquire@hexabridge.com under the owner's deployment workflow. Verify it arrives in that mailbox; an SMTP acceptance response alone does not prove inbox delivery. Check spam/provider logs as needed. Do not use real customer data.
- Confirm service restart/reboot persistence is configured and that other hosted sites still work.

No database migration is needed. Do not add trackers, third-party form services or change the approved content as part of deployment.

## 8. Rollback and completion report

If deployment verification fails, restore the previous `current` release target and restart only the HexaBridge service. Restore the prior virtual-host configuration if it changed, validate it and reload the web server. Preserve the new release and logs for diagnosis; do not delete unrelated files or rewrite repository history. For a first deployment with no previous release, disable only the new virtual host/service if needed and report the failure.

Return to the owner with:

```text
Live URL:
Instance identifier:
Deployed full commit SHA:
Release directory and process/service:
HTTPS and renewal status:
Inquiry delivery to inquire@hexabridge.com: verified / pending (reason)
Other verification results:
Previous release and rollback action:
Any remaining owner action:
```

Do not claim deployment or email success until those results have actually been observed.
