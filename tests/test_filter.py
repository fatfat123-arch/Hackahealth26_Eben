"""Checks for float Lab handling and independent stylization controls."""
import unittest
import cv2
import numpy as np
from cartoonize import filter_frame


class LabFilterTests(unittest.TestCase):
    def test_identity_and_smooth_neutral_brightness(self):
        ramp = np.tile(np.arange(256, dtype=np.uint8)[None, :, None], (16, 1, 3))
        self.assertTrue(np.array_equal(filter_frame(ramp, 0, False, cv2, np), ramp))
        result = filter_frame(ramp, 1, False, cv2, np, smoothing=0, colour_step=32)
        self.assertLessEqual(np.max(np.abs(result.astype(float) - ramp)), 1)
        self.assertGreater(len(np.unique(result)), 250)

    def test_independent_outline_opacity_and_determinism(self):
        frame = np.zeros((64, 64, 3), np.uint8)
        frame[:, :32] = (130, 160, 190)
        frame[:, 32:] = (30, 50, 70)
        def apply(opacity):
            return filter_frame(frame, 0, False, cv2, np, smoothing=1,
                                colour_step=24, outline_opacity=opacity)
        bare, subtle, defined = apply(0), apply(0.15), apply(0.30)
        self.assertTrue(np.array_equal(defined, apply(0.30)))
        self.assertTrue(np.all(defined <= subtle))
        self.assertTrue(np.all(subtle <= bare))
        self.assertTrue(np.any(defined < subtle))
        self.assertTrue(np.array_equal(bare[:, :20], defined[:, :20]))
        # Explicit colour settings work even with a zero preset.
        self.assertFalse(np.array_equal(bare, frame))


if __name__ == '__main__':
    unittest.main()
