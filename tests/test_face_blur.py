import unittest
import numpy as np
from face_blur import FaceBlur
from cartoonize import ToolError


class SequenceDetector:
    def __init__(self, values): self.values=iter(values)
    def detect(self,image): return None,next(self.values)


class FaceBlurTests(unittest.TestCase):
    def setUp(self):
        yy,xx=np.indices((160,200))
        self.frame=np.repeat((((xx//3+yy//3)%2)*255).astype(np.uint8)[...,None],3,axis=2)

    def test_strength_and_background(self):
        weak=FaceBlur(.15,box=(65,40,60,70))(self.frame)
        strong=FaceBlur(.9,box=(65,40,60,70))(self.frame)
        self.assertLess(strong[60:95,85:110].var(),weak[60:95,85:110].var())
        self.assertTrue(np.array_equal(strong[:10,:20],self.frame[:10,:20]))
        self.assertTrue(np.array_equal(FaceBlur(0)(self.frame),self.frame))

    def test_comparison_left_untouched(self):
        frame=np.concatenate([self.frame,self.frame],axis=1)
        result=FaceBlur(.8,comparison=True,box=(65,40,60,70))(frame)
        self.assertTrue(np.array_equal(result[:,:200],frame[:,:200]))
        self.assertFalse(np.array_equal(result[:,200:],frame[:,200:]))

    def test_missing_detection_aborts_instead_of_unblurred_output(self):
        effect=FaceBlur(detector=SequenceDetector([None]))
        with self.assertRaisesRegex(ToolError,'No face found'): effect(self.frame)
        face=np.array([[100,80,90,100]])
        effect=FaceBlur(detector=SequenceDetector([face,None,None]),max_missed=1)
        effect(self.frame); effect(self.frame)
        self.assertEqual(effect.gap_frames,1)
        with self.assertRaisesRegex(ToolError,'tracking lost'): effect(self.frame)

    def test_edge_box_and_invalid_box(self):
        result=FaceBlur(box=(0,0,60,70))(self.frame)
        self.assertEqual(result.shape,self.frame.shape)
        with self.assertRaisesRegex(ToolError,'outside'):
            FaceBlur(box=(180,40,60,70))(self.frame)


if __name__=='__main__': unittest.main()
