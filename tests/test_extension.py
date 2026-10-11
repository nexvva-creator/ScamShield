import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EXTENSION_DIR = ROOT / "extension"


class ExtensionPackageTests(unittest.TestCase):
    def test_manifest_is_mv3_and_limits_host_access_to_local_app(self):
        manifest = json.loads((EXTENSION_DIR / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["manifest_version"], 3)
        self.assertEqual(manifest["host_permissions"], ["http://127.0.0.1:8000/*"])
        self.assertNotIn("<all_urls>", manifest["host_permissions"])
        self.assertEqual(manifest["background"]["service_worker"], "background.js")

    def test_extension_scripts_and_pages_exist(self):
        manifest = json.loads((EXTENSION_DIR / "manifest.json").read_text(encoding="utf-8"))
        paths = [
            manifest["background"]["service_worker"],
            manifest["action"]["default_popup"],
            "common.js",
            "popup.js",
            "popup.css",
            "result.html",
            "result.js",
            "content-script.js",
            "warning.css",
        ]
        for relative_path in paths:
            with self.subTest(path=relative_path):
                self.assertTrue((EXTENSION_DIR / relative_path).is_file())

    def test_extension_does_not_inject_scripts_on_all_pages(self):
        manifest = json.loads((EXTENSION_DIR / "manifest.json").read_text(encoding="utf-8"))
        self.assertNotIn("content_scripts", manifest)
        self.assertNotIn("webNavigation", manifest.get("permissions", []))
        self.assertEqual(
            manifest["optional_host_permissions"],
            ["http://*/*", "https://*/*"],
        )


if __name__ == "__main__":
    unittest.main()
