import unittest

from mcp_server import (
    analyze_hypothesis_pressure,
    ask_reading_context_question,
    get_reading_stage,
    list_reading_stages,
)


class MCPToolTests(unittest.TestCase):
    def test_list_reading_stages(self):
        result = list_reading_stages()

        self.assertTrue(result["ok"])
        self.assertEqual(len(result["data"]["stages"]), 8)
        self.assertEqual(result["data"]["stages"][4]["checkpoint_id"], "CP1")

    def test_get_reading_stage(self):
        result = get_reading_stage(5)

        self.assertTrue(result["ok"])
        self.assertEqual(result["data"]["stage"]["checkpoint"]["checkpoint_id"], "CP1")

    def test_get_reading_stage_rejects_unknown_stage(self):
        result = get_reading_stage(999)

        self.assertFalse(result["ok"])
        self.assertIn("unknown stage_id", result["error"])

    def test_analyze_hypothesis_pressure_uses_existing_fallback_without_key(self):
        result = analyze_hypothesis_pressure(
            "他可能会利用老鼠发现的通道离开牢房。",
            "medium",
        )

        self.assertTrue(result["ok"])
        self.assertEqual(result["data"]["analysis"]["category"], "UNCLEAR")

    def test_ask_reading_context_question_uses_existing_fallback_without_key(self):
        result = ask_reading_context_question(
            "test-session",
            "一英尺大约是多少厘米？",
            3,
        )

        self.assertTrue(result["ok"])
        self.assertTrue(result["data"]["answer"]["fallback"])


if __name__ == "__main__":
    unittest.main()
