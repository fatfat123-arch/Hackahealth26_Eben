import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from fractions import Fraction

import av
import numpy as np
import imageio_ffmpeg

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from cartoonise import cartoonise, process_video


class TimingTest(unittest.TestCase):
    def test_vfr_rotation_runs_and_sampling(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / 'source.mp4'
            times = [0, 40, 100, 140, 220]
            with av.open(str(source), 'w') as out:
                stream = out.add_stream('libx264', rate=25)
                stream.width = 64
                stream.height = 32
                stream.pix_fmt = 'yuv420p'
                stream.time_base = stream.codec_context.time_base = Fraction(1, 1000)
                stream.codec_context.max_b_frames = 0
                stream.options = {'tune': 'zerolatency'}
                for i, timestamp in enumerate(times):
                    pixels = np.zeros((32, 64, 3), np.uint8)
                    pixels[:, :32, 2] = 230
                    frame = av.VideoFrame.from_ndarray(pixels, format='bgr24')
                    frame.pts = timestamp + 5000
                    frame.time_base = Fraction(1, 1000)
                    for packet in stream.encode(frame):
                        delta = (times[i+1] if i+1 < len(times) else 280) - timestamp
                        packet.duration = round(Fraction(delta, 1000) / packet.time_base)
                        out.mux(packet)
                for packet in stream.encode(None):
                    out.mux(packet)
            unchanged = root / 'unchanged.mp4'
            process_video(source, unchanged, transform=lambda x: x)
            with av.open(str(unchanged)) as check:
                self.assertAlmostEqual(float(check.streams.video[0].duration * check.streams.video[0].time_base), .28, places=4)
                self.assertEqual([round(f.pts*f.time_base*1000) for f in check.decode(video=0)], times)
            phone = root / 'phone.mov'
            subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-v', 'error', '-display_rotation', '90', '-i', str(source),
                            '-f', 'lavfi', '-i', 'sine=duration=0.28', '-map', '0:v', '-map', '1:a',
                            '-c:v', 'copy', '-c:a', 'aac', '-metadata:s:v:0', 'rotate=90', str(phone)], check=True)
            original = phone.read_bytes()
            runs = root / 'videos'
            first = cartoonise(phone, runs, transform=lambda x: x)
            second = cartoonise(phone, runs, transform=lambda x: x, max_fps=10)
            self.assertEqual(first.name, 'run1')
            self.assertEqual(second.name, 'run2')
            self.assertEqual((first / 'input.mov').read_bytes(), original)
            self.assertEqual(phone.read_bytes(), original)
            for folder, expected in [(first, times), (second, [0, 100, 220])]:
                with av.open(str(folder / 'output.mp4')) as inp:
                    self.assertEqual(len(inp.streams.audio), 0)
                    stream = inp.streams.video[0]
                    self.assertEqual((stream.width, stream.height), (32, 64))
                    frames = list(inp.decode(video=0))
                    self.assertEqual([round(f.pts*f.time_base*1000) for f in frames], expected)
                    self.assertAlmostEqual(float(stream.duration*stream.time_base), .26, places=4)
                    self.assertEqual(frames[0].rotation, 0)
                    image = frames[0].to_ndarray(format='bgr24')
                    self.assertGreater(image[-8:, :, 2].mean(), image[:8, :, 2].mean() + 100)
                report = json.loads((folder / 'run.json').read_text())
                self.assertEqual(report['status'], 'complete')
                self.assertTrue(report['source_variable_frame_rate'])
            cut = root / 'cut.mp4'
            process_video(phone, cut, transform=lambda x: x, duration=.12)
            with av.open(str(cut)) as inp:
                self.assertAlmostEqual(float(inp.streams.video[0].duration*inp.streams.video[0].time_base), .12, places=4)


if __name__ == '__main__':
    unittest.main()
