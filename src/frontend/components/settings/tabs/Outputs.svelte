<script lang="ts">
    import { onDestroy } from "svelte"
    import { uid } from "uid"
    import { BLACKMAGIC, NDI, OUTPUT } from "../../../../types/Channels"
    import { Option } from "../../../../types/Main"
    import type { Output } from "../../../../types/Output"
    import { AudioAnalyser } from "../../../audio/audioAnalyser"
    import { activePage, activeStage, activeStyle, currentOutputSettings, dictionary, ndiData, os, outputDisplay, outputs, settingsTab, stageShows, styles, toggleOutputEnabled } from "../../../stores"
    import { newToast } from "../../../utils/common"
    import { destroy, receive, send } from "../../../utils/request"
    import T from "../../helpers/T.svelte"
    import { keysToID, sortByName, sortObject } from "../../helpers/array"
    import { getActiveOutputs, refreshOut } from "../../helpers/output"
    import InputRow from "../../input/InputRow.svelte"
    import Title from "../../input/Title.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialPopupButton from "../../inputs/MaterialPopupButton.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"

    let outputsList: Output[] = []
    $: outputsList = sortObject(sortByName(keysToID($outputs).filter((a) => !a.isKeyOutput)), "stageOutput")

    $: if (outputsList.length && (!$currentOutputSettings || !$outputs[$currentOutputSettings])) currentOutputSettings.set(outputsList.find((a) => a.enabled)?.id || outputsList[0].id || "")

    let currentOutput: Output | null = null
    $: if ($currentOutputSettings) currentOutput = { id: $currentOutputSettings, ...$outputs[$currentOutputSettings] }

    $: if (currentOutput?.blackmagic) send(BLACKMAGIC, ["GET_DEVICES"])

    const autoRevert: string[] = ["kioskMode"] // changing these settings could break some things in some cases
    const revertTime = 5 // seconds
    let reverted: string[] = []

    function updateOutput(key: string, value: any, outputId = "") {
        if (!outputId) outputId = currentOutput?.id || ""
        if (!outputId || !$outputs[outputId]) return

        // auto revert special values
        if (autoRevert.includes(key) && value && !reverted.includes(key)) {
            newToast($dictionary.toast?.reverting_setting?.replace("{}", revertTime.toString()) || "")
            reverted.push(key)
            setTimeout(() => {
                updateOutput(key, false, outputId)
                newToast("$toast.reverted")
            }, revertTime * 1000)
        }

        // properly update output content
        if (key === "style") {
            // wait to update output, so slide is refreshed after style is changed in output window
            setTimeout(refreshOut)
        }

        if (key === "ndi") {
            if (value) {
                newToast("$toast.output_capture_enabled")

                const enabledOutputs = Object.values($outputs).filter((a) => a.enabled && !a.stageOutput)
                if (enabledOutputs.length > 1) {
                    updateOutput("transparent", true)
                    updateOutput("invisible", true)
                }
            }
        } else if (key === "blackmagic") {
            if (value === true) {
                // send(BLACKMAGIC, ["GET_DEVICES"])
                updateOutput("transparent", true)
                updateOutput("invisible", true)
            } else {
                send(BLACKMAGIC, ["STOP_SENDER"], { id: outputId })
            }
        }

        // TODO: history
        outputs.update((a: any) => {
            if (key.includes(".")) {
                let split = key.split(".")
                a[outputId][split[0]][split[1]] = value
                if (split[1] === "lines" && !Number(value)) delete a[outputId][split[0]][split[1]]
            } else {
                a[outputId][key] = value
            }

            if (key === "ndi") {
                if (!value) {
                    ndiData.update((a) => {
                        delete a[outputId]
                        return a
                    })

                    // delete a[outputId].ndiData
                    if (!a[outputId].blackmagic) {
                        if (a[outputId].ndiData?.audio) delete a[outputId].ndiData.audio
                        delete a[outputId].transparent
                        delete a[outputId].invisible
                    }
                }
            }

            if (key === "blackmagic") {
                if (!value) {
                    // ndiData.update((a) => {
                    //     delete a[outputId]
                    //     return a
                    // })

                    // delete a[outputId].blackmagicData
                    if (!a[outputId].ndi) {
                        delete a[outputId].transparent
                        delete a[outputId].invisible
                    }
                }
            }

            if (key === "enabled") {
                // , rate: $special.previewRate || "auto"
                if (value) send(OUTPUT, ["CREATE"], currentOutput)
                else {
                    send(OUTPUT, ["REMOVE"], { id: outputId })
                    updateOutput("hideFromPreview", false, outputId)
                }

                // WIP if only one left, all outputs should be "active"
            }

            if (!a[outputId].enabled) return a

            // UPDATE OUTPUT WINDOW

            if (["alwaysOnTop", "kioskMode", "transparent", "invisible", "ndi"].includes(key)) {
                send(OUTPUT, ["SET_VALUE"], { id: outputId, key, value })
            }

            return a
        })
    }

    const isChecked = (e: any) => e.target.checked

    function toggleOutput(state: boolean) {
        toggleOutputEnabled.set(true) // disable preview output transitions (to prevent visual svelte bug)
        setTimeout(() => {
            updateOutput("enabled", state)
            if ($outputDisplay) {
                let enabled = getActiveOutputs($outputs, false)
                Object.entries($outputs).forEach(([id, output]) => {
                    send(OUTPUT, ["DISPLAY"], { enabled: enabled.includes(id), output: { id, ...output }, one: true })
                })
            }
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
        console.log(key, value)

        newData[key] = value

        updateOutput("ndiData", newData)

        send(NDI, ["NDI_DATA"], { id, ...newData })

        if (key === "audio") {
            if (value) AudioAnalyser.recorderActivate()
            else AudioAnalyser.recorderDeactivate()
        }
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
    function updateBlackmagicData(e: any, key: string) {
        let id = currentOutput?.id
        if (!id) return

        let newData = $outputs[id]?.blackmagicData
        if (!newData) newData = {}
        let value = e?.detail?.id || e?.detail?.name || e
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
                    send(OUTPUT, ["SET_VALUE"], { id: currentOutput?.id, key: "blackmagic", value: currentOutput })
                })
            } else if (key === "pixelFormat") {
                setTimeout(() => {
                    send(OUTPUT, ["SET_VALUE"], { id: currentOutput?.id, key: "blackmagic", value: currentOutput })
                })
            }
        })
    }

    $: activeOutputs = Object.values($outputs).filter((a) => !a.stageOutput && a.enabled && a.active === true)

    // RECEIVE BLACKMAGIC DEVICES

    let listenerId = uid()
    onDestroy(() => destroy(BLACKMAGIC, listenerId))
    const receiveBMD = {
        GET_DEVICES: (data) => {
            blackmagicDevices = JSON.parse(data).map((a) => ({ id: a.deviceHandle, name: a.displayName || a.modelName, data: { displayModes: a.inputDisplayModes } }))
            if (blackmagicDevices.length && !currentOutput?.blackmagicData?.deviceId) updateBlackmagicData(blackmagicDevices[0].id, "deviceId")
        }
    }
    receive(BLACKMAGIC, receiveBMD, listenerId)

    $: outputLabel = `${currentOutput?.bounds.width || 1920}x${currentOutput?.bounds.height || 1080}`
