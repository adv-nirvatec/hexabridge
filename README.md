# HexaBridge website

Corporate website for HexaBridge Technologies Ltd, based on the supplied 2026 corporate profile. Static HTML, CSS and JavaScript; no build step, server application, database or secrets required.

## Local preview

From this directory, run `python -m http.server 4173 --bind 127.0.0.1`, then open http://127.0.0.1:4173.

## Approval status

Initial design for local visual approval. Not approved for production deployment. Contact email, telephone, business address and domain have not been supplied. The contact section explicitly indicates that contact details will be added before launch. No inquiry form or message delivery is implemented.

## OpenClaw / Tencent Lighthouse handoff

After the owner approves the design and confirms the domain and contact details:

1. Clone `https://github.com/adv-nirvatec/hexabridge.git` on the Lighthouse instance into a dedicated site directory. Preserve other sites and existing server configuration.
2. Serve this directory with the existing web server. The document root must contain `index.html`, `styles.css`, `script.js` and `assets/`.
3. Configure the owner's confirmed hostname and HTTPS using the existing server's certificate workflow. No application process or Node installation is needed.
4. Verify the homepage, section navigation, phone menu and both corporate profile download links. Check desktop and phone layouts.
5. Report the deployed commit and URL. Retain the previous release for rollback.

Do not deploy automatically on push. Domain, target directory and server configuration must come from the owner or the established Lighthouse environment; they are not specified in this repository.

## Content notes

- Original logo extracted from the supplied corporate profile.
- Six capabilities, company positioning and delivery model follow that profile.
- Digital collections is an illustrative concept, not a claim of an operational payment product. The partner approval qualification is retained.
- Fonts are requested from Google Fonts, with local system font fallbacks.
- No analytics, cookies, tracking scripts or external form services are configured.
