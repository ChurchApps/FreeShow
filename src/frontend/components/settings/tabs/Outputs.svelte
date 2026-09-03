<script lang="ts">
    import { onDestroy } from "svelte"
    import { uid } from "uid"
    import { BLACKMAGIC, NDI, OUTPUT } from "../../../../types/Channels"
    import { Main } from "../../../../types/IPC/Main"
    import type { Option } from "../../../../types/Main"
    import type { Output, RtmpDestination } from "../../../../types/Output"
    import { AudioAnalyser } from "../../../audio/audioAnalyser"
    import { requestMain, sendMain } from "../../../IPC/main"
    import { activePage, activePopup, activeStage, activeStyle, alertMessage, currentOutputSettings, ndiData, outputDisplay, outputs, rtmpStatus, saved, settingsTab, special, stageShows, styles, toggleOutputEnabled } from "../../../stores"
    import { newToast } from "../../../utils/common"
    import { translateText } from "../../../utils/language"
    import { destroy, receive, send } from "../../../utils/request"
    import { clone, keysToID, sortByName, sortObject } from "../../helpers/array"
    import { addRtmpDestination, checkFFmpeg, refreshOut, removeRtmpDestination, startRtmpStreaming, startStreaming, stopRtmpStreaming, stopStreaming, toggleOutput, updateOutputRtmpData, updateOutputWebrtcData, updateRtmpDestination } from "../../helpers/output"
    import { hasStreamableDestination } from "../../helpers/rtmpDestinations"
    import InputRow from "../../input/InputRow.svelte"
    import Title from "../../input/Title.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialCheckbox from "../../inputs/MaterialCheckbox.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialPopupButton from "../../inputs/MaterialPopupButton.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"

    let outputsList: Output[] = []
    $: outputsList = sortObject(sortByName(keysToID($outputs)), "stageOutput")

    let currentOutput: Output | null = null
    $: if ($currentOutputSettings) currentOutput = clone({ id: $currentOutputSettings, ...$outputs[$currentOutputSettings] })

    $: if (currentOutput?.blackmagic) send(BLACKMAGIC, ["GET_DEVICES"])

    function updateOutput(key: string, value: any, outputId = "") {
        if (!outputId) outputId = currentOutput?.id || ""
        if (!outputId || !$outputs[outputId]) return

        if (key === "style") setTimeout(refreshOut)

        outputs.update((a: any) => {
            const out = a[outputId]
            if (!out) return a

            // Update value
            if (key.includes(".")) {
                let [p1, p2] = key.split(".")
                out[p1][p2] = value
                if (p2 === "lines" && !Number(value)) delete out[p1][p2]
            } else {
                out[key] = value
            }

            // IPC
            if (key === "enabled") {
                if (value) {
                    enableOutput(out)
                } else {
                    send(OUTPUT, ["REMOVE"], { id: outputId })
                    updateOutput("hideFromPreview", false, outputId)

                    ndiData.update((n) => {
                        delete n[outputId]
                        return n
                    })

                    AudioAnalyser.recorderDeactivate()
                }
            }

            if (out.enabled) {
                // transparent/invisible are window-creation options, and the capture-type flags
                // (ndi/webrtc/rtmp/blackmagic) flip the window's offscreen (OSR) mode, which is fixed at
                // creation — none can change on a live window, so these need a full recreate (CREATE on an
                // existing id tears the window down and rebuilds it with the new config, including the
                // sender/capture lifecycle). alwaysOnTop applies live via SET_VALUE.
                const recreateKeys = ["transparent", "invisible", "ndi", "webrtc", "rtmp", "blackmagic"]
                if (recreateKeys.includes(key)) {
                    send(OUTPUT, ["CREATE"], { id: outputId, ...out })
                } else if (key === "alwaysOnTop") {
                    send(OUTPUT, ["SET_VALUE"], { id: outputId, key, value })
                }
            }

            return a
        })

        async function enableOutput(out: Output) {
            if (out.rtmp) await checkFFmpeg()
            send(OUTPUT, ["CREATE"], { ...out, id: outputId })
            AudioAnalyser.recorderActivate()
        }
    }

    function _toggleOutput(state: boolean) {
        toggleOutputEnabled.set(true) // disable preview output transitions (to prevent visual svelte bug)
        setTimeout(() => {
            updateOutput("enabled", state)
            if ($outputDisplay) toggleOutput(currentOutput?.id || "")
        }, 100)
    }

    $: styleId = currentOutput?.style || ""
    function editStyle() {
        activeStyle.set(styleId)
        settingsTab.set("styles")
    }

    $: stageId = currentOutput?.stageOutput || ""
    function editStage() {
        activeStage.set({ id: stageId, items: [] })
        activePage.set("stage")
    }

    // ndi
    function updateNdiData(e: any, key: string) {
        let id = currentOutput?.id
        if (!id) return

        let newData = $outputs[id]?.ndiData
        if (!newData) newData = {}

        let value = e?.detail?.id ?? e

        newData[key] = value

        updateOutput("ndiData", newData)

        send(NDI, ["NDI_DATA"], { id, ...newData })

        if (key === "name" || key === "groups") {
            alertMessage.set("settings.restart_for_change")
            activePopup.set("alert")
            saved.set(false)
        }
    }

    // webrtc
    function updateWebrtcData(e: any, key: string) {
        let id = currentOutput?.id
        if (!id) return

        let value = e?.detail?.id ?? e
        const updated = updateOutputWebrtcData(id, key, value)
        if (!updated) return

        saved.set(false)
    }

    // RTMP

    function updateRtmpData(value: any, key: string) {
        if (!currentOutput?.id) return
        updateOutputRtmpData(currentOutput.id, key, value)
    }

    function extractPlatformName(urlString: string | undefined): string | null {
        if (!urlString) return null
        try {
            const normalizedUrl = urlString.replace(/^rtmp(s)?:\/\//i, "http$1://")
            const parsedUrl = new URL(normalizedUrl)
            const match = parsedUrl.hostname.toLowerCase().match(/([^.]+)\.[^.]+$/)
            return match ? match[1] : null
        } catch {
            return null
        }
    }

    // RTMP encoder

    let encoderOptions: { value: string; label: string; data?: string; disabled?: boolean }[] = [{ value: "auto", label: "Auto" }]
    // let detectingEncoders = false
    async function loadEncoders(force = false) {
        // detectingEncoders = true
        try {
            const detection = await requestMain(Main.ENCODER_DETECT, { force })
            const encoders = (detection?.encoders || []).sort((a, b) => a.label.localeCompare(b.label)).sort((a, b) => (a.available === b.available ? 0 : a.available ? -1 : 1))
            // .filter((a) => a.available) // should we hide unavailable encoders?
            const recommended = encoders.find((e) => e.id === detection?.recommended)
            encoderOptions = [{ value: "auto", label: "Auto", data: recommended?.label || "" }, ...encoders.map((e) => ({ value: e.id, label: e.label, data: e.available ? "" : e.reason, disabled: !e.available }))]
        } finally {
            // detectingEncoders = false
        }
    }

    function setEncoder(encoder: string) {
        special.update((a) => ({ ...a, rtmpEncoder: encoder }))
        sendMain(Main.SET_RTMP_ENCODER, { encoder })
        saved.set(false)
    }

    $: if (currentOutput?.rtmp && encoderOptions.length === 1) loadEncoders()
    $: if (currentOutput?.rtmp && !currentOutput?.rtmpData?.destinations?.length) addDestination()

    // RTMP destinations

    function addDestination() {
        if (currentOutput?.id) addRtmpDestination(currentOutput.id)
    }
    function updateDestination(destinationId: string, key: keyof RtmpDestination, value: any) {
        if (currentOutput?.id) updateRtmpDestination(currentOutput.id, destinationId, key, value)
    }
    function removeDestination(destinationId: string) {
        if (currentOutput?.id) removeRtmpDestination(currentOutput.id, destinationId)
    }

    // Frame rates

    const framerates = [
        { value: "10", label: "10 fps" },
        { value: "12", label: "12 fps" },
        { value: "24", label: "24 fps" },
        { value: "25", label: "25 fps" },
        { value: "30", label: "30 fps" },
        { value: "48", label: "48 fps" },
        { value: "50", label: "50 fps" },
        { value: "60", label: "60 fps" }
    ]

    // blackmagic
    let blackmagicDevices: Option[] = []
    function getUsedBlackmagicDeviceIds(excludeId = "") {
        return Object.entries($outputs)
            .filter(([id, o]: any) => id !== excludeId && o.blackmagic && o.blackmagicData?.deviceId)
            .map(([_id, o]: any) => String(o.blackmagicData.deviceId))
    }

    function updateBlackmagicData(e: any, key: string) {
        let id = currentOutput?.id
        if (!id) return

        let newData = $outputs[id]?.blackmagicData
        if (!newData) newData = {}
        let value = e?.detail?.id || e?.detail?.name || e

        if (key === "deviceId") {
            const usedIds = getUsedBlackmagicDeviceIds(id)
            if (usedIds.includes(String(value))) {
                newToast("Device already in use by another output.")
                return
            }
        }

        newData[key] = value

        updateOutput("blackmagicData", newData)
        // send(NDI, ["NDI_DATA"], { id, ...newData })

        // wait for current value to update
        setTimeout(() => {
            if (key === "deviceId") {
                let device = blackmagicDevices.find((a) => a.id === value)
                if (!device) return

                let displayModes = device.data?.displayModes || []
                updateBlackmagicData(displayModes, "displayModes")
                if (displayModes.length) {
                    // try setting to "preferred" modes, or set to first available
                    updateBlackmagicData(displayModes.find((a) => a.name === "1080i59.94" || a.name === "1080p29.97")?.name || displayModes[0]?.name, "displayMode")
                }
            } else if (key === "displayMode") {
                let device = blackmagicDevices.find((a) => a.id === currentOutput?.blackmagicData?.deviceId)
                if (!device) return

                let displayModes = device.data?.displayModes || []
                let modeData = displayModes.find((a) => a.name === value) || {}
                if (!modeData.width) return

                // pixel format
                let pixelFormats = (modeData.videoModes || []).map((format) => ({ name: format }))
                updateBlackmagicData(pixelFormats, "pixelFormats")
                updateBlackmagicData(pixelFormats[0]?.name, "pixelFormat")

                // force resolution & update framerate
                updateOutput("forcedResolution", { width: modeData.width, height: modeData.height })
                updateBlackmagicData(modeData.frameRate, "framerate")
                // updateBlackmagicData(modeData.videoModes, "pixelFormats")

                // allow data to update first
                setTimeout(() => {
                    if (newData.displayMode && newData.pixelFormat) send(OUTPUT, ["SET_VALUE"], { id: currentOutput?.id, key: "blackmagic", value: currentOutput })
                })
            } else if (key === "pixelFormat" || key === "alphaKey" || key === "sdr") {
                if (key === "alphaKey") updateOutput("transparent", value)
                setTimeout(() => {
                    if (newData.displayMode && newData.pixelFormat) send(OUTPUT, ["SET_VALUE"], { id: currentOutput?.id, key: "blackmagic", value: currentOutput })
                })
            }

            saved.set(false)
        })
    }

    $: activeOutputs = Object.values($outputs).filter((a) => !a.stageOutput && a.enabled && a.active === true)

    // RECEIVE BLACKMAGIC DEVICES

    let listenerId = uid()
    onDestroy(() => destroy(BLACKMAGIC, listenerId))
    const receiveBMD = {
        GET_DEVICES: (data) => {
            const parsedData = JSON.parse(data)
            blackmagicDevices = parsedData.map((a) => ({
                id: a.deviceHandle,
                name: a.displayName || a.modelName,
                data: {
                    displayModes: a.outputDisplayModes || a.inputDisplayModes,
                    supportsInternalKeying: a.supportsInternalKeying || false,
                    supportsExternalKeying: a.supportsExternalKeying || false
                }
            }))
            // auto-select first available device (not in use)
            if (blackmagicDevices.length && (!currentOutput?.blackmagicData?.deviceId || !currentOutput?.blackmagicData?.displayModes?.length)) {
                const usedIds = getUsedBlackmagicDeviceIds(currentOutput?.id)
                const availableDevice = blackmagicDevices.find((d) => !usedIds.includes(String(d.id || "")))
                if (availableDevice) updateBlackmagicData({ detail: { id: availableDevice.id } }, "deviceId")
            }
        }
    }
    receive(BLACKMAGIC, receiveBMD, listenerId)

    // Check if alpha keying is supported by the device
    function isAlphaSupported(): boolean {
        const device = blackmagicDevices.find((a) => a.id === currentOutput?.blackmagicData?.deviceId)
        if (!device) return false
        return device.data?.supportsInternalKeying || device.data?.supportsExternalKeying || false
    }

    $: isCropped = currentOutput?.cropping && (currentOutput.cropping.left || 0) + (currentOutput.cropping.right || 0) + (currentOutput.cropping.top || 0) + (currentOutput.cropping.bottom || 0) > 0
    $: outputLabel = (currentOutput?.blackmagicData?.displayMode || `${currentOutput?.bounds?.width || 1920}x${currentOutput?.bounds?.height || 1080}`) + (isCropped ? ` - settings.cropped` : "")
</script>

{#if outputsList.filter((a) => !a.stageOutput).length > 1 || !currentOutput?.enabled || currentOutput?.stageOutput}
    {@const isStreaming = currentOutput?.webrtcData?.streaming || currentOutput?.rtmpData?.streaming}
    <MaterialToggleSwitch label="settings.enabled" checked={currentOutput?.enabled} defaultValue={true} disabled={(!currentOutput?.stageOutput && currentOutput?.enabled && activeOutputs.length < 2) || (currentOutput?.enabled && isStreaming)} on:change={(e) => _toggleOutput(e.detail)} />
{/if}

{#if stageId}
    <InputRow>
        <MaterialPopupButton label="stage.stage_layout" value={stageId} name={$stageShows[stageId]?.name} icon="stage" popupId="select_stage_layout" on:change={(e) => updateOutput("stageOutput", e.detail)} />
        {#if $stageShows[stageId]}
            <MaterialButton title="titlebar.edit" icon="edit" on:click={editStage} />
        {/if}
    </InputRow>
{:else}
    <InputRow>
        <MaterialPopupButton label="settings.active_style" value={styleId} name={$styles[styleId]?.name} icon="styles" popupId="select_style" on:change={(e) => updateOutput("style", e.detail)} allowEmpty />
        {#if $styles[styleId]}
            <MaterialButton title="titlebar.edit" icon="edit" on:click={editStyle} />
        {/if}
    </InputRow>
{/if}

<!-- WIP toggle fullscreen (Mac) ?? Only working one time for some reason -->
<!-- WIP toggle visibleOnAllWorkspaces (Mac) -->

{#if !currentOutput?.invisible}
    <!-- window -->
    <Title label="settings.window" icon="hdmi" />

    <MaterialPopupButton label="settings.output_screen" value={outputLabel} name={outputLabel} icon={currentOutput?.boundsLocked ? "locked" : "screen"} popupId="choose_screen" />
    <MaterialToggleSwitch label="settings.always_on_top" checked={currentOutput?.alwaysOnTop !== false} defaultValue={true} on:change={(e) => updateOutput("alwaysOnTop", e.detail)} />
{/if}

{#if currentOutput?.blackmagic}
    <Title label="Blackmagic Design" icon="blackmagic" />

    <MaterialDropdown
        label="settings.device"
        value={currentOutput?.blackmagicData?.deviceId || ""}
        options={(() => {
            const usedIds = getUsedBlackmagicDeviceIds(currentOutput?.id)
            return blackmagicDevices.map((device) => ({
                label: usedIds.includes(String(device.id || "")) ? `${device.name} (in use)` : device.name,
                value: device.id ? String(device.id) : "",
                disabled: usedIds.includes(String(device.id))
            }))
        })()}
        on:change={(e) => updateBlackmagicData(e.detail, "deviceId")}
    />

    {#if currentOutput?.blackmagicData?.deviceId}
        <InputRow>
            <MaterialDropdown label="settings.display_mode" value={currentOutput.blackmagicData?.displayMode} options={currentOutput.blackmagicData?.displayModes?.map((mode) => ({ label: mode.name, value: mode.name })) || []} on:change={(e) => updateBlackmagicData(e.detail, "displayMode")} />
            <MaterialDropdown label="settings.pixel_format" value={currentOutput.blackmagicData?.pixelFormat} options={currentOutput.blackmagicData?.pixelFormats?.map((format) => ({ label: format.name, value: format.name })) || []} on:change={(e) => updateBlackmagicData(e.detail, "pixelFormat")} />
        </InputRow>

        {#if currentOutput.blackmagicData?.pixelFormat?.includes("YUV")}
            <MaterialToggleSwitch label="SDR" title="SDR Encoding (Rec. 709)" checked={currentOutput.blackmagicData?.sdr !== false} defaultValue={true} on:change={(e) => updateBlackmagicData(e.detail, "sdr")} />
        {/if}

        {#if isAlphaSupported()}
            <MaterialToggleSwitch label="settings.alpha_key" checked={currentOutput.blackmagicData?.alphaKey} on:change={(e) => updateBlackmagicData(e.detail, "alphaKey")} />
        {/if}
    {/if}
{/if}

{#if currentOutput?.ndi}
    <Title label="NDI®" icon="ndi" />

    <InputRow>
        {#if currentOutput.invisible && !currentOutput.blackmagic}
            <MaterialPopupButton label="edit.size" value={outputLabel} name={outputLabel} icon="resize" popupId="change_output_values" />
        {/if}
        <MaterialDropdown label="settings.frame_rate" value={currentOutput.ndiData?.framerate || "30"} defaultValue="30" options={framerates} on:change={(e) => updateNdiData(e.detail, "framerate")} />
    </InputRow>

    <InputRow>
        <MaterialTextInput label="inputs.name" value={currentOutput.ndiData?.name || `FreeShow NDI${currentOutput.name ? ` - ${currentOutput.name}` : ""}`} defaultValue={`FreeShow NDI${currentOutput.name ? ` - ${currentOutput.name}` : ""}`} on:change={(e) => updateNdiData(e.detail, "name")} />
        <MaterialTextInput label="inputs.group" title="settings.comma_seperated" value={currentOutput.ndiData?.groups || ""} defaultValue="" placeholder="public" on:change={(e) => updateNdiData(e.detail, "groups")} />
    </InputRow>

    <!-- not sure if we need to toggle this off? -->
    <MaterialToggleSwitch label="settings.transparent" checked={currentOutput.transparent} defaultValue={true} on:change={(e) => updateOutput("transparent", e.detail)} />

    <!-- Connections count (connection status visible by blue indicator) -->
    <!-- {#if $ndiData[currentOutput?.id || ""]?.connections > 0}
        <div style="padding: 10px;font-size: 0.8em;opacity: 0.4;text-align: center;">
            {$ndiData[currentOutput?.id || ""].connections}
        </div>
    {/if} -->
{/if}

{#if currentOutput?.webrtc}
    <Title label="WebRTC" icon="broadcast" />

    {#if currentOutput.invisible && !currentOutput.blackmagic}
        <MaterialPopupButton label="edit.size" value={outputLabel} name={outputLabel} icon="resize" popupId="change_output_values" />
    {/if}
    <InputRow>
        <MaterialDropdown label="settings.frame_rate" value={currentOutput.webrtcData?.fps?.toString() || "30"} defaultValue="30" options={framerates} on:change={(e) => updateWebrtcData(e.detail, "fps")} />
        <MaterialTextInput label="Bitrate (kbps)" value={currentOutput.webrtcData?.bitrate?.toString() || "4000"} defaultValue="4000" placeholder="4000" on:change={(e) => updateWebrtcData(e.detail, "bitrate")} />
    </InputRow>
    <MaterialTextInput label="WHIP Endpoint URL" value={currentOutput.webrtcData?.url || ""} placeholder="e.g. https://live.restream.io/whip/live/YOUR_KEY" on:change={(e) => updateWebrtcData(e.detail, "url")} pasteBtn />
    <MaterialTextInput label="Bearer Token (Optional)" value={currentOutput.webrtcData?.token || ""} placeholder="Authorization token" on:change={(e) => updateWebrtcData(e.detail, "token")} pasteBtn />
    <!-- <MaterialToggleSwitch label="settings.transparent" checked={currentOutput.transparent} defaultValue={false} on:change={(e) => updateOutput("transparent", e.detail)} /> -->

    {#if currentOutput?.enabled && currentOutput?.webrtcData?.url}
        <div style="padding-bottom: 10px;">
            <MaterialButton variant="outlined" icon={currentOutput.webrtcData?.streaming ? "stop" : "record"} style="width: 100%; justify-content: center; {currentOutput.webrtcData?.streaming ? 'background: #b60707 !important;' : ''}" on:click={() => (currentOutput?.webrtcData?.streaming ? stopStreaming(currentOutput.id, true) : startStreaming(currentOutput?.id))} white>
                {translateText(currentOutput.webrtcData?.streaming ? "output.stop_streaming" : "output.start_streaming")}
            </MaterialButton>
        </div>
    {/if}
{/if}

{#if currentOutput?.rtmp}
    <Title label="RTMP" icon="broadcast" />

    {#if currentOutput.invisible && !currentOutput.blackmagic}
        <MaterialPopupButton label="edit.size" value={outputLabel} name={outputLabel} icon="resize" popupId="change_output_values" />
    {/if}
    <InputRow>
        <MaterialDropdown label="settings.frame_rate" value={currentOutput.rtmpData?.fps?.toString() || "30"} defaultValue="30" options={framerates} on:change={(e) => updateRtmpData(e.detail, "fps")} />
        <MaterialTextInput label="settings.bitrate (kbps)" value={currentOutput.rtmpData?.bitrate?.toString() || "4000"} defaultValue="4000" placeholder="4000" on:change={(e) => updateRtmpData(e.detail, "bitrate")} />
    </InputRow>

    <InputRow style="margin-bottom: 10px;">
        <MaterialDropdown label="settings.video_encoder" value={$special.rtmpEncoder || "auto"} defaultValue="auto" options={encoderOptions} on:change={(e) => setEncoder(e.detail)} />
        <!-- <MaterialButton variant="outlined" icon="refresh" title="Re-detect encoders" disabled={detectingEncoders} on:click={() => loadEncoders(true)} /> -->
    </InputRow>

    <div class="destinations">
        {#each currentOutput.rtmpData?.destinations || [] as destination (destination.id)}
            {@const status = $rtmpStatus[currentOutput?.id || ""]?.[destination.id]}

            <div class="destination">
                <div style="display: flex;align-items: center;gap: 10px;padding-bottom: 4px;text-transform: uppercase;">
                    <span class="dot {status?.state || 'idle'}" data-title={status?.error || status?.state || "idle"}></span>
                    <div style="font-size: 0.8em; opacity: 0.5;">{extractPlatformName(destination.url) || ""}</div>
                </div>

                {#if (currentOutput.rtmpData?.destinations || []).length > 1 || destination.enabled === false}
                    <InputRow>
                        <MaterialCheckbox label="settings.enabled" checked={destination.enabled} defaultValue={true} style="flex: 1;" on:change={(e) => updateDestination(destination.id, "enabled", e.detail)} />
                        {#if !destination.enabled || !destination.url}
                            <MaterialButton variant="outlined" icon="delete" title="settings.remove" on:click={() => removeDestination(destination.id)} red />
                        {/if}
                    </InputRow>
                {/if}

                <MaterialTextInput label="Stream URL" value={destination.url} placeholder="e.g. rtmp://a.rtmp.youtube.com/live2" on:change={(e) => updateDestination(destination.id, "url", e.detail)} pasteBtn />
                <MaterialTextInput label="Stream key" value={destination.key} type="password" on:change={(e) => updateDestination(destination.id, "key", e.detail)} pasteBtn />

                <!-- kept visible after recovery: a destination that reconnects repeatedly still looks
                     "live" between drops, so the count is the only signal that it is struggling -->
                {#if status?.restarts}
                    <div class="destination-warning">
                        {status.restarts === 1 ? "Reconnected once" : `Reconnected ${status.restarts} times`}{status.lastIssue && !status.error ? ` — ${status.lastIssue}` : ""}
                    </div>
                {/if}
                {#if status?.error}
                    <div class="destination-error">{status.error}</div>
                {/if}
            </div>
        {/each}

        <MaterialButton variant="outlined" icon="add" disabled={(currentOutput.rtmpData?.destinations || []).some((a) => !a.url)} on:click={() => addDestination()}>
            {translateText("settings.add_destination")}
        </MaterialButton>
    </div>

    {#if currentOutput?.enabled && hasStreamableDestination(currentOutput.rtmpData)}
        <div style="padding: 10px 0;">
            <MaterialButton variant="outlined" icon={currentOutput.rtmpData?.streaming ? "stop" : "record"} style="width: 100%; justify-content: center; {currentOutput.rtmpData?.streaming ? 'background: #b60707 !important;' : ''}" on:click={() => (currentOutput?.rtmpData?.streaming ? stopRtmpStreaming(currentOutput.id, true) : startRtmpStreaming(currentOutput?.id))} white>
                {translateText(currentOutput.rtmpData?.streaming ? "output.stop_streaming" : "output.start_streaming")}
            </MaterialButton>
        </div>
    {/if}
{/if}

<style>
    .hint {
        padding: 0 10px 10px;
        font-size: 0.8em;
        opacity: 0.5;
    }

    /* Stream destinations */

    .destinations {
        display: flex;
        flex-direction: column;
        gap: 5px;
    }

    .destination {
        display: flex;
        flex-direction: column;

        padding: 8px;
        border: 1px solid var(--primary-lighter);
        border-radius: 4px;
    }

    .dot {
        flex-shrink: 0;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background-color: #6b6b6b;
    }
    .dot.connecting,
    .dot.reconnecting {
        background-color: #e0a800;
    }
    .dot.live {
        background-color: #2ecc71;
    }
    .dot.error {
        background-color: #b60707;
    }

    .destination-warning {
        padding-top: 4px;
        font-size: 0.8em;
        color: #e0bc50;
    }
    .destination-error {
        padding-top: 4px;
        color: #ff8080;
        font-size: 0.8em;
    }
</style>
