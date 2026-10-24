import base64
import hashlib
import ipaddress
import socket
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from lab.app import MAX_BODY, app
from lab.core import compare_hashes, decrypt, encrypt, generate_traffic, inspect_url


class URLTests(unittest.TestCase):
    def test_anatomy_and_duplicate_query_fields(self):
        data = inspect_url("https://docs.example.test:443/a%20b?x=1&x=2&empty=#part")
        self.assertEqual(data["hostname"], "docs.example.test")
        self.assertEqual(data["decoded_path"], "/a b")
        self.assertEqual(data["fragment"], "part")
        self.assertEqual(data["query"], [{"name":"x", "value":"1"}, {"name":"x", "value":"2"}, {"name":"empty", "value":""}])

    def test_https_is_not_a_safety_verdict(self):
        result = inspect_url("https://example.test")
        self.assertEqual(result["review_count"], 0)
        self.assertIn("not a safety verdict", result["notice"])
        self.assertNotIn("safe", result["verdict"].lower())

    def test_user_info_is_not_hostname(self):
        data = inspect_url("http://trusted.example.test:password@actual.example.test:8080/a?next=/b")
        self.assertEqual(data["hostname"], "actual.example.test")
        self.assertTrue(data["has_credentials"])
        self.assertEqual(data["review_count"], 4)

    def test_unicode_and_punycode(self):
        a = inspect_url("https://bücher.example.test")
        b = inspect_url("https://xn--bcher-kva.example.test")
        self.assertEqual(a["ascii_hostname"], b["ascii_hostname"])
        self.assertEqual(a["review_count"], 1)
        self.assertEqual(b["review_count"], 1)

    def test_ip_literal_and_port_zero(self):
        a = inspect_url("http://[::1]:0/")
        self.assertEqual(a["hostname"], "::1")
        self.assertEqual(a["port"], 0)
        self.assertTrue(any(f["title"] == "Literal IP address" for f in a["findings"]))

    def test_invalid_urls(self):
        values = ["", "example.test", "javascript:alert(1)", "file:///etc/passwd", "ftp://example.test", "https://", "https://[broken", "https://example.test:99999", "https://exa mple.test", "https://example.test\n", "https://example.test\\@other.test", "https://-bad.test", "https://example..test", "https://exa_mple.test", "https://example.test/?" + "a=1&" * 101, "https://example.test/" + "x" * 4096]
        for url in values:
            with self.subTest(url=url[:60]), self.assertRaises(ValueError):
                inspect_url(url)


