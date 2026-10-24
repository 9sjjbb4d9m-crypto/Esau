# Loopback Lab

A local-only cybersecurity learning workspace built with Python, FastAPI, and a responsive, buildless HTML/CSS/JavaScript UI. All UI assets are bundled. No API keys, Node build, database, or account required.

## GitHub Codespaces

This branch supports a **remote GitHub Codespace** as an explicit alternative to running on your own computer. The learning tools still make no outbound requests or third-party scans. GitHub hosts the runtime, source, and authenticated preview traffic.

1. Create a Codespace from the `loopback-lab-codespaces` branch of `9sjjbb4d9m-crypto/Esau`.
2. Wait for the container setup to install Python dependencies and run the tests. VS Code opens the `loopback-lab` folder automatically.
3. In its terminal, run:

   ```sh
   .venv/bin/python -m lab --codespaces
   ```

4. In the **Ports** panel, ensure port **8765** has visibility **Private**, then choose **Open in Browser**. Newly forwarded Codespaces ports default to Private. Public source code does not require a public app port.
5. Stop the app with Ctrl+C and stop the Codespace from GitHub when finished.

You can also use **Tasks: Run Task → Start Loopback Lab in Codespaces**. The **Test Loopback Lab** task runs the suite. Codespaces may consume your GitHub compute/storage quota.

`--codespaces` requires GitHub's `CODESPACES=true` and `CODESPACE_NAME` environment values. It permits only the exact `https://<codespace-name>-<port>.app.github.dev` origin in addition to loopback origins. The listener remains on `127.0.0.1`; proxy headers are not trusted. The ordinary `python -m lab` command keeps the original local-only behavior. Hostname checks are not authentication: the forwarded port must remain Private so GitHub controls access. No application account system is added.

The `.devcontainer` configuration is at the repository root. The lab lives under `loopback-lab/`; the existing French-learning application is preserved on this branch.

## Start locally

Requires Python 3.11 or newer and a modern browser. From this directory:

```sh
python -m venv .venv
```

Activate the environment:

```sh
# macOS / Linux
source .venv/bin/activate

# Windows PowerShell
.venv\Scripts\Activate.ps1
```

Install and start:

```sh
python -m pip install -r requirements.txt
python -m lab
```

Open **http://127.0.0.1:8765** on the same machine. Stop with **Ctrl+C**. If the port is occupied, use `python -m lab --port 8766` and open the matching port. The supported launcher only binds to `127.0.0.1`, disables proxy-header trust and HTTP access logs, and has no option to bind to a public interface. For remote use, follow only the explicit private Codespaces setup above; do not expose the local-only mode through public tunnels or reverse proxies.

The initial dependency installation uses the package index. **Running the installed app needs no internet.** To install on an offline computer with the same OS, CPU architecture, and Python version, prepare a wheelhouse on a connected machine:

```sh
python -m pip download --only-binary=:all: -r requirements-dev.txt -d wheelhouse
# Copy this project and wheelhouse to the offline machine, then:
python -m pip install --no-index --find-links=wheelhouse -r requirements-dev.txt
```

Use `requirements.txt` instead if you do not need tests. Direct dependencies are pinned; these files are not a transitive dependency lock. Keep dependencies updated when using the lab long term.

## Explore

| Workspace | Experiment | What it teaches |
| --- | --- | --- |
| URL inspector | Inspect bundled samples or paste URL text | URL parsing, credentials before `@`, HTTP vs HTTPS, IP literals, ports, Unicode/Punycode, encoding, and redirect query fields |
| Hash playground | Change one character and compare digests | SHA-256, SHA-512, SHA3-256, deterministic hashing, UTF-8 bytes, and the avalanche effect |
| Encryption studio | Encrypt, decrypt, alter a byte, decrypt again | AES-256-GCM authenticated encryption, random keys and nonces, integrity verification |
| Traffic simulator | Compare baseline, burst, and DNS-heavy patterns | Seeded synthetic traffic, per-second counts, protocol mix, paginated/filterable events, and CSV export |

The built-in **Lab guide** contains four short exercises. It is also accessible at `/#guide` on narrow screens. The **Reset workspace** button restores sample inputs and clears computed results and keys across all workspaces. It does not delete exported files or guarantee memory erasure.

URLs are never made clickable, fetched, resolved, or reputation-checked. URL results are structural clues, **not verdicts that a URL is safe or malicious**. Encoded paths are decoded once for display; query fields use standard query decoding. This is a teaching parser, not a complete browser/WHATWG URL parser, public-suffix analyzer, or homoglyph detector.

