#!/usr/bin/env python3
"""Incremental, conservative cartoon filtering for constant-frame-rate video."""
import argparse
from fractions import Fraction
import heapq
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time


class ToolError(Exception):
    pass


def run(command):
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode:
        raise ToolError(f"{Path(command[0]).name} failed:\n{result.stderr[-4000:]}")
    return result.stdout


def number(value):
    try:
        result = float(value)
    except ValueError:
        raise argparse.ArgumentTypeError("expected seconds as a number")
    if not math.isfinite(result) or result < 0:
        raise argparse.ArgumentTypeError("must be a finite, nonnegative number")
    return result


def inspect_video(path, probe):
    info = json.loads(run([probe, '-v', 'error', '-show_streams', '-of', 'json', str(path)]))
    video = next((s for s in info['streams'] if s['codec_type'] == 'video'), None)
    if not video:
        raise ToolError('Input has no video stream.')
    try:
        fps = Fraction(video['avg_frame_rate'])
        tick = float(Fraction(video['time_base']))
        if fps <= 0:
            raise ValueError()
    except (ValueError, KeyError, ZeroDivisionError):
        raise ToolError('Cannot establish a reliable frame rate.')
    # Packet PTS inspection avoids decoding the entire source. A bounded reorder
    # heap handles B-frames; extreme reordering is conservatively rejected.
    print('Checking video packet timestamps with ffprobe (no filtering)...', flush=True)
    command = [probe, '-v', 'error', '-select_streams', 'v:0', '-show_packets',
               '-show_entries', 'packet=pts_time', '-of', 'csv=p=0', str(path)]
    heap, previous, first, count = [], None, None, 0
    expected = 1 / float(fps)
    tolerance = max(2 * tick, 0.000002)
    last_report = time.monotonic()

    def accept(pts):
        nonlocal previous, first, count
        if previous is not None and abs(pts - previous - expected) > tolerance:
            raise ToolError('Variable or discontinuous frame timing detected. This tool refuses '
                            'to convert VFR to CFR: doing so could duplicate/drop frames and alter '
                            'gesture timing. Use a timestamp-preserving VFR workflow instead.')
        if first is None:
            first = pts
        previous = pts
        count += 1

    with tempfile.TemporaryFile() as errors:
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=errors, text=True)
        try:
            for line in process.stdout:
                try:
                    pts = float(line.strip().split(',')[0])
                    if not math.isfinite(pts):
                        raise ValueError()
                except ValueError:
                    raise ToolError('Missing/invalid packet timestamps; cannot verify CFR safely.')
                heapq.heappush(heap, pts)
                if len(heap) > 64:
                    accept(heapq.heappop(heap))
                if time.monotonic() - last_report >= 5:
                    print(f'  Checked {count:,} timestamps...', flush=True)
                    last_report = time.monotonic()
            if process.wait():
                errors.seek(0)
                raise ToolError(f'ffprobe timestamp scan failed: {errors.read().decode()[-4000:]}')
            while heap:
                accept(heapq.heappop(heap))
        finally:
            process.stdout.close()
            if process.poll() is None:
                process.kill()
            process.wait()
    if count < 2:
        raise ToolError('At least two timestamped video packets are needed to verify CFR.')
    return video, any(s['codec_type'] == 'audio' for s in info['streams']), fps, first, count


def filter_frame(frame, strength, outlines, cv2, np, *, smoothing=None,
                 colour_step=None, outline_opacity=None, brightness_step=0):
    """Float Lab: L in [0,100], signed a/b approximately [-127,127].

    Explicit controls override the strength preset independently. Colour steps
    are Lab units, not OpenCV's offset/scaled uint8 Lab representation.
    """
    smoothing = strength if smoothing is None else smoothing
    colour_step = 24 * strength if colour_step is None else colour_step
    opacity = (0.30 * strength if outlines else 0) if outline_opacity is None else outline_opacity
    if smoothing == 0 and colour_step == 0 and opacity == 0 and brightness_step == 0:
        return frame.copy()

    # Float BGR must be normalized BEFORE cvtColor; a/b remain signed in Lab.
    lab = cv2.cvtColor(frame.astype(np.float32) / 255.0, cv2.COLOR_BGR2LAB)
    smooth = lab.copy()
    if smoothing > 0:
        for _ in range(2 if smoothing >= 0.75 else 1):
            # A small luminance range sigma avoids smoothing across boundaries.
            luminance = cv2.bilateralFilter(smooth[:, :, 0], 7, 3 + 5 * smoothing, 3)
            chroma = cv2.bilateralFilter(smooth, 7, 10 + 18 * smoothing, 3)
            smooth[:, :, 0] = luminance
            smooth[:, :, 1:] = chroma[:, :, 1:]
        smooth = lab * (1 - smoothing) + smooth * smoothing

    simplified = smooth.copy()
    if colour_step > 0:
        # Fixed zero-centred chroma bins preserve neutral greys, with no overflow.
        simplified[:, :, 1:] = np.clip(
            np.rint(smooth[:, :, 1:] / colour_step) * colour_step, -127, 127)
    if brightness_step > 0:
        simplified[:, :, 0] = np.clip(
            np.rint(smooth[:, :, 0] / brightness_step) * brightness_step, 0, 100)
    filtered = cv2.cvtColor(simplified, cv2.COLOR_LAB2BGR)
    if opacity > 0:
        # Edges precede ALL quantization, including optional L posterization.
        pre_quantized = cv2.cvtColor(smooth, cv2.COLOR_LAB2BGR)
        edge_source = np.clip(np.rint(pre_quantized * 255), 0, 255).astype(np.uint8)
        gray = cv2.cvtColor(edge_source, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 60, 120).astype(np.float32) / 255.0
        filtered *= 1 - opacity * edges[:, :, None]
    return np.clip(np.rint(filtered * 255), 0, 255).astype(np.uint8)


