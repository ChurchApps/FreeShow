<script lang="ts">
    import { dictionary } from "../../stores"
    import { history } from "../helpers/history"
    import Icon from "../helpers/Icon.svelte"
    import Button from "../inputs/Button.svelte"

    export let columns: number
    export let index: number
    export let actions: any

    function changeSlideAction(id: string, save: boolean = true) {
        let data = { ...actions, [id]: actions[id] ? !actions[id] : true }
        history({ id: "SHOW_LAYOUT", save, newData: { key: "actions", data, indexes: [index] } })
    }

    // delete receiveMidi if it don't exists
    // $: if (actions.receiveMidi && !$midiIn[actions.receiveMidi]) {
    //     changeSlideAction("receiveMidi", false)
    // }

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