class HashTests(unittest.TestCase):
    def test_known_sha256_vector(self):
        data = compare_hashes("abc", "abc", "sha256")
        self.assertEqual(data["digest"], "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
        self.assertEqual(data["changed_bits"], 0)
        self.assertTrue(data["identical"])

    def test_known_empty_vector(self):
        self.assertEqual(compare_hashes("", "", "sha256")["digest"], "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")

    def test_algorithms_and_bit_difference(self):
        for algo in ("sha256", "sha512", "sha3_256"):
            with self.subTest(algorithm=algo):
                data = compare_hashes("a", "b", algo)
                expected = bin(int(data["digest"], 16) ^ int(data["comparison_digest"], 16)).count("1")
                self.assertEqual(data["changed_bits"], expected)
                self.assertEqual(data["total_bits"], hashlib.new(algo).digest_size * 8)

    def test_utf8_and_no_normalization(self):
        data = compare_hashes("é", "e\u0301", "sha256")
        self.assertEqual((data["input_bytes"], data["comparison_bytes"]), (2, 3))
        self.assertFalse(data["identical"])

    def test_unsupported_hash(self):
        with self.assertRaises(ValueError):
            compare_hashes("a", "b", "md5")


class EncryptionTests(unittest.TestCase):
    def test_round_trip_unicode_and_empty(self):
        for message in ("", "Hello\n世界 🔐", "x" * 8192):
            with self.subTest(length=len(message)):
                encrypted = encrypt(message)
                self.assertEqual(decrypt(encrypted["key"], encrypted["envelope"]), {"plaintext": message, "authenticated": True})

    def test_fresh_key_and_nonce(self):
        first, second = encrypt("same message"), encrypt("same message")
        self.assertNotEqual(first["key"], second["key"])
        self.assertNotEqual(first["envelope"].split(".")[1], second["envelope"].split(".")[1])
        self.assertEqual(len(base64.urlsafe_b64decode(first["key"])), 32)
        self.assertEqual(len(base64.urlsafe_b64decode(first["envelope"].split(".")[1])), 12)

    def test_tamper_and_wrong_key_rejected(self):
        data = encrypt("sample")
        for part_index in (1, 2):
            with self.subTest(part=part_index):
                parts = data["envelope"].split(".")
                raw = bytearray(base64.urlsafe_b64decode(parts[part_index]))
                raw[0] ^= 1
                parts[part_index] = base64.urlsafe_b64encode(raw).decode()
                with self.assertRaisesRegex(ValueError, "cannot be authenticated"):
                    decrypt(data["key"], ".".join(parts))
        with self.assertRaises(ValueError):
            decrypt(encrypt("other")["key"], data["envelope"])

    def test_invalid_envelopes(self):
        data = encrypt("sample")
        for envelope in ("", "v2." + data["envelope"].split(".", 1)[1], "v1.!.$", "v1.YQ==.Yg==", data["envelope"] + ".extra"):
            with self.subTest(envelope=envelope[:15]), self.assertRaises(ValueError):
                decrypt(data["key"], envelope)
        with self.assertRaises(ValueError):
            decrypt("not a key", data["envelope"])


class TrafficTests(unittest.TestCase):
    def test_reproducibility_and_seed_change(self):
        self.assertEqual(generate_traffic(42, 360, "baseline"), generate_traffic(42, 360, "baseline"))
        self.assertNotEqual(generate_traffic(42, 360, "baseline"), generate_traffic(43, 360, "baseline"))

    def test_counts_buckets_and_reserved_addresses(self):
        for scenario in ("baseline", "burst", "dns"):
            with self.subTest(scenario=scenario):
                data = generate_traffic(42, 360, scenario)
                self.assertEqual(len(data["series"]), 60)
                self.assertEqual(sum(b["packets"] for b in data["series"]), 360)
                self.assertEqual(sum(data["protocols"].values()), 360)
                self.assertEqual(sum(b["bytes"] for b in data["series"]), data["summary"]["bytes"])
                self.assertEqual(len({p["id"] for p in data["packets"]}), 360)
                timestamps = [(p["second"], p["millisecond"]) for p in data["packets"]]
                self.assertEqual(timestamps, sorted(timestamps))
                for p in data["packets"]:
                    self.assertIn(ipaddress.ip_address(p["source"]), ipaddress.ip_network("192.0.2.0/24"))
                    self.assertIn(ipaddress.ip_address(p["destination"]), ipaddress.ip_network("198.51.100.0/24"))

    def test_scenarios_have_expected_patterns(self):
        baseline, burst, dns = (generate_traffic(42, 360, s) for s in ("baseline", "burst", "dns"))
        self.assertGreater(burst["summary"]["peak_pps"], baseline["summary"]["peak_pps"])
        self.assertEqual(sum(p["pattern"] == "Injected burst" for p in burst["packets"]), 120)
        self.assertGreater(dns["protocols"]["DNS"], baseline["protocols"]["DNS"])

    def test_invalid_configuration(self):
        for args in ((-1, 360, "baseline"), (2**32, 360, "baseline"), (42, 1001, "baseline"), (42, 59, "baseline"), (42, 360, "capture")):
            with self.subTest(args=args), self.assertRaises(ValueError):
                generate_traffic(*args)


class APITests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app, base_url="http://127.0.0.1:8765", client=("127.0.0.1", 32100))
        self.addCleanup(self.client.close)

    def post(self, path, data, **kwargs):
        return self.client.post(path, json=data, headers={"X-Lab-Request": "1", **kwargs.pop("headers", {})}, **kwargs)

    def test_all_endpoints_and_local_assets(self):
        for path in ("/", "/static/app.js", "/static/style.css", "/static/favicon.svg", "/api/health"):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.headers["cache-control"], "no-store")
                self.assertIn("connect-src 'self'", response.headers["content-security-policy"])
        self.assertEqual(self.post("/api/url", {"url":"https://example.test"}).status_code, 200)
        self.assertEqual(self.post("/api/hash", {"text":"a", "comparison":"b"}).status_code, 200)
        enc = self.post("/api/encrypt", {"text":"hi"}).json()
        self.assertEqual(self.post("/api/decrypt", {"key":enc["key"], "envelope":enc["envelope"]}).json()["plaintext"], "hi")
        self.assertEqual(self.post("/api/traffic", {}).status_code, 200)

    def test_foreign_hosts_and_rebinding_blocked(self):
        for host in ("example.test", "127.0.0.1.evil.test", "localhost.evil.test", "0.0.0.0", "192.168.1.2", "localhost@evil.test"):
            with self.subTest(host=host):
                self.assertEqual(self.client.get("/", headers={"Host":host}).status_code, 403)

    def test_non_loopback_peer_blocked_even_with_forwarded_headers(self):
        with TestClient(app, base_url="http://127.0.0.1:8765", client=("192.0.2.1", 12345)) as client:
            self.assertEqual(client.get("/", headers={"X-Forwarded-For":"127.0.0.1"}).status_code, 403)

    def test_same_origin_and_foreign_origins(self):
        self.assertEqual(self.post("/api/encrypt", {"text":"a"}, headers={"Origin":"http://127.0.0.1:8765"}).status_code, 200)
        for origin in ("https://evil.test", "null", "http://localhost:8765", "http://127.0.0.1:9999"):
            with self.subTest(origin=origin):
                self.assertEqual(self.post("/api/encrypt", {"text":"a"}, headers={"Origin":origin}).status_code, 403)
        self.assertEqual(self.post("/api/encrypt", {"text":"a"}, headers={"Sec-Fetch-Site":"cross-site"}).status_code, 403)

    def test_json_marker_and_no_cors(self):
        self.assertEqual(self.client.post("/api/encrypt", json={"text":"a"}).status_code, 403)
        response = self.client.post("/api/encrypt", content='{"text":"a"}', headers={"X-Lab-Request":"1", "Content-Type":"text/plain"})
        self.assertEqual(response.status_code, 403)
        response = self.client.options("/api/encrypt", headers={"Origin":"https://evil.test", "Access-Control-Request-Method":"POST"})
        self.assertNotIn("access-control-allow-origin", response.headers)

    def test_validation_does_not_echo_secrets(self):
        response = self.post("/api/encrypt", {"text":"a", "secret":"do-not-repeat-this"})
        self.assertEqual(response.status_code, 422)
        self.assertNotIn("do-not-repeat-this", response.text)
        for body in ({"seed": True}, {"count": 1001}, {"scenario":"scan"}, {"seed":"42"}):
            self.assertEqual(self.post("/api/traffic", body).status_code, 422)

    def test_invalid_json_and_bounded_inputs(self):
        response = self.client.post("/api/encrypt", content="{", headers={"X-Lab-Request":"1", "Content-Type":"application/json"})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(self.post("/api/encrypt", {"text":"x" * 8193}).status_code, 422)
        self.assertEqual(self.post("/api/url", {"url":"https://example.test/" + "x" * 4096}).status_code, 422)

    def test_body_limit_including_chunked_requests(self):
        headers = {"X-Lab-Request":"1", "Content-Type":"application/json"}
        for content in (b"x" * (MAX_BODY + 1), iter([b"x" * 32768] * 3)):
            with self.subTest(chunked=not isinstance(content, bytes)):
                self.assertEqual(self.client.post("/api/encrypt", content=content, headers=headers).status_code, 413)

    def test_path_traversal_and_external_docs_unavailable(self):
        self.assertEqual(self.client.get("/static/%2e%2e/core.py").status_code, 404)
        self.assertEqual(self.client.get("/docs").status_code, 404)
        self.assertEqual(self.client.get("/openapi.json").status_code, 404)

    def test_operations_make_no_outbound_connections_or_dns_calls(self):
        # In-process ASGI transport requires no TCP connection. Any outbound call fails the test.
        with patch.object(socket, "getaddrinfo", side_effect=AssertionError("DNS forbidden")) as dns, \
             patch.object(socket.socket, "connect", side_effect=AssertionError("TCP forbidden")) as tcp, \
             patch.object(socket.socket, "connect_ex", side_effect=AssertionError("TCP forbidden")), \
             patch.object(socket.socket, "sendto", side_effect=AssertionError("UDP forbidden")):
            self.assertEqual(self.post("/api/url", {"url":"http://169.254.169.254/latest/meta-data/"}).status_code, 200)
            self.assertEqual(self.post("/api/hash", {"text":"x", "comparison":"y"}).status_code, 200)
            encrypted = self.post("/api/encrypt", {"text":"a"}).json()
            self.assertEqual(self.post("/api/decrypt", {"key":encrypted["key"], "envelope":encrypted["envelope"]}).status_code, 200)
            self.assertEqual(self.post("/api/traffic", {}).status_code, 200)
            dns.assert_not_called()
            tcp.assert_not_called()


if __name__ == "__main__":
    unittest.main()
