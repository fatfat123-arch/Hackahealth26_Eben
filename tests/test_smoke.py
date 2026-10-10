"""Small integration fixtures; never reads the person's gesture video."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

import imageio_ffmpeg
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()


class SmokeTest(unittest.TestCase):
    def test_segment_audio_comparison_and_guards(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'source.mp4'
            output = Path(directory) / 'output.mp4'
            subprocess.run([FFMPEG, '-v', 'error', '-f', 'lavfi', '-i',
                            'testsrc2=size=160x120:rate=30000/1001:duration=3',
                            '-f', 'lavfi', '-i',
                            "aevalsrc='if(between(t,1,1.5),sin(2*PI*440*t),0)':s=48000:d=3",
                            '-c:v', 'libx264', '-c:a', 'aac', str(source)], check=True)
            command = [sys.executable, str(ROOT / 'cartoonize.py'), str(source), str(output),
                       '--start', '0.5', '--duration', '1.5', '--compare', '--outlines']
            result = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            streams = json.loads(subprocess.check_output([
                'ffprobe', '-v', 'error', '-show_streams', '-of', 'json', str(output)]))['streams']
            video, audio = streams
            self.assertEqual((video['width'], video['height']), (320, 120))
            self.assertEqual(video['codec_name'], 'h264')
            self.assertEqual(video['pix_fmt'], 'yuv420p')
            self.assertEqual(video['avg_frame_rate'], '30000/1001')
            self.assertEqual(int(video['nb_frames']), 45)
            self.assertAlmostEqual(float(video['duration']), 1.5015, places=4)
            self.assertAlmostEqual(float(audio['duration']), 1.5015, delta=0.001)
            raw = subprocess.check_output([FFMPEG, '-v', 'error', '-i', str(output),
                                           '-map', '0:a:0', '-f', 'f32le', '-ac', '1',
                                           '-ar', '48000', 'pipe:1'])
            samples = np.frombuffer(raw, np.float32)
            def rms(start, end):
                return np.sqrt(np.mean(samples[int(start * 48000):int(end * 48000)] ** 2))
            self.assertLess(rms(0.1, 0.3), 0.01)
            self.assertGreater(rms(0.6, 0.8), 0.3)
            self.assertLess(rms(1.2, 1.4), 0.01)
            data = output.read_bytes()
            self.assertLess(data.index(b'moov'), data.index(b'mdat'))
            self.assertNotEqual(subprocess.run(command, capture_output=True).returncode, 0)
            same = subprocess.run([sys.executable, str(ROOT / 'cartoonize.py'),
                                   str(source), str(source)], capture_output=True, text=True)
            self.assertIn('never overwritten', same.stderr)

    def test_vfr_refused_and_silent_cfr(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'vfr.mp4'
            output = Path(directory) / 'output.mp4'
            subprocess.run([FFMPEG, '-v', 'error', '-f', 'lavfi', '-i',
                            'testsrc2=size=160x120:rate=30:duration=1', '-vf',
                            "select='if(lt(n,15),1,not(mod(n,2)))'", '-fps_mode', 'vfr',
                            '-c:v', 'libx264', str(source)], check=True)
            result = subprocess.run([sys.executable, str(ROOT / 'cartoonize.py'),
                                     str(source), str(output)], capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('Variable or discontinuous', result.stderr)
            self.assertFalse(output.exists())
            cfr = Path(directory) / 'silent.mp4'
            subprocess.run([FFMPEG, '-v', 'error', '-f', 'lavfi', '-i',
                            'testsrc2=size=160x120:rate=30:duration=0.2',
                            '-c:v', 'libx264', str(cfr)], check=True)
            result = subprocess.run([sys.executable, str(ROOT / 'cartoonize.py'),
                                     str(cfr), str(output), '--strength', '0'],
                                    capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn('no audio', result.stdout)


if __name__ == '__main__':
    unittest.main()
