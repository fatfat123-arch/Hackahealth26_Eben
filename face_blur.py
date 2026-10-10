#!/usr/bin/env python3
"""Blur faces in an existing video; no White-box inference is rerun.

Examples:
  .venv/bin/python face_blur.py whitebox.mp4 blurred.mp4 --strength 0.12
  .venv/bin/python face_blur.py comparison.mp4 blurred.mp4 --comparison-input --strength 0.12

Comparison input must contain aligned, equal-sized original-left/cartoon-right
views. Detect on the original left and blur only the right; the left stays
identifiable. Otherwise detect and blur the whole video. --box x,y,w,h provides
a fixed face rectangle in pixels relative to ONE view, for difficult footage.
Strength is Gaussian radius relative to face size, not transparency. This is a
visual face-obscuring effect, not guaranteed anonymity. Hands over the face are
also blurred. Frame timing, audio, overwrite guards and encoding reuse the
existing cartoonize.py pipeline (including its CFR-only timing policy).
"""
import argparse
from pathlib import Path
import sys

import cartoonize as pipeline

DEFAULT_MODEL = Path(__file__).resolve().parent / 'models/face_detection_yunet_2023mar.onnx'


def unit(value):
    result = pipeline.number(value)
    if result > 1:
        raise argparse.ArgumentTypeError('must be between 0 and 1')
    return result


def rectangle(value):
    try:
        x, y, w, h = (int(v) for v in value.split(','))
        if min(x, y) < 0 or min(w, h) <= 0:
            raise ValueError()
        return (x, y, w, h)
    except ValueError:
        raise argparse.ArgumentTypeError('expected x,y,width,height; nonnegative origin and positive size')


def iou(a, b):
    x = max(a[0], b[0]); y = max(a[1], b[1])
    right = min(a[0]+a[2], b[0]+b[2]); bottom = min(a[1]+a[3], b[1]+b[3])
    overlap = max(0, right-x)*max(0, bottom-y)
    return overlap / max(1, a[2]*a[3]+b[2]*b[3]-overlap)


class FaceBlur:
    def __init__(self, strength=0.12, comparison=False, box=None, model=DEFAULT_MODEL,
                 threshold=0.7, max_missed=10, detector=None):
        try:
            import cv2
            import numpy as np
        except ImportError as exc:
            raise pipeline.ToolError(f'{exc}; install the project requirements first.')
        self.cv2, self.np = cv2, np
        self.strength, self.comparison, self.box = strength, comparison, box
        self.max_missed = max_missed
        self.frames = self.gap_frames = self.detected_frames = 0
        self.tracks = []
        self.detector = detector
        if strength and box is None and detector is None:
            if not Path(model).is_file():
                raise pipeline.ToolError(f'Face detector is missing: {model}. Supply --model or --box x,y,w,h.')
            if not hasattr(cv2, 'FaceDetectorYN'):
                raise pipeline.ToolError('This OpenCV build lacks FaceDetectorYN; use OpenCV 4.8+ or --box.')
            try:
                # Fixed 320x320 input works with the official static-shape model
                # in both OpenCV 4.x and 5.x. Map x/y scales separately afterwards.
                self.detector = cv2.FaceDetectorYN.create(str(model), '', (320, 320), threshold)
            except cv2.error as exc:
                raise pipeline.ToolError(f'Cannot load the face model: {exc}')

    def tracked_boxes(self, image):
        np, cv2 = self.np, self.cv2
        h, w = image.shape[:2]
        if self.box is not None:
            x,y,bw,bh = self.box
            if x+bw > w or y+bh > h:
                raise pipeline.ToolError('--box extends outside the selected view.')
            return [np.asarray(self.box, dtype=float)]
        _, faces = self.detector.detect(cv2.resize(image, (320,320)))
        boxes = [] if faces is None else [np.asarray(f[:4],dtype=float)*[w/320,h/320,w/320,h/320] for f in faces]
        if boxes:
            self.detected_frames += 1
        # Associate by overlap; new faces snap immediately, existing boxes use
        # fixed temporal smoothing. Keep current detection in the mask bounds
        # so smoothing does not expose the leading edge of a moving face.
        old = self.tracks.copy(); updated = []; masks = []
        for box in boxes:
            index = max(range(len(old)), key=lambda i:iou(old[i]['box'],box), default=None)
            if index is not None and iou(old[index]['box'],box) > 0.15:
                previous = old.pop(index)['box']
                smoothed = 0.65*previous + 0.35*box
            else:
                smoothed = box
            updated.append({'box':smoothed, 'missed':0})
            left = np.minimum(smoothed[:2],box[:2]); right = np.maximum(smoothed[:2]+smoothed[2:],box[:2]+box[2:])
            masks.append(np.concatenate((left,right-left)))
        if old:
            self.gap_frames += 1
        for track in old:
            track['missed'] += 1
            if track['missed'] > self.max_missed:
                raise pipeline.ToolError(f'Face tracking lost at frame {self.frames}. No output saved. '
                                         'Try --box for a fixed face region or a shorter clip.')
            updated.append(track); masks.append(track['box'])
        self.tracks = updated
        if not masks:
            raise pipeline.ToolError(f'No face found at frame {self.frames}. No output saved. '
                                     'Try --comparison-input for aligned comparisons, or --box x,y,w,h.')
        return masks

    def blur_box(self, source, output, box):
        cv2, np = self.cv2, self.np
        x,y,w,h = box
        cx,cy = x+w/2,y+h/2
        rx,ry = w*.78,h*.78
        height,width = source.shape[:2]
        x0=max(0,int(cx-rx)); x1=min(width,int(np.ceil(cx+rx))+1)
        y0=max(0,int(cy-ry)); y1=min(height,int(np.ceil(cy+ry))+1)
        if x1<=x0 or y1<=y0:
            return
        sigma=max(.1,min(w,h)*.22*self.strength)
        # Include blur-kernel context outside the mask to avoid patch seams.
        pad=int(np.ceil(sigma*3))
        px0=max(0,x0-pad); py0=max(0,y0-pad)
        px1=min(width,x1+pad); py1=min(height,y1+pad)
        blurred=cv2.GaussianBlur(source[py0:py1,px0:px1],(0,0),sigmaX=sigma,sigmaY=sigma)
        blurred=blurred[y0-py0:y1-py0,x0-px0:x1-px0]
        yy,xx=np.ogrid[y0:y1,x0:x1]
        radius=np.sqrt(((xx-cx)/rx)**2+((yy-cy)/ry)**2)
        # Flat blur in the interior, smoothstep feather in the outer 20%.
        alpha=np.clip((1-radius)/.20,0,1)
        alpha=(alpha*alpha*(3-2*alpha))[...,None].astype(np.float32)
        patch=output[y0:y1,x0:x1]
        output[y0:y1,x0:x1]=np.clip(np.rint(patch*(1-alpha)+blurred*alpha),0,255).astype(np.uint8)

    def __call__(self, frame, *unused, **kwargs):
        self.frames += 1
        if self.strength == 0:
            return frame.copy()
        width = frame.shape[1]
        if self.comparison and width % 2:
            raise pipeline.ToolError('Comparison input must have two equal-width views.')
        split = width//2 if self.comparison else 0
        detection = frame[:,:split] if self.comparison else frame
        source = frame[:,split:]
        result = frame.copy(); target = result[:,split:]
        for box in self.tracked_boxes(detection):
            self.blur_box(source,target,box)
        return result


