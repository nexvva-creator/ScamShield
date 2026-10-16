import unittest

from scamshield.analysis import analyze_message, analyze_url


class UrlAnalysisTests(unittest.TestCase):
    def test_clean_looking_url_is_unknown_without_threat_feed(self):
        result = analyze_url("https://example.org/account")
        self.assertEqual(result["risk_label"], "unknown")
        self.assertEqual(result["coverage"][1]["status"], "not_configured")
        self.assertNotIn("safe", result["title"].lower())

    def test_weak_url_signals_are_explained(self):
        result = analyze_url("http://xn--login-example.top:8080/verify")
        self.assertEqual(result["risk_label"], "caution")
        evidence_types = {item["type"] for item in result["evidence"]}
        self.assertIn("punycode_hostname", evidence_types)
        self.assertIn("unencrypted_http", evidence_types)
        self.assertIn("uncommon_domain_suffix", evidence_types)
        self.assertIn("unusual_port", evidence_types)

    def test_additional_url_structure_signals_are_explained(self):
        result = analyze_url("https://example123456789.com/path%2fhidden")
        evidence_types = {item["type"] for item in result["evidence"]}
        self.assertIn("digit_heavy_hostname", evidence_types)
        self.assertIn("encoded_url_path", evidence_types)

    def test_local_or_reserved_addresses_are_rejected(self):
        for url in ("http://127.0.0.1/admin", "http://localhost/", "http://[::1]/"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                analyze_url(url)

    def test_non_web_schemes_and_embedded_credentials_are_rejected(self):
        for url in ("javascript:alert(1)", "ftp://example.org/file", "https://user:secret@example.org/"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                analyze_url(url)


class MessageAnalysisTests(unittest.TestCase):
    def test_supported_locales_translate_message_results(self):
        samples = {
            "es": "código otp",
            "fr": "code de vérification",
            "hi": "ओटीपी",
            "ar": "رمز OTP",
            "bn": "ওটিপি",
        }
        for locale, phrase in samples.items():
            with self.subTest(locale=locale):
                result = analyze_message(f"Please send the {phrase} now", locale)
                self.assertEqual(result["locale"], locale)
                evidence = next(item for item in result["evidence"] if item["type"] == "requests_secret")
                self.assertNotIn("message asks", evidence["text"].lower())
                self.assertNotEqual(result["title"], "Pause and verify")

    def test_supported_locales_translate_url_results(self):
        for locale in ("es", "fr", "hi", "ar", "bn"):
            with self.subTest(locale=locale):
                result = analyze_url("http://bit.ly/example", locale)
                self.assertEqual(result["locale"], locale)
                self.assertNotEqual(result["title"], "Pause and verify")
                self.assertIn("shortened_url", {item["type"] for item in result["evidence"]})

    def test_ordinary_message_is_unknown_and_explains_coverage(self):
        result = analyze_message("Your monthly statement is ready.")
        self.assertEqual(result["risk_label"], "unknown")
        self.assertIn("provider is configured", result["disclaimer"])

    def test_message_links_are_extracted_but_not_opened(self):
        result = analyze_message("Please review https://bit.ly/example before paying")
        self.assertEqual(result["detected_links"], ["bit.ly"])
        self.assertIn("shortened_url", {item["type"] for item in result["evidence"]})
        self.assertIn("contains_link", {item["type"] for item in result["evidence"]})

    def test_empty_and_oversized_messages_are_rejected(self):
        for message in (" ", "x" * 6001):
            with self.subTest(length=len(message)), self.assertRaises(ValueError):
                analyze_message(message)


if __name__ == "__main__":
    unittest.main()
