<script lang="ts">
    import Button from "../../../common/components/Button.svelte"
    import Icon from "../../../common/components/Icon.svelte"
    import { send } from "../../util/socket"
    import { active, mediaCache } from "../../util/stores"
    import Clear from "../show/Clear.svelte"

    export let tablet: boolean = false

    $: path = $active?.id
    $: thumbnailPath = $mediaCache[path]
</script>

<div class="media">
    {#if path}
        <div class="play">
            <Button
                on:click={() => {
                    send("API:play_media", { path })
                    send("API:get_cleared")
                }}
                center
            >
                <Icon id="play" style="opacity: 0.5;" size={8} white />
            </Button>
        </div>

        <img src={thumbnailPath} alt="Preview" draggable="false" />
    {/if}
</div>

{#if !tablet}
    <Clear />
{/if}

<style>
    .media {
        background-color: var(--primary-darker);

        position: relative;

        display: flex;
        height: 100%;
        width: 100%;
    }

    img {
        object-fit: contain;
        width: 100%;
        height: 100%;
    }

    .play :global(button) {
        position: absolute;
        width: 100%;
        height: 100%;

        padding: 50px;
    }
</style>
