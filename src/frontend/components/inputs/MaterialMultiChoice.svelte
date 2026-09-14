<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import Icon from "../helpers/Icon.svelte"
    import MaterialButton from "./MaterialButton.svelte"

    export let options: { id: string; name: string; title?: string; icon: string; tip?: string; disabled?: boolean; colored?: boolean }[] = []
    export let value: string = ""
    export let highlightFirst = true
    export let gradient = false
    export let canDeselect = false

    let dispatch = createEventDispatcher()
    function click(id: string) {
        if (canDeselect && value === id) {
            dispatch("click", "")
        } else {
            dispatch("click", id)
        }
    }
</script>

<div class="choice" class:highlightFirst>
    {#each options as option, i}
        <MaterialButton title={option.title || option.name} disabled={option.disabled} class={i === 0 ? "first" : i === options.length - 1 ? "last" : ""} variant="outlined" isActive={option.id === value} on:click={() => click(option.id)} white>
            <div class="list">
                {#if option.icon.includes(".webp")}
                    <img src={option.icon} alt="{option.id}-logo" draggable={false} />
                {:else}
                    <Icon id={option.icon} size={5} white={!option.colored && !gradient} {gradient} />
                {/if}
                <div class="text">
                    <p>{option.name}</p>
                    {#if option.tip}<p class="tip">{option.tip}</p>{/if}
                </div>
            </div>
        </MaterialButton>
    {/each}
</div>

<style>
    .choice {
        display: flex;
        justify-content: center; /* space-evenly; */
        flex-wrap: wrap;
        width: 100%;

        gap: 9px;

        border-radius: 8px;
        background-color: var(--primary-darker);
        padding: 10px;
    }

    .choice :global(button) {
        flex: 1;
        aspect-ratio: 1;
        min-width: 160px;
        max-width: 280px;

        /* border-radius: 0; */
    }

    .text {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .tip {
        opacity: 0.4;
        font-size: 0.7em;
        font-style: italic;
        font-weight: normal;
        margin-top: 5px;
    }

    .choice.highlightFirst :global(button.first) {
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

    .list p {
        max-width: 150px;
        white-space: normal;
        /* text-overflow: initial; */
    }

    img {
        height: 100px;
        max-width: 100%;
        object-fit: contain;
        padding: 10px;
    }
</style>
