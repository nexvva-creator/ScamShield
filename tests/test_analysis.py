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
        self.assertIsInstance(result["score"], int)
        self.assertTrue(result["title"])
        evidence_types = {item["type"] for item in result["evidence"]}
        self.assertIn("punycode_hostname", evidence_types)
        self.assertIn("unencrypted_http", evidence_types)
        self.assertIn("uncommon_domain_suffix", evidence_types)
        self.assertIn("unusual_port", evidence_types)

    def test_local_or_reserved_addresses_are_rejected(self):
        for url in ("http://127.0.0.1/admin", "http://localhost/", "http://[::1]/"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                analyze_url(url)

    def test_non_web_schemes_and_embedded_credentials_are_rejected(self):
        for url in ("javascript:alert(1)", "ftp://example.org/file", "https://user:secret@example.org/"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                analyze_url(url)


class MessageAnalysisTests(unittest.TestCase):
    def test_curated_message_cases_cover_scam_signals_and_benign_examples(self):
        cases = (
            (
                "delivery-fee scam",
                "Delivery attempt failed. Pay a redelivery fee today to release your parcel.",
                {"requests_upfront_payment"},
                "unknown",
            ),
            (
                "account takeover link",
                "We detected a suspicious sign-in. Secure your account now at https://example.com/login.",
                {"pushes_link_action"},
                "unknown",
            ),
            (
                "credential theft",
                "Your bank account is locked. Reply with your OTP immediately to restore access.",
                {"requests_secret", "creates_urgency"},
                "caution",
            ),
            (
                "job fee scam",
                "You were selected for a remote job. Pay a processing fee before onboarding.",
                {"job_offer", "requests_upfront_payment"},
                "caution",
            ),
            (
                "recovery scam",
                "We can recover your lost crypto with guaranteed profit. Pay an upfront fee to begin.",
                {"unrealistic_return", "requests_upfront_payment"},
                "caution",
            ),
        )
        for name, message, expected_types, expected_label in cases:
            with self.subTest(name=name):
                result = analyze_message(message)
                actual_types = {item["type"] for item in result["evidence"]}
                self.assertTrue(expected_types.issubset(actual_types))
                self.assertEqual(result["risk_label"], expected_label)

    def test_word_boundaries_avoid_pin_substring_false_positive(self):
        result = analyze_message("Your parcel was delivered today. Thank you for shopping with us.")
        self.assertNotIn("requests_secret", {item["type"] for item in result["evidence"]})
        self.assertEqual(result["risk_label"], "unknown")
        self.assertEqual(result["score"], 0)

    def test_security_reminder_does_not_look_like_a_secret_request(self):
        result = analyze_message(
            "Security reminder: never share your OTP, PIN, or password with anyone who calls you."
        )
        self.assertNotIn("requests_secret", {item["type"] for item in result["evidence"]})
        self.assertEqual(result["risk_label"], "unknown")

    def test_supported_locales_translate_message_results(self):
        samples = {
            "es": "código otp",
            "fr": "code de vérification",
            "hi": "ओटीपी",
            "ar": "رمز OTP",
        }
        for locale, phrase in samples.items():
            with self.subTest(locale=locale):
                result = analyze_message(f"Please send the {phrase} now", locale)
                self.assertEqual(result["locale"], locale)
                evidence = next(item for item in result["evidence"] if item["type"] == "requests_secret")
                self.assertNotIn("message asks", evidence["text"].lower())
                self.assertNotEqual(result["title"], "Pause and verify")

    def test_supported_locales_translate_url_results(self):
        for locale in ("es", "fr", "hi", "ar"):
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
