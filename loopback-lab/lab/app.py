"""Same-origin, loopback-only HTTP interface."""
import ipaddress
import re
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field

from .core import compare_hashes, decrypt, encrypt, generate_traffic, inspect_url
from .runtime import runtime

STATIC = Path(__file__).parent / "static"
MAX_BODY = 65536
SECURITY_HEADERS = {
    "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'",
    "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY", "Cache-Control": "no-store",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
}


class LocalBoundary:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        async def secure_send(message):
            if message["type"] == "http.response.start":
                message["headers"] = list(message.get("headers", [])) + [(k.lower().encode(), v.encode()) for k, v in SECURITY_HEADERS.items()]
            await send(message)

        async def reject(status, detail):
            await JSONResponse({"detail": detail}, status_code=status)(scope, receive, secure_send)

        headers = {k.decode().lower(): v.decode() for k, v in scope["headers"]}
        host = headers.get("host", "").lower()
        try:
            peer_is_local = ipaddress.ip_address(scope["client"][0]).is_loopback
        except (ValueError, TypeError):
            peer_is_local = False
        local_host = bool(re.fullmatch(r"(?:localhost|127\.0\.0\.1|\[::1\])(?::[0-9]{1,5})?", host))
        preview_host = runtime.codespaces_origin is not None and f"https://{host}" == runtime.codespaces_origin
        if not peer_is_local or not (local_host or preview_host):
            return await reject(403, "This lab accepts loopback connections and explicitly configured hostnames only.")
        allowed_origins = {f"http://{host}"} if local_host else set()
        if runtime.codespaces_origin is not None:
            allowed_origins.add(runtime.codespaces_origin)
        origin = headers.get("origin")
        if (origin is not None and origin not in allowed_origins) or headers.get("sec-fetch-site") == "cross-site":
            return await reject(403, "Cross-origin requests are disabled.")
        if scope["method"] == "POST":
            if headers.get("x-lab-request") != "1" or headers.get("content-type", "").split(";")[0].strip() != "application/json":
                return await reject(403, "Use the lab's same-origin JSON interface.")
            body = bytearray()
            while True:
                message = await receive()
                if message["type"] == "http.disconnect":
                    return
                body.extend(message.get("body", b""))
                if len(body) > MAX_BODY:
                    return await reject(413, "Request exceeds the 64 KiB limit.")
                if not message.get("more_body", False):
                    break
            delivered = False
            async def limited_receive():
                nonlocal delivered
                if not delivered:
                    delivered = True
                    return {"type": "http.request", "body": bytes(body), "more_body": False}
                return await receive()
            return await self.app(scope, limited_receive, secure_send)
        return await self.app(scope, receive, secure_send)


app = FastAPI(title="Loopback Lab", docs_url=None, redoc_url=None, openapi_url=None)
app.add_middleware(LocalBoundary)


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class URLInput(Input):
    url: str = Field(min_length=1, max_length=4096)


class HashInput(Input):
    text: str = Field(max_length=8192)
    comparison: str = Field(max_length=8192)
    algorithm: Literal["sha256", "sha512", "sha3_256"] = "sha256"


class EncryptInput(Input):
    text: str = Field(max_length=8192)


class DecryptInput(Input):
    key: str = Field(max_length=128)
    envelope: str = Field(max_length=45000)


class TrafficInput(Input):
    seed: int = Field(default=42, ge=0, le=2**32 - 1)
    count: int = Field(default=360, ge=60, le=1000)
    scenario: Literal["baseline", "burst", "dns"] = "baseline"


@app.exception_handler(RequestValidationError)
async def validation_error(request, error):
    # Do not echo request values (keys or plaintext) in errors.
    return JSONResponse({"detail": "Invalid input. Check field types, lengths, and allowed options."}, status_code=422)


def compute(function, *args):
    try:
        return function(*args)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from None


@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")


@app.get("/api/health")
def health():
    return {"status": "ok", "mode": "codespaces" if runtime.codespaces_origin else "local-only", "outbound_operations": False}


@app.post("/api/url")
def url_inspector(data: URLInput):
    return compute(inspect_url, data.url)


@app.post("/api/hash")
def hashes(data: HashInput):
    return compute(compare_hashes, data.text, data.comparison, data.algorithm)


@app.post("/api/encrypt")
def encryption(data: EncryptInput):
    return compute(encrypt, data.text)


@app.post("/api/decrypt")
def decryption(data: DecryptInput):
    return compute(decrypt, data.key, data.envelope)


@app.post("/api/traffic")
def traffic(data: TrafficInput):
    return compute(generate_traffic, data.seed, data.count, data.scenario)


app.mount("/static", StaticFiles(directory=STATIC), name="static")
