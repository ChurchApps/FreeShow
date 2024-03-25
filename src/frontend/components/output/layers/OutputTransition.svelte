<script lang="ts">
    import type { Transition } from "../../../../types/Show"
    import { custom } from "../../../utils/transitions"

    export let transition: Transition

    $: disableTransition = transition.type === "none" || !transition.duration
</script>

{#if disableTransition}
    <div>
        <slot />
    </div>
{:else}
    <div transition:custom={transition}>
        <slot />
    </div>
{/if}

<style>
    div {
        width: 100%;
        height: 100%;
    }
</style>
