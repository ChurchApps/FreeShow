<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import type { Input as TInput } from "../../../types/Input"
    import { clone } from "../helpers/array"
    import HRule from "./HRule.svelte"
    import Input from "./Input.svelte"

    export let inputs: TInput[]
    export let title = ""

    let dispatch = createEventDispatcher()
    function changed(e: any, input: TInput) {
        let value = e.detail
        dispatch("change", clone({ ...input, value }))
    }
</script>

{#if title}
    <HRule {title} />
{/if}

{#each inputs as input}
    {#if input?.type}
        <Input {input} on:change={(e) => changed(e, input)} />
    {/if}
{/each}
