<script lang="ts">
    import { uid } from "uid"
    import { OUTPUT } from "../../../../types/Channels"
    import { activePopup, currentOutputSettings, os, outputDisplay, outputs, styles } from "../../../stores"
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

    function updateOutput(key: string, value: any) {
        outputs.update((a: any) => {
            if (key.includes(".")) {
                let split = key.split(".")
                a[currentOutput.id][split[0]][split[1]] = value
                if (split[1] === "lines" && !Number(value)) delete a[currentOutput.id][split[0]][split[1]]
            } else {
                a[currentOutput.id][key] = value

                // update key output style
                if (["style", "enabled", "alwaysOnTop", "kioskMode"].includes(key) && a[currentOutput.id].keyOutput) {
                    a[a[currentOutput.id].keyOutput][key] = value
                }
            }

            if (["alwaysOnTop", "kioskMode"].includes(key)) {
                send(OUTPUT, ["SET_VALUE"], { id: $currentOutputSettings, key, value })

                // update key output
                if (a[currentOutput.id].keyOutput) {
                    send(OUTPUT, ["SET_VALUE"], { id: a[currentOutput.id].keyOutput, key, value })
                }
            }

            currentOutputSettings.set(currentOutput.id)
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

    let edit: any
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

{#if outputsList.length > 1}
    <CombinedInput>
        <p><T id="settings.enabled" /></p>
        <div class="alignRight">
            <Checkbox
                checked={currentOutput.enabled}
                on:change={(e) => {
                    updateOutput("enabled", isChecked(e))
                    if ($outputDisplay) {
                        let enabled = getActiveOutputs($outputs, false)
                        Object.entries($outputs).forEach(([id, output]) => {
                            send(OUTPUT, ["DISPLAY"], { enabled: enabled.includes(id), output: { id, ...output }, one: true })
                        })
                    }
                }}
            />
        </div>
    </CombinedInput>
{/if}

<CombinedInput>
    <p><T id="settings.active_style" /></p>
    <Dropdown options={stylesList} value={$styles[currentOutput.style]?.name || "—"} on:click={(e) => updateOutput("style", e.detail.id)} />
</CombinedInput>

<CombinedInput>
    <p><T id="settings.enable_key_output" /></p>
    <div class="alignRight">
        <Checkbox
            checked={!!currentOutput.keyOutput}
            on:change={(e) => {
                let outputId = isChecked(e) ? "key_" + uid(5) : currentOutput.keyOutput
                let keyValue = isChecked(e) ? outputId : null
                updateOutput("keyOutput", keyValue)
                keyOutput(outputId, !isChecked(e))
            }}
        />
    </div>
</CombinedInput>

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
<CombinedInput>
    <p><T id="settings.position" /></p>
    <Button on:click={() => activePopup.set("change_output_values")}>
        <Icon id="window" right />
        <p><T id="popup.change_output_values" /></p>
    </Button>
</CombinedInput>

<CombinedInput>
    <p><T id="settings.always_on_top" /></p>
    <div class="alignRight">
        <Checkbox checked={currentOutput.alwaysOnTop !== false} on:change={(e) => updateOutput("alwaysOnTop", isChecked(e))} />
    </div>
</CombinedInput>

<!-- disable on linux -->
<!-- {#if $os.platform !== "linux"}
    <CombinedInput>
        <p><T id="settings.show_in_taskbar" /></p>
        <div class="alignRight">
            <Checkbox checked={currentOutput.taskbar === true} on:change={(e) => updateOutput("taskbar", isChecked(e))} />
        </div>
    </CombinedInput>
{/if} -->

<!-- disable on windows -->
{#if $os.platform !== "win32"}
    <CombinedInput>
        <p><T id="settings.kiosk_mode" /></p>
        <div class="alignRight">
            <Checkbox checked={currentOutput.kioskMode === true} on:change={(e) => updateOutput("kioskMode", isChecked(e))} />
        </div>
    </CombinedInput>
{/if}

<div class="filler" style={outputsList.length > 1 ? "height: 76px;" : ""} />
<div class="bottom">
    {#if outputsList.length > 1}
        <div style="display: flex;overflow-x: auto;">
            {#each outputsList as currentOutput}
                {@const active = $currentOutputSettings === currentOutput.id}

                <SelectElem id="output" data={{ id: currentOutput.id }} fill>
                    <Button
                        border={active}
                        class="context #output_screen"
                        {active}
                        style="width: 100%;outline-offset: -4px;border-bottom: 2px solid {currentOutput.color};"
                        on:click={() => currentOutputSettings.set(currentOutput.id)}
                        bold={false}
                        center
                    >
                        <HiddenInput value={currentOutput.name} id={"output_" + currentOutput.id} on:edit={(e) => updateOutput("name", e.detail.value)} bind:edit />
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