Hash inputs are encoded exactly as UTF-8, including whitespace and case. The highlighted digest characters are hex characters; the percentage is calculated over **bits**. General-purpose hashes are not password storage algorithms.

Encryption uses the maintained `cryptography` library. Each encryption generates a fresh 32-byte key and 12-byte nonce using the OS random source. AES-GCM appends a 16-byte authentication tag. The envelope is `v1.<nonce>.<ciphertext+tag>` using padded URL-safe Base64; the fixed associated data is `loopback-learning-lab:v1`. Encryption is intentionally randomized. The demo displays its key for learning and is **not a secrets vault**. Never reuse a nonce with the same key in a real application.

Traffic is generated as records in memory. It is not packet capture or packet transmission. Sources use `192.0.2.0/24` and destinations use `198.51.100.0/24` (RFC 5737 documentation ranges). A run spans 60 simulated seconds and 60–1,000 events. With the same Python runtime, seed, count, and scenario, runs reproduce exactly. In burst mode, one third of events are assigned to seconds 26–33; the rest retain the baseline distribution. DNS-heavy mode changes protocol sampling weights. ICMP has no port. The generator labels protocols for education; it does not model full protocol stacks or real attack detection.

The **Export CSV** button exports every event matching the selected protocol, across all pages, with `synthetic`, seed, and scenario columns. Chart values also have a table view for accessibility.

## Run tests

```sh
python -m pip install -r requirements-dev.txt
python -m unittest discover -s tests -v
```

Tests run in-process without a listening server or internet. They cover known hash vectors, UTF-8, URL parsing and invalid input, encryption round trips and tampering, deterministic traffic and aggregation, loopback/host/origin restrictions, input/body limits, JSON errors, asset delivery, and blocked DNS/TCP/UDP attempts during API operations.

Optional browser smoke tests require Playwright and a Chromium binary. They start and stop their own loopback server, exercise each workspace at desktop/mobile widths, check for JS errors and external requests, and validate CSV download. They are separate from the dependency-light test suite:

```sh
python -m pip install playwright
python -m playwright install chromium
python tests/browser_smoke.py
```

To use an existing Chromium install instead, set `CHROMIUM_PATH` to its executable path. Browser test dependencies are only needed for this optional step.

## Local boundary and limits

- The server rejects non-loopback client IPs. Ordinary launches accept Host values only for `127.0.0.1`, `localhost`, or `[::1]` (with an optional port); explicit Codespaces mode additionally accepts that Codespace’s exact preview hostname. This also limits DNS rebinding through foreign hostnames.
- Cross-origin browser requests are rejected. POST requests require JSON and `X-Lab-Request: 1`; cross-site forms and CORS preflights cannot invoke the API. An absent Origin is permitted for local command-line clients that send the marker header.
- The Content Security Policy allows only same-origin scripts, styles, images, and fetches. No external fonts, CDNs, analytics, or remote documentation UI is loaded. The server sets no-store, no-referrer, anti-framing, and nosniff headers.
- API request bodies are capped at 64 KiB before JSON parsing, including chunked bodies. URL text is limited to 4,096 characters and 100 query fields; hash/plaintext fields to 8,192 characters. Oversized or malformed inputs return a controlled error without echoing secret fields.
- The application writes no inputs, keys, or results to files, a database, cookies, or browser storage. Keys exist in Python/browser memory while processed. The browser and OS may retain memory; reset is not secure deletion. Only explicit CSV export creates a user data file.
- This is a single-user educational application, not an OS-level sandbox, production service, password manager, or intrusion detector. Other local processes/users can access a listening loopback port. The code intentionally contains no outbound network operations; it does not install a system-wide firewall.

## Source map

```text
lab/core.py           Pure URL, hashing, AES-GCM, and synthetic traffic functions
lab/app.py            Validated API, loopback/origin/body boundaries, static files
lab/__main__.py       Loopback launcher with explicit private Codespaces mode
lab/runtime.py        Validated Codespaces launch settings
lab/static/          Bundled UI, icons, styles, interactions
tests/test_lab.py     Offline unit, API, and boundary tests
tests/browser_smoke.py Optional end-to-end browser checks
```

API endpoints are `POST /api/url`, `/api/hash`, `/api/encrypt`, `/api/decrypt`, and `/api/traffic`; `GET /api/health` reports the local-only mode. The UI is served at `/`.

For a local CLI example while the server is running:

```sh
curl http://127.0.0.1:8765/api/url \
  -H 'Content-Type: application/json' \
  -H 'X-Lab-Request: 1' \
  --data '{"url":"https://example.test/learn"}'
```

Nothing is deployed or published by these commands.