</script>

{#if outputsList.filter((a) => !a.stageOutput).length > 1 || !currentOutput?.enabled || currentOutput?.stageOutput}
    <MaterialToggleSwitch label="settings.enabled" checked={currentOutput?.enabled} defaultValue={true} disabled={!currentOutput?.stageOutput && currentOutput?.enabled && activeOutputs.length < 2} on:change={(e) => toggleOutput(e.detail)} />
{/if}

{#if stageId}
    <InputRow>
        <MaterialPopupButton label="stage.stage_layout" value={stageId} nameObject={$stageShows} icon="stage" popupId="select_stage_layout" on:change={(e) => updateOutput("stageOutput", e.detail)} />
        {#if $stageShows[stageId]}
            <MaterialButton title="titlebar.edit" icon="edit" on:click={editStage} />
        {/if}
    </InputRow>
{:else}
    <InputRow>
        <MaterialPopupButton label="settings.active_style" value={styleId} nameObject={$styles} icon="styles" popupId="select_style" on:change={(e) => updateOutput("style", e.detail)} allowEmpty />
        {#if $styles[styleId]}
            <MaterialButton title="titlebar.edit" icon="edit" on:click={editStyle} />
        {/if}
    </InputRow>
{/if}

<!-- WIP toggle fullscreen (Mac) ?? Only working one time for some reason -->
<!-- WIP toggle visibleOnAllWorkspaces (Mac) -->

<!-- window -->
<Title label="settings.window" icon="window" />

<MaterialPopupButton label="settings.output_screen" value={outputLabel} icon={currentOutput?.invisible ? "stage" : currentOutput?.boundsLocked ? "locked" : "screen"} popupId={currentOutput?.invisible ? "change_output_values" : "choose_screen"} />
<MaterialToggleSwitch label="settings.always_on_top" checked={currentOutput?.alwaysOnTop !== false} defaultValue={true} disabled={currentOutput?.invisible} on:change={(e) => updateOutput("alwaysOnTop", e.detail)} />

<!-- this will make the whole application "locked" so no other apps can be accessed, might increase performance, but generally not recommend -->
<!-- disable on windows -->
<!-- only <= 1.4.5 -->
{#if $os.platform !== "win32" && currentOutput?.kioskMode === true}
    <MaterialToggleSwitch label="settings.kiosk_mode" checked={currentOutput?.kioskMode === true} defaultValue={false} on:change={(e) => updateOutput("kioskMode", e.detail)} />
{/if}

<!-- NDI -->
<Title label="NDI®" icon="companion" />

<MaterialToggleSwitch label="actions.enable NDI®" checked={currentOutput?.ndi} defaultValue={false} data={$ndiData[currentOutput?.id || ""]?.connections || null} on:change={(e) => updateOutput("ndi", e.detail)} />

{#if currentOutput?.ndi}
    <MaterialToggleSwitch label="preview.audio" checked={currentOutput.ndiData?.audio} defaultValue={false} on:change={(e) => updateNdiData(e.detail, "audio")} />
    <MaterialDropdown label="settings.frame_rate" value={currentOutput?.ndiData?.framerate || "30"} defaultValue="30" options={framerates} on:change={(e) => updateNdiData(e.detail, "framerate")} />
{/if}

<!-- Blackmagic -->
<!-- BLACKMAGIC CURRENTLY NOT WORKING -->
<!-- <h3>Blackmagic Design</h3>

<CombinedInput>
    <p><T id="actions.enable" /> Blackmagic</p>
    <div class="alignRight">
        <Checkbox checked={currentOutput.blackmagic} on:change={(e) => updateOutput("blackmagic", isChecked(e))} />
    </div>
</CombinedInput> -->

{#if currentOutput?.blackmagic}
    <CombinedInput>
        <p><T id="settings.device" /></p>
        <Dropdown value={blackmagicDevices.find((a) => a.id === currentOutput?.blackmagicData?.deviceId)?.name || "—"} options={blackmagicDevices} on:click={(e) => updateBlackmagicData(e, "deviceId")} />
    </CombinedInput>

    {#if currentOutput.blackmagicData?.deviceId}
        <CombinedInput>
            <p><T id="settings.display_mode" /></p>
            <Dropdown
                value={currentOutput.blackmagicData?.displayModes?.find((a) => a.name === currentOutput?.blackmagicData?.displayMode)?.name || "—"}
                options={currentOutput.blackmagicData?.displayModes || []}
                on:click={(e) => updateBlackmagicData(e, "displayMode")}
            />
        </CombinedInput>

        <CombinedInput>
            <p><T id="settings.pixel_format" /></p>
            <Dropdown
                value={currentOutput.blackmagicData?.pixelFormats?.find((a) => a.name === currentOutput?.blackmagicData?.pixelFormat)?.name || "—"}
                options={currentOutput.blackmagicData?.pixelFormats || []}
                on:click={(e) => updateBlackmagicData(e, "pixelFormat")}
            />
        </CombinedInput>

        <CombinedInput>
            <p><T id="settings.alpha_key" /></p>
            <div class="alignRight">
                <Checkbox checked={currentOutput.blackmagicData?.alphaKey} on:change={(e) => updateBlackmagicData(isChecked(e), "alphaKey")} />
            </div>
        </CombinedInput>
    {/if}
{/if}

{#if currentOutput?.ndi || currentOutput?.blackmagic}
    <br />

    <MaterialToggleSwitch label="settings.transparent" checked={currentOutput.transparent} defaultValue={true} on:change={(e) => updateOutput("transparent", e.detail)} />
    <MaterialToggleSwitch label="settings.invisible_window" checked={currentOutput.invisible} defaultValue={true} on:change={(e) => updateOutput("invisible", e.detail)} />
{/if}
