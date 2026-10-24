# Verification

Verified on 2026-10-24 with Python 3.12 and Chromium on Linux.

- Fresh virtual environment: installation from `requirements-dev.txt` succeeded; `pip check` found no broken requirements.
- `python -m unittest discover -s tests -v`: **34 tests passed**.
- `CHROMIUM_PATH=/usr/bin/chromium python tests/browser_smoke.py`: **passed** at 1440px desktop and 390px mobile widths.
- Browser flows checked URL samples and errors, inert HTML/script input rendering, hashing and identical inputs, encryption round trip and tamper rejection, traffic scenarios, protocol filters, pagination, CSV contents, reset, guide navigation, and horizontal overflow.
- Browser checks observed **zero external requests**, **zero uncaught JavaScript errors**, no cookies, and no local/session storage.
- API tests denied DNS, TCP, and UDP operations while exercising every computational endpoint.
- `node --check lab/static/app.js`: passed.

The optional browser test starts and stops its own loopback server. No public deployment, third-party scan, or live packet capture was performed. Windows/macOS setup instructions are provided but were not executed on those platforms.

The current Starlette test client emits an upstream deprecation notice for its supported httpx compatibility layer. It does not affect the passing tests or runtime application.

Codespaces preparation: five additional tests verify explicit opt-in, exact preview-origin matching, host rewriting, and rejection of other origins and non-loopback peers. A live Codespace has not been created or tested from this environment; the available GitHub integration cannot create Codespaces.
