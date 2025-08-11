<script lang="ts">
    import { onMount } from "svelte"
    import { BLACKMAGIC, OUTPUT } from "../../../../types/Channels"
    import type { Output } from "../../../../types/Output"
    import { activeTriggerFunction, currentOutputSettings, ndiData, outputs, popupData, stageShows, styles, toggleOutputEnabled } from "../../../stores"
    import { newToast } from "../../../utils/common"
    import { waitForPopupData } from "../../../utils/popup"
    import { send } from "../../../utils/request"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { keysToID, sortByName, sortObject } from "../../helpers/array"
    import { addOutput, enableStageOutput, refreshOut } from "../../helpers/output"
    import HiddenInput from "../../inputs/HiddenInput.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import SelectElem from "../../system/SelectElem.svelte"

    let outputsList: Output[] = []
    $: outputsList = sortObject(sortByName(keysToID($outputs).filter((a) => !a.isKeyOutput)), "stageOutput")

    $: if (outputsList.length && (!$currentOutputSettings || !$outputs[$currentOutputSettings])) currentOutputSettings.set(outputsList.find((a) => a.enabled)?.id || outputsList[0].id || "")

    let currentOutput: Output | null = null
    $: if ($currentOutputSettings) currentOutput = { id: $currentOutputSettings, ...$outputs[$currentOutputSettings] }

    function updateOutput(key: string, value: any, outputId = "") {
        if (!outputId) outputId = currentOutput?.id || ""
        if (!outputId || !$outputs[outputId]) return

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

    // CREATE

    $: if ($activeTriggerFunction === "create_output") createOutput({})
    async function createOutput(e: any) {
        const skipPopup = e.ctrlKey || e.metaKey
        let stageLayouts = keysToID($stageShows)
        let type = stageLayouts.length && !skipPopup ? await waitForPopupData("choose_output") : "normal"
        if (!type) return

        if (type === "stage") {
            let firstStageLayoutId = sortByName(stageLayouts)[0]?.id || ""
            let stageId = stageLayouts.length > 1 ? (await waitForPopupData("select_stage_layout")) || firstStageLayoutId : firstStageLayoutId

            let stageLayout = $stageShows[stageId]

            toggleOutputEnabled.set(true) // disable preview output transitions (to prevent visual svelte bug)
            setTimeout(() => {
                let id = enableStageOutput({ stageOutput: stageId, name: stageLayout?.name || "" })
                currentOutputSettings.set(id)
            }, 100)
        } else if (type === "normal") {
            let styleId = ""
            if (Object.keys($styles).length && !skipPopup) {
                popupData.set({ outputId: currentOutput?.id, skip: true })
                styleId = await waitForPopupData("select_style")
            }

            addOutput(false, styleId)
        }

        checkScroll()
    }

    let tabsElem: HTMLDivElement | undefined
    let isScrollable = false
    function checkScroll() {
        if (!tabsElem) return
        isScrollable = tabsElem.scrollWidth > tabsElem.clientWidth
    }

    onMount(checkScroll)

    let edit: any
</script>

<div class="row">
    {#if outputsList.length > 1}
        <div class="tabs" class:isScrollable bind:this={tabsElem}>
            {#each outputsList as output}
                {@const active = $currentOutputSettings === output.id}

                <SelectElem id="output" data={{ id: output.id }} fill>
                    <button class="tab context #output_screen{output.stageOutput ? '_stage' : ''}" class:active on:click={() => currentOutputSettings.set(output.id || "")}>
                        {#if output.stageOutput}<Icon id="stage" right />{/if}
                        {#if output.enabled !== false}<Icon id="check" size={0.7} white right />{/if}
                        <HiddenInput value={output.name} id={"output_" + output.id} on:edit={(e) => updateOutput("name", e.detail.value, output.id)} bind:edit />

                        {#if output.color}
                            <div class="color" style="--color: {output.color};"></div>
                        {/if}
                    </button>
                </SelectElem>
            {/each}
        </div>
    {/if}

    <MaterialButton title="settings.new_output" class={outputsList.length > 1 ? "small" : ""} style={outputsList.length > 1 ? "" : "flex: 1;"} on:click={createOutput}>
        <Icon id="add" size={1.2} white={outputsList.length > 1} />
        {#if outputsList.length <= 1}
            <!-- "settings.add" -->
            <T id="settings.new_output" />
        {/if}
    </MaterialButton>
</div>

<style>
    .row {
        display: flex;

        background-color: var(--primary);

        height: 50px;
    }

    .row :global(button.small) {
        transform: translateY(4px);

        border-radius: 15px;
        height: 40px;
        aspect-ratio: 1;
    }
    .row:not(:has(.isScrollable)) :global(button.small) {
        transform: translate(-10px, 4px);
    }

    .tabs {
        --radius: 15px;

        display: flex;

        flex: 1;

        overflow-x: auto;

        padding: 0 var(--radius);
    }

    button.tab {
        background-color: inherit;
        color: inherit;
        font-family: inherit;
        font-size: inherit;
        border: none;

        height: 100%;

        position: relative;
        display: flex;
        align-items: center;
        width: 100%;

        padding: 10px 20px;
        border: none;
        background-color: transparent;
        cursor: pointer;

        transition: background-color 0.12s ease;

        border-radius: 0 0 var(--radius) var(--radius);

        /* border-bottom: 2px solid var(--primary); */
    }
    button.tab:not(.active):hover {
        background-color: var(--hover);
    }

    .tab .color {
        position: absolute;
        left: var(--radius);
        bottom: 5px;

        width: calc(100% - var(--radius) * 2);
        height: 2px;

        background-color: var(--color);
    }

    .tabs :not(:first-child) .tab::before {
        content: "";
        position: absolute;
        left: -2px; /* hidden under active */
        top: 42%;
        transform: translateY(-50%);

        width: 2px;
        height: 45%;
        background-color: var(--primary-lighter);
    }

    .tab.active {
        background-color: var(--primary-darker);
        z-index: 1;

        /* border-bottom: 2px solid var(--secondary); */
    }

    /* concave rounding */
    .tabs .tab.active::before,
    .tabs .tab.active::after {
        transform: initial;

        content: "";
        position: absolute;
        top: 0;
        width: var(--radius);
        height: var(--radius);
    }
    .tabs .tab.active::before {
        left: calc(var(--radius) * -1);
        background: radial-gradient(circle at 0 100%, transparent var(--radius), var(--primary-darker) 0px);
    }
    .tabs .tab.active::after {
        right: calc(var(--radius) * -1);
        background: radial-gradient(circle at 100% 100%, transparent var(--radius), var(--primary-darker) 0px);
    }
</style>
