<script lang="ts">
    import { activePopup, activeShow, dictionary, popupData } from "../../stores"
    import { history } from "../helpers/history"
    import Icon from "../helpers/Icon.svelte"
    import { _show } from "../helpers/shows"
    import Button from "../inputs/Button.svelte"

    export let columns: number
    export let index: number
    export let actions: any

    function changeSlideAction(id: string) {
        history({
            id: "changeLayout",
            newData: { key: "actions", value: { ...actions, [id]: actions[id] ? !actions[id] : true } },
            location: { page: "show", show: $activeShow!, layoutSlide: index, layout: _show("active").get("settings.activeLayout") },
        })
    }
</script>

<div class="icons" style="zoom: {4 / columns};">
    {#if actions.sendMidi}
        <div>
            <div class="button white">
                <Button
                    style="padding: 5px;"
                    title={$dictionary.actions?.send_midi}
                    on:click={() => {
                        popupData.set(index)
                        activePopup.set("midi")
                    }}
                >
                    <Icon id="music" white />
                </Button>
            </div>
        </div>
    {/if}
    {#if actions.clearBackground}
        <div>
            <div class="button">
                <Button style="padding: 5px;" redHover title={$dictionary.clear?.background} on:click={() => changeSlideAction("clearBackground")}>
                    <Icon id="background" white />
                </Button>
            </div>
        </div>
    {/if}
    {#if actions.clearOverlays}
        <div>
            <div class="button">
                <Button style="padding: 5px;" redHover title={$dictionary.clear?.overlays} on:click={() => changeSlideAction("clearOverlays")}>
                    <Icon id="overlays" white />
                </Button>
            </div>
        </div>
    {/if}
    {#if actions.clearAudio}
        <div>
            <div class="button">
                <Button style="padding: 5px;" redHover title={$dictionary.clear?.audio} on:click={() => changeSlideAction("clearAudio")}>
                    <Icon id="audio" white />
                </Button>
            </div>
        </div>
    {/if}
</div>

<style>
    .icons {
        pointer-events: none;
        display: flex;
        flex-direction: column;
        position: absolute;
        right: 5px;
        z-index: 1;
    }
    .icons div {
        opacity: 0.9;
        display: flex;
    }
    .icons .button {
        background-color: rgb(0 0 0 / 0.6);
        pointer-events: all;
    }

    .button:not(.white) :global(svg) {
        fill: #ff5050;
    }
</style>
