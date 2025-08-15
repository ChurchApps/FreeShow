<script lang="ts">
    import { dictionary, outputs, outputState } from "../../../stores"
    import { newToast } from "../../../utils/common"
    import { keysToID, sortByName, sortObject } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import { getActiveOutputs } from "../../helpers/output"
    import Button from "../../inputs/Button.svelte"

    export let currentOutputId: string | null

    // onMount(() => {
    //     currentOutputId = getActiveOutputs({}, true, true)[0]
    // })

    $: outs = sortObject(sortByName(keysToID($outputs).filter((a) => a.enabled && !a.isKeyOutput)), "stageOutput")

    function toggleOutput(e: any, id: string) {
        if (outs.length <= 1) return

        outputs.update((a) => {
            if (e.ctrlKey || e.metaKey) {
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
                    newToast("$toast.one_output")
                }
            }

            return a
        })

        currentOutputId = getActiveOutputs()[0]
    }

    let allSameState = true
    // wait for all windows to update first
    $: if ($outputState) setTimeout(updateState, 100)
    function updateState() {
        allSameState = new Set($outputState.map((a) => a.active)).size < 2
    }
</script>

{#if outs.length > 1}
    <div>
        {#each outs as output}
            <Button
                title={$dictionary.actions?.toggle_output_lock}
                on:click={(e) => toggleOutput(e, output.id)}
                id={output.id}
                active={output.active}
                style="flex: 1;{output.active ? 'border-bottom: 2px solid ' + output.color + ' !important;' : ''}"
                class="output_button context #output_active_button"
                bold={false}
                center
                dark
            >
                {#if output.stageOutput}<Icon id="stage" right />{/if}
                {#if !output.active}<Icon id="locked" right />{/if}
                {#if !allSameState && $outputState.find((a) => a.id === output.id)?.active}<Icon id="check" right />{/if}
                <p style={output.active ? "" : "text-decoration: line-through;"}>{output.name}</p>
            </Button>
        {/each}
    </div>
{/if}

<style>
    div {
        display: flex;
        flex-wrap: wrap;
        /* overflow-x: auto; */
    }

    div :global(button) {
        cursor: pointer;
        border-bottom: 2px solid var(--primary-lighter) !important;
        white-space: nowrap;
    }
    div :global(button.active:hover) {
        filter: brightness(0.8);
    }
</style>
