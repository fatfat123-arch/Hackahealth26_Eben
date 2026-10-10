"""Silent TFLite video processing with phone timestamps and numbered run folders.

  python Cartooniser/cartoonise.py video.mov
  python Cartooniser/cartoonise.py video.mov --max-fps 15 --crf 26

Each run keeps input.<extension>, output.mp4 and run.json in videos/runN.
The original file is never overwritten. No face blur or audio is added.
"""
import argparse
from fractions import Fraction
import hashlib
import json
import math
from pathlib import Path
import shutil
import sys
import time

try:
    import av
    import cv2
    import numpy as np
except ImportError as exc:
    raise SystemExit(f"Missing dependency: {exc}. Install Cartooniser/requirements.txt")

MODEL_PATH = Path(__file__).resolve().parent / "model.tflite"
SIZE = 512


def _interpreter():
    if getattr(_interpreter, "session", None) is None:
        if not MODEL_PATH.is_file():
            raise ValueError(f"Missing cartoon model: {MODEL_PATH}")
        try:
            import tensorflow as tf
            interpreter = tf.lite.Interpreter
        except (ImportError, AttributeError) as exc:
            raise ValueError("A TensorFlow installation providing tf.lite.Interpreter is required.") from exc
        session = interpreter(model_path=str(MODEL_PATH), num_threads=4)
        session.allocate_tensors()
        details = session.get_input_details()[0]
        if tuple(details['shape']) != (1, SIZE, SIZE, 3) or details['dtype'] != np.float32:
            raise ValueError("Expected this project's float-input 512x512 TFLite model.")
        _interpreter.session = session
        _interpreter.input_index = details["index"]
        _interpreter.output_index = session.get_output_details()[0]["index"]
    return _interpreter.session, _interpreter.input_index, _interpreter.output_index


def cartoon_frame(frame):
    """Cartoonise one frame and return it at the original size."""
    height, width = frame.shape[:2]
    scale = SIZE / max(height, width)
    new_w = max(1, int(round(width * scale)))
    new_h = max(1, int(round(height * scale)))
    resized = cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_AREA)
    normalised = resized.astype(np.float32) / 127.5 - 1.0

    top = (SIZE - new_h) // 2
    left = (SIZE - new_w) // 2
    square = cv2.copyMakeBorder(
        normalised,
        top,
        SIZE - new_h - top,
        left,
        SIZE - new_w - left,
        cv2.BORDER_REPLICATE,
    )

    session, input_index, output_index = _interpreter()
    session.set_tensor(input_index, square[None])
    session.invoke()
    output = session.get_tensor(output_index)[0]
    cartoon = np.clip((output + 1.0) * 127.5, 0, 255).astype(np.uint8)
    crop = cartoon[top : top + new_h, left : left + new_w]
    return cv2.resize(crop, (width, height), interpolation=cv2.INTER_LINEAR)



def new_run(root):
    root.mkdir(parents=True, exist_ok=True)
    number = 1
    while True:
        folder = root / f'run{number}'
        try:
            folder.mkdir()  # Atomic reservation, including concurrent invocations.
            return folder
        except FileExistsError:
            number += 1


def positive(value):
    result = float(value)
    if not math.isfinite(result) or result <= 0:
        raise argparse.ArgumentTypeError('must be a finite positive number')
    return result


