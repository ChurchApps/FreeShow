<script lang="ts">
    import { BLACKMAGIC, OUTPUT } from "../../../../types/Channels"
    import type { Output } from "../../../../types/Output"
    import { activeTriggerFunction, currentOutputSettings, ndiData, outputs, popupData, stageShows, styles, toggleOutputEnabled } from "../../../stores"
    import { newToast } from "../../../utils/common"
    import { waitForPopupData } from "../../../utils/popup"
    import { send } from "../../../utils/request"
    import Icon from "../../helpers/Icon.svelte"
    import { keysToID, sortByName, sortObject } from "../../helpers/array"
    import { addOutput, enableStageOutput, refreshOut } from "../../helpers/output"
    import Tabs from "../../input/Tabs.svelte"
    import HiddenInput from "../../inputs/HiddenInput.svelte"

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
                newToast("toast.output_capture_enabled")

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
    }

    let edit: any
</script>

<Tabs id="output" tabs={outputsList} value={$currentOutputSettings || ""} newLabel="settings.new_output" class="context #output_screen" on:open={(e) => currentOutputSettings.set(e.detail)} on:create={createOutput} let:tab>
    {#if tab.stageOutput}<Icon id="stage" right />{/if}
    {#if tab.enabled !== false}<Icon id="check" size={0.7} white right />{/if}
    <HiddenInput value={tab.name} id={"output_" + tab.id} on:edit={(e) => updateOutput("name", e.detail.value, tab.id)} bind:edit />

    {#if tab.color}
        <div class="color" style="--color: {tab.color};"></div>
    {/if}
</Tabs>
