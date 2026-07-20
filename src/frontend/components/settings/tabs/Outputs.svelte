<script lang="ts">
    import { onDestroy } from "svelte"
    import { uid } from "uid"
    import { BLACKMAGIC, NDI, OUTPUT } from "../../../../types/Channels"
    import { Option } from "../../../../types/Main"
    import type { Output } from "../../../../types/Output"
    import { AudioAnalyser } from "../../../audio/audioAnalyser"
    import { activePage, activePopup, activeStage, activeStyle, alertMessage, currentOutputSettings, ndiData, outputDisplay, outputs, saved, settingsTab, stageShows, styles, toggleOutputEnabled } from "../../../stores"
    import { newToast } from "../../../utils/common"
    import { translateText } from "../../../utils/language"
    import { destroy, receive, send } from "../../../utils/request"
    import { clone, keysToID, sortByName, sortObject } from "../../helpers/array"
    import { refreshOut, startRtmpStreaming, startStreaming, stopRtmpStreaming, stopStreaming, toggleOutput, updateOutputRtmpData, updateOutputWebrtcData } from "../../helpers/output"
    import InputRow from "../../input/InputRow.svelte"
    import Title from "../../input/Title.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
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
                    send(OUTPUT, ["CREATE"], { ...out, id: outputId })
                    AudioAnalyser.recorderActivate()
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
                const ipcKeys = ["alwaysOnTop", "transparent", "invisible", "ndi", "webrtc", "rtmp"]
                if (key === "transparent") {
                    send(OUTPUT, ["CREATE"], { id: outputId, ...out })
                } else if (key === "blackmagic" || ipcKeys.includes(key)) {
                    send(OUTPUT, ["SET_VALUE"], { id: outputId, key, value: key === "blackmagic" ? out : value })
                }
            }

            return a
        })
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
            } else if (key === "pixelFormat" || key === "alphaKey") {
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

    function updateRtmpData(value: any, key: string) {
        if (!currentOutput?.id) return
        updateOutputRtmpData(currentOutput.id, key, value)
    }
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
    <MaterialTextInput label="Stream URL" value={currentOutput.rtmpData?.url || ""} placeholder="e.g. rtmp://a.rtmp.youtube.com/live2" on:change={(e) => updateRtmpData(e.detail, "url")} pasteBtn />
    <MaterialTextInput label="Stream key" value={currentOutput.rtmpData?.key || ""} type="password" on:change={(e) => updateRtmpData(e.detail, "key")} pasteBtn />

    {#if currentOutput?.enabled && currentOutput?.rtmpData?.url && currentOutput?.rtmpData?.key}
        <div style="padding-bottom: 10px;">
            <MaterialButton variant="outlined" icon={currentOutput.rtmpData?.streaming ? "stop" : "record"} style="width: 100%; justify-content: center; {currentOutput.rtmpData?.streaming ? 'background: #b60707 !important;' : ''}" on:click={() => (currentOutput?.rtmpData?.streaming ? stopRtmpStreaming(currentOutput.id, true) : startRtmpStreaming(currentOutput?.id))} white>
                {translateText(currentOutput.rtmpData?.streaming ? "output.stop_streaming" : "output.start_streaming")}
            </MaterialButton>
        </div>
    {/if}
{/if}
