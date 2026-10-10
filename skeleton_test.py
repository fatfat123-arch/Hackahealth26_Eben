import cv2, numpy as np, onnxruntime as ort, subprocess

sess = ort.InferenceSession("animegan.onnx",
        providers=["CUDAExecutionProvider", "CPUExecutionProvider"])
in_name = sess.get_inputs()[0].name

cap = cv2.VideoCapture("in.mp4")
fps = cap.get(cv2.CAP_PROP_FPS)
W, H = 512, 512  # pick sizes divisible by 8, keep aspect ratio in real code

ff = subprocess.Popen(
    ["ffmpeg", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}",
     "-r", str(fps), "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p",
     "-crf", "18", "out.mp4"], stdin=subprocess.PIPE)

prev_gray = prev_out = None
while True:
    ok, frame = cap.read()
    if not ok: break
    frame = cv2.resize(frame, (W, H))
    x = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB).astype(np.float32) / 127.5 - 1
    y = sess.run(None, {in_name: x[None]})[0][0]
    out = cv2.cvtColor(((y + 1) * 127.5).clip(0, 255).astype(np.uint8),
                       cv2.COLOR_RGB2BGR)

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    if prev_out is not None:  # flow-based temporal smoothing
        flow = cv2.calcOpticalFlowFarneback(gray, prev_gray, None,
                                            0.5, 3, 15, 3, 5, 1.2, 0)
        gx, gy = np.meshgrid(np.arange(W), np.arange(H))
        warped = cv2.remap(prev_out,
                           (gx + flow[..., 0]).astype(np.float32),
                           (gy + flow[..., 1]).astype(np.float32),
                           cv2.INTER_LINEAR)
        out = cv2.addWeighted(out, 0.65, warped, 0.35, 0)
    ff.stdin.write(out.tobytes())
    prev_gray, prev_out = gray, out

ff.stdin.close(); ff.wait()