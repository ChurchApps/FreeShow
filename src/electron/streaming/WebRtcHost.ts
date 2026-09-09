import { BrowserWindow, ipcMain } from "electron"

// Listen for WebRtcHost console logs and print them in the main process console
ipcMain.on("WEBRTC_LOG", (_event, { type, message }) => {
    const prefix = `[WebRtcHost ${type.toUpperCase()}]`
    if (type === "error") {
        console.error(prefix, message)
    } else if (type === "warn") {
        console.warn(prefix, message)
    } else {
        // Only print success or high-level events, suppress verbose inner-loop/ice debug logs
        if (message.includes("Completed Successfully") || message.includes("Stopping stream") || message.includes("WHIP DELETE") || message.includes("AudioCtx State") || message.includes("Audio Frames Received")) {
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

export class WebRtcHost {
    private static window: BrowserWindow | null = null
    private static started = false

    static isRunning() {
        return this.started && !!this.window && !this.window.isDestroyed()
    }

    static getWindow() {
        return this.window
    }

    static start() {
        if (this.started) return
        this.started = true
        console.log("[WebRtcHost] Starting WebRTC host...")

        this.window = new BrowserWindow({
            show: false,
            width: 1,
            height: 1,
            skipTaskbar: true,
            webPreferences: {
                contextIsolation: false,
                nodeIntegration: true,
                backgroundThrottling: false,
                webSecurity: false,
                autoplayPolicy: "no-user-gesture-required" // Crucial: allows AudioContexts to start playing in background without user interactions
            }
        })

        this.window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(this.buildHostHtml())}`)

        this.window.once("closed", () => {
            this.window = null
            this.started = false
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
    }

    /** Push a captured RGBA frame for a specific output to the hidden renderer. */
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
const { ipcRenderer } = require("electron");

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
    ipcRenderer.send("WEBRTC_LOG", { type, message: msg });
}

console.log = (...args) => sendLog("log", ...args);
console.info = (...args) => sendLog("info", ...args);
console.warn = (...args) => sendLog("warn", ...args);
console.error = (...args) => sendLog("error", ...args);

// Map<outputId, { canvas, ctx, mediaStream, pc, url, token, resolvePost, rejectPost, resourceUrl, audioCtx, audioDest, nextPlayTime } >
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

ipcRenderer.on("WEBRTC_FRAME", (_event, { outputId, buffer, size }) => {
    const stream = streams[outputId];
    if (!stream) return;

    const { canvas, ctx } = stream;
    if (canvas.width !== size.width) canvas.width = size.width;
    if (canvas.height !== size.height) canvas.height = size.height;

    try {
        const imageData = new ImageData(new Uint8ClampedArray(buffer), size.width, size.height);
        ctx.putImageData(imageData, 0, 0);
        // Remember the last real frame so the keep-alive heartbeat can redraw it during gaps.
        stream.lastImageData = imageData;
        stream.lastPaintTime = Date.now();
    } catch (err) {
        console.error("Frame paint error:", err.message);
    }
});

let audioLogCount = 0;

// Receive dynamic interleaved signed Int16 PCM system audio buffers from FreeShow
ipcRenderer.on("WEBRTC_AUDIO", (_event, { buffer, sampleRate, channelCount }) => {
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
ipcRenderer.on("WHIP_POST_RESPONSE", (_event, { outputId, answerSdp, resourceUrl }) => {
    const stream = streams[outputId];
    if (stream) {
        stream.resourceUrl = resourceUrl;
        if (stream.resolvePost) {
            stream.resolvePost(answerSdp);
        }
    }
});

ipcRenderer.on("WHIP_POST_ERROR", (_event, { outputId, error }) => {
    const stream = streams[outputId];
    if (stream && stream.rejectPost) {
        stream.rejectPost(new Error(error));
    }
});

ipcRenderer.on("START_WHIP", async (_event, { outputId, url, token, fps, bitrate }) => {
    // Ignore a duplicate/overlapping start for the same output while one is already negotiating.
    if (startingStreams.has(outputId)) {
        console.info("WHIP start ignored for " + outputId + " (a start is already in progress).");
        return;
    }
    startingStreams.add(outputId);
    try {
        await stopStream(outputId);

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: false });
        // Set an initial size
        canvas.width = 640;
        canvas.height = 360;

        // Paint an initial frame so captureStream produces RTP immediately. Without a first paint the
        // encoder has nothing to encode and the track emits nothing until real capture frames arrive —
        // at startup that's too late, and the WHIP server closes the session with "deadline exceeded
        // while waiting tracks". A black kick-start keeps the track alive until real frames replace it.
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

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

        streams[outputId] = { canvas, ctx, mediaStream, pc, url, token, resourceUrl: "", audioCtx, audioDest, nextPlayTime: 0, lastImageData: null, lastPaintTime: 0, keepAlive: null };

        // Keep-alive heartbeat: canvas.captureStream(fps) only emits a frame when the canvas is drawn to,
        // so if real capture frames aren't flowing (e.g. at startup, or whenever the output has no
        // content) the track goes silent and the WHIP server drops the session ("waiting tracks"). This
        // redraws the last frame (or black) during any gap so the track always produces RTP and the
        // stream stays connected until real content appears. Real frames drive it directly when flowing.
        streams[outputId].keepAlive = setInterval(() => {
            const s = streams[outputId];
            if (!s) return;
            if (Date.now() - (s.lastPaintTime || 0) < 200) return; // real frames are flowing; leave it
            try {
                if (s.lastImageData) s.ctx.putImageData(s.lastImageData, 0, 0);
                else { s.ctx.fillStyle = "black"; s.ctx.fillRect(0, 0, s.canvas.width, s.canvas.height); }
            } catch (e) {}
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
            ipcRenderer.send("DO_WHIP_POST", { outputId, url, token, sdp: gatheredSdp });
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

ipcRenderer.on("STOP_WHIP", async (_event, { outputId }) => {
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
        ipcRenderer.send("DO_WHIP_DELETE", { outputId, url: stream.resourceUrl, token: stream.token });
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
