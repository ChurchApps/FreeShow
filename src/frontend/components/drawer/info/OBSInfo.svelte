<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { connectToOBS } from "../../../utils/obsTalk"
    import { wait } from "../../../utils/common"
    import { obsData } from "../../../stores"

    let connected = false
    let currentScene: string = ""
    let isLive: boolean = false
    let isRecording: boolean = false
    let obs: any = null

    let isMounted = false
    let previewImg: string = ""
    let cpuUsage: number = 0
    let activeFps: number = 0

    const cpuUsageBuffer: number[] = []
    const fpsBuffer: number[] = []
    const AVERAGE_WINDOW = 10

    let streamDuration: string = ""
    let streamBytes: number = 0

    function getPreview() {
        if (!isMounted || !obs || !currentScene) return
        const previewRequestId = Math.random().toString(36).substring(7)
        obs.call("GetSourceScreenshot", {
            sourceName: currentScene,
            imageFormat: "jpg",
            imageWidth: 480,
            imageCompressionQuality: 50,
            requestId: previewRequestId
        })
        startPreviewAutoRefresh()
    }

    let previewInterval: any = null
    function startPreviewAutoRefresh() {
        if (previewInterval) clearInterval(previewInterval)
        previewInterval = setInterval(() => {
            getPreview()
        }, 500)
    }
    function stopPreviewAutoRefresh() {
        if (previewInterval) {
            clearInterval(previewInterval)
            previewInterval = null
        }
    }

    let metricsInterval: any = null
    function startMetricsAutoRefresh() {
        if (metricsInterval) clearInterval(metricsInterval)
        metricsInterval = setInterval(() => {
            getMetrics()
        }, 1000)
    }
    function stopMetricsAutoRefresh() {
        if (metricsInterval) {
            clearInterval(metricsInterval)
            metricsInterval = null
        }
    }
    function getMetrics() {
        if (!obs) return
        obs.call("GetStats")
        if (isLive) {
            obs.call("GetStreamStatus")
        }
    }

    onDestroy(() => {
        isMounted = false
        stopPreviewAutoRefresh()
        stopMetricsAutoRefresh()
    })

    onMount(async () => {
        isMounted = true

        if (!$obsData.connected) {
            const unsub = obsData.subscribe((value) => {
                if (value.connected) {
                    unsub()
                    setup()
                }
            })
            return
        }

        await wait(100) // let main page load first
        await setup()
    })

    async function setup() {
        obs = await connectToOBS()
        getPreview()

        obs.onStateChange((isConnected: boolean) => {
            connected = isConnected
            if (isConnected) {
                obs.call("GetSceneList")
                obs.call("GetStreamStatus")
                obs.call("GetRecordStatus")
                startMetricsAutoRefresh()
            } else {
                stopMetricsAutoRefresh()
            }
        })

        obs.listen((msg: any) => {
            // OpCode 7: Request Responses
            if (msg.op === 7 && msg.d) {
                const res = msg.d.responseData
                switch (msg.d.requestType) {
                    case "GetSceneList":
                        currentScene = res?.currentProgramSceneName
                        previewImg = ""
                        getPreview()
                        break
                    case "GetSceneItemList":
                        getPreview()
                        break
                    case "GetStats": {
                        const cpu = res?.cpuUsage || 0
                        const fps = res?.activeFps || 0
                        cpuUsageBuffer.push(cpu)
                        fpsBuffer.push(fps)
                        if (cpuUsageBuffer.length > AVERAGE_WINDOW) cpuUsageBuffer.shift()
                        if (fpsBuffer.length > AVERAGE_WINDOW) fpsBuffer.shift()
                        // Calculate averages
                        cpuUsage = cpuUsageBuffer.reduce((a, b) => a + b, 0) / cpuUsageBuffer.length
                        activeFps = fpsBuffer.reduce((a, b) => a + b, 0) / fpsBuffer.length
                        break
                    }
                    case "GetStreamStatus":
                        isLive = Boolean(res?.outputActive)
                        streamDuration = res?.outputTimecode || ""
                        streamBytes = res?.outputBytes || 0
                        break
                    case "GetRecordStatus":
                        isRecording = Boolean(res?.isRecording ?? res?.outputActive ?? false)
                        break
                    case "ToggleRecord":
                        if (res && typeof res.outputActive !== "undefined") isRecording = res.outputActive
                        break
                    case "GetSourceScreenshot":
                        if (msg.d.requestStatus?.result) {
                            previewImg = res?.imageData
                        }
                        break
                }
            }

            // OpCode 5: Event Broadcasters
            if (msg.op === 5 && msg.d) {
                const evt = msg.d.eventData
                switch (msg.d.eventType) {
                    case "CurrentProgramSceneChanged":
                        currentScene = evt.sceneName
                        previewImg = ""
                        getPreview()
                        break
                    case "StreamStateChanged":
                        isLive = evt.outputActive
                        break
                    case "RecordStateChanged":
                        isRecording = evt.outputActive
                        break
                }
            }
        })
    }
</script>