def process_video(src, dst, *, transform=cartoon_frame, max_fps=None, crf=23,
                  preset='veryfast', duration=None):
    """Stream frames with a one-frame lookahead; retain PTS and display durations.

    Disabling B-frames and encoder buffering lets us assign each output packet
    its measured duration immediately, including the final VFR frame.
    """
    stats = {'decoded_frames': 0, 'processed_frames': 0, 'skipped_frames': 0,
             'max_fps': max_fps, 'crf': crf, 'preset': preset, 'audio': False,
             'warnings': [], 'timing': 'original presentation timestamps, rebased to zero'}
    limit = Fraction(str(duration)) if duration is not None else None
    interval = Fraction(1, 1) / Fraction(str(max_fps)) if max_fps else None
    with av.open(str(src)) as inp:
        if not inp.streams.video:
            raise ValueError('Input has no video stream.')
        video = inp.streams.video[0]
        if video.codec_context.color_trc in (16, 18):
            raise ValueError('HDR/PQ/HLG input requires tone mapping first; use an SDR phone recording for this model.')
        sar = video.sample_aspect_ratio
        if sar and sar != 1:
            raise ValueError('Non-square source pixels are unsupported; normalize pixel aspect ratio first.')
        tb = Fraction(video.time_base)
        rate = video.average_rate or video.guessed_rate or Fraction(30, 1)
        if rate <= 0:
            raise ValueError('Cannot establish nominal frame rate for encoding.')
        output = None; stream = None; pending = None; first = previous = last_delta = None
        first_delta = None; variable = False; rotation = None; end = None
        next_allowed = None; last_report = time.monotonic()

        def encode(frame, timestamp, until):
            nonlocal output, stream, rotation, last_report
            angle = int(frame.rotation)
            if angle % 90:
                raise ValueError(f'Unsupported display rotation: {angle} degrees.')
            if rotation is None:
                rotation = angle
            elif rotation != angle:
                raise ValueError('Changing display rotation inside a clip is unsupported.')
            pixels = frame.to_ndarray(format='bgr24')
            if angle:
                pixels = np.ascontiguousarray(np.rot90(pixels, k=angle // 90))
            result = transform(pixels)
            if result.shape != pixels.shape or result.dtype != np.uint8:
                raise ValueError('Filter must return uint8 BGR at the oriented source dimensions.')
            h, w = result.shape[:2]
            if h % 2 or w % 2:
                result = cv2.copyMakeBorder(result, 0, h % 2, 0, w % 2, cv2.BORDER_REPLICATE)
            if output is None:
                output = av.open(str(dst), 'w', format='mp4', options={'movflags': '+faststart'})
                stream = output.add_stream('libx264', rate=rate)
                stream.width = result.shape[1]; stream.height = result.shape[0]
                stream.pix_fmt = 'yuv420p'
                stream.time_base = tb; stream.codec_context.time_base = tb
                stream.codec_context.max_b_frames = 0
                stream.options = {'crf': str(crf), 'preset': preset, 'tune': 'zerolatency'}
                stats.update({'input_dimensions': [frame.width, frame.height],
                              'output_dimensions': [stream.width, stream.height],
                              'rotation_applied_degrees_ccw': rotation,
                              'padded_for_yuv420p': bool(h % 2 or w % 2), 'time_base': str(tb)})
            elif (result.shape[1], result.shape[0]) != (stream.width, stream.height):
                raise ValueError('Resolution changes inside a video are unsupported.')
            vf = av.VideoFrame.from_ndarray(result, format='bgr24')
            vf.pts = round(timestamp / tb); vf.time_base = tb
            ticks = round((until - timestamp) / tb)
            if ticks <= 0:
                raise ValueError('Frame duration is below the source time-base precision.')
            vf.duration = ticks
            packets = list(stream.encode(vf))
            if len(packets) != 1:
                raise ValueError('Encoder unexpectedly buffered frames; cannot guarantee output timing.')
            packet = packets[0]
            packet.duration = round((until - timestamp) / packet.time_base)
            output.mux(packet)
            stats['processed_frames'] += 1
            if time.monotonic() - last_report >= 5:
                print(f"Processed {stats['processed_frames']} frames; source time {float(until):.2f}s", flush=True)
                last_report = time.monotonic()

        try:
            for frame in inp.decode(video):
                if frame.pts is None or frame.time_base is None:
                    raise ValueError('Frame timestamps are missing; refusing to invent phone-video timing.')
                absolute = frame.pts * Fraction(frame.time_base)
                if first is None:
                    first = absolute
                t = absolute - first
                if previous is not None:
                    delta = t - previous
                    if delta <= 0:
                        raise ValueError('Non-increasing presentation timestamps; cannot preserve timing safely.')
                    last_delta = delta
                    if first_delta is None:
                        first_delta = delta
                    elif abs(delta - first_delta) > 2 * tb:
                        variable = True
                previous = t
                if limit is not None and t >= limit:
                    end = limit
                    break
                stats['decoded_frames'] += 1
                # Source timestamps remain unchanged for frames selected by the cap.
                if next_allowed is None or interval is None or t >= next_allowed:
                    if pending is not None:
                        encode(pending[0], pending[1], t)
                    pending = (frame, t)
                    next_allowed = t + interval if interval else None
                else:
                    stats['skipped_frames'] += 1
                # Decoder-provided duration describes the terminal frame. If
                # absent, use the stream endpoint, then an explicitly logged estimate.
                if frame.duration > 0:
                    end = t + frame.duration * Fraction(frame.time_base)
                elif video.duration is not None:
                    end = (video.start_time or 0) * tb + video.duration * tb - first
                    if end <= t: end = None
                else:
                    end = None
            if pending is None:
                raise ValueError('Input contains no decodable video frames.')
            if end is None:
                end = previous + (last_delta or Fraction(1,1)/rate)
                stats['warnings'].append('Final frame duration was absent; estimated from last interval/nominal rate.')
            if limit is not None:
                end = min(end, limit)
            if end <= pending[1]:
                raise ValueError('Invalid final frame duration.')
            encode(pending[0], pending[1], end)
            if list(stream.encode(None)):
                raise ValueError('Unexpected delayed encoder packets.')
            stats.update({'source_variable_frame_rate': variable, 'duration_seconds': float(end),
                          'source_start_seconds': float(first)})
        finally:
            if output is not None:
                output.close()
    return stats


def cartoonise(src, runs_dir, **options):
    src = Path(src).expanduser().resolve()
    if not src.is_file():
        raise ValueError(f'Input does not exist: {src}')
    folder = new_run(Path(runs_dir).expanduser().resolve())
    copied = folder / ('input' + (src.suffix.lower() or '.video'))
    partial = folder / 'output.partial.mp4'
    final = folder / 'output.mp4'
    report = {'status': 'running', 'source': str(src), 'input': copied.name,
              'output': final.name}
    report_path = folder / 'run.json'
    started = time.monotonic()
    try:
        shutil.copy2(src, copied)
        with copied.open('rb') as f:
            report['input_sha256'] = hashlib.file_digest(f, 'sha256').hexdigest()
        report_path.write_text(json.dumps(report, indent=2))
        print(f'Run folder: {folder}\nInput copied unchanged. Output will be silent.', flush=True)
        report.update(process_video(copied, partial, **options))
        partial.rename(final)
        report.update(status='complete', elapsed_seconds=round(time.monotonic()-started, 3),
                      input_bytes=copied.stat().st_size, output_bytes=final.stat().st_size)
        print(f"Saved {final}\n{report['processed_frames']} processed / {report['skipped_frames']} skipped; "
              f"duration {report['duration_seconds']:.6f}s; VFR={report['source_variable_frame_rate']}", flush=True)
        for warning in report['warnings']: print('Timing note:', warning)
        return folder
    except BaseException as exc:
        report.update(status='failed', error=str(exc) or type(exc).__name__)
        partial.unlink(missing_ok=True)
        raise
    finally:
        report_path.write_text(json.dumps(report, indent=2))


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('input', type=Path)
    p.add_argument('--runs-dir', type=Path, default=Path(__file__).resolve().parents[1]/'videos')
    p.add_argument('--crf', type=int, default=23, help='H.264 quality 0–51; higher = smaller/less detail (default 23)')
    p.add_argument('--preset', choices=['ultrafast','veryfast','fast','medium','slow'], default='veryfast', help='encoding speed, not neural inference speed')
    p.add_argument('--max-fps', type=positive, help='optional frame sampling cap; fewer model calls, same playback duration')
    p.add_argument('--duration', type=positive, help='process only the opening N seconds; retain the complete input copy')
    args = p.parse_args()
    if not 0 <= args.crf <= 51: p.error('crf must be 0–51')
    cartoonise(args.input, args.runs_dir, crf=args.crf, preset=args.preset,
               max_fps=args.max_fps, duration=args.duration)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('\nCancelled; copied input retained.', file=sys.stderr); sys.exit(130)
    except Exception as exc:
        print(f'Error: {exc}', file=sys.stderr); sys.exit(1)
