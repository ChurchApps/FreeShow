<script lang="ts">
    import { dictionary, outLocked, outputCache, outputs, playingAudio, presenterControllerKeys } from "../../stores"
    import { clearAudio } from "../helpers/audio"
    import Icon from "../helpers/Icon.svelte"
    import { isOutCleared, setOutput } from "../helpers/output"
    import { clearAll, clearOverlays } from "../helpers/showActions"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"
    import { clearTimers } from "./clear"

    export let autoChange: any
    export let activeClear: any
    export let callVideoClear: any

    // $: allCleared = !$outBackground && !$outSlide && !$outOverlays.length && !Object.keys($playingAudio).length && !$outTransition
    $: allCleared = isOutCleared(null, $outputs) && !Object.keys($playingAudio).length
    $: if (allCleared) autoChange = true

    function restoreOutput() {
        outputs.set($outputCache)
        outputCache.set(null)
    }

    let enableRestore: boolean = false
    $: if (!allCleared) {
        enableRestore = false
        outputCache.set(null)
    }
    $: if ($outputCache) {
        setTimeout(() => {
            enableRestore = true
        }, 1000)
    }
</script>

<div class="clear" style="border-top: 2px solid var(--primary-lighter);">
    <span>
        {#if allCleared && $outputCache}
            <Button class="clearAll" disabled={$outLocked || !enableRestore} on:click={restoreOutput} dark center>
                <Icon id="reset" size={1.2} />
                <span style="padding-left: 10px;"><T id={"preview.restore_output"} /></span>
            </Button>
        {:else}
            <Button class="clearAll" disabled={$outLocked || allCleared} on:click={clearAll} title="{$dictionary.clear?.all} [esc]" red dark center>
                <Icon id="clear" size={1.2} />
                <span style="padding-left: 10px;"><T id={"clear.all"} /></span>
            </Button>
        {/if}
    </span>
    <span class="group">
        <div class="combinedButton">
            <Button
                disabled={$outLocked || isOutCleared("background", $outputs)}
                on:click={() => {
                    if (!$outLocked) {
                        autoChange = true
                        callVideoClear = true
                        setOutput("background", null)
                    }
                }}
                title={$dictionary.clear?.background + " [F1]"}
                dark
                red
                center
            >
                <Icon id="background" size={1.2} />
            </Button>
            <!-- disabled={($outLocked) || isOutCleared("background", $outputs)} -->
            <Button
                on:click={() => {
                    if (activeClear === "background") {
                        autoChange = true
                        activeClear = null
                    } else {
                        autoChange = false
                        activeClear = "background"
                    }
                }}
                title={$dictionary.preview?.background}
                dark={activeClear !== "background"}
            />
        </div>

        <div class="combinedButton">
            <Button
                disabled={$outLocked || isOutCleared("slide", $outputs)}
                on:click={() => {
                    if (!$outLocked) {
                        autoChange = true
                        setOutput("slide", null)
                    }
                }}
                title={$dictionary.clear?.slide + " [F2]"}
                dark
                red
                center
            >
                <Icon id="slide" size={1.2} />
            </Button>
            <!-- disabled={($outLocked) || isOutCleared("slide", $outputs)} -->
            <Button
                on:click={() => {
                    if (activeClear === "slide") {
                        autoChange = true
                        activeClear = null
                    } else {
                        autoChange = false
                        activeClear = "slide"
                    }
                }}
                title={$dictionary.preview?.slide}
                dark={activeClear !== "slide"}
            />
        </div>

        <div class="combinedButton">
            <Button
                disabled={$outLocked || isOutCleared("overlays", $outputs, true)}
                on:click={() => {
                    if (!$outLocked) {
                        autoChange = true
                        clearOverlays()
                    }
                }}
                title={$dictionary.clear?.overlays + " [F3]"}
                dark
                red
                center
            >
                <Icon id="overlays" size={1.2} />
            </Button>
            <!-- disabled={($outLocked) || isOutCleared("overlays", $outputs, true)} -->
            <Button
                on:click={() => {
                    if (activeClear === "overlays") {
                        autoChange = true
                        activeClear = null
                    } else {
                        autoChange = false
                        activeClear = "overlays"
                    }
                }}
                title={$dictionary.preview?.overlays}
                dark={activeClear !== "overlays"}
            />
        </div>

        <div class="combinedButton">
            <Button
                disabled={$outLocked || !Object.keys($playingAudio).length}
                on:click={() => {
                    if (!$outLocked) {
                        autoChange = true
                        clearAudio()
                    }
                }}
                title={$dictionary.clear?.audio + " [F4]"}
                dark
                red
                center
            >
                <Icon id="audio" size={1.2} />
            </Button>
            <!-- disabled={($outLocked) || !Object.keys($playingAudio).length} -->
            <Button
                on:click={() => {
                    if (activeClear === "audio") {
                        autoChange = true
                        activeClear = null
                    } else {
                        autoChange = false
                        activeClear = "audio"
                    }
                }}
                title={$dictionary.preview?.audio}
                dark={activeClear !== "audio"}
            />
        </div>

        <div class="combinedButton">
            <Button
                disabled={$outLocked || isOutCleared("transition", $outputs)}
                on:click={() => {
                    if (!$outLocked) {
                        autoChange = true
                        clearTimers()
                    }
                }}
                title={$dictionary.clear?.nextTimer + ($presenterControllerKeys ? "" : " [F5]")}
                dark
                red
                center
            >
                <Icon id="clock" size={1.2} />
            </Button>
            <!-- disabled={($outLocked) || isOutCleared("transition", $outputs)} -->
            <Button
                on:click={() => {
                    if (activeClear === "nextTimer") {
                        autoChange = true
                        activeClear = null
                    } else {
                        autoChange = false
                        activeClear = "nextTimer"
                    }
                }}
                title={$dictionary.preview?.nextTimer}
                dark={activeClear !== "nextTimer"}
            />
        </div>
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

    .combinedButton {
        display: flex;
        flex-direction: column;
        flex-grow: 1;
    }
    .combinedButton :global(button:last-child) {
        padding: 5px !important;
    }
</style>
