"""Pure local computations. No network, subprocess, or filesystem operations."""
import base64
import binascii
import hashlib
import ipaddress
import random
import re
import secrets
from collections import Counter
from urllib.parse import parse_qsl, unquote, urlsplit

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def inspect_url(value: str) -> dict:
    if not value or len(value) > 4096:
        raise ValueError("Enter an HTTP or HTTPS URL of at most 4,096 characters.")
    if any(ord(c) < 33 or ord(c) == 127 for c in value) or "\\" in value:
        raise ValueError("URLs must not contain whitespace, control characters, or backslashes.")
    try:
        url = urlsplit(value)
        host = url.hostname
        port = url.port
        if url.scheme not in {"http", "https"} or not host:
            raise ValueError
        ascii_host = host.encode("idna").decode("ascii")
        try:
            address = ipaddress.ip_address(host)
        except ValueError:
            address = None
            labels = ascii_host.rstrip(".").split(".")
            if len(ascii_host) > 253 or any(not re.fullmatch(r"[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?", label) for label in labels):
                raise ValueError
        query = parse_qsl(url.query, keep_blank_values=True, max_num_fields=100)
    except (ValueError, UnicodeError):
        raise ValueError("Use a valid HTTP or HTTPS URL with a valid host and port (at most 100 query fields).") from None

    findings = []
    def flag(title, description, level="review"):
        findings.append({"title": title, "description": description, "level": level})
    if url.scheme == "http":
        flag("Unencrypted scheme", "HTTP does not request transport encryption. HTTPS alone would not prove a site trustworthy.")
    else:
        flag("HTTPS scheme", "The text requests HTTPS. No certificate or connection was checked.", "info")
    if url.username is not None or url.password is not None:
        flag("Embedded credentials", "Text before @ is user information, not the destination. Read the actual hostname carefully.")
    if address:
        flag("Literal IP address", "The destination is written as an IP address. This is a structural clue, not evidence of harm.")
    if any(ord(c) > 127 for c in host) or "xn--" in ascii_host:
        flag("Internationalized hostname", "Unicode and Punycode can represent legitimate names or lookalikes. Compare the ASCII hostname.")
    if len(ascii_host.split(".")) > 4:
        flag("Many hostname labels", "Long subdomain chains can make the actual destination harder to recognize.")
    if port is not None and port != {"http": 80, "https": 443}[url.scheme]:
        flag("Unusual port", f"Port {port} is not the default for {url.scheme.upper()}.")
    if "%" in url.path or "%" in url.query:
        flag("Percent-encoded content", "Encoding is common in URLs. Inspect the decoded path alongside the original.")
    if any(k.lower() in {"redirect", "url", "next", "return", "redirect_uri", "continue"} for k, _ in query):
        flag("Possible redirect parameter", "A query field may describe another destination. It was not followed.")
    if len(value) > 200:
        flag("Long URL", "Long URLs can be legitimate but may obscure important components.")
    reviews = sum(f["level"] == "review" for f in findings)
    return {"url": value, "scheme": url.scheme, "hostname": host, "ascii_hostname": ascii_host,
            "port": port if port is not None else {"http": 80, "https": 443}[url.scheme], "path": url.path or "/",
            "decoded_path": unquote(url.path or "/"), "query": [{"name": k, "value": v} for k, v in query],
            "fragment": url.fragment, "has_credentials": url.username is not None or url.password is not None,
            "findings": findings, "review_count": reviews,
            "verdict": "Review these clues" if reviews else "No flagged structural clues",
            "notice": "Structural analysis only. This is not a safety verdict; no DNS, browsing, or reputation lookup occurred."}


