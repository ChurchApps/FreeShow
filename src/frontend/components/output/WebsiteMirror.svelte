<script lang="ts">
    import { createEventDispatcher, onDestroy, onMount } from "svelte"
    import { uid } from "uid"
    import { OUTPUT } from "../../../types/Channels"
    import { Main } from "../../../types/IPC/Main"
    import { sendMain } from "../../IPC/main"
    import { playerVideos } from "../../stores"
    import { destroy, receive } from "../../utils/request"
    import { normalizeWebsiteUrl } from "../helpers/websiteControls"

    export let id: string
    export let fit = "contain"

    const dispatch = createEventDispatcher()
    const listenerId = "WEBSITE_MIRROR_" + uid()

    let canvas: HTMLCanvasElement
    let ctx: CanvasRenderingContext2D | null = null
    let drawing = false
    let loaded = false

    onMount(() => {
        ctx = canvas.getContext("2d")
        receive(OUTPUT, { WEBSITE_FRAME: receiveFrame }, listenerId)
        sendMain(Main.WEBSITE_CAPTURE, { id, action: "sync", url: normalizeWebsiteUrl($playerVideos[id]?.id || "") })
    })
    onDestroy(() => destroy(OUTPUT, listenerId))

    async function receiveFrame(data: { websiteId: string; frame: Uint8Array }) {
        if (data?.websiteId !== id || drawing || !ctx || !data.frame) return
        drawing = true

        try {
            const bitmap = await createImageBitmap(new Blob([data.frame as any], { type: "image/jpeg" }))
            if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
                canvas.width = bitmap.width
                canvas.height = bitmap.height
            }
            ctx.drawImage(bitmap, 0, 0)
            bitmap.close()

            if (!loaded) {
                loaded = true
                dispatch("loaded", true)
            }
        } catch (err) {
            console.error(err)
        }

        drawing = false
    }
</script>

<canvas class="media" bind:this={canvas} style="object-fit: {fit === 'blur' ? 'contain' : fit || 'contain'};" />

<style>
    canvas {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
    }
</style>
