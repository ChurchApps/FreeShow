<script lang="ts">
    import { createEventDispatcher, onDestroy, onMount } from "svelte"
    import { Main } from "../../../../types/IPC/Main"
    import type { MediaStyle } from "../../../../types/Main"
    import { sendMain } from "../../../IPC/main"
    import { dictionary, media, os, outputs } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import { getMediaStyle } from "../../helpers/media"
    import { findMatchingOut } from "../../helpers/output"
    import Button from "../../inputs/Button.svelte"
    import SelectElem from "../../system/SelectElem.svelte"
    import Card from "../Card.svelte"

    interface Cam {
        id: string
        name: string
        group: string
    }
    export let cam: Cam
    export let item = false
    export let style = ""
    export let showPlayOnHover = true

    let loaded = false
    // $: active = $outBackground?.type === "camera" && $outBackground.id === cam.id

    let videoElem: HTMLVideoElement | undefined

    // https://stackoverflow.com/questions/33761770/what-constraints-should-i-pass-to-getusermedia-in-order-to-get-two-video-media
    // https://blog.addpipe.com/getusermedia-video-constraints/
    let constraints = {
        video: {
            deviceId: { exact: cam.id },
            groupId: cam.group,
            width: { ideal: 1920 },
            height: { ideal: 1080 }
            // aspectRatio: 1.777777778,
            // frameRate: { max: 30 },
            // facingMode: { exact: "user" }
        }
    }

    let error: null | string = null

    let retryTimeout: NodeJS.Timeout | null = null

    onMount(capture)
    function capture() {
        error = ""

        navigator.mediaDevices
            .getUserMedia(constraints)
            .then((mediaStream) => {
                if (!videoElem) return

                videoElem.srcObject = mediaStream
                loaded = true
                videoElem.play()
            })
            .catch((err) => {
                let msg: string = err.message
                if (err.name === "NotReadableError") {
                    msg += "<br />Maybe it's in use by another program."
                    sendMain(Main.ACCESS_CAMERA_PERMISSION)
                }
                error = err.name + ":<br />" + msg
                loaded = true

                // retry
                if ($os.platform === "darwin") retryTimeout = setTimeout(capture, 5000)
            })
    }

    onDestroy(() => {
        if (retryTimeout) clearTimeout(retryTimeout)

        if (!videoElem) return
        ;(videoElem.srcObject as MediaStream)?.getTracks()?.forEach((track) => track.stop())
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
</script>

{#if item}
    {#if !error}
        <video style="width: 100%;height: 100%;{style}" bind:this={videoElem}>
            <track kind="captions" />
        </video>
    {/if}
{:else}
    <Card class="context #camera_card" {loaded} outlineColor={findMatchingOut(cam.id, $outputs)} active={findMatchingOut(cam.id, $outputs) !== null} on:click={click} label={cam.name} icon="camera" white={!cam.id.includes("cam")} {showPlayOnHover}>
        <SelectElem id="camera" data={{ id: cam.id, type: "camera", name: cam.name, cameraGroup: cam.group }} draggable>
            <!-- icons -->
            <div class="icons">
                {#if !!mediaStyle.filter?.length || $media[cam.id]?.fit || mediaStyle.flipped || mediaStyle.flippedY || Object.keys(mediaStyle.cropping || {}).length}
                    <div style="max-width: 100%;">
                        <div class="button">
                            <Button style="padding: 3px;" redHover title={$dictionary.actions?.remove} on:click={() => removeStyle("filters")}>
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
</style>
