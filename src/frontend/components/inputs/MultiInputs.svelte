<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import Button from "./Button.svelte"
    import T from "../helpers/T.svelte"
    import Icon from "../helpers/Icon.svelte"

    type Input = {
        id: string
        name?: string
        title?: string
        icon?: string
        disabled?: string
    }

    export let inputs: Input[]
    export let active: string

    let dispatch = createEventDispatcher()
    function click(id: string) {
        dispatch("click", id)
    }
</script>

<div class="flex">
    {#each inputs as input}
        <Button
            title={input.title}
            on:click={() => click(input.id)}
            style={active === input.id ? "border-bottom: 2px solid var(--secondary) !important;" : "border-bottom: 2px solid var(--primary-lighter);"}
            disabled={input.disabled}
            bold={false}
            center
            dark
        >
            {#if input.icon}<Icon id={input.icon} white={!input.name} right={!!input.name} />{/if}
            {#if input.name}<T id={input.name} />{/if}
        </Button>
    {/each}
</div>

<style>
    .flex {
        display: flex;
    }
    .flex :global(button) {
        flex: 1;
    }
</style>
