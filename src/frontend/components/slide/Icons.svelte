<script lang="ts">
    import type { Media, Slide, SlideData } from "../../../types/Show"
    import { AudioPlayer } from "../../audio/audioPlayer"
    import { activePopup, activeShow, activeTimers, alertMessage, outputs, shows } from "../../stores"
    import { translateText } from "../../utils/language"
    import { getAccess } from "../../utils/profile"
    import { videoExtensions } from "../../values/extensions"
    import { clone } from "../helpers/array"
    import { history } from "../helpers/history"
    import Icon from "../helpers/Icon.svelte"
    import { getExtension } from "../helpers/media"
    import { _show } from "../helpers/shows"
    import { joinTime, secondsToTime } from "../helpers/time"
    import Button from "../inputs/Button.svelte"

    export let slide: Slide
    export let timer: number[]
    export let layoutSlide: SlideData
    export let background: Media | null
    export let backgroundCount = 0
    export let duration: number
    export let columns: number
    export let index: number
    export let style: string

    $: videoDuration = duration ? joinTime(secondsToTime(duration)) : null
    $: isVideo = background?.path ? videoExtensions.includes(getExtension(background.path)) : false
    $: muted = background?.muted !== false
    $: looping = background?.loop !== false

    $: nextTimer = (layoutSlide.nextTimer || 0) > 0 ? (layoutSlide.nextTimer! > 59 ? joinTime(secondsToTime(layoutSlide.nextTimer!)) : layoutSlide.nextTimer + "s") : null
    $: transition = layoutSlide?.transition || layoutSlide?.mediaTransition

    $: currentShow = $shows[$activeShow?.id || ""] || {}

    function hasAccess() {
        if (currentShow.locked) {
            alertMessage.set("show.locked_info")
            activePopup.set("alert")
            return false
        }

        const profile = getAccess("shows")
        const readOnly = profile.global === "read" || profile[currentShow.category || ""] === "read"
        if (readOnly) {
            alertMessage.set("profile.locked")
            activePopup.set("alert")
            return false
        }

        return true
    }

    function removeLayout(key: string) {
        if (!hasAccess()) return

        history({ id: "SHOW_LAYOUT", newData: { key, indexes: [index] } })
    }

    // TODO: history
    function mute() {
        if (!hasAccess()) return

        _show()
            .media([layoutSlide.background || ""])
            .set({ key: "muted", value: false })
    }
    function removeLoop() {
        if (!hasAccess()) return

        _show()
            .media([layoutSlide.background || ""])
            .set({ key: "loop", value: false })
    }

    function resetTimer() {
        if (!hasAccess()) return

        activeTimers.update((a) => {
            a = a.filter((_a, i) => !timer.includes(i))
            return a
        })
        // send(OUTPUT, ["ACTIVE_TIMERS"], $activeTimers)
    }

    function removeSlideSetting(key: string) {
        if (!slide || currentShow.locked) return

        let settings = clone(slide.settings || {})
        delete settings[key]
        let newData = { style: settings }

        history({
            id: "slideStyle",
            oldData: { style: slide.settings || {} },
            newData,
            location: { page: "show", show: $activeShow!, slide: layoutSlide.id }
        })
    }

    $: audio = layoutSlide.audio?.length ? _show().get()?.media?.[layoutSlide.audio[0]] || {} : {}
    $: audioPath = audio.path
    // no need for cloud when audio can be stacked
    // $: cloudId = $driveData.mediaId
    // $: audioPath = cloudId && cloudId !== "default" ? audio.cloud?.[cloudId] || audio.path : audio.path

    $: zoom = 4 / columns
</script>

