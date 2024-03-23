<script lang="ts">
    import type { Transition } from "../../../../types/Show"
    import { custom } from "../../../utils/transitions"

    export let value: string
    export let style: string
    export let transition: Transition
    export let isKeyOutput: boolean = false

    $: noTransition = transition.type === "none"
</script>

{#if noTransition}
    <div class="meta" {style} class:key={isKeyOutput}>
        {@html value}
    </div>
{:else}
    <div class="meta" transition:custom={transition} {style} class:key={isKeyOutput}>
        {@html value}
    </div>
{/if}

<style>
    .meta {
        position: absolute;
        display: flex;
        justify-content: center;
        align-items: center;
    }
</style>
