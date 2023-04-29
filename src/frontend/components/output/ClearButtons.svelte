<script lang="ts">
    import { dictionary, outLocked, outputs, playingAudio, slideTimers } from "../../stores"
    import { clearAudio } from "../helpers/audio"
    import Icon from "../helpers/Icon.svelte"
    import { clearPlayingVideo, getActiveOutputs, isOutCleared, setOutput } from "../helpers/output"
    import { clearOverlays } from "../helpers/showActions"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"

    // $: allCleared = !$outBackground && !$outSlide && !$outOverlays.length && !Object.keys($playingAudio).length && !$outTransition
    $: allCleared = isOutCleared(null, $outputs) && !Object.keys($playingAudio).length

    export let autoChange: any
    export let activeClear: any
    export let video: any
    export let videoTime: number
    export let videoData: any

    async function clearVideo() {
        // videoData.paused = true // ?
        videoData = await clearPlayingVideo()

        // RESET
        video = null
        videoTime = 0
    }

    function clearTimers() {
        setOutput("transition", null)
        let outs = getActiveOutputs()
        Object.keys($slideTimers).forEach((id) => {
            if (outs.includes(id)) $slideTimers[id].timer?.clear()
        })
    }

    export let callClear: boolean = false
    $: if (callClear) {
        clearAll()
        callClear = false
    }

    const clearAll = () => {
        if ($outLocked) return

        clearVideo()
        setOutput("background", null)
        setOutput("slide", null)
        clearOverlays()
        clearAudio()
        clearTimers()
        allCleared = true
        autoChange = true
    }
</script>

<div class="clear" style="border-top: 2px solid var(--primary-lighter);">
    <span>
        <Button class="clearAll" disabled={$outLocked || allCleared} on:click={clearAll} title={$dictionary.clear?.all} red dark center>
            <Icon id="clear" size={1.2} />
            <span style="padding-left: 10px;"><T id={"clear.all"} /></span>
        </Button>
    </span>
    <span class="group">
        <Button
            disabled={($outLocked && activeClear === "background") || isOutCleared("background", $outputs)}
            on:click={() => {
                if (activeClear !== "background") {
                    // previousActive = activeClear
                    autoChange = false
                    activeClear = "background"
                } else if (!$outLocked) {
                    autoChange = true
                    clearVideo()
                    setOutput("background", null)
                }
            }}
            title={activeClear === "background" ? $dictionary.clear?.background : $dictionary.preview?.background}
            red={activeClear === "background"}
            dark
            center
        >
            <Icon id="background" size={1.2} />
        </Button>
        <Button
            disabled={($outLocked && activeClear === "slide") || isOutCleared("slide", $outputs)}
            on:click={() => {
                if (activeClear !== "slide") {
                    // previousActive = activeClear
                    autoChange = false
                    activeClear = "slide"
                } else if (!$outLocked) {
                    autoChange = true
                    setOutput("slide", null)
                }
            }}
            title={activeClear === "slide" ? $dictionary.clear?.slide : $dictionary.preview?.slide}
            red={activeClear === "slide"}
            dark
            center
        >
            <Icon id="slide" size={1.2} />
        </Button>
        <Button
            disabled={($outLocked && activeClear === "overlays") || isOutCleared("overlays", $outputs, true)}
            on:click={() => {
                if (activeClear !== "overlays") {
                    // previousActive = activeClear
                    autoChange = false
                    activeClear = "overlays"
                } else if (!$outLocked) {
                    autoChange = true
                    clearOverlays()
                }
            }}
            title={activeClear === "overlays" ? $dictionary.clear?.overlays : $dictionary.preview?.overlays}
            red={activeClear === "overlays"}
            dark
            center
        >
            <Icon id="overlays" size={1.2} />
        </Button>
        <Button
            disabled={($outLocked && activeClear === "audio") || !Object.keys($playingAudio).length}
            on:click={() => {
                if (activeClear !== "audio") {
                    // previousActive = activeClear
                    autoChange = false
                    activeClear = "audio"
                } else if (!$outLocked) {
                    autoChange = true
                    clearAudio()
                }
            }}
            title={activeClear === "audio" ? $dictionary.clear?.audio : $dictionary.preview?.audio}
            red={activeClear === "audio"}
            dark
            center
        >
            <Icon id="audio" size={1.2} />
        </Button>
        <Button
            disabled={($outLocked && activeClear === "nextTimer") || isOutCleared("transition", $outputs)}
            on:click={() => {
                if (activeClear !== "nextTimer") {
                    // previousActive = activeClear
                    autoChange = false
                    activeClear = "nextTimer"
                } else if (!$outLocked) {
                    autoChange = true
                    clearTimers()
                }
            }}
            title={activeClear === "nextTimer" ? $dictionary.clear?.nextTimer : $dictionary.preview?.nextTimer}
            red={activeClear === "nextTimer"}
            dark
            center
        >
            <Icon id="clock" size={1.2} />
        </Button>
    </span>
</div>

<style>
    .clear {
        display: flex;
        flex-direction: column;
    }

    :global(.clearAll) {
        width: 100%;
    }

    .group {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
    }
    .group :global(button) {
        flex-grow: 1;
        /* height: 40px; */
    }
</style>
