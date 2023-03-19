<script lang="ts">
    import { activeShow, dictionary, midiIn } from "../../stores"
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

    // delete receiveMidi if it don't exists
    $: if (actions.receiveMidi && !$midiIn[actions.receiveMidi]) {
        changeSlideAction("receiveMidi")
    }

    const actionsList = [
        { id: "receiveMidi", title: $dictionary.actions?.play_on_midi, icon: "play", white: true },
        { id: "sendMidi", title: $dictionary.actions?.send_midi, icon: "music", white: true },
        { id: "startTimer", title: $dictionary.actions?.start_timer, icon: "timer", white: true },
        { id: "stopTimers", title: $dictionary.actions?.stop_timers, icon: "stop" },
        { id: "clearBackground", title: $dictionary.clear?.background, icon: "background" },
        { id: "clearOverlays", title: $dictionary.clear?.overlays, icon: "overlays" },
        { id: "clearAudio", title: $dictionary.clear?.audio, icon: "audio" },
    ]
</script>

<div class="icons" style="zoom: {4 / columns};">
    {#each actionsList as action}
        {#if actions[action.id]}
            <div>
                <div class="button {action.white ? 'white' : ''}">
                    <Button style="padding: 5px;" redHover title={action.title} on:click={() => changeSlideAction(action.id)}>
                        <Icon id={action.icon} white />
                    </Button>
                </div>
            </div>
        {/if}
    {/each}
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
