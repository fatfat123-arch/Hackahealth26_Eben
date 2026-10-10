"""Encode a rendered rig test, using the existing project venv and FFmpeg."""
import argparse,subprocess
from pathlib import Path
import imageio_ffmpeg
p=argparse.ArgumentParser(); p.add_argument('target',choices=['forehead','cheek','head_top','foot_grab']); a=p.parse_args()
folder=Path(__file__).resolve().parent/'output'/a.target/'frames'
if any(not (folder/f'frame_{f:04d}.png').is_file() for f in range(1,97)):
    raise SystemExit('Render all 96 frames first with --render animation.')
subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-y','-framerate','24','-i',str(folder/'frame_%04d.png'),
                '-frames:v','96','-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(folder.parent/'preview.mp4')],check=True)
print(folder.parent/'preview.mp4')
