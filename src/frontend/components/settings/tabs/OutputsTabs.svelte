<script lang="ts">
    import { OUTPUT } from "../../../../types/Channels"
    import type { ClickEvent } from "../../../../types/Main"
    import type { Output } from "../../../../types/Output"
    import { AudioAnalyser } from "../../../audio/audioAnalyser"
    import { createOutputAudioChannel } from "../../../audio/routing/audioRoutingInit"
    import { activeTriggerFunction, currentOutputSettings, outputs, popupData, stageShows, styles, toggleOutputEnabled } from "../../../stores"
    import { newToast } from "../../../utils/common"
    import { translateText } from "../../../utils/language"
    import { waitForPopupData } from "../../../utils/popup"
    import { send } from "../../../utils/request"
    import Icon from "../../helpers/Icon.svelte"
    import { clone, keysToID, sortByName, sortObject } from "../../helpers/array"
    import { addOutput, checkFFmpeg, enableStageOutput, refreshOut } from "../../helpers/output"
    import Tabs from "../../input/Tabs.svelte"
    import HiddenInput from "../../inputs/HiddenInput.svelte"

    // prevent "resetting" rename if output changed while renaming
    $: updatedOutputs = $outputs
    let currentOutputs = clone($outputs)
    $: {
        let newOutputs = clone(updatedOutputs)
        Object.values(newOutputs).map((a) => {
            delete a.out
            return a
        })
        let currOutputs = clone(currentOutputs)
        Object.values(currOutputs).map((a) => {
            delete a.out
            return a
        })

        if (JSON.stringify(newOutputs) !== JSON.stringify(currOutputs)) {
            currentOutputs = clone(updatedOutputs)
        }
    }

    ///

    let outputsList: Output[] = []
    $: outputsList = sortObject(sortByName(keysToID(currentOutputs)), "stageOutput")

    $: if (outputsList.length && (!$currentOutputSettings || !currentOutputs[$currentOutputSettings])) currentOutputSettings.set(outputsList.find((a) => a.enabled)?.id || outputsList[0].id || "")

    let currentOutput: Output | null = null
    $: if ($currentOutputSettings) currentOutput = { id: $currentOutputSettings, ...currentOutputs[$currentOutputSettings] }

    function updateOutput(key: string, value: any, outputId = currentOutput?.id || "") {
        if (!outputId || !$outputs[outputId]) return

        if (key === "style") setTimeout(refreshOut)

        outputs.update((a: any) => {
            const out = a[outputId]

            // Update value
            if (key.includes(".")) {
                const [p1, p2] = key.split(".")
                out[p1][p2] = value
                if (p2 === "lines" && !Number(value)) delete out[p1][p2]
            } else {
                out[key] = value
            }

            if (key === "enabled" && value) {
                send(OUTPUT, ["CREATE"], { ...out, id: outputId })
                // checkWindowCapture()
                AudioAnalyser.recorderActivate()
            }

            const captureTypeKeys = ["blackmagic", "ndi", "webrtc", "rtmp"]
            const ipcKeys = ["alwaysOnTop", "transparent", "invisible"]
            if (out.enabled && (captureTypeKeys.includes(key) || ipcKeys.includes(key))) {
                if (value && captureTypeKeys.includes(key)) newToast("toast.output_capture_enabled")
                send(OUTPUT, ["SET_VALUE"], { id: outputId, key, value: key === "blackmagic" ? out : value })
            }

            return a
        })
    }

    // CREATE

    $: if ($activeTriggerFunction === "create_output") createOutput()
    async function createOutput(e?: ClickEvent) {
        const skipPopup = e?.detail.ctrl
        const stageLayouts = keysToID($stageShows)

        // input type (normal/stage)
        const type = stageLayouts.length && !skipPopup ? await waitForPopupData("choose_output_input") : "normal"
        if (!type) return

        // data (style/layout)
        let styleId = ""
        let stageId = ""
        if (type === "stage") {
            const sorted = sortByName(stageLayouts)
            const firstId = sorted[0]?.id || ""
            stageId = stageLayouts.length > 1 ? (await waitForPopupData("select_stage_layout")) || firstId : firstId
        } else if (Object.keys($styles).length && !skipPopup) {
            popupData.set({ outputId: currentOutput?.id, skip: true })
            styleId = await waitForPopupData("select_style")
        }

        // output type (local/network)
        let setup = { localType: "window", networkType: "" }
        if (!skipPopup) setup = (await waitForPopupData("choose_output_type")) || setup
        const { localType, networkType } = setup

        // FFmpeg check for RTMP
        if (networkType === "rtmp" && !(await checkFFmpeg())) return

        // create
        let outputId = ""
        if (type === "stage") {
            toggleOutputEnabled.set(true) // disable preview output transitions (to prevent visual svelte bug)
            outputId = enableStageOutput({ stageOutput: stageId, name: $stageShows[stageId]?.name || "" })
        } else {
            let name = ""
            if (networkType && !localType) {
                if (networkType === "ndi") name = "NDI"
                else if (networkType === "webrtc") name = "WebRTC"
                else if (networkType === "rtmp") name = "RTMP"
            }

            outputId = addOutput(false, styleId, false, name)
        }

        // apply settings
        if (!skipPopup) {
            if (localType !== "window") {
                updateOutput("invisible", true, outputId)
                if (!localType && networkType === "ndi") updateOutput("transparent", true, outputId)
            }

            if (localType === "blackmagic") updateOutput("blackmagic", true, outputId)
            if (networkType === "ndi") updateOutput("ndi", true, outputId)
            else if (networkType === "webrtc") updateOutput("webrtc", true, outputId)
            else if (networkType === "rtmp") updateOutput("rtmp", true, outputId)

            updateOutput("enabled", true, outputId)

            if (networkType) createOutputAudioChannel(outputId)
        }
    }

    let edit: any
</script>

<Tabs id="output" tabs={outputsList} value={$currentOutputSettings || ""} newLabel="settings.new_output" class="context #output_screen" on:open={(e) => currentOutputSettings.set(e.detail)} on:create={createOutput} let:tab>
    {#if tab.stageOutput}<Icon id="stage" right title={translateText("menu.stage")} />{/if}
    {#if tab.enabled !== false}<Icon id="check" size={0.7} white right />{/if}
    <HiddenInput value={tab.name} id={"output_" + tab.id} on:edit={(e) => updateOutput("name", e.detail.value, tab.id)} bind:edit />

    <div class="right-icons">
        {#if !tab.invisible}<Icon id="hdmi" size={0.6} white title={translateText("settings.window")} />{/if}
        {#if tab.blackmagic}<Icon id="blackmagic" size={0.6} white title="Blackmagic Design" />{/if}
        {#if tab.ndi}<Icon id="ndi" size={0.6} white title="NDI" />{/if}
        {#if tab.webrtc}<Icon id="broadcast" size={0.6} white title="WebRTC" />{/if}
        {#if tab.rtmp}<Icon id="broadcast" size={0.6} white title="RTMP" />{/if}
    </div>

    {#if tab.color}
        <div class="color" style="--color: {tab.color};"></div>
    {/if}
</Tabs>

<style>
    .right-icons {
        display: flex;
        gap: 2px;
        margin-left: auto;
        padding-left: 8px;
        opacity: 0.7;
    }
</style>
