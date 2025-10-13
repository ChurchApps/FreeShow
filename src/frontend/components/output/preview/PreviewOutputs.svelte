<script lang="ts">
    import type { ClickEvent } from "../../../../types/Main"
    import type { Output } from "../../../../types/Output"
    import { ndiData, outputs, outputState } from "../../../stores"
    import { newToast } from "../../../utils/common"
    import { translateText } from "../../../utils/language"
    import { keysToID, sortByName, sortObject } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"

    // onMount(() => {
    //     currentOutputId = getActiveOutputs({}, true, true)[0]
    // })

    $: outs = sortObject(sortByName(keysToID($outputs).filter((a) => a.enabled)), "stageOutput")

    function toggleOutput(e: ClickEvent, id: string) {
        if (outs.length <= 1) return

        outputs.update((a) => {
            if (e.detail.ctrl) {
                let newState = false
                let getAllActive = Object.values(a).filter((a) => !a.stageOutput && a.active)
                if ((getAllActive.length === 1 && a[id].active) || a[id].stageOutput) newState = true

                Object.keys(a).forEach((id) => {
                    a[id].active = a[id].stageOutput ? true : newState
                })
                a[id].active = true
            } else {
                a[id].active = a[id].stageOutput ? true : !a[id].active

                let activeList = Object.values(a).filter((a) => !a.stageOutput && a.enabled && a.active === true)
                if (!activeList.length) {
                    a[id].active = true
                    newToast("toast.one_output")
                }
            }

            return a
        })
    }

    // let allSameState = true
    // // wait for all windows to update first
    // $: if ($outputState) setTimeout(updateState, 100)
    // function updateState() {
    //     allSameState = new Set($outputState.map((a) => a.active)).size < 2
    // }

    function getOutputStateTitle(output: Output, _updater: any) {
        if (!output.active) return "output.state_locked"
        if ($outputState.find((a) => a.id === output.id)?.active) return "output.state_active"
        if ($ndiData[output?.id || ""]?.connections > 0) return "NDI"
        if (output.invisible) return "settings.invisible_window"
        return "output.state_inactive"
    }
</script>

{#if outs.length > 1}
    <div class="outputTitles">
        {#each outs as output}
            <MaterialButton
                id={output.id}
                title="actions.toggle_output_lock"
                active={output.active}
                style="width: 50%;font-weight: normal;border-radius: 0;padding: 0.2em 0.8em;{output.active ? 'border-bottom: 2px solid ' + output.color + ' !important;' : ''}"
                class="output_button context #output_active_button"
                on:click={(e) => toggleOutput(e, output.id)}
            >
                <div
                    class="indicator"
                    class:locked={!output.active}
                    class:invisible={output.invisible}
                    class:ndi={$ndiData[output?.id || ""]?.connections > 0}
                    class:active={$outputState.find((a) => a.id === output.id)?.active === true}
                    data-title={translateText(getOutputStateTitle(output, { $outputState, $ndiData }))}
                ></div>
                {#if output.stageOutput}<Icon id="stage" size={0.8} white />{/if}
                <!-- {#if !allSameState && $outputState.find((a) => a.id === output.id)?.active}<Icon id="check" />{/if} -->

                <p style={output.active ? "" : "text-decoration: line-through;"}>{output.name}</p>
            </MaterialButton>
        {/each}
    </div>
{/if}

<style>
    .outputTitles {
        display: flex;
        flex-wrap: wrap;
        /* overflow-x: auto; */

        background-color: var(--primary-darker);
    }

    .outputTitles :global(button) {
        cursor: pointer;
        border-bottom: 2px solid var(--primary-lighter) !important;
        white-space: nowrap;
    }
    .outputTitles :global(button.active:hover) {
        filter: brightness(0.8);
    }

    .indicator {
        padding: 0;
        width: 8px;
        height: 8px;
        border-radius: 50%;

        transition: 0.3s background-color ease;
        background-color: #ce3535;
    }
    .indicator.invisible {
        background-color: #897f7f;
    }
    .indicator.ndi {
        background-color: #48cbe9;
    }
    .indicator.active {
        background-color: #6dff85;
    }
    .indicator.locked {
        background-color: #c98b55;
    }
    .indicator.locked.active,
    .indicator.locked.ndi {
        background-color: #ffb16d;
    }
</style>
