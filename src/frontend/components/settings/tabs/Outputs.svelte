<script lang="ts">
    import { onDestroy } from "svelte"
    import { uid } from "uid"
    import { BLACKMAGIC, NDI, OUTPUT } from "../../../../types/Channels"
    import { Option } from "../../../../types/Main"
    import type { Output } from "../../../../types/Output"
    import { AudioAnalyser } from "../../../audio/audioAnalyser"
    import { activePopup, currentOutputSettings, dictionary, ndiData, os, outputDisplay, outputs, stageShows, styles, toggleOutputEnabled } from "../../../stores"
    import { newToast } from "../../../utils/common"
    import { waitForPopupData } from "../../../utils/popup"
    import { destroy, receive, send } from "../../../utils/request"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { keysToID, sortByName, sortObject } from "../../helpers/array"
    import { addOutput, enableStageOutput, getActiveOutputs, keyOutput } from "../../helpers/output"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import HiddenInput from "../../inputs/HiddenInput.svelte"
    import SelectElem from "../../system/SelectElem.svelte"

    let outputsList: Output[] = []
    $: outputsList = sortObject(sortByName(keysToID($outputs).filter((a) => !a.isKeyOutput)), "stageOutput")

    $: if (outputsList.length && (!$currentOutputSettings || !$outputs[$currentOutputSettings])) currentOutputSettings.set(outputsList.find((a) => a.enabled)?.id || outputsList[0].id || "")

    let currentOutput: any = {}
    $: if ($currentOutputSettings) currentOutput = { id: $currentOutputSettings, ...$outputs[$currentOutputSettings] }

    $: if (currentOutput.blackmagic) send(BLACKMAGIC, ["GET_DEVICES"])

    const autoRevert: string[] = ["kioskMode"] // changing these settings could break some things in some cases
    const revertTime: number = 5 // seconds
    let reverted: string[] = []

    function updateOutput(key: string, value: any, outputId: string = "") {
        if (!outputId) outputId = currentOutput.id

        // auto revert special values
        if (autoRevert.includes(key) && value && !reverted.includes(key)) {
            newToast($dictionary.toast?.reverting_setting?.replace("{}", revertTime.toString()) || "")
            reverted.push(key)
            setTimeout(() => {
                updateOutput(key, false, outputId)
                newToast("$toast.reverted")
            }, revertTime * 1000)
        }

        if (key === "ndi") {
            if (value) newToast("$toast.output_capture_enabled")
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

                // update key output style
                if (["style", "enabled", "alwaysOnTop", "kioskMode"].includes(key) && a[outputId].keyOutput) {
                    a[a[outputId].keyOutput][key] = value
                }
            }

            if (key === "ndi") {
                if (value) {
                    delete a[outputId].keyOutput
                } else {
                    ndiData.update((a) => {
                        delete a[outputId]
                        return a
                    })

                    // delete a[outputId].ndiData
                    if (!a[outputId].blackmagic) {
                        if (delete a[outputId].ndiData?.audio) delete a[outputId].ndiData.audio
                        delete a[outputId].transparent
                        delete a[outputId].invisible
                    }
                }
            }

            if (key === "blackmagic") {
                if (value) {
                    delete a[outputId].keyOutput
                } else {
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

                // update key output
                if (a[outputId].keyOutput) {
                    send(OUTPUT, ["SET_VALUE"], { id: a[outputId].keyOutput, key, value })
                }
            }

            return a
        })
    }

    const isChecked = (e: any) => e.target.checked

    // styles
    $: stylesList = getList($styles)
    function getList(styles) {
        let sortedList = sortByName(keysToID(styles))
        return [{ id: null, name: "—" }, ...sortedList]
    }

    let stageLayouts = sortByName(keysToID($stageShows)).map((a) => ({ ...a, name: a.name || $dictionary.main?.unnamed || "" }))

    // ndi
    function updateNdiData(e: any, key: string) {
        let id = currentOutput.id
        if (!id) return

        let newData = $outputs[id]?.ndiData
        if (!newData) newData = {}

        let value = e?.detail?.id ?? e
        newData[key] = value

        updateOutput("ndiData", newData)

        send(NDI, ["NDI_DATA"], { id, ...newData })

        if (key === "audio") {
            if (value) AudioAnalyser.recorderActivate()
            else AudioAnalyser.recorderDeactivate()
        }
    }

    const framerates = [
        { id: 10, name: "10 fps" },
        { id: 12, name: "12 fps" },
        { id: 24, name: "24 fps" },
        { id: 25, name: "25 fps" },
        { id: 30, name: "30 fps" },
        { id: 48, name: "48 fps" },
        { id: 50, name: "50 fps" },
        { id: 60, name: "60 fps" },
    ]

    // blackmagic
    let blackmagicDevices: Option[] = []
    function updateBlackmagicData(e: any, key: string) {
        let id = currentOutput.id
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
                let device = blackmagicDevices.find((a) => a.id === currentOutput.blackmagicData?.deviceId)
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
                    send(OUTPUT, ["SET_VALUE"], { id: currentOutput.id, key: "blackmagic", value: currentOutput })
                })
            } else if (key === "pixelFormat") {
                setTimeout(() => {
                    send(OUTPUT, ["SET_VALUE"], { id: currentOutput.id, key: "blackmagic", value: currentOutput })
                })
            }
        })
    }

    let edit: any

    $: activeOutputs = Object.values($outputs).filter((a) => !a.stageOutput && a.enabled && a.active === true)

    const ndiNotSupported = false // $os.platform === "linux" && $os.arch !== "x64" && $os.arch !== "ia32"

    // RECEIVE BLACKMAGIC DEVICES

    let listenerId = uid()
    onDestroy(() => destroy(BLACKMAGIC, listenerId))
    const receiveBMD = {
        GET_DEVICES: (data) => {
            blackmagicDevices = JSON.parse(data).map((a) => ({ id: a.deviceHandle, name: a.displayName || a.modelName, data: { displayModes: a.inputDisplayModes } }))
            if (blackmagicDevices.length && !currentOutput.blackmagicData?.deviceId) updateBlackmagicData(blackmagicDevices[0].id, "deviceId")
        },
    }
    receive(BLACKMAGIC, receiveBMD, listenerId)

    // CREATE

    async function createOutput() {
        let stageLayouts = keysToID($stageShows)
        let type = stageLayouts.length ? await waitForPopupData("choose_output") : "normal"

        if (type === "stage") {
            // get first stage layout
            let stageOutput = sortByName(stageLayouts)[0] || {}

            toggleOutputEnabled.set(true) // disable preview output transitions (to prevent visual svelte bug)
            setTimeout(() => {
                let id = enableStageOutput({ stageOutput: stageOutput?.id || "", name: stageOutput?.name || "" })
                currentOutputSettings.set(id)
            }, 100)
        } else if (type === "normal") {
            addOutput()
        }
    }
