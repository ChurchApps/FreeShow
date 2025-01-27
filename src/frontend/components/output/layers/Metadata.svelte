<script lang="ts">
    import type { Transition } from "../../../../types/Show"
    import { custom } from "../../../utils/transitions"

    export let value: string
    export let style: string
    export let transition: Transition
    export let isKeyOutput: boolean = false

    $: noTransition = transition.type === "none" || transition.duration === 0

    // WIP metadata "auto size / align / etc." does not work
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

        /* default style */
        color: white;
        font-size: 100px;
        font-family: unset;
        line-height: 1.1;
        -webkit-text-stroke-color: #000000;
        text-shadow: 2px 2px 10px #000000;

        border-style: solid;
        border-width: 0px;
        border-color: #ffffff;
    }
</style>
