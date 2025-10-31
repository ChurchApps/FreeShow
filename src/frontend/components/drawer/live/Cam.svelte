<script lang="ts">
    import { createEventDispatcher, onDestroy, onMount } from "svelte"
    import type { MediaStyle } from "../../../../types/Main"
    import { type CameraData, cameraManager } from "../../../media/cameraManager"
    import { media, os, outputs, special } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import Icon from "../../helpers/Icon.svelte"
    import { getMediaStyle } from "../../helpers/media"
    import { findMatchingOut } from "../../helpers/output"
    import Button from "../../inputs/Button.svelte"
    import SelectElem from "../../system/SelectElem.svelte"
    import Card from "../Card.svelte"

    export let cam: CameraData
    export let item = false
    export let style = ""
    export let showPlayOnHover = true
    export let disablePreview = false

    let loaded = false
    // $: active = $outBackground?.type === "camera" && $outBackground.id === cam.id

    let videoElem: HTMLVideoElement | undefined
    let error: null | string = null
    let retryTimeout: NodeJS.Timeout | null = null

    onMount(capture)
    async function capture() {
        if (disablePreview) return

        error = ""

        const cameraStream = await cameraManager.getCameraStream(cam.id, cam.group)
        if (typeof cameraStream === "string") {
            error = cameraStream
            loaded = true

            // retry
            if ($os.platform === "darwin") retryTimeout = setTimeout(capture, 5000)
        } else {
            if (!videoElem) return

            videoElem.srcObject = cameraStream
            loaded = true
            videoElem.play()
        }
    }

    onDestroy(() => {
        if (retryTimeout) clearTimeout(retryTimeout)

        if (!videoElem) return
        cameraManager.stopTracks(videoElem.srcObject as MediaStream)
        videoElem.srcObject = null
    })

    let dispatch = createEventDispatcher()
    function click(e) {
        if (iconClicked) return
        dispatch("click", e)
    }

    // ICON

    let mediaStyle: MediaStyle = {}
    $: if (cam.id) mediaStyle = getMediaStyle($media[cam.id], undefined)

    let iconClicked: NodeJS.Timeout | null = null
    function removeStyle(key: string) {
        iconClicked = setTimeout(() => (iconClicked = null), 50)

        media.update((a) => {
            if (!a[cam.id]) return a

            if (key === "filters") {
                delete a[cam.id].fit
                delete a[cam.id].flipped
                delete a[cam.id].flippedY
                delete a[cam.id].filter
                delete a[cam.id].cropping
            } else {
                delete a[cam.id][key]
            }

            return a
        })
    }

    let startupCameras: string[] = []
    $: if ($special) startupCameras = cameraManager.getStartupCameras()
    function removeFromStartup(cameraId: string) {
        iconClicked = setTimeout(() => (iconClicked = null), 50)

        const newCameraIds = startupCameras.filter((id) => id !== cameraId)
        cameraManager.setStartupCameras(newCameraIds)
    }
</script>

{#if item}
    {#if disablePreview}
        <div class="iconPreview">
            <Icon id="camera" size={3} white />
        </div>
    {:else if !error}
        <video style="width: 100%;height: 100%;{style}" bind:this={videoElem}>
            <track kind="captions" />
        </video>
    {/if}
{:else}
    <Card class="context #camera_card" {loaded} outlineColor={findMatchingOut(cam.id, $outputs)} active={findMatchingOut(cam.id, $outputs) !== null} on:click={click} label={cam.name} icon="camera" white={!cam.id.includes("cam")} {showPlayOnHover}>
        <SelectElem id="camera" data={{ id: cam.id, type: "camera", name: cam.name, cameraGroup: cam.group }} draggable>
            <!-- icons -->
            <div class="icons">
                {#if startupCameras.includes(cam.id)}
                    <div style="max-width: 100%;">
                        <div class="button">
                            <Button style="padding: 3px;" redHover title={translateText("actions.remove")} on:click={() => removeFromStartup(cam.id)}>
                                <Icon id="startup" size={0.9} white />
                            </Button>
                        </div>
                    </div>
                {/if}

                {#if !!mediaStyle.filter?.length || $media[cam.id]?.fit || mediaStyle.flipped || mediaStyle.flippedY || Object.keys(mediaStyle.cropping || {}).length}
                    <div style="max-width: 100%;">
                        <div class="button">
                            <Button style="padding: 3px;" redHover title={translateText("actions.remove")} on:click={() => removeStyle("filters")}>
                                <Icon id="filter" size={0.9} white />
                            </Button>
                        </div>
                    </div>
                {/if}
            </div>

            {#if error}
                <div class="error">
                    {@html error}
                </div>
            {:else}
                <video bind:this={videoElem} {style}>
                    <track kind="captions" />
                </video>
            {/if}
        </SelectElem>
    </Card>
{/if}

<style>
    /* video {
    -webkit-transform: scaleX(-1);
    transform: scaleX(-1);
  } */

    video {
        aspect-ratio: 1920/1080;
    }

    .error {
        align-self: center;
        text-align: center;
        color: #ff9a9a;
    }

    /* icons */

    .icons {
        pointer-events: none;
        display: flex;
        flex-direction: column;
        position: absolute;
        left: 0;
        z-index: 1;
        font-size: 0.9em;

        height: 80%;
        flex-wrap: wrap;

        max-width: calc(100% - 21px);
    }
    .icons div {
        opacity: 0.9;
        display: flex;
    }
    .icons .button {
        background-color: rgb(0 0 0 / 0.6);
        pointer-events: all;
    }

    .iconPreview {
        display: flex;
        align-items: center;
        justify-content: center;

        width: 100%;
        height: 100%;

        border: 2px solid white;
        background-color: rgb(0 50 100 / 0.3);

        zoom: 8;
    }
</style>
