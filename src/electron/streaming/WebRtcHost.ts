import { BrowserWindow, ipcMain } from "electron"
import { SenderCapture } from "../capture/SenderCapture"
import { join } from "path"
import { NdiSender } from "../ndi/NdiSender"

// Listen for WebRtcHost console logs and print them in the main process console
ipcMain.on("WEBRTC_LOG", (_event, { type, message }) => {
    const prefix = `[WebRtcHost ${type.toUpperCase()}]`
    if (type === "error") {
        console.error(prefix, message)
    } else if (type === "warn") {
        console.warn(prefix, message)
    } else {
        // Only print success or high-level events, suppress verbose inner-loop/ice debug logs
        if (message.includes("Completed Successfully") || message.includes("Stopping stream") || message.includes("WHIP DELETE") || message.includes("AudioCtx State") || message.includes("Audio Frames Received") || message.includes("[frames]")) {
            console.log(prefix, message)
        }
    }
})

// Perform WHIP HTTP POST signaling from Electron Main (NodeJS) to bypass all browser CORS / Origin limits
ipcMain.on("DO_WHIP_POST", async (event, { outputId, url, token, sdp }) => {
    try {
        const headers: Record<string, string> = {
            "Content-Type": "application/sdp",
            "User-Agent": "OBS/30.0.0"
        }
        if (token) {
            headers.Authorization = `Bearer ${token}`
        }

        const res = await fetch(url, {
            method: "POST",
            headers,
            body: sdp
        })

        const responseText = await res.text()

        if (!res.ok) {
            throw new Error(`WHIP HTTP post failed with status ${res.status}. Response: ${responseText}`)
        }

        // Get the Location header for graceful WHIP resource deletion
        const location = res.headers.get("Location") || res.headers.get("location")
        let resourceUrl = ""
        if (location) {
            try {
                resourceUrl = new URL(location, url).toString()
            } catch (_) {
                resourceUrl = location
            }
        }

        event.reply("WHIP_POST_RESPONSE", { outputId, answerSdp: responseText, resourceUrl })
    } catch (err: any) {
        console.error(`[WebRtcHost Main] WHIP POST error:`, err.message)
        event.reply("WHIP_POST_ERROR", { outputId, error: err.message })
    }
})

// Perform WHIP HTTP DELETE signaling from Electron Main (NodeJS) to gracefully close the stream
ipcMain.on("DO_WHIP_DELETE", async (_event, { outputId, url, token }) => {
    console.log(`[WebRtcHost Main] Performing WHIP HTTP DELETE for ${outputId} to ${url}...`)
    try {
        const headers: Record<string, string> = {
            "User-Agent": "OBS/30.0.0"
        }
        if (token) {
            headers.Authorization = `Bearer ${token}`
        }

        const res = await fetch(url, {
            method: "DELETE",
            headers
        })

        console.log(`[WebRtcHost Main] WHIP DELETE response received with status: ${res.status} ${res.statusText}`)
    } catch (err: any) {
        console.error(`[WebRtcHost Main] WHIP DELETE error:`, err.message)
    }
})

// The hidden host window encodes and sends WebRTC (WHIP). Its frames come from the capture worker over
// the shared-memory transport (capture/FrameServer.ts in the worker, streamLink.ts in the window's
// preload): the worker serves each streamed output a BGRA frame at the output's size, and this window
// draws it into the canvas whose captureStream feeds the peer connection. Main only relays the socket
// details; no frame passes through it on the GPU capture path. sendFrame() below is the fallback for
// the main-thread capture path (no shared-texture capture).
export class WebRtcHost {
    private static window: BrowserWindow | null = null
    private static started = false
    private static loaded = false
    private static wsInfo: { port: number; token: string } | null = null
    private static wanted = new Set<string>()
    private static hooked = false

    static isRunning() {
        return this.started && !!this.window && !this.window.isDestroyed()
    }

    static getWindow() {
        return this.window
    }

    private static hook() {
        if (this.hooked) return
        this.hooked = true
        SenderCapture.webrtcMessageHandler = (msg) => {
            if (msg.type === "webrtcWs") {
                this.wsInfo = { port: msg.port, token: msg.token }
                for (const id of [...this.wanted]) this.wire(id)
            } else if (msg.type === "webrtcNeedTarget") {
                this.wire(msg.targetId)
            }
        }
    }

    // hand the host window the worker's socket for one output; the worker asks once per output, so an
    // output whose window was not ready is remembered and wired when it is
    private static wire(targetId: string) {
        if (!this.isRunning() || !this.loaded || !this.wsInfo) {
            this.wanted.add(targetId)
            return
        }
        this.wanted.delete(targetId)
        this.window!.webContents.send("STREAM_WS", { targetId, port: this.wsInfo.port, token: this.wsInfo.token })
    }