{#if connected}
    <div style="display: flex;flex-direction: column;flex: 1;height: 100%;">
        <!-- Preview Canvas -->
        <div style="background: #101216;position: relative;font-family: 'Segoe UI', system-ui, sans-serif;">
            <!-- <div style="position: absolute;top: 0.25em;left: 0.25em;background: rgba(22, 25, 28, 0.85);color: #cbd5e1;padding: 0.2em 0.5em;border-radius: 4px;font-size: 0.7em;font-weight: 600;border: 1px solid #101216;letter-spacing: 0.05em;">
                {currentScene || "No Scene"}
            </div> -->
            {#if previewImg}
                <img id="preview-img" src={previewImg} alt="Scene Preview" style="width: 100%;display: block;" />
            {:else}
                <div style="width: 100%;height: 150px;display: flex;align-items: center;justify-content: center;color: #555;font-size: 0.9em;font-weight: 500;">No Preview Available</div>
            {/if}
        </div>

        <!-- Status Indicators -->
        <!-- <div style="display: flex;align-items: center;justify-content: center;gap: 1.5em;background: #1f232a;padding: 0.6em 1em;border-radius: 6px;font-family: 'Segoe UI', system-ui, sans-serif;">
            <div style="display: flex;align-items: center;gap: 0.4em;">
                <span style="display: inline-block;width: 8px;height: 8px;border-radius: 50%;background: {isLive ? '#ef4444' : 'rgba(255,255,255,0.2)'};box-shadow: {isLive ? '0 0 6px #ef4444' : 'none'};transition: all 0.3s;"></span>
                <span style="color: {isLive ? '#f1f3f5' : '#94a3b8'};font-weight: 700;font-size: 0.8em;letter-spacing: 0.05em;">LIVE</span>
            </div>
            <div style="width: 1px;height: 12px;background: #2b303c;"></div>
            <div style="display: flex;align-items: center;gap: 0.4em;">
                <span style="display: inline-block;width: 8px;height: 8px;border-radius: 50%;background: {isRecording ? '#ef4444' : 'rgba(255,255,255,0.2)'};box-shadow: {isRecording ? '0 0 6px #ef4444' : 'none'};transition: all 0.3s;"></span>
                <span style="color: {isRecording ? '#f1f3f5' : '#94a3b8'};font-weight: 700;font-size: 0.8em;letter-spacing: 0.05em;">REC</span>
            </div>
        </div> -->

        <!-- Spacer to push the metrics to the bottom -->
        <div style="flex: 1;"></div>

        <!-- Metrics Grid -->
        <div style="display: grid;grid-template-columns: 1fr 1fr;justify-items: center;text-align: center;gap: 0.5em;background: #1f232a;padding: 0.5em 0.75em;border-radius: 6px;font-family: 'Segoe UI', system-ui, sans-serif;">
            <div style="display: flex;align-items: center;flex-direction: column;gap: 0.35em;margin-bottom: 5px;">
                <span style="color: {isLive ? '#f1f3f5' : '#94a3b8'};font-size: 0.7em;font-weight: 600;letter-spacing: 0.05em;">LIVE</span>
                <span style="display: inline-block;width: 15px;height: 15px;border-radius: 50%;background: {isLive ? '#ef4444' : 'rgba(255,255,255,0.2)'};box-shadow: {isLive ? '0 0 6px #ef4444' : 'none'};transition: all 0.3s;"></span>
            </div>
            <div style="display: flex;align-items: center;flex-direction: column;gap: 0.35em;margin-bottom: 5px;">
                <span style="color: {isRecording ? '#f1f3f5' : '#94a3b8'};font-size: 0.7em;font-weight: 600;letter-spacing: 0.05em;">REC</span>
                <span style="display: inline-block;width: 15px;height: 15px;border-radius: 50%;background: {isRecording ? '#ef4444' : 'rgba(255,255,255,0.2)'};box-shadow: {isRecording ? '0 0 6px #ef4444' : 'none'};transition: all 0.3s;"></span>
            </div>

            <div style="display: flex;flex-direction: column;gap: 0.15em;">
                <span style="color: #64748b;font-size: 0.65em;font-weight: 600;letter-spacing: 0.05em;text-transform: uppercase;">CPU Usage</span>
                <span style="color: #cbd5e1;font-size: 0.95em;font-weight: 700;">{cpuUsage.toFixed(1)}%</span>
            </div>
            <div style="display: flex;flex-direction: column;gap: 0.15em;">
                <span style="color: #64748b;font-size: 0.65em;font-weight: 600;letter-spacing: 0.05em;text-transform: uppercase;">Framerate</span>
                <span style="color: #cbd5e1;font-size: 0.95em;font-weight: 700;">{activeFps.toFixed(0)} FPS</span>
            </div>

            {#if isLive}
                <div style="display: flex;flex-direction: column;gap: 0.15em;grid-column: span 2;">
                    <div style="width: 100%;height: 1px;background: #2b303c;margin: 0.15em 0;"></div>
                </div>
                <div style="display: flex;flex-direction: column;gap: 0.15em;">
                    <span style="color: #64748b;font-size: 0.65em;font-weight: 600;letter-spacing: 0.05em;text-transform: uppercase;">Duration</span>
                    <span style="color: #ef4444;font-size: 0.95em;font-weight: 700;">{streamDuration}</span>
                </div>
                <div style="display: flex;flex-direction: column;gap: 0.15em;">
                    <span style="color: #64748b;font-size: 0.65em;font-weight: 600;letter-spacing: 0.05em;text-transform: uppercase;">Data Sent</span>
                    <span style="color: #cbd5e1;font-size: 0.95em;font-weight: 700;">{(streamBytes / (1024 * 1024)).toFixed(1)} MB</span>
                </div>
            {/if}
        </div>
    </div>
{/if}
