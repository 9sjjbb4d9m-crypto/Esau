"""Explicit launch settings; ordinary launches remain loopback-only."""
import re
from dataclasses import dataclass
from typing import Mapping


@dataclass
class Runtime:
    codespaces_origin: str | None = None


runtime = Runtime()


def codespaces_origin(port: int, environment: Mapping[str, str]) -> str:
    if environment.get("CODESPACES") != "true":
        raise ValueError("--codespaces is available only inside a GitHub Codespace.")
    name = environment.get("CODESPACE_NAME", "")
    domain = environment.get("GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN", "app.github.dev")
    if not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", name) or domain != "app.github.dev":
        raise ValueError("Unrecognized Codespaces name or forwarding domain.")
    if not 1024 <= port <= 65535:
        raise ValueError("Choose a port from 1024 to 65535.")
    return f"https://{name}-{port}.{domain}"