<div class="icons" style="zoom: {zoom};{style}">
    {#if layoutSlide.disabled}
        <div>
            <div class="button">
                <Button style="padding: 3px;" redHover title={translateText("actions.enable")} {zoom} on:click={() => removeLayout("disabled")}>
                    <Icon id="disable" size={0.9} white />
                </Button>
            </div>
        </div>
    {/if}

    {#if timer.length}
        <div>
            <div class="button">
                <Button style="padding: 3px;" redHover title={translateText("remove.timer")} {zoom} on:click={() => resetTimer()}>
                    <Icon id="timer" size={0.9} white />
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
                <Button style="padding: 3px;" redHover title={translateText("remove.nextTimer")} {zoom} on:click={() => removeLayout("nextTimer")}>
                    <Icon id="clock" size={0.9} white />
                </Button>
            </div>
            <span><p>{nextTimer}</p></span>
        </div>
    {/if}
    {#if layoutSlide.end}
        <!-- WIP move this to Actions.svelte (right side) -->
        <div>
            <div class="button">
                <Button style="padding: 3px;" redHover title={translateText("remove.to_start")} {zoom} on:click={() => removeLayout("end")}>
                    <Icon id="restart" size={0.9} white />
                </Button>
            </div>
        </div>
    {/if}
    {#if transition}
        <div>
            <div class="button">
                <Button
                    style="padding: 3px;"
                    redHover
                    title={translateText("remove.transition")}
                    {zoom}
                    on:click={() => {
                        removeLayout("transition")
                        removeLayout("mediaTransition")
                    }}
                >
                    <Icon id="transition" size={0.9} white />
                </Button>
            </div>
        </div>
    {/if}

    {#if layoutSlide.bindings?.length}
        <div>
            <div class="button">
                <Button style="padding: 3px;" redHover title={translateText("actions.remove_binding")} {zoom} on:click={() => removeLayout("bindings")}>
                    <Icon id="bind" size={0.9} white />
                </Button>
            </div>
            {#if layoutSlide.bindings.length > 1}
                <span><p>{layoutSlide.bindings.length}</p></span>
            {:else}
                <span><p>{$outputs[layoutSlide.bindings[0]]?.name || ""}</p></span>
            {/if}
        </div>
    {/if}

    {#if background}
        <div>
            <div class="button">
                <Button style="padding: 3px;" redHover title={translateText("remove.background")} {zoom} on:click={() => removeLayout("background")}>
                    <Icon id={["camera", "screen", "ndi"].includes(background.type || "") ? background.type || "" : background.path?.includes("http") ? "web" : "image"} size={0.9} white />
                </Button>
            </div>
            {#if videoDuration}
                <span><p>{videoDuration}</p></span>
            {/if}
        </div>
    {/if}
    {#if background && muted && isVideo}
        <div>
            <div class="button">
                <Button style="padding: 3px;" redHover title={translateText("actions.unmute")} {zoom} on:click={() => mute()}>
                    <Icon id="muted" size={0.9} white />
                </Button>
            </div>
        </div>
    {/if}
    {#if background && looping && isVideo && backgroundCount > 1}
        <div>
            <div class="button">
                <Button style="padding: 3px;{layoutSlide.actions?.nextAfterMedia ? 'opacity: 0.5;' : ''}" redHover title={translateText("media._loop")} {zoom} on:click={() => removeLoop()}>
                    <Icon id="loop" size={0.9} white />
                </Button>
            </div>
        </div>
    {/if}
    {#if layoutSlide.mics?.length}
        <div>
            <div class="button">
                <Button style="padding: 3px;" redHover title={translateText("actions.remove")} {zoom} on:click={() => removeLayout("mics")}>
                    <Icon id="microphone" size={0.9} white />
                </Button>
            </div>
            {#if layoutSlide.mics.length > 1}
                <span>
                    <p>{layoutSlide.mics.length}</p>
                </span>
            {/if}
        </div>
    {/if}
    {#if layoutSlide.audio?.length}
        <div>
            <div class="button">
                <Button style="padding: 3px;" redHover title={translateText("remove.audio")} {zoom} on:click={() => removeLayout("audio")}>
                    <Icon id="audio" size={0.9} white />
                </Button>
            </div>
            <span>
                {#if layoutSlide.audio.length === 1}
                    {#await AudioPlayer.getDuration(audioPath || "")}
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
    {#if layoutSlide.effects?.length}
        <div>
            <div class="button">
                <Button style="padding: 3px;" redHover title={translateText("remove.effects")} {zoom} on:click={() => removeLayout("effects")}>
                    <Icon id="effects" size={0.9} white />
                </Button>
            </div>
            {#if layoutSlide.effects.length > 1}
                <span><p>{layoutSlide.effects.length}</p></span>
            {/if}
        </div>
    {/if}
    {#if layoutSlide.overlays?.length}
        <div>
            <div class="button">
                <Button style="padding: 3px;" redHover title={translateText("remove.overlays")} {zoom} on:click={() => removeLayout("overlays")}>
                    <Icon id="overlays" size={0.9} white />
                </Button>
            </div>
            {#if layoutSlide.overlays.length > 1}
                <span><p>{layoutSlide.overlays.length}</p></span>
            {/if}
        </div>
    {/if}

    {#if slide?.settings?.template}
        <div>
            <div class="button">
                <Button style="padding: 3px;" redHover title={translateText("actions.remove")} {zoom} on:click={() => removeSlideSetting("template")}>
                    <Icon id="templates" size={0.9} white />
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
        z-index: 1;
        font-size: 0.9em;

        height: 80%;
        flex-wrap: wrap;
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
        padding: 3px;
        font-size: 0.75em;
        font-weight: bold;
        display: flex;
        align-items: center;
    }
</style>