def main():
    parser=argparse.ArgumentParser(description=__doc__,formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('input',type=Path)
    parser.add_argument('output',type=Path)
    parser.add_argument('--strength',type=unit,default=0.12,help='0–1; 0 bypasses blur, 1 is strongest (default 0.12)')
    parser.add_argument('--comparison-input',action='store_true',help='detect on original left, blur cartoon right only')
    parser.add_argument('--box',type=rectangle,help='fixed face box x,y,width,height within one view; bypass detection')
    parser.add_argument('--model',type=Path,default=DEFAULT_MODEL)
    parser.add_argument('--threshold',type=unit,default=.7,help='detector confidence threshold (default .7)')
    parser.add_argument('--start',type=pipeline.number,default=0)
    parser.add_argument('--duration',type=pipeline.number)
    args=parser.parse_args()
    if args.duration == 0:
        parser.error('duration must be positive')
    if not args.input.is_file(): parser.error('input file does not exist')
    if args.input.resolve()==args.output.resolve() or args.output.exists():
        parser.error('output must be a new file, different from the input')
    effect=FaceBlur(args.strength,args.comparison_input,args.box,args.model,args.threshold)
    print(f'Face blur only, strength {args.strength}; White-box is not rerun.',flush=True)
    if args.comparison_input:
        print('Comparison mode: original left remains identifiable; blur applies to right only.',flush=True)
    original_filter, original_argv = pipeline.filter_frame,sys.argv
    try:
        pipeline.filter_frame=effect
        sys.argv=['face_blur.py',str(args.input),str(args.output),'--strength','0','--start',str(args.start)]
        if args.duration is not None: sys.argv+=['--duration',str(args.duration)]
        pipeline.main()
    finally:
        pipeline.filter_frame=original_filter; sys.argv=original_argv
    print(f'Blurred {effect.frames} frames. Detection frames: {effect.detected_frames}; '
          f'frames using a held detection: {effect.gap_frames}.',flush=True)
    if effect.gap_frames:
        print('Review held-detection frames for face movement or occlusion.',flush=True)


if __name__=='__main__':
    try:
        main()
    except (pipeline.ToolError,OSError,ValueError) as exc:
        print(f'Error: {exc}',file=sys.stderr); sys.exit(1)
    except KeyboardInterrupt:
        print('\nCancelled.',file=sys.stderr); sys.exit(130)
