<script lang="ts">
    import { OUTPUT } from "../../../types/Channels"
    import { activeTimers, dictionary } from "../../stores"
    import { send } from "../../utils/request"
    import { getAudioDuration } from "../helpers/audio"
    import { history } from "../helpers/history"
    import Icon from "../helpers/Icon.svelte"
    import { _show } from "../helpers/shows"
    import { joinTime, secondsToTime } from "../helpers/time"
    import Button from "../inputs/Button.svelte"

    export let timer: any
    export let layoutSlide: any
    export let background: any
    export let duration: any
    export let columns: number
    export let index: number
    export let style: string

    $: console.log(layoutSlide.audio)

    $: videoDuration = duration ? joinTime(secondsToTime(duration)) : null
    $: notMuted = background?.muted === false

    $: nextTimer = (layoutSlide.nextTimer || 0) > 0 ? (layoutSlide.nextTimer > 59 ? joinTime(secondsToTime(layoutSlide.nextTimer)) : layoutSlide.nextTimer + "s") : null
    $: transition = layoutSlide?.transition || layoutSlide?.mediaTransition

    function removeLayout(key: string) {
        history({ id: "SHOW_LAYOUT", newData: { key, indexes: [index] } })
    }

    // TODO: history
    function mute() {
        _show("active").media([layoutSlide.background]).set({ key: "muted", value: undefined })
    }

    function resetTimer() {
        activeTimers.update((a) => {
            a = a.filter((_a, i) => !timer.includes(i))
            return a
        })
        send(OUTPUT, ["ACTIVE_TIMERS"], $activeTimers)
    }
</script>

<!-- TODO: check if exists -->
<div class="icons" style="zoom: {4 / columns};{style}">
    {#if timer.length}
        <div>
            <div class="button">
                <Button style="padding: 5px;" redHover title={$dictionary.remove?.timer} on:click={() => resetTimer()}>
                    <Icon id="timer" white />
                </Button>
            </div>
            {#if timer.length > 1}
                <span><p>{timer.length}</p></span>
            {/if}
        </div>
    {/if}
    {#if nextTimer}
        <div>
            <div class="button">
                <Button style="padding: 5px;" redHover title={$dictionary.remove?.nextTimer} on:click={() => removeLayout("nextTimer")}>
                    <Icon id="clock" white />
                </Button>
            </div>
            <span><p>{nextTimer}</p></span>
        </div>
    {/if}
    {#if layoutSlide.end}
        <div>
            <div class="button">
                <Button style="padding: 5px;" redHover title={$dictionary.remove?.to_start} on:click={() => removeLayout("end")}>
                    <Icon id="restart" white />
                </Button>
            </div>
        </div>
    {/if}
    {#if transition}
        <div>
            <div class="button">
                <Button
                    style="padding: 5px;"
                    redHover
                    title={$dictionary.remove?.transition}
                    on:click={() => {
                        removeLayout("transition")
                        removeLayout("mediaTransition")
                    }}
                >
                    <Icon id="transition" white />
                </Button>
            </div>
        </div>
    {/if}
    {#if background}
        <div>
            <div class="button">
                <Button style="padding: 5px;" redHover title={$dictionary.remove?.background} on:click={() => removeLayout("background")}>
                    <!-- <Icon id={background.type || "image"} white /> -->
                    <Icon id="image" white />
                </Button>
            </div>
            {#if videoDuration}
                <!-- <span>01:13</span> -->
                <span><p>{videoDuration}</p></span>
            {/if}
        </div>
    {/if}
    {#if notMuted}
        <div>
            <div class="button">
                <Button style="padding: 5px;" redHover title={$dictionary.actions?.mute} on:click={() => mute()}>
                    <Icon id="volume" white />
                </Button>
            </div>
        </div>
    {/if}
    {#if layoutSlide.overlays?.length}
        <div>
            <div class="button">
                <Button style="padding: 5px;" redHover title={$dictionary.remove?.overlays} on:click={() => removeLayout("overlays")}>
                    <Icon id="overlays" white />
                </Button>
            </div>
            {#if layoutSlide.overlays.length > 1}
                <span><p>{layoutSlide.overlays.length}</p></span>
            {/if}
        </div>
    {/if}
    {#if layoutSlide.audio?.length}
        <div>
            <div class="button">
                <Button style="padding: 5px;" redHover title={$dictionary.remove?.audio} on:click={() => removeLayout("audio")}>
                    <Icon id="audio" white />
                </Button>
            </div>
            <span>
                {#if layoutSlide.audio.length === 1}
                    {#await getAudioDuration(_show("active").get().media[layoutSlide.audio[0]].path)}
                        <p>00:00</p>
                    {:then duration}
                        <p>{joinTime(secondsToTime(duration))}</p>
                    {/await}
                {:else}
                    <p>{layoutSlide.audio.length}</p>
                {/if}
            </span>
        </div>
    {/if}
</div>

<style>
    .icons {
        pointer-events: none;
        display: flex;
        flex-direction: column;
        position: absolute;
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
    .icons span {
        pointer-events: all;
        background-color: rgb(0 0 0 / 0.6);
        padding: 5px;
        font-size: 0.75em;
        font-weight: bold;
        display: flex;
        align-items: center;
    }
</style>
