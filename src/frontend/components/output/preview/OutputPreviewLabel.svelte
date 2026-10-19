<script lang="ts">
    import type { ClickEvent } from "../../../../types/Main"
    import type { Output } from "../../../../types/Output"
    import { dictionary, ndiData, outputs, outputState } from "../../../stores"
    import { newToast } from "../../../utils/common"
    import { translateText } from "../../../utils/language"
    import Icon from "../../helpers/Icon.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"

    export let output: Output & { id: string }
    export let outs: Output[] = []

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

    function getOutputStateTitle(output: Output, _updater: any) {
        if (!output.active) return "output.state_locked"
        if ($outputState.find((a) => a.id === output.id)?.active) return "settings.enabled"
        if ($ndiData[output?.id || ""]?.connections > 0) return "NDI"
        if (output.invisible) return "settings.network_output"
        return "output.state_inactive"
    }
</script>

<div class="outputTitle">
    <MaterialButton id={output.id} title={output.stageOutput ? "" : "actions.toggle_output_lock"} active={output.active} style="width: 100%;font-weight: normal;border-radius: 0;padding: 0.2em 0.8em;{output.active ? 'border-bottom: 2px solid ' + output.color + ' !important;' : ''}" class="output_button context #output_active_button" on:click={(e) => toggleOutput(e, output.id)}>
        <div class="indicator" class:locked={!output.active} class:invisible={output.invisible} class:ndi={$ndiData[output?.id || ""]?.connections > 0} class:active={$outputState.find((a) => a.id === output.id)?.active === true} data-title={translateText(getOutputStateTitle(output, { $outputState, $ndiData }), $dictionary)}></div>
        {#if output.stageOutput}<Icon id="stage" size={0.8} white />{/if}

        <p style={output.active ? "" : "text-decoration: line-through;"}>{output.name}</p>
    </MaterialButton>
</div>

<style>
    .outputTitle {
        width: 100%;
        background-color: var(--primary-darker);
    }

    .outputTitle :global(button) {
        cursor: pointer;
        border-bottom: 2px solid var(--primary-lighter) !important;
        white-space: nowrap;
    }
    .outputTitle :global(button.active:hover) {
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
