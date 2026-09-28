#!/usr/bin/env bash
# Builds whisper-cli from a pinned whisper.cpp release and installs it into
# resources/binaries/whisper.cpp/<platform>-<arch>/.
#
# Usage: npm run whisper:build            (or: bash scripts/build-whisper-cpp.sh)
# Env:
#   WHISPER_CPP_VERSION  git tag to build (default below)
#   WHISPER_CPP_NATIVE   ON (default) = optimise for this CPU, OFF = portable build
#   CMAKE                cmake executable (default: cmake on PATH)
#   JOBS                 parallel build jobs (default: nproc)
set -euo pipefail

WHISPER_CPP_VERSION="${WHISPER_CPP_VERSION:-v1.9.4}"
WHISPER_CPP_NATIVE="${WHISPER_CPP_NATIVE:-ON}"
CMAKE="${CMAKE:-cmake}"
JOBS="${JOBS:-$(nproc 2>/dev/null || echo 4)}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="$ROOT/.cache/whisper.cpp-$WHISPER_CPP_VERSION"
BUILD_DIR="$SRC_DIR/build"

case "$(uname -s)-$(uname -m)" in
  Linux-x86_64) TARGET="linux-x64" ;;
  *) echo "Only Linux x64 is supported by this script for now (got $(uname -s)-$(uname -m))." >&2; exit 1 ;;
esac
OUT_DIR="$ROOT/resources/binaries/whisper.cpp/$TARGET"

command -v "$CMAKE" >/dev/null || { echo "cmake not found. Install it (e.g. 'sudo apt install cmake') or set CMAKE=/path/to/cmake." >&2; exit 1; }
command -v git >/dev/null || { echo "git not found." >&2; exit 1; }

if [ ! -d "$SRC_DIR/.git" ]; then
  echo "==> Cloning whisper.cpp $WHISPER_CPP_VERSION"
  git clone --depth 1 --branch "$WHISPER_CPP_VERSION" https://github.com/ggml-org/whisper.cpp.git "$SRC_DIR"
fi

echo "==> Configuring (static, native=$WHISPER_CPP_NATIVE)"
"$CMAKE" -S "$SRC_DIR" -B "$BUILD_DIR" \
  -DCMAKE_BUILD_TYPE=Release \
  -DBUILD_SHARED_LIBS=OFF \
  -DGGML_NATIVE="$WHISPER_CPP_NATIVE" \
  -DWHISPER_BUILD_TESTS=OFF \
  -DWHISPER_BUILD_SERVER=OFF \
  -DWHISPER_SDL2=OFF \
  -DWHISPER_CURL=OFF

echo "==> Building whisper-cli with $JOBS jobs"
"$CMAKE" --build "$BUILD_DIR" --config Release --target whisper-cli -j "$JOBS"

mkdir -p "$OUT_DIR"
install -m 0755 "$BUILD_DIR/bin/whisper-cli" "$OUT_DIR/whisper-cli"
echo "$WHISPER_CPP_VERSION" > "$OUT_DIR/VERSION"

# Sample audio for the transcription smoke test (JFK inaugural address excerpt).
mkdir -p "$ROOT/test-audio"
if [ ! -f "$ROOT/test-audio/sample.wav" ]; then
  cp "$SRC_DIR/samples/jfk.wav" "$ROOT/test-audio/sample.wav"
fi

echo "==> Installed $OUT_DIR/whisper-cli ($WHISPER_CPP_VERSION)"
"$OUT_DIR/whisper-cli" --help >/dev/null 2>&1 && echo "==> whisper-cli runs"
