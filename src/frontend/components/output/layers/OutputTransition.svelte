<script lang="ts">
    import type { Transition } from "../../../../types/Show"
    import { custom } from "../../../utils/transitions"

    export let transition: Transition | undefined

    $: disableTransition = transition?.type === "none" || !transition?.duration
</script>

<!-- svelte transition bug!!! -->
{#if disableTransition}
    <div class="transitioner">
        <slot />
    </div>
{:else}
    <div class="transitioner" transition:custom={transition}>
        <slot />
    </div>
{/if}

<style>
    div {
        width: 100%;
        height: 100%;
    }
</style>
