"""Cartoonise a video and keep the original width and height.

The model still needs a 512x512 input, so each frame is fitted inside that
square with padding, then the padding is removed and the cartoon is scaled
back to the source size.

Usage:
    python cartoonise.py ../video.mp4
    python cartoonise.py ../video.mp4 ../video_cartoon.mp4
"""
import sys
from pathlib import Path

import cv2
import numpy as np
import tensorflow as tf

MODEL_PATH = Path(__file__).resolve().parent / "model.tflite"
SIZE = 512


def _interpreter():
    if getattr(_interpreter, "session", None) is None:
        if not MODEL_PATH.is_file():
            sys.exit(f"Missing cartoon model: {MODEL_PATH}")
        session = tf.lite.Interpreter(model_path=str(MODEL_PATH))
        session.allocate_tensors()
        _interpreter.session = session
        _interpreter.input_index = session.get_input_details()[0]["index"]
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


def cartoonise(src, dst):
    cap = cv2.VideoCapture(str(src))
    if not cap.isOpened():
        sys.exit(f"Could not open {src}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if dst.exists():
        dst.unlink()
    out = cv2.VideoWriter(
        str(dst),
        cv2.CAP_AVFOUNDATION,
        cv2.VideoWriter_fourcc(*"avc1"),
        fps,
        (width, height),
    )
    if not out.isOpened():
        sys.exit(f"Could not create {dst}")

    index = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        out.write(cartoon_frame(frame))
        index += 1
        print(f"\rFrame {index}/{total}", end="", flush=True)

    cap.release()
    out.release()
    print(f"\nSaved to {dst}")


def main():
    if len(sys.argv) not in (2, 3):
        sys.exit("Usage: python cartoonise.py input.mp4 [output.mp4]")

    src = Path(sys.argv[1]).expanduser().resolve()
    if len(sys.argv) == 3:
        dst = Path(sys.argv[2]).expanduser().resolve()
    else:
        dst = src.with_name(src.stem + "_cartoon.mp4")
    cartoonise(src, dst)


if __name__ == "__main__":
    main()
