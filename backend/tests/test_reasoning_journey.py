import unittest

from unittest.mock import patch

from reasoning_journey_service import (
    build_journey_model_payload,
    build_journey_prompt,
    summarize_reasoning_journey,
)
from schemas import ReasoningJourneyRequest


def make_request() -> ReasoningJourneyRequest:
    return ReasoningJourneyRequest(
        hypothesis_v1={"text": "他会找到牢房中的隐藏出口并从那里离开。", "confidence": "high"},
        stress_result={
            "selected_assumption": "隐藏出口足以让成年人通过",
            "pressure_question": "老鼠能够消失，是否已经证明成年人也能从同一路径通过？",
            "rationale_evidence_ids": ["E02"],
        },
        hypothesis_v2={"text": "隐藏路径也许用于与外界建立联系。", "confidence": "medium"},
        final_reasoning="他通过隐藏路径联系外界，再借停电和维修人员进入的机会离开。",
        annotations=[{"quote": "五美元变成了零钱", "note": "可能发生了交换"}],
    )


class ReasoningJourneyTests(unittest.TestCase):
    def test_prompt_reuses_existing_reasoning_and_fixed_solution(self):
        prompt = build_journey_prompt(make_request())
        self.assertIn("隐藏出口", prompt)
        self.assertIn("五美元变成了零钱", prompt)
        self.assertIn("E01", prompt)
        self.assertIn("solution_steps", prompt)

    def test_payload_is_one_low_temperature_json_call(self):
        payload = build_journey_model_payload(make_request())
        self.assertEqual(payload["response_format"], {"type": "json_object"})
        self.assertEqual(payload["temperature"], 0.2)
        self.assertFalse(payload["enable_thinking"])
        self.assertEqual(len(payload["messages"]), 2)

    def test_missing_api_key_returns_structured_fallback(self):
        with patch("reasoning_journey_service.AI_API_KEY", ""):
            result = summarize_reasoning_journey(make_request())
        self.assertEqual(result.source, "fallback")
        self.assertGreaterEqual(len(result.reasoning_map), 3)
        self.assertIn("隐藏出口", result.shift.changed)
        self.assertEqual([node.stage for node in result.reasoning_map], ["V1", "CP2", "V2", "FINAL"])
        self.assertEqual(result.late_arriving_clue.arrived_at, "ANNOTATION_ONLY")
        self.assertEqual(len(result.solution_path), 5)


if __name__ == "__main__":
    unittest.main()