def compare_hashes(text: str, comparison: str, algorithm: str) -> dict:
    if algorithm not in {"sha256", "sha512", "sha3_256"}:
        raise ValueError("Choose SHA-256, SHA-512, or SHA3-256.")
    a = hashlib.new(algorithm, text.encode("utf-8")).digest()
    b = hashlib.new(algorithm, comparison.encode("utf-8")).digest()
    changed = sum((x ^ y).bit_count() for x, y in zip(a, b))
    return {"algorithm": algorithm, "digest": a.hex(), "comparison_digest": b.hex(),
            "input_bytes": len(text.encode("utf-8")), "comparison_bytes": len(comparison.encode("utf-8")),
            "changed_bits": changed, "total_bits": len(a) * 8, "percent_changed": round(changed / (len(a) * 8) * 100, 1),
            "identical": a == b}


AAD = b"loopback-learning-lab:v1"


def encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii")


def decode(value: str) -> bytes:
    try:
        return base64.b64decode(value.encode("ascii"), altchars=b"-_", validate=True)
    except (ValueError, UnicodeError, binascii.Error):
        raise ValueError("Expected valid URL-safe Base64 with padding.") from None


def encrypt(text: str) -> dict:
    key = AESGCM.generate_key(bit_length=256)
    nonce = secrets.token_bytes(12)
    ciphertext = AESGCM(key).encrypt(nonce, text.encode("utf-8"), AAD)
    return {"key": encode(key), "envelope": "v1." + encode(nonce) + "." + encode(ciphertext),
            "algorithm": "AES-256-GCM", "nonce_bytes": 12, "tag_bytes": 16}


def decrypt(key: str, envelope: str) -> dict:
    try:
        version, nonce, ciphertext = envelope.split(".")
        key_bytes, nonce_bytes, ciphertext_bytes = decode(key), decode(nonce), decode(ciphertext)
        if version != "v1" or len(key_bytes) != 32 or len(nonce_bytes) != 12 or len(ciphertext_bytes) < 16:
            raise ValueError
        plaintext = AESGCM(key_bytes).decrypt(nonce_bytes, ciphertext_bytes, AAD).decode("utf-8")
        return {"plaintext": plaintext, "authenticated": True}
    except (ValueError, InvalidTag, UnicodeError):
        raise ValueError("Decryption failed. Check the key and envelope; modified data cannot be authenticated.") from None


def generate_traffic(seed: int, count: int, scenario: str) -> dict:
    """Generate documentation-only addresses; never capture or transmit packets."""
    if not 0 <= seed <= 2**32 - 1 or not 60 <= count <= 1000 or scenario not in {"baseline", "burst", "dns"}:
        raise ValueError("Invalid traffic configuration.")
    rng = random.Random(seed)
    packets, buckets = [], [{"second": i, "packets": 0, "bytes": 0} for i in range(60)]
    for i in range(count):
        burst = scenario == "burst" and i < count // 3
        second = rng.randrange(26, 34) if burst else rng.randrange(60)
        protocol = rng.choices(["HTTPS", "DNS", "HTTP", "ICMP"], weights=[20, 65, 10, 5] if scenario == "dns" else [65, 20, 10, 5])[0]
        size = rng.randint(60, 240) if protocol in {"DNS", "ICMP"} else rng.randint(400, 1500)
        packets.append({"id": i + 1, "second": second, "millisecond": rng.randrange(1000),
                        "source": f"192.0.2.{rng.randint(1, 12)}", "destination": f"198.51.100.{rng.randint(1, 6)}",
                        "protocol": protocol, "port": {"HTTPS": 443, "DNS": 53, "HTTP": 80, "ICMP": None}[protocol],
                        "bytes": size, "pattern": "Injected burst" if burst else "Baseline"})
        buckets[second]["packets"] += 1
        buckets[second]["bytes"] += size
    packets.sort(key=lambda p: (p["second"], p["millisecond"], p["id"]))
    protocols = Counter(p["protocol"] for p in packets)
    return {"synthetic": True, "seed": seed, "scenario": scenario, "duration_seconds": 60,
            "packets": packets, "series": buckets, "protocols": dict(protocols),
            "summary": {"packets": count, "bytes": sum(p["bytes"] for p in packets),
                        "peak_pps": max(b["packets"] for b in buckets), "sources": len({p["source"] for p in packets})}}
