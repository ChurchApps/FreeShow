<script lang="ts">
    import { outputs } from "../../stores"
    import { newToast } from "../../utils/messages"
    import { getActiveOutputs } from "../helpers/output"
    import Button from "../inputs/Button.svelte"

    export let currentOutputId: string | null

    // onMount(() => {
    //     currentOutputId = getActiveOutputs({}, true, true)[0]
    // })

    $: outs = Object.entries($outputs)
        .map(([id, o]: any) => ({ id, ...o }))
        .filter((a) => a.enabled && !a.isKeyOutput)
        .sort((a, b) => a.name.localeCompare(b.name))

    function toggleOutput(e: any, id: string) {
        if (outs.length <= 1) return

        outputs.update((a) => {
            if (e.ctrlKey || e.metaKey) {
                Object.keys(a).forEach((id) => {
                    a[id].active = false
                })
                a[id].active = true
            } else {
                a[id].active = !a[id].active
                let activeList = Object.values(a).filter((a) => a.active === true)
                if (!activeList.length) {
                    a[id].active = true
                    newToast("You have to have at least one active output")
                }
            }

            return a
        })

        currentOutputId = getActiveOutputs()[0]
    }
</script>

{#if outs.length > 1}
    <div>
        {#each outs as output}
            <Button
                on:click={(e) => toggleOutput(e, output.id)}
                id={output.id}
                active={output.active}
                style="flex: 1;{output.active ? 'border-bottom: 2px solid ' + output.color + ' !important;' : ''}"
                class="output_button context #output_active_button"
                bold={false}
                center
                dark
            >
                {output.name}
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
