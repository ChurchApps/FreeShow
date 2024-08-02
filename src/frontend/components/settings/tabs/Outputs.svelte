<script lang="ts">
    import { uid } from "uid"
    import { NDI, OUTPUT } from "../../../../types/Channels"
    import { activePopup, currentOutputSettings, ndiData, os, outputDisplay, outputs, styles, toggleOutputEnabled } from "../../../stores"
    import { send } from "../../../utils/request"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { addOutput, getActiveOutputs, keyOutput } from "../../helpers/output"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import HiddenInput from "../../inputs/HiddenInput.svelte"
    import SelectElem from "../../system/SelectElem.svelte"

    let outputsList: any[] = []
    $: outputsList = Object.entries($outputs)
        .map(([id, a]) => ({ id, ...a }))
        .filter((a) => !a.isKeyOutput)
        .sort((a, b) => a.name.localeCompare(b.name))

    $: if (outputsList.length && (!$currentOutputSettings || !$outputs[$currentOutputSettings])) currentOutputSettings.set(outputsList[0].id)

    let currentOutput: any = {}
    $: if ($currentOutputSettings) currentOutput = { id: $currentOutputSettings, ...$outputs[$currentOutputSettings] }

    $: console.log($currentOutputSettings, currentOutput)

    function updateOutput(key: string, value: any, outputId: string = "") {
        if (!outputId) outputId = currentOutput.id

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

                    delete a[outputId].ndiData
                    delete a[outputId].transparent
                }
            }

            if (key === "enabled") {
                // , rate: $special.previewRate || "auto"
                if (value) send(OUTPUT, ["CREATE"], currentOutput)
                else send(OUTPUT, ["REMOVE"], { id: outputId })

                // WIP if only one left, all outputs should be "active"
            }

            if (!a[outputId].enabled) return a

            // UPDATE OUTPUT WINDOW

            if (["alwaysOnTop", "kioskMode", "transparent", "ndi"].includes(key)) {
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
        let list = Object.entries(styles).map(([id, obj]: any) => {
            return { ...obj, id }
        })

        let sortedList = list.sort((a, b) => a.name.localeCompare(b.name))

        return [{ id: null, name: "—" }, ...sortedList]
    }

    // ndi
    function updateNdiData(e: any, key: string) {
        let id = currentOutput.id
        if (!id) return

        let newData = $outputs[id]?.ndiData
        if (!newData) newData = {}
        newData[key] = e.detail.id

        updateOutput("ndiData", newData)

        send(NDI, ["NDI_DATA"], { id, ...newData })
    }

    const framerates: any = [
        { id: 10, name: "10 fps" },
        { id: 12, name: "12 fps" },
        { id: 24, name: "24 fps" },
        { id: 25, name: "25 fps" },
        { id: 30, name: "30 fps" },
        { id: 48, name: "48 fps" },
        { id: 50, name: "50 fps" },
        { id: 60, name: "60 fps" },
    ]

    let edit: any

    $: activeOutputs = Object.values($outputs).filter((a) => !a.stageOutput && a.enabled && a.active === true)

    const ndiNotSupported = $os.platform === "linux" && $os.arch !== "x64" && $os.arch !== "ia32"
</script>

<div class="info">
    <p><T id="settings.hide_output_hint" /></p>
    <!-- <p><T id="settings.show_output_hint" /></p> -->
    {#if $os.platform === "darwin"}
        <p><T id="settings.hide_menubar_hint" /></p>
    {/if}
</div>

<!-- main -->

<br />

{#if (outputsList.length > 1 && !currentOutput.stageOutput) || !currentOutput.enabled}
    <CombinedInput>
        <p><T id="settings.enabled" /></p>
        <div class="alignRight">
            <Checkbox
                checked={currentOutput.enabled}
                disabled={currentOutput.enabled && activeOutputs.length < 2}
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

<CombinedInput>
    <p><T id="settings.enable_key_output" /></p>
    <div class="alignRight">
        <Checkbox
            checked={!!currentOutput.keyOutput}
            disabled={currentOutput.ndi}
            on:change={(e) => {
                let outputId = isChecked(e) ? "key_" + uid(5) : currentOutput.keyOutput
                let keyValue = isChecked(e) ? outputId : null
                updateOutput("keyOutput", keyValue)
                keyOutput(outputId, !isChecked(e))
            }}
        />
    </div>
</CombinedInput>

{#if !currentOutput.stageOutput}
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
    <Button on:click={() => activePopup.set("choose_screen")}>
        <Icon id="screen" right />
        <p><T id="popup.choose_screen" /></p>
    </Button>
    <!-- <Screens /> -->
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
        <p><T id="settings.transparent" /></p>
        <div class="alignRight">
            <Checkbox checked={currentOutput.transparent} on:change={(e) => updateOutput("transparent", isChecked(e))} />
        </div>
    </CombinedInput>

    <CombinedInput>
        <p><T id="preview.audio" /> (Not implemented yet)</p>
        <div class="alignRight">
            <Checkbox disabled checked={currentOutput.audio} on:change={(e) => updateOutput("audio", isChecked(e))} />
        </div>
    </CombinedInput>

    <CombinedInput>
        <p><T id="settings.frame_rate" /></p>
        <Dropdown value={framerates.find((a) => a.id === currentOutput.ndiData?.framerate)?.name || "30 fps"} options={framerates} on:click={(e) => updateNdiData(e, "framerate")} />
    </CombinedInput>
{/if}

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
                        on:click={() => currentOutputSettings.set(output.id)}
                        bold={false}
                        center
                    >
                        {#if output.stageOutput}<Icon id="stage" right />{/if}
                        <HiddenInput value={output.name} id={"output_" + output.id} on:edit={(e) => updateOutput("name", e.detail.value, output.id)} bind:edit />
                    </Button>
                </SelectElem>
            {/each}
        </div>
    {/if}

    <div style="display: flex;">
        <Button style="width: 100%;" on:click={() => addOutput()} center>
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
