#!/bin/sh
set -eu
TASK_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
if command -v blender >/dev/null 2>&1; then
    blender --background --disable-autoexec --python-exit-code 1 "$TASK_ROOT/rain_v3.2.blend" --python "$TASK_ROOT/rig_tests/rain_tests.py" -- "$@"
elif command -v flatpak-spawn >/dev/null 2>&1; then
    flatpak-spawn --host flatpak run --filesystem="$TASK_ROOT" org.blender.Blender --background --disable-autoexec --python-exit-code 1 "$TASK_ROOT/rain_v3.2.blend" --python "$TASK_ROOT/rig_tests/rain_tests.py" -- "$@"
else
    flatpak run --filesystem="$TASK_ROOT" org.blender.Blender --background --disable-autoexec --python-exit-code 1 "$TASK_ROOT/rain_v3.2.blend" --python "$TASK_ROOT/rig_tests/rain_tests.py" -- "$@"
fi
