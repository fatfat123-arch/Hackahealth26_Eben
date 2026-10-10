#!/usr/bin/env python3
"""Local White-box-Cartoonization experiment using the existing video/audio pipeline.

Upstream: https://github.com/SystemErrorWang/White-box-Cartoonization
Revision: ee97277d7fd873b89e9b8e1341efe74e10dd4124
Upstream code/weights: Xinrui Wang, CC BY-NC-SA 4.0, noncommercial use.
Only TensorFlow API imports are adapted; architecture, weights, BGR input
normalization and guided-filter postprocessing follow upstream inference.
"""
import argparse
import os
from pathlib import Path
import sys
import types

os.environ.setdefault('TF_CPP_MIN_LOG_LEVEL', '2')
os.environ.setdefault('CUDA_VISIBLE_DEVICES', '-1')

import cartoonize as pipeline

ROOT = Path(__file__).resolve().parent
UPSTREAM = ROOT / 'experiments/White-box-Cartoonization/test_code'


def compatibility_module(name):
    path = UPSTREAM / f'{name}.py'
    source = path.read_text().replace('import tensorflow as tf', 'import tensorflow.compat.v1 as tf')
    source = source.replace('import tensorflow.contrib.slim as slim', 'import tf_slim as slim')
    module = types.ModuleType(f'whitebox_{name}')
    module.__file__ = str(path)
    exec(compile(source, str(path), 'exec'), module.__dict__)
    return module


class WhiteBox:
    def __init__(self, threads=4):
        import tensorflow.compat.v1 as tf
        tf.disable_eager_execution()
        self.graph = tf.Graph()
        with self.graph.as_default():
            self.input = tf.placeholder(tf.float32, [1, None, None, 3])
            network = compatibility_module('network')
            guided = compatibility_module('guided_filter')
            generated = network.unet_generator(self.input)
            self.output = guided.guided_filter(self.input, generated, r=1, eps=5e-3)
            variables = [v for v in tf.trainable_variables() if 'generator' in v.name]
            saver = tf.train.Saver(var_list=variables)
        config = tf.ConfigProto(intra_op_parallelism_threads=threads, inter_op_parallelism_threads=1,
                                device_count={'GPU': 0})
        self.session = tf.Session(graph=self.graph, config=config)
        try:
            saver.restore(self.session, str(UPSTREAM / 'saved_models/model-33999'))
        except Exception:
            self.session.close()
            raise
        print(f'Restored all {len(variables)} generator tensors from upstream model-33999.', flush=True)

    def __call__(self, frame, strength, outlines, cv2, np, **unused):
        h, w = frame.shape[:2]
        # Benchmark is already divisible by eight. Pad other sizes, never crop
        # fingers or resize; remove only padding after inference.
        padded = cv2.copyMakeBorder(frame, 0, (-h) % 8, 0, (-w) % 8, cv2.BORDER_REFLECT_101)
        batch = padded.astype(np.float32)[None] / 127.5 - 1
        result = self.session.run(self.output, {self.input: batch})[0, :h, :w]
        return np.clip((result + 1) * 127.5, 0, 255).astype(np.uint8)

    def close(self):
        self.session.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--start', type=pipeline.number, default=0)
    parser.add_argument('--duration', type=pipeline.number, default=5)
    parser.add_argument('--threads', type=int, default=4)
    parser.add_argument('--compare', action='store_true')
    args = parser.parse_args()
    if args.duration <= 0 or args.duration > 10:
        parser.error('This experimental runner is limited to clips of at most 10 seconds.')
    if args.threads < 1:
        parser.error('threads must be positive')
    if not args.input.is_file() or args.output.exists() or args.input.resolve() == args.output.resolve():
        parser.error('Input must exist; output must be a new, different file.')
    try:
        model = WhiteBox(args.threads)
    except ImportError as exc:
        raise pipeline.ToolError(f'Missing experiment dependency: {exc}; install requirements-whitebox.txt')
    old_filter, old_argv = pipeline.filter_frame, sys.argv
    try:
        pipeline.filter_frame = model
        sys.argv = ['cartoonize.py', str(args.input), str(args.output), '--start', str(args.start),
                    '--duration', str(args.duration)] + (['--compare'] if args.compare else [])
        print('White-box neural inference at native resolution; OpenCV preset settings printed '
              'below are bypassed. Original audio/video timing pipeline is reused.', flush=True)
        pipeline.main()
    finally:
        pipeline.filter_frame = old_filter
        sys.argv = old_argv
        model.close()


if __name__ == '__main__':
    try:
        main()
    except (pipeline.ToolError, OSError, ValueError) as exc:
        print(f'Error: {exc}', file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        print('\nCancelled.', file=sys.stderr)
        sys.exit(130)