</script>

<div class="info">
    <p><T id="settings.outputs_hint" /></p>
    <!-- <p><T id="settings.hide_output_hint" /></p> -->
    <!-- <p><T id="settings.show_output_hint" /></p> -->
    <!-- {#if $os.platform === "darwin"}<p><T id="settings.hide_menubar_hint" /></p>{/if} -->
</div>

<!-- main -->

{#if outputsList.filter((a) => !a.stageOutput).length > 1 || !currentOutput.enabled || currentOutput.stageOutput}
    <CombinedInput>
        <p><T id="settings.enabled" /></p>
        <div class="alignRight">
            <Checkbox
                checked={currentOutput.enabled}
                disabled={!currentOutput.stageOutput && currentOutput.enabled && activeOutputs.length < 2}
                on:change={(e) => {
                    toggleOutputEnabled.set(true) // disable preview output transitions (to prevent visual svelte bug)
                    setTimeout(() => {
                        updateOutput("enabled", isChecked(e))
                        if ($outputDisplay) {
                            let enabled = getActiveOutputs($outputs, false)
                            Object.entries($outputs).forEach(([id, output]) => {
                                send(OUTPUT, ["DISPLAY"], { enabled: enabled.includes(id), output: { id, ...output }, one: true })
                            })
                        }
                    }, 100)
                }}
            />
        </div>
    </CombinedInput>
{/if}

<!-- WIP probably not needed! -->
{#if currentOutput.keyOutput}
    <CombinedInput>
        <p><T id="settings.enable_key_output" /></p>
        <div class="alignRight">
            <Checkbox
                checked={!!currentOutput.keyOutput}
                disabled={currentOutput.ndi || currentOutput.blackmagic}
                on:change={(e) => {
                    let outputId = isChecked(e) ? "key_" + uid(5) : currentOutput.keyOutput
                    let keyValue = isChecked(e) ? outputId : null
                    updateOutput("keyOutput", keyValue)
                    keyOutput(outputId, !isChecked(e))
                }}
            />
        </div>
    </CombinedInput>
{/if}

{#if currentOutput.stageOutput}
    <CombinedInput>
        <p><T id="stage.stage_layout" /></p>
        <Dropdown options={stageLayouts} value={stageLayouts.find((a) => a.id === currentOutput.stageOutput)?.name || "—"} on:click={(e) => (e.detail?.id ? updateOutput("stageOutput", e.detail.id) : "")} />
    </CombinedInput>
{:else}
    <CombinedInput>
        <p><T id="settings.active_style" /></p>
        <Dropdown options={stylesList} value={$styles[currentOutput.style]?.name || "—"} on:click={(e) => updateOutput("style", e.detail.id)} />
    </CombinedInput>
{/if}

<!-- WIP toggle fullscreen (Mac) ?? Only working one time for some reason -->
<!-- WIP toggle visibleOnAllWorkspaces (Mac) -->

<!-- window -->
<h3><T id="settings.window" /></h3>
<!-- <div style="justify-content: center;flex-direction: column;font-style: italic;opacity: 0.8;min-height: initial;">
  <p><T id="settings.move_output_hint" /></p>
</div> -->
<CombinedInput>
    <p><T id="settings.output_screen" /></p>
    <Button disabled={currentOutput.invisible} on:click={() => activePopup.set("choose_screen")}>
        <Icon id={currentOutput.boundsLocked ? "locked" : "screen"} style="margin-left: 0.5em;" right />
        <p>
            <T id="popup.choose_screen" />
            {#if currentOutput.bounds?.width}
                <span style="display: flex;align-items: center;padding: 0 8px;opacity: 0.5;font-size: 0.9em;">({currentOutput.bounds.width}x{currentOutput.bounds.height})</span>
            {/if}
        </p>
    </Button>
    <!-- centered? -->
    <!-- <Button disabled={currentOutput.invisible} on:click={() => activePopup.set("choose_screen")} center>
        <div style="display: flex;align-items: center;padding: 0;">
            <Icon id="screen" right />
            <p style="padding: 0;"><T id="popup.choose_screen" /></p>
        </div>
    </Button> -->
</CombinedInput>
<!-- <CombinedInput>
    <p><T id="settings.position" /></p>
    <Button on:click={() => activePopup.set("change_output_values")}>
        <Icon id="window" right />
        <p><T id="popup.change_output_values" /></p>
    </Button>
</CombinedInput> -->

<CombinedInput>
    <p><T id="settings.always_on_top" /></p>
    <div class="alignRight">
        <Checkbox disabled={currentOutput.invisible} checked={currentOutput.alwaysOnTop !== false} on:change={(e) => updateOutput("alwaysOnTop", isChecked(e))} />
    </div>
</CombinedInput>

<!-- disable on windows -->
{#if $os.platform !== "win32"}
    <CombinedInput>
        <p><T id="settings.kiosk_mode" /></p>
        <div class="alignRight">
            <Checkbox checked={currentOutput.kioskMode === true} on:change={(e) => updateOutput("kioskMode", isChecked(e))} />
        </div>
    </CombinedInput>
{/if}

<!-- NDI -->
<h3>NDI®</h3>

<CombinedInput>
    <p>
        <T id="actions.enable" /> NDI®
        {#if ndiNotSupported}(Device architecture not supported){/if}
        <span class="connections">{$ndiData[currentOutput.id || ""]?.connections || ""}</span>
    </p>
    <div class="alignRight">
        <Checkbox disabled={ndiNotSupported} checked={currentOutput.ndi} on:change={(e) => updateOutput("ndi", isChecked(e))} />
    </div>
</CombinedInput>

{#if currentOutput.ndi}
    <CombinedInput>
        <p><T id="preview.audio" /></p>
        <div class="alignRight">
            <Checkbox checked={currentOutput.ndiData?.audio} on:change={(e) => updateNdiData(isChecked(e), "audio")} />
        </div>
    </CombinedInput>

    <CombinedInput>
        <p><T id="settings.frame_rate" /></p>
        <Dropdown value={framerates.find((a) => a.id === currentOutput.ndiData?.framerate)?.name || "30 fps"} options={framerates.map((a) => ({ ...a, id: a.id.toString() }))} on:click={(e) => updateNdiData(e, "framerate")} />
    </CombinedInput>
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

{#if currentOutput.blackmagic}
    <CombinedInput>
        <p><T id="settings.device" /></p>
        <Dropdown value={blackmagicDevices.find((a) => a.id === currentOutput.blackmagicData?.deviceId)?.name || "—"} options={blackmagicDevices} on:click={(e) => updateBlackmagicData(e, "deviceId")} />
    </CombinedInput>

    {#if currentOutput.blackmagicData?.deviceId}
        <CombinedInput>
            <p><T id="settings.display_mode" /></p>
            <Dropdown
                value={currentOutput.blackmagicData?.displayModes?.find((a) => a.name === currentOutput.blackmagicData?.displayMode)?.name || "—"}
                options={currentOutput.blackmagicData?.displayModes || []}
                on:click={(e) => updateBlackmagicData(e, "displayMode")}
            />
        </CombinedInput>

        <CombinedInput>
            <p><T id="settings.pixel_format" /></p>
            <Dropdown
                value={currentOutput.blackmagicData?.pixelFormats?.find((a) => a.name === currentOutput.blackmagicData?.pixelFormat)?.name || "—"}
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

<br />

{#if currentOutput.ndi || currentOutput.blackmagic}
    <CombinedInput>
        <p><T id="settings.transparent" /></p>
        <div class="alignRight">
            <Checkbox checked={currentOutput.transparent} on:change={(e) => updateOutput("transparent", isChecked(e))} />
        </div>
    </CombinedInput>

    <CombinedInput>
        <p><T id="settings.invisible_window" /></p>
        <div class="alignRight">
            <Checkbox checked={currentOutput.invisible} on:change={(e) => updateOutput("invisible", isChecked(e))} />
        </div>
    </CombinedInput>
{/if}

<!-- OUTPUT SELECTOR -->

<div class="filler" style={outputsList.length > 1 ? "height: 76px;" : ""} />
<div class="bottom">
    {#if outputsList.length > 1}
        <div style="display: flex;overflow-x: auto;">
            {#each outputsList as output}
                {@const active = $currentOutputSettings === output.id}

                <SelectElem id="output" data={{ id: output.id }} fill>
                    <Button
                        border={active}
                        class="context #output_screen{output.stageOutput ? '_stage' : ''}"
                        {active}
                        style="width: 100%;outline-offset: -4px;border-bottom: 2px solid {output.color};"
                        on:click={() => currentOutputSettings.set(output.id || "")}
                        bold={false}
                        center
                    >
                        {#if output.stageOutput}<Icon id="stage" right />{/if}
                        {#if output.enabled !== false}<Icon id="check" size={0.7} white right />{/if}
                        <HiddenInput value={output.name} id={"output_" + output.id} on:edit={(e) => updateOutput("name", e.detail.value, output.id)} bind:edit />
                    </Button>
                </SelectElem>
            {/each}
        </div>
    {/if}

    <div style="display: flex;">
        <Button style="width: 100%;" on:click={createOutput} center>
            <Icon id="add" right />
            <T id="settings.add" />
        </Button>
    </div>
</div>

<style>
    .info {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;

        min-height: 38px;
        margin: 5px 0;
        margin-bottom: 15px;
        font-style: italic;
        opacity: 0.8;
    }

    .info p {
        white-space: initial;
    }

    .connections {
        display: flex;
        align-items: center;
        padding-left: 10px;
        opacity: 0.5;
        font-weight: normal;
    }

    h3 {
        color: var(--text);
        text-transform: uppercase;
        text-align: center;
        font-size: 0.9em;
        margin: 20px 0;
    }

    .filler {
        height: 48px;
    }
    .bottom {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        background-color: var(--primary-darkest);

        display: flex;
        flex-direction: column;
    }
</style>