    static start() {
        if (this.started) return
        this.started = true
        this.hook()
        console.log("[WebRtcHost] Starting WebRTC host...")

        this.window = new BrowserWindow({
            show: false,
            width: 1,
            height: 1,
            skipTaskbar: true,
            webPreferences: {
                preload: join(__dirname, "..", "webrtcPreload"),
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: false, // the preload maps the shared-memory frame ring with a native module
                backgroundThrottling: false,
                webSecurity: false,
                autoplayPolicy: "no-user-gesture-required" // Crucial: allows AudioContexts to start playing in background without user interactions
            }
        })

        this.loaded = false
        this.window.webContents.once("did-finish-load", () => {
            this.loaded = true
            // the worker forgets what it asked for: every streamed output is requested again with its next frame
            NdiSender.getSharedWorker()?.postMessage({ type: "webrtcReset" })
            for (const id of [...this.wanted]) this.wire(id)
        })
        this.window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(this.buildHostHtml())}`)

        this.window.once("closed", () => {
            this.window = null
            this.started = false
            this.loaded = false
            NdiSender.getSharedWorker()?.postMessage({ type: "webrtcReset" })
        })
    }

    static stop() {
        if (!this.started) return
        this.started = false
        console.log("[WebRtcHost] Stopping WebRTC host...")

        if (this.window && !this.window.isDestroyed()) {
            this.window.destroy()
            this.window = null
        }
        this.loaded = false
        this.wanted.clear()
        NdiSender.getSharedWorker()?.postMessage({ type: "webrtcReset" })
    }

    /** Main-thread capture path only: push an RGBA frame for an output to the hidden renderer. */
    static sendFrame(outputId: string, buffer: Buffer, size: { width: number; height: number }) {
        if (!this.isRunning()) return
        this.window!.webContents.send("WEBRTC_FRAME", { outputId, buffer, size })
    }

    /** Push captured interleaved PCM audio data to the hidden renderer. */
    static sendAudio(buffer: Buffer, { sampleRate, channelCount }: { sampleRate: number; channelCount: number }) {
        if (!this.isRunning()) return
        this.window!.webContents.send("WEBRTC_AUDIO", { buffer, sampleRate, channelCount })
    }

    /** Start a WHIP stream for a specific output window. */
    static startWhip(outputId: string, url: string, token?: string, options?: { fps?: number; bitrate?: number }) {
        if (!this.isRunning()) {
            console.warn(`[WebRtcHost] Cannot start WHIP for ${outputId}: Host is not running.`)
            return
        }
        this.window!.webContents.send("START_WHIP", { outputId, url, token, fps: options?.fps || 30, bitrate: options?.bitrate || 2500 })
    }

    /** Stop a WHIP stream for a specific output window. */
    static stopWhip(outputId: string) {
        if (!this.isRunning()) return
        this.window!.webContents.send("STOP_WHIP", { outputId })
    }

    private static buildHostHtml(): string {
        /* eslint-disable no-useless-escape */
        return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>FreeShow WebRTC WHIP Host</title></head>
<body>
<div id="canvases" style="display:none"></div>
<script>
"use strict";
const host = window.webrtcHost;

// Forward console logs to Electron Main process
const originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error
};

function sendLog(type, ...args) {
    originalConsole[type](...args);
    const msg = args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ");
    host.send("WEBRTC_LOG", { type, message: msg });
}

console.log = (...args) => sendLog("log", ...args);
console.info = (...args) => sendLog("info", ...args);
console.warn = (...args) => sendLog("warn", ...args);
console.error = (...args) => sendLog("error", ...args);

// ----- frame canvases: one per output, drawn on the GPU (BGRA from the worker, RGBA from main) -----
// A canvas lives as long as frames arrive for its output; a WHIP stream captures whichever canvas
// belongs to its output, so frames can start before or after the stream is negotiated.
const VS = "attribute vec2 a;varying vec2 v;void main(){v=vec2((a.x+1.0)*0.5,1.0-(a.y+1.0)*0.5);gl_Position=vec4(a,0.0,1.0);}";
const FS = "precision mediump float;varying vec2 v;uniform sampler2D t;uniform float swap;void main(){vec4 c=texture2D(t,v);gl_FragColor=mix(c,c.bgra,swap);gl_FragColor.a=1.0;}";
const canvases = {};
let frameCount = 0, frameAge = 0;

function getCanvas(outputId) {
    if (canvases[outputId]) return canvases[outputId];
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 360;
    document.getElementById("canvases").appendChild(canvas);
    const gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true });
    const entry = { canvas, gl: null, swapUniform: null, size: "", hasFrame: false, lastPaintTime: 0 };
    if (gl) {
        const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
        const program = gl.createProgram();
        gl.attachShader(program, compile(gl.VERTEX_SHADER, VS));
        gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FS));
        gl.linkProgram(program);
        if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
            gl.useProgram(program);
            gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
            const position = gl.getAttribLocation(program, "a");
            gl.enableVertexAttribArray(position);
            gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
            const texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            entry.gl = gl;
            entry.swapUniform = gl.getUniformLocation(program, "swap");
        } else console.error("WebGL program failed to link");
    } else console.error("WebGL unavailable in the WebRTC host");
    // black until the first frame, so captureStream produces RTP at once
    if (entry.gl) { entry.gl.clearColor(0, 0, 0, 1); entry.gl.clear(entry.gl.COLOR_BUFFER_BIT); }
    canvases[outputId] = entry;
    return entry;
}

function drawFrame(outputId, width, height, pixels, bgra) {
    const entry = getCanvas(outputId);
    const gl = entry.gl;
    if (!gl || !width || !height) return;
    if (entry.canvas.width !== width || entry.canvas.height !== height) {
        entry.canvas.width = width;
        entry.canvas.height = height;
        entry.size = "";
    }
    gl.viewport(0, 0, width, height);
    const size = width + "x" + height;
    if (entry.size === size) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    else { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels); entry.size = size; }
    gl.uniform1f(entry.swapUniform, bgra ? 1 : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    entry.hasFrame = true;
    entry.lastPaintTime = Date.now();
}

// redraw the last uploaded frame (keep-alive during gaps)
function redraw(entry) {
    const gl = entry.gl;
    if (!gl) return;
    if (entry.hasFrame) gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    else { gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
}

// frames from the capture worker (shared memory, transferred ArrayBuffer; see streamLink.ts)
window.addEventListener("message", (e) => {
    const m = e.data;
    if (m?.type !== "STREAM_FRAME" || !(m.data instanceof ArrayBuffer)) return;
    try {
        drawFrame(m.id, m.xres, m.yres, new Uint8Array(m.data), m.format !== "rgba");
        frameCount++;
        frameAge += Date.now() - m.time;
    } catch (err) {
        console.error("Frame paint error: " + err.message);
    }
    // the upload has read the buffer: hand it back to be refilled
    window.postMessage({ type: "STREAM_ACK", target: m.target, slot: m.slot, data: m.data }, "*", [m.data]);
});

setInterval(() => {
    if (!frameCount) return;
    console.info("[frames] " + frameCount + "/s age=" + Math.round(frameAge / frameCount) + "ms");
    frameCount = frameAge = 0;
}, 5000);

// frames from main (main-thread capture path only): RGBA
host.on("WEBRTC_FRAME", ({ outputId, buffer, size }) => {
    try {
        drawFrame(outputId, size.width, size.height, new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength), false);
    } catch (err) {
        console.error("Frame paint error: " + err.message);
    }
});

// Map<outputId, { canvas, mediaStream, pc, url, token, resolvePost, rejectPost, resourceUrl, audioCtx, audioDest, nextPlayTime } >
const streams = {};

// Outputs with a WHIP negotiation currently in flight — dedupes overlapping START_WHIP (startup fires
// it more than once), which otherwise POSTs twice to the same publisher path and hangs the server.
const startingStreams = new Set();

const RTC_CONFIG = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

// WHIP is non-trickle (vanilla ICE): the offer we POST must already carry the ICE candidates.
// Wait for gathering to complete before sending, otherwise the server receives an offer with
// missing host candidates and no valid candidate pair can form (connection never establishes).
// Bounded by a timeout so a blocked/slow STUN server can't hang the start forever.
function waitForIceGathering(pc, timeoutMs) {
    if (pc.iceGatheringState === "complete") return Promise.resolve();
    return new Promise((resolve) => {
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            pc.removeEventListener("icegatheringstatechange", check);
            resolve();
        };
        const check = () => {
            if (pc.iceGatheringState === "complete") finish();
        };
        pc.addEventListener("icegatheringstatechange", check);
        // Fallback: some networks never reach "complete" (e.g. blocked STUN); send what we have.
        setTimeout(finish, timeoutMs);
    });
}

let audioLogCount = 0;

// Receive dynamic interleaved signed Int16 PCM system audio buffers from FreeShow
host.on("WEBRTC_AUDIO", ({ buffer, sampleRate, channelCount }) => {
    const streamKeys = Object.keys(streams);
    if (streamKeys.length === 0) return;

    // Alignment-safe and offset-aligned casting to Int16Array
    const alignedBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const int16 = new Int16Array(alignedBuffer);
    const numFrames = int16.length / channelCount;

    if (numFrames <= 0) return;

    if (audioLogCount++ % 100 === 0) {
        console.info("Audio Frames Received: " + numFrames + " samples. Channels: " + channelCount + " Rate: " + sampleRate);
    }

    // Convert interleaved Int16 to Planar Float32 (Standard format for Web Audio API buffers)
    const leftChannel = new Float32Array(numFrames);
    const rightChannel = new Float32Array(numFrames);

    for (let i = 0; i < numFrames; i++) {
        leftChannel[i] = int16[i * 2] / 32768;
        if (channelCount > 1) {
            rightChannel[i] = int16[i * 2 + 1] / 32768;
        } else {
            rightChannel[i] = leftChannel[i];
        }
    }

    // Mix the audio buffer into all active streaming outputs' audio contexts
    for (const outputId of streamKeys) {
        const stream = streams[outputId];
        if (!stream || !stream.audioCtx || !stream.audioDest) continue;

        const audioCtx = stream.audioCtx;
        if (audioCtx.state === "suspended") {
            audioCtx.resume().then(() => {
                console.info("AudioCtx State Resumed: " + audioCtx.state);
            });
        }

        if (audioLogCount % 100 === 1) {
            console.info("AudioCtx State for " + outputId + ": " + audioCtx.state + " Time: " + audioCtx.currentTime);
        }

        // Create Web Audio Buffer
        const audioBuffer = audioCtx.createBuffer(2, numFrames, sampleRate);
        audioBuffer.copyToChannel(leftChannel, 0);
        audioBuffer.copyToChannel(rightChannel, 1);

        // Feed buffer into the destination using sample-accurate scheduling
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(stream.audioDest);

        const currentTime = audioCtx.currentTime;
        if (stream.nextPlayTime < currentTime) {
            // Safety buffer offset (10ms) to prevent audio gaps
            stream.nextPlayTime = currentTime + 0.01;
        }

        source.start(stream.nextPlayTime);
        stream.nextPlayTime += audioBuffer.duration;
    }
});

// Receive WHIP POST response from Node.js Main process
host.on("WHIP_POST_RESPONSE", ({ outputId, answerSdp, resourceUrl }) => {
    const stream = streams[outputId];
    if (stream) {
        stream.resourceUrl = resourceUrl;
        if (stream.resolvePost) {
            stream.resolvePost(answerSdp);
        }
    }
});

host.on("WHIP_POST_ERROR", ({ outputId, error }) => {
    const stream = streams[outputId];
    if (stream && stream.rejectPost) {
        stream.rejectPost(new Error(error));
    }
});

host.on("START_WHIP", async ({ outputId, url, token, fps, bitrate }) => {
    // Ignore a duplicate/overlapping start for the same output while one is already negotiating.
    if (startingStreams.has(outputId)) {
        console.info("WHIP start ignored for " + outputId + " (a start is already in progress).");
        return;
    }
    startingStreams.add(outputId);
    try {
        await stopStream(outputId);

        // the output's canvas (black until frames arrive, so captureStream produces RTP immediately:
        // without a first paint the encoder has nothing to encode and the WHIP server closes the
        // session with "deadline exceeded while waiting tracks")
        const entry = getCanvas(outputId);
        redraw(entry);
        const canvas = entry.canvas;

        const targetFps = fps ? Number(fps) : 30;
        const mediaStream = canvas.captureStream(targetFps);

        let realAudioTrack = null;
        let audioCtx = null;
        let audioDest = null;
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
            audioCtx.resume();
            audioDest = audioCtx.createMediaStreamDestination();
            realAudioTrack = audioDest.stream.getAudioTracks()[0];
        } catch (err) {
            console.warn("Failed to generate real audio track: " + err.message);
        }

        const pc = new RTCPeerConnection(RTC_CONFIG);

        pc.addEventListener("iceconnectionstatechange", () => {
            console.info("ICE connection state for " + outputId + ": " + pc.iceConnectionState);
        });
        pc.addEventListener("connectionstatechange", () => {
            console.info("Peer connection state for " + outputId + ": " + pc.connectionState);
            if (pc.connectionState === "failed") {
                console.error("WebRTC connection failed for " + outputId + " (ICE/DTLS could not establish a path).");
            }
        });

        mediaStream.getTracks().forEach((track) => {
            pc.addTransceiver(track, { direction: "sendonly", streams: [mediaStream] });
        });

        if (realAudioTrack) {
            pc.addTransceiver(realAudioTrack, { direction: "sendonly", streams: [mediaStream] });
        }

        if (bitrate && Number(bitrate) > 0) {
            try {
                const senders = pc.getSenders();
                const videoSender = senders.find(s => s.track && s.track.kind === "video");
                if (videoSender) {
                    const parameters = videoSender.getParameters();
                    if (!parameters.encodings || parameters.encodings.length === 0) {
                        parameters.encodings = [{}];
                    }
                    parameters.encodings[0].maxBitrate = Number(bitrate) * 1000;
                    await videoSender.setParameters(parameters);
                }
            } catch (bErr) {
                console.warn("Failed to set video maxBitrate: " + bErr.message);
            }
        }

        streams[outputId] = { canvas, mediaStream, pc, url, token, resourceUrl: "", audioCtx, audioDest, nextPlayTime: 0, keepAlive: null };

        // Keep-alive heartbeat: canvas.captureStream(fps) only emits a frame when the canvas is drawn to,
        // so if real capture frames aren't flowing (e.g. at startup, or whenever the output has no
        // content) the track goes silent and the WHIP server drops the session ("waiting tracks"). This
        // redraws the last frame (or black) during any gap so the track always produces RTP and the
        // stream stays connected until real content appears. Real frames drive it directly when flowing.
        streams[outputId].keepAlive = setInterval(() => {
            const s = streams[outputId];
            if (!s) return;
            if (Date.now() - (entry.lastPaintTime || 0) < 200) return; // real frames are flowing; leave it
            try { redraw(entry); } catch (e) {}
        }, 200);

        // Enforce sendonly direction on the SDP offer
        const offer = await pc.createOffer();
        let sdp = offer.sdp;
        sdp = sdp.replace(/a=sendrecv/g, "a=sendonly");

        await pc.setLocalDescription(new RTCSessionDescription({
            type: "offer",
            sdp: sdp
        }));

        // Wait for ICE gathering to complete so the POSTed offer carries the candidates, then send the
        // gathered localDescription (not the pre-gathering offer string). Without this, the server gets
        // an offer with no host candidates and the connection can never establish.
        await waitForIceGathering(pc, 3000);
        const gatheredSdp = (pc.localDescription && pc.localDescription.sdp) ? pc.localDescription.sdp : sdp;

        // Perform signaling POST request from NodeJS Main process to bypass all CORS / origin security constraints
        const answerSdp = await new Promise((resolve, reject) => {
            streams[outputId].resolvePost = resolve;
            streams[outputId].rejectPost = reject;
            host.send("DO_WHIP_POST", { outputId, url, token, sdp: gatheredSdp });
        });

        // Guard against a teardown race: if this connection was stopped/replaced while we were awaiting
        // ICE gathering or the signaling POST, don't apply the answer to a closed pc (throws) — just bail.
        if (!streams[outputId] || streams[outputId].pc !== pc || pc.signalingState === "closed") {
            console.info("WHIP start aborted for " + outputId + " (connection was closed during negotiation).");
            return;
        }

        await pc.setRemoteDescription(new RTCSessionDescription({
            type: "answer",
            sdp: answerSdp
        }));
        console.info("WHIP stream established Completed Successfully!");

    } catch (err) {
        console.error("Failed to start WHIP stream for " + outputId + ": " + err.message);
        await stopStream(outputId);
    } finally {
        startingStreams.delete(outputId);
    }
});

host.on("STOP_WHIP", async ({ outputId }) => {
    await stopStream(outputId);
});

async function stopStream(outputId) {
    const stream = streams[outputId];
    if (!stream) return;

    console.info("Stopping stream for " + outputId);

    if (stream.keepAlive) {
        clearInterval(stream.keepAlive);
        stream.keepAlive = null;
    }

    // Gracefully terminate WHIP session on the server via HTTP DELETE
    if (stream.resourceUrl) {
        console.info("Sending WHIP DELETE request to resource URL: " + stream.resourceUrl);
        host.send("DO_WHIP_DELETE", { outputId, url: stream.resourceUrl, token: stream.token });
    }

    try {
        stream.mediaStream.getTracks().forEach(t => {
            t.stop();
        });
    } catch (_) {}

    try {
        if (stream.audioCtx) {
            stream.audioCtx.close();
        }
    } catch (_) {}

    try {
        stream.pc.close();
    } catch (_) {}

    delete streams[outputId];
}
<\/script>
</body>
</html>`
        /* eslint-enable no-useless-escape */
    }
}