def read_frame(pipe, size):
    data = bytearray()
    while len(data) < size:
        chunk = pipe.read(size - len(data))
        if not chunk:
            break
        data.extend(chunk)
    if data and len(data) != size:
        raise ToolError('Decoder returned an incomplete video frame.')
    return data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--start', type=number, default=0, help='start in seconds from first video frame')
    parser.add_argument('--duration', type=number, help='duration in seconds (default: remaining video)')
    parser.add_argument('--strength', type=number, default=0.35, help='0–1; default 0.35 (mild)')
    parser.add_argument('--outlines', action='store_true', help='enable preset outline opacity (0.30 * strength)')
    parser.add_argument('--compare', action='store_true', help='save original (left) and filtered (right)')
    parser.add_argument('--smoothing', type=number, help='0–1; overrides strength smoothing preset')
    parser.add_argument('--colour-step', type=number, help='0–32 Lab a/b units; 0 disables colour quantization; default 24 * strength')
    parser.add_argument('--outline-opacity', type=number, help='0–1; overrides outline preset and enables outlines when positive')
    parser.add_argument('--brightness-step', type=number, default=0, help='0–4 Lab L units; 0 preserves smooth brightness (default)')
    args = parser.parse_args()
    if args.strength > 1 or args.duration == 0:
        parser.error('strength must be 0–1 and duration must be greater than zero')
    for name, maximum in [('smoothing', 1), ('colour_step', 32), ('outline_opacity', 1), ('brightness_step', 4)]:
        value = getattr(args, name)
        if value is not None and value > maximum:
            parser.error(f'{name.replace("_", "-")} must be between 0 and {maximum}')
    effective_colour_step = 24 * args.strength if args.colour_step is None else args.colour_step
    if args.brightness_step and (effective_colour_step == 0 or args.brightness_step >= effective_colour_step):
        parser.error('brightness-step must be finer than a positive colour-step')
    source, output = args.input.resolve(), args.output.resolve()
    if not source.is_file():
        raise ToolError(f'Input not found: {source}')
    if source == output or (output.exists() and os.path.samefile(source, output)):
        raise ToolError('Input and output must be different files. Input is never overwritten.')
    if output.exists():
        raise ToolError(f'Output already exists; choose a new name: {output}')
    if output.suffix.lower() != '.mp4':
        raise ToolError('Output must use the .mp4 extension.')
    if not output.parent.is_dir():
        raise ToolError(f'Output directory does not exist: {output.parent}')
    try:
        import cv2
        import numpy as np
        import imageio_ffmpeg
    except ImportError as exc:
        raise ToolError(f'Missing Python dependency: {exc}. Run: python -m pip install -r requirements.txt')
    probe = shutil.which('ffprobe')
    if not probe:
        raise ToolError('ffprobe is missing. Install FFmpeg using your OS package manager.')
    ffmpeg = os.environ.get('FFMPEG_BINARY') or imageio_ffmpeg.get_ffmpeg_exe()
    encoders = run([ffmpeg, '-hide_banner', '-encoders'])
    if 'libx264' not in encoders or ' aac ' not in encoders:
        raise ToolError('FFmpeg must provide libx264 and AAC encoders. Unset FFMPEG_BINARY to use the bundled build.')
    video, audio, fps, first_pts, total = inspect_video(source, probe)
    width, height = video['width'], video['height']
    if width % 2 or height % 2:
        raise ToolError('yuv420p requires even dimensions; refusing to resize/crop the source.')
    if any(s.get('rotation', 0) for s in video.get('side_data_list', [])):
        raise ToolError('Rotated video metadata is unsupported; normalize orientation explicitly first.')
    start_frame = int(args.start * fps + 0.5)
    if start_frame >= total:
        raise ToolError('Start is beyond the end of the video.')
    frames = total - start_frame
    if args.duration is not None:
        frames = min(frames, int(args.duration * fps + 0.5))
    if frames < 1:
        raise ToolError('Requested duration is shorter than one rounded frame.')
    actual_start = start_frame / float(fps)
    duration = frames / float(fps)
    print(f'CFR verified: {width}x{height}, {fps} fps; {total:,} frames.\n'
          f'Segment: {actual_start:.6f}s + {duration:.6f}s ({frames} frames). '
          'Boundaries rounded to nearest frame.\n'
          f'Preset {args.strength}; smoothing {args.smoothing if args.smoothing is not None else args.strength}; '
          f'Lab colour step {effective_colour_step}; brightness step {args.brightness_step}; '
          f'outline opacity {args.outline_opacity if args.outline_opacity is not None else (0.30 * args.strength if args.outlines else 0)}.', flush=True)
    out_width = width * (2 if args.compare else 1)
    cv2.setNumThreads(1)
    with tempfile.TemporaryDirectory(prefix='.cartoonize-', dir=output.parent) as temp:
        temp = Path(temp)
        silent = temp / 'filtered.mp4'
        final = temp / 'final.mp4'
        decode_cmd = [ffmpeg, '-v', 'error', '-nostdin', '-noautorotate', '-i', str(source),
                      '-map', '0:v:0', '-vf',
                      f'trim=start_frame={start_frame}:end_frame={start_frame + frames},setpts=PTS-STARTPTS',
                      '-an', '-fps_mode', 'passthrough', '-pix_fmt', 'bgr24', '-f', 'rawvideo', 'pipe:1']
        encode_cmd = [ffmpeg, '-v', 'error', '-nostdin', '-n', '-f', 'rawvideo', '-pix_fmt', 'bgr24',
                      '-s', f'{out_width}x{height}', '-framerate', str(fps), '-i', 'pipe:0',
                      '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
                      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(silent)]
        with tempfile.TemporaryFile() as dec_err, tempfile.TemporaryFile() as enc_err:
            decoder = subprocess.Popen(decode_cmd, stdout=subprocess.PIPE, stderr=dec_err)
            encoder = None
            try:
                encoder = subprocess.Popen(encode_cmd, stdin=subprocess.PIPE, stderr=enc_err)
                last = time.monotonic()
                for index in range(frames):
                    raw = read_frame(decoder.stdout, width * height * 3)
                    if not raw:
                        raise ToolError(f'Decoder stopped after {index}/{frames} frames.')
                    original = np.frombuffer(raw, np.uint8).reshape(height, width, 3)
                    filtered = filter_frame(original, args.strength, args.outlines, cv2, np,
                                            smoothing=args.smoothing, colour_step=args.colour_step,
                                            outline_opacity=args.outline_opacity,
                                            brightness_step=args.brightness_step)
                    result = np.concatenate((original, filtered), axis=1) if args.compare else filtered
                    encoder.stdin.write(result.tobytes())
                    if time.monotonic() - last >= 5 or index + 1 == frames:
                        print(f'  {index + 1}/{frames} frames ({100 * (index + 1) / frames:.1f}%)', flush=True)
                        last = time.monotonic()
                encoder.stdin.close()
                # Closing the pipe also stops unnecessary decoding past the segment.
                decoder.stdout.close()
                if decoder.wait() or encoder.wait():
                    raise ToolError('Video decoder or encoder failed.')
            except (BrokenPipeError, ToolError) as exc:
                for proc in (decoder, encoder):
                    if proc and proc.poll() is None:
                        proc.kill()
                    if proc:
                        proc.wait()
                dec_err.seek(0)
                enc_err.seek(0)
                raise ToolError(f'{exc}\n{dec_err.read().decode()[-2000:]}\n{enc_err.read().decode()[-2000:]}')
            finally:
                for proc in (decoder, encoder):
                    if proc and proc.poll() is None:
                        proc.kill()
                    if proc:
                        proc.wait()
                if decoder.stdout:
                    decoder.stdout.close()
                if encoder and encoder.stdin and not encoder.stdin.closed:
                    encoder.stdin.close()
        if audio:
            print('Adding synchronized audio (AAC re-encode for accurate segment cuts)...', flush=True)
            absolute_start = first_pts + actual_start
            run([ffmpeg, '-v', 'error', '-nostdin', '-n', '-i', str(silent),
                 '-copyts', '-i', str(source), '-map', '0:v:0', '-map', '1:a:0',
                 '-c:v', 'copy', '-af',
                 f'atrim=start={absolute_start:.9f}:end={absolute_start + duration:.9f},'
                 f'asetpts=PTS-({absolute_start:.9f})/TB,aresample=async=1:first_pts=0',
                 '-c:a', 'aac', '-b:a', '192k', '-t', f'{duration:.9f}',
                 '-movflags', '+faststart', str(final)])
        else:
            print('Source has no audio track.', flush=True)
            final = silent
        # Exclusive hard-link publication: even a concurrently created output is safe.
        os.link(final, output)
    print(f'Saved {output}', flush=True)


if __name__ == '__main__':
    try:
        main()
    except (ToolError, OSError, ValueError) as exc:
        print(f'Error: {exc}', file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        print('\nCancelled; temporary output removed.', file=sys.stderr)
        sys.exit(130)
