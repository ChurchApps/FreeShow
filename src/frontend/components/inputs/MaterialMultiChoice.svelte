<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import Icon from "../helpers/Icon.svelte"
    import MaterialButton from "./MaterialButton.svelte"

    export let options: { id: string; name: string; title?: string; icon: string; disabled?: boolean; colored?: boolean }[] = []
    export let hightlightFirst: boolean = true

    let dispatch = createEventDispatcher()
    function click(id: string) {
        dispatch("click", id)
    }
</script>

<div class="choice" class:hightlightFirst>
    {#each options as option, i}
        <MaterialButton title={option.title} disabled={option.disabled} class={i === 0 ? "first" : i === options.length - 1 ? "last" : ""} variant="outlined" on:click={() => click(option.id)} white>
            <div class="list">
                <Icon id={option.icon} size={5} white={!option.colored} />
                <p>{option.name}</p>
            </div>
        </MaterialButton>
    {/each}
</div>

<style>
    .choice {
        display: flex;
        width: 100%;

        gap: 9px;

        border-radius: 8px;
        background-color: var(--primary-darker);
        padding: 10px;
    }

    .choice :global(button) {
        flex: 1;
        aspect-ratio: 1;
        max-height: 250px;

        /* border-radius: 0; */
    }

    .choice.hightlightFirst :global(button.first) {
        border-color: rgb(255 255 255 / 0.25) !important;
    }

    /* .choice :global(button.first) {
        border-top-left-radius: 4px;
        border-bottom-left-radius: 4px;
    }
    .choice :global(button.last) {
        border-top-right-radius: 4px;
        border-bottom-right-radius: 4px;
    }
    .choice :global(button:not(.first)) {
        border-left: 0;
    } */

    .list {
        display: flex;
        flex-direction: column;
        gap: 10px;

        justify-content: center;
        align-items: center;
    }
</style>
