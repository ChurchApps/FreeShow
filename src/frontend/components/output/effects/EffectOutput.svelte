<script lang="ts">
    import { Transition } from "../../../../types/Show"
    import { effects } from "../../../stores"
    import OutputTransition from "../transitions/OutputTransition.svelte"
    import Effect from "./Effect.svelte"

    export let ids: string[]
    export let transition: Transition
    export let mirror = false

    // $: transitionEnabled = !!((transition.type !== "none" && transition.duration) || transition.in || transition.out)

    // don't update real time??
    // let currentEffect: any = null
    // $: if (id) updateEffect()
    // function updateEffect() {
    //     currentEffect = $effects[id] ? { id, ...$effects[id] } : null
    // }
</script>

{#each ids as id}
    {@const effect = $effects[id]}
    {#if effect}
        <OutputTransition transition={mirror ? undefined : transition} inTransition={mirror ? null : transition.in || transition} outTransition={mirror ? null : transition.out || transition}>
            <Effect effect={{ id, ...effect }} />
        </OutputTransition>
    {/if}
{/each}
