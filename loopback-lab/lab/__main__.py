import argparse
import os

import uvicorn

from .runtime import codespaces_origin, runtime


def main():
    parser = argparse.ArgumentParser(description="Start the local-only Loopback learning lab.")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--codespaces", action="store_true", help="Allow this Codespace's exact HTTPS preview origin; keep its forwarded port private.")
    args = parser.parse_args()
    if not 1024 <= args.port <= 65535:
        parser.error("Choose a port from 1024 to 65535.")
    runtime.codespaces_origin = None
    if args.codespaces:
        try:
            runtime.codespaces_origin = codespaces_origin(args.port, os.environ)
        except ValueError as error:
            parser.error(str(error))
        print(f"Codespaces preview → {runtime.codespaces_origin}\nKeep port {args.port} visibility Private in the Ports panel.")
    print(f"Loopback Lab → http://127.0.0.1:{args.port}\nPress Ctrl+C to stop. No data is saved.")
    uvicorn.run("lab.app:app", host="127.0.0.1", port=args.port, proxy_headers=False, access_log=False)


if __name__ == "__main__":
    main()
