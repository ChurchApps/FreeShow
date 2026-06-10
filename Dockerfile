# syntax=docker/dockerfile:1
#
# Reproducible Linux build environment for FreeShow (Electron + Svelte).
# Electron apps build per-platform, so this targets the LINUX build only — it
# cannot produce macOS/Windows binaries (use a native machine / CI for those).
#
# It pins the OS toolchain + Node so builds are consistent and traceable. Note:
# for fully reproducible *npm* versions you also need a committed package-lock.json
# (this repo gitignores it). When a lockfile is present this image uses `npm ci`;
# otherwise it falls back to `npm install` (versions resolve fresh — see BUILDING.md).
#
#   Build the app image:   docker build -t freeshow-build .
#   Package to ./out:      docker run --rm -v "$PWD/out:/app/dist" freeshow-build npm run pack
#   Interactive shell:     docker run --rm -it -v "$PWD":/app freeshow-build bash
#   Run the E2E test:      docker run --rm freeshow-build \
#                            xvfb-run --auto-servernum --server-args="-screen 0 1280x960x24" -- npm run test:playwright
#
# Pin the base image to a digest (node:22.12.0-bookworm@sha256:...) for byte-for-byte reproducibility.

FROM node:22.12.0-bookworm

# Native-module build toolchain + FreeShow's system libraries (see BUILDING.md):
#  - build-essential + python3(+setuptools): node-gyp toolchain
#  - libfontconfig1-dev / uuid-dev / libltc-dev: required by native deps (fonts, NDI, LTC timecode)
#  - xvfb: run the headless E2E test
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        python3 \
        python3-setuptools \
        libfontconfig1-dev \
        uuid-dev \
        libltc-dev \
        xvfb \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first so this layer caches when only source changes.
# `package-lock.json*` is optional — copied only if it exists.
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Build the app: frontend (Vite) -> web companion servers (Vite) -> electron (tsc)
COPY . .
RUN npm run build

# `docker run` with no args drops you in a shell; override with `npm run pack`,
# the xvfb test command, etc. (see the header above).
CMD ["bash"]
