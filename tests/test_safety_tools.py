import unittest

from safety_tools import analyze_context_offer, check_email_headers, compare_organization_domain, safety_checklist


class SafetyToolTests(unittest.TestCase):
    def test_email_header_mismatches_are_cautious_and_explained(self):
        result = check_email_headers(
            "From: Billing <notice@example.org>\n"
            "Reply-To: attacker@other.invalid\n"
            "Authentication-Results: mx.example; spf=fail; dkim=pass; dmarc=fail\n"
        )
        self.assertEqual(result["risk_label"], "caution")
        self.assertTrue(any("Reply-To" in finding for finding in result["findings"]))
        self.assertTrue(any("SPF" in finding for finding in result["findings"]))
        self.assertIn("does not verify", result["disclaimer"])

    def test_email_headers_are_bounded(self):
        with self.assertRaisesRegex(ValueError, "12,000"):
            check_email_headers("x" * 12_001)

    def test_context_check_keeps_uncertainty_and_adds_specific_job_signals(self):
        result = analyze_context_offer("job", "Pay a registration fee to receive guaranteed income.")
        self.assertEqual(result["risk_label"], "caution")
        self.assertEqual(len(result["findings"]), 2)
        self.assertTrue(result["checklist"])
        self.assertIn("not proof", result["disclaimer"])

    def test_directory_matches_only_exact_host_or_subdomain(self):
        direct = compare_organization_domain("https://reportfraud.ftc.gov/case")
        deceptive = compare_organization_domain("https://reportfraud.ftc.gov.attacker.invalid/")
        self.assertEqual(len(direct["matches"]), 1)
        self.assertEqual(deceptive["matches"], [])

    def test_safety_checklist_rejects_unknown_scenarios(self):
        self.assertEqual(len(safety_checklist("marketplace")), 4)
        with self.assertRaisesRegex(ValueError, "supported"):
            safety_checklist("unknown")


if __name__ == "__main__":
    unittest.main()
