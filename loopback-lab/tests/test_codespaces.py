import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from lab.app import app
from lab.runtime import codespaces_origin, runtime


class CodespacesTests(unittest.TestCase):
    origin = "https://sample-lab-abc123-8765.app.github.dev"

    def test_valid_origin_and_opt_in(self):
        self.assertEqual(codespaces_origin(8765, {"CODESPACES":"true", "CODESPACE_NAME":"sample-lab-abc123"}), self.origin)
        for environment in ({}, {"CODESPACES":"false", "CODESPACE_NAME":"sample-lab-abc123"}, {"CODESPACES":"true", "CODESPACE_NAME":"x/evil"}, {"CODESPACES":"true", "CODESPACE_NAME":"x", "GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN":"evil.test"}):
            with self.subTest(environment=environment), self.assertRaises(ValueError):
                codespaces_origin(8765, environment)

    def test_preview_disabled_by_default(self):
        with TestClient(app, base_url=self.origin, client=("127.0.0.1", 1234)) as client:
            self.assertEqual(client.get("/").status_code, 403)

    def test_only_exact_preview_origin_accepted(self):
        with patch.object(runtime, "codespaces_origin", self.origin), TestClient(app, base_url=self.origin, client=("127.0.0.1", 1234)) as client:
            self.assertEqual(client.get("/").status_code, 200)
            self.assertEqual(client.get("/api/health").json()["mode"], "codespaces")
            headers = {"Origin":self.origin, "X-Lab-Request":"1"}
            self.assertEqual(client.post("/api/hash", json={"text":"a", "comparison":"b"}, headers=headers).status_code, 200)
            for origin in ("https://other-8765.app.github.dev", self.origin.replace("https:", "http:"), "null"):
                self.assertEqual(client.post("/api/hash", json={"text":"a", "comparison":"b"}, headers={**headers, "Origin":origin}).status_code, 403)
            self.assertEqual(client.get("/", headers={"Host":"other-8765.app.github.dev"}).status_code, 403)

    def test_forwarded_host_rewrite_and_loopback_remain_supported(self):
        with patch.object(runtime, "codespaces_origin", self.origin), TestClient(app, base_url="http://127.0.0.1:8765", client=("127.0.0.1", 1234)) as client:
            for origin in (self.origin, "http://127.0.0.1:8765"):
                self.assertEqual(client.post("/api/encrypt", json={"text":"demo"}, headers={"X-Lab-Request":"1", "Origin":origin}).status_code, 200)

    def test_remote_peers_still_rejected_in_preview_mode(self):
        with patch.object(runtime, "codespaces_origin", self.origin), TestClient(app, base_url=self.origin, client=("192.0.2.1", 1234)) as client:
            self.assertEqual(client.get("/", headers={"X-Forwarded-For":"127.0.0.1"}).status_code, 403)


if __name__ == "__main__":
    unittest.main()
