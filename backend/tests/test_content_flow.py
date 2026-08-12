import unittest

from content import EVIDENCE, STAGES_BY_ID


class ContentFlowTests(unittest.TestCase):
    def test_cp0_is_training_after_seven_doors(self):
        stage3 = STAGES_BY_ID[3]

        self.assertEqual(stage3.checkpoint.checkpoint_id, "CP0")
        self.assertEqual(stage3.checkpoint.kind, "training")
        self.assertIn("七道门", " ".join(stage3.segments))

    def test_cp2_appears_only_after_e03_is_read(self):
        stage4 = STAGES_BY_ID[4]
        stage5 = STAGES_BY_ID[5]
        stage6 = STAGES_BY_ID[6]

        self.assertIsNone(stage4.checkpoint)
        self.assertEqual(stage5.checkpoint.checkpoint_id, "CP1")
        self.assertEqual(
            [item.evidence_id for item in stage5.allowed_evidence],
            ["E01", "E02"],
        )

        self.assertEqual(stage6.checkpoint.checkpoint_id, "CP2")
        self.assertEqual(stage6.checkpoint.kind, "pressure")
        self.assertEqual(
            [item.evidence_id for item in stage6.allowed_evidence],
            ["E01", "E02", "E03"],
        )
        self.assertTrue(
            any(
                "外部维修人员进入监狱" in segment
                for segment in stage6.segments
            )
        )

    def test_checkpoint_ids_form_one_contiguous_flow(self):
        checkpoints = [
            STAGES_BY_ID[stage_id].checkpoint
            for stage_id in (3, 5, 6, 7)
        ]

        self.assertEqual(
            [checkpoint.checkpoint_id for checkpoint in checkpoints],
            ["CP0", "CP1", "CP2", "CP3"],
        )
        self.assertEqual(
            [checkpoint.kind for checkpoint in checkpoints],
            ["training", "capture", "pressure", "final"],
        )
        self.assertEqual(
            [
                checkpoint.checkpoint_id
                for checkpoint in checkpoints
                if checkpoint.kind == "pressure"
            ],
            ["CP2"],
        )

    def test_cp1_content_does_not_overprove_e02(self):
        text_before_cp2 = " ".join(
            segment
            for stage_id in range(1, 7)
            for segment in STAGES_BY_ID[stage_id].segments
        )

        self.assertNotIn("排水管通向河里吧", text_before_cp2)
        self.assertEqual(
            STAGES_BY_ID[6].allowed_evidence[2].source_stage,
            6,
        )

    def test_e01_unlocks_only_after_the_search_is_read(self):
        self.assertEqual(EVIDENCE["E01"].source_stage, 2)
        self.assertEqual(STAGES_BY_ID[1].allowed_evidence, [])
        self.assertEqual(
            [item.evidence_id for item in STAGES_BY_ID[2].allowed_evidence],
            ["E01"],
        )


if __name__ == "__main__":
    unittest.main()
