import fs from "fs"
import os from "os"
import path from "path"
import { execFileSync } from "child_process"
import { _electron as electron } from "playwright"
import { expect, test } from "@playwright/test"

test("real output capture survives idle initialization, restart and framerate changes", async () => {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), "freeshow-capture-"))
    fs.writeFileSync(
        path.join(profile, "config.json"),
        JSON.stringify({
            dataPath: path.join(profile, "data"),
            autoErrorReporting: false
        })
    )
    fs.writeFileSync(
        path.join(profile, "settings.json"),
        JSON.stringify({
            initialized: true,
            language: "en",
            disabledServers: {
                remote: true,
                stage: true,
                controller: true,
                output_stream: true
            },
            outputs: {
                default: {
                    enabled: true,
                    active: true,
                    invisible: true,
                    rtmp: true,
                    name: "Capture regression",
                    bounds: { x: 0, y: 0, width: 640, height: 360 },
                    rtmpData: {
                        bitrate: 1000,
                        encoder: "x264",
                        destinations: [
                            {
                                id: "test",
                                url: path.join(profile, "initial.flv"),
                                key: "",
                                enabled: true
                            }
                        ]
                    }
                }
            }
        })
    )
    fs.writeFileSync(path.join(profile, "settings_synced.json"), JSON.stringify({ special: { autoUpdates: false } }))
    const app = await electron.launch({
        executablePath: process.env.FS_TEST_EXECUTABLE,
        args: process.env.FS_TEST_EXECUTABLE ? [] : [".", "--no-sandbox"],
        env: {
            ...process.env,
            NODE_ENV: "production",
            FS_MOCK_STORE_PATH: profile
        }
    })
    app.process().stdout?.on("data", (b) => fs.appendFileSync(path.join(profile, "stdout.log"), b))
    app.process().stderr?.on("data", (b) => fs.appendFileSync(path.join(profile, "stderr.log"), b))
    let passed = false
    try {
        await expect
            .poll(
                () =>
                    app.evaluate(({ app }) => {
                        const require = process.getBuiltinModule("module").createRequire(app.getAppPath() + "/build/electron/index.js")
                        return !!require("./output/OutputHelper.js").OutputHelper.getOutput("default")?.window
                    }),
                { timeout: 30000 }
            )
            .toBe(true)
        // Isolate capture from frontend PCM startup; capture hooks and frames are real.
        await app.evaluate(({ app }) => {
            const require = process.getBuiltinModule("module").createRequire(app.getAppPath() + "/build/electron/index.js")
            require("./audio/processAudio.js").isAudioEnabled = () => false
            require("./streaming/encoderDetection.js").setRtmpEncoderSetting("default", "x264")
        })
        const update = async (values: Record<string, unknown>, filename: string) =>
            app.evaluate(
                ({ app }, { values, destination }) => {
                    const require = process.getBuiltinModule("module").createRequire(app.getAppPath() + "/build/electron/index.js")
                    const H = require("./output/OutputHelper.js").OutputHelper
                    const output = H.getOutput("default")
                    H.Values.updateValue({
                        id: "default",
                        key: "rtmpData",
                        value: {
                            ...output.rtmpData,
                            ...values,
                            destinations: [{ id: "test", url: destination, key: "", enabled: true }]
                        }
                    })
                },
                { values, destination: path.join(profile, filename) }
            )
        const assertLive = async () => {
            await expect
                .poll(
                    () =>
                        app.evaluate(({ app }) => {
                            const require = process.getBuiltinModule("module").createRequire(app.getAppPath() + "/build/electron/index.js")
                            const R = require("./streaming/RtmpStreamer.js").RtmpStreamer
                            const s = R.streamers.get("default")
                            return !!s?.lastFrame && s.videoFrameCount > 30 && R.getStatus("default").test?.state === "live"
                        }),
                    { timeout: 20000 }
                )
                .toBe(true)
        }
        await app.firstWindow().then((w) => w.locator(".top").first().waitFor())
        await new Promise((r) => setTimeout(r, 5000))
        await app.evaluate(async ({ app }, profile) => {
            const require = process.getBuiltinModule("module").createRequire(app.getAppPath() + "/build/electron/index.js")
            const H = require("./output/OutputHelper.js").OutputHelper
            await H.Lifecycle.removeOutput("default")
            const config = JSON.parse(require("fs").readFileSync(require("path").join(profile, "settings.json"), "utf8"))
            await H.Lifecycle.createOutput({ ...config.outputs.default, id: "default" })
        }, profile)
        // Let the delayed idle initialization run before starting on the retained window.
        await new Promise((r) => setTimeout(r, 1500))
        await update({ streaming: true }, "initial.flv")
        await assertLive()
        await update({ streaming: false }, "initial.flv")
        await update({ streaming: true }, "restart.flv")
        await assertLive()
        await update({ fps: 25 }, "fps.flv")
        await assertLive()
        await update({ fps: 30 }, "fps-restored.flv")
        await assertLive()
        await update({ streaming: false }, "fps-restored.flv")
        // Starting before the delayed initialization must not be overwritten by stale state.
        await app.evaluate(async ({ app }, profile) => {
            const require = process.getBuiltinModule("module").createRequire(app.getAppPath() + "/build/electron/index.js")
            const H = require("./output/OutputHelper.js").OutputHelper
            await H.Lifecycle.removeOutput("default")
            const config = JSON.parse(require("fs").readFileSync(require("path").join(profile, "settings.json"), "utf8"))
            await H.Lifecycle.createOutput({ ...config.outputs.default, id: "default" })
        }, profile)
        await update({ streaming: true }, "early-start.flv")
        await new Promise((r) => setTimeout(r, 1500))
        expect(
            await app.evaluate(({ app }) => {
                const require = process.getBuiltinModule("module").createRequire(app.getAppPath() + "/build/electron/index.js")
                return require("./output/OutputHelper.js").OutputHelper.getOutput("default")?.captureOptions?.options?.rtmp
            })
        ).toBe(true)
        await assertLive()
        await update({ streaming: false }, "early-start.flv")
        await expect
            .poll(() =>
                app.evaluate(({ app }) => {
                    const require = process.getBuiltinModule("module").createRequire(app.getAppPath() + "/build/electron/index.js")
                    return require("./streaming/RtmpStreamer.js").RtmpStreamer.isRunning("default")
                })
            )
            .toBe(false)
        for (const name of ["initial.flv", "restart.flv", "fps.flv", "fps-restored.flv", "early-start.flv"]) {
            const file = path.join(profile, name)
            expect(fs.statSync(file).size).toBeGreaterThan(1000)
            const video = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_streams", "-of", "json", file], { encoding: "utf8" })).streams[0]
            expect(video).toMatchObject({ codec_name: "h264", width: 640, height: 360 })
        }
        passed = true
    } finally {
        if (!passed) {
            console.log(
                "Capture diagnostics:",
                await app
                    .evaluate(({ app }) => {
                        const require = process.getBuiltinModule("module").createRequire(app.getAppPath() + "/build/electron/index.js")
                        const H = require("./output/OutputHelper.js").OutputHelper
                        const R = require("./streaming/RtmpStreamer.js").RtmpStreamer
                        const output = H.getOutput("default")
                        const stream = R.streamers.get("default")
                        return { window: !!output?.window && !output.window.isDestroyed(), capture: output?.captureOptions?.options, paintListeners: output?.window?.webContents.listenerCount("paint"), frames: stream?.videoFrameCount, hasFrame: !!stream?.lastFrame, status: R.getStatus("default") }
                    })
                    .catch(() => "App already closed")
            )
            console.log("Capture test logs:", profile)
        }
        const child = app.process()
        await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
        if (child.exitCode === null) await Promise.race([new Promise((r) => child.once("exit", r)), new Promise((r) => setTimeout(r, 5000))])
        if (child.exitCode === null) child.kill()
        if (passed) fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
    }
})
