<script lang="ts">
    import { onMount } from "svelte"
    //import { send } from "../../../utils/request"
    //import { OUTPUT } from "../../../../types/Channels"

    export let capture: any
    export let fullscreen: any = false
    export let disabled: any = false
    export let id: string = ""
    export let style: string = ""

    let webview: Electron.WebviewTag
    //let ctx: any
    let width: number = 0
    let height: number = 0

    /*
    function logWindowDetails() {
        //const apectRatio = (capture?.size?.width || 16) / (capture?.size?.height || 9)
        if (canvas) {
            const rect = canvas.getBoundingClientRect()
            const data = { id, width: Math.round(rect.width), height: Math.round(rect.height), x: Math.round(rect.left), y: Math.round(rect.top) }
            send(OUTPUT, ["PREVIEW_BOUNDS"], data)
        }
    }

    $: if (canvas || id) logWindowDetails()*/

    onMount(() => {
        if (!webview) return

        //ctx = iframe.getContext("2d")
        //webview.width = width //* 2.8
        //webview.height = height //* 2.8
        //console.log("SETTING HEIGHT TO", webview.height)

        /*
        window.addEventListener("resize", () => {
            logWindowDetails()
        })

        //TODO: Bind to canvas initialisation
        setTimeout(() => {
            logWindowDetails()
        }, 1000)

        send(OUTPUT, ["PREVIEW_RESOLUTION"], { id, size: { width: canvas.width, height: canvas.height } })*/
    })

    /*
    $: if (fullscreen !== "") setTimeout(updateResolution, 100)
    function updateResolution() {
        if (!iframe) return

        iframe.width = fullscreen ? width * 1.2 : width * 2.8
        iframe.height = fullscreen ? height * 1.2 : height * 2.8
        send(OUTPUT, ["PREVIEW_RESOLUTION"], { id, size: { width: iframe.width, height: iframe.height } })

        //if (capture) updateCanvas()
    }*/

    function sendData() {
        webview.send("STARTUP", { channel: "TYPE", data: "output" })

        setTimeout(() => {
            console.log("SETTING ALL OUTPUTS")
            webview.send("ALL_OUTPUTS", {
                channel: "ALL_OUTPUTS",
                data: {
                    default: {
                        enabled: true,
                        active: true,
                        name: "Primary",
                        color: "#F0008C",
                        bounds: {
                            x: 0,
                            y: 0,
                            width: 1920,
                            height: 1080,
                        },
                        screen: null,
                        kiosk: true,
                        style: "default",
                        show: {},
                        ndi: true,
                        out: {
                            transition: null,
                            slide: {
                                id: "35dbb62dae5",
                                layout: "51db998a895",
                                index: 0,
                                line: 0,
                            },
                        },
                    },
                },
            })
        }, 5000)
        setTimeout(() => {
            console.log("SENDING OUTPUT")
            webview.send("OUTPUTS", {
                channel: "OUTPUTS",
                data: {
                    default: {
                        enabled: true,
                        active: true,
                        name: "Primary",
                        color: "#F0008C",
                        bounds: {
                            x: 0,
                            y: 0,
                            width: 1920,
                            height: 1080,
                        },
                        screen: null,
                        kiosk: true,
                        style: "default",
                        show: {},
                        ndi: true,
                        out: {
                            transition: null,
                            slide: {
                                id: "35dbb62dae5",
                                layout: "51db998a895",
                                index: 0,
                                line: 0,
                            },
                        },
                    },
                },
            })
        }, 10000)
    }

    function loadWindowContent() {
        webview.addEventListener("did-finish-load", () => {
            console.log("Webview content has finished loading")
            sendData()
        })

        webview.src = "http://localhost:3000"

        //TODO: ADD ISPROD CHECK
        /*
        if (isProd) iframe.src = "public/index.html"
        else iframe.src = "http://localhost:3000"
        */
    }

    $: console.log("IFRAME IS", webview)
    console.log("MADE IT")
    $: if (id && webview) loadWindowContent()

    // TODO: render in real time this...
    /*
    $: if (iframe) updateCanvas()
    async function updateCanvas() {
        if (!iframe) return

        const arr = new Uint8ClampedArray(capture.buffer)
        const pixels = new ImageData(arr, capture.size.width, capture.size.height)
        const bitmap = await createImageBitmap(pixels)

        ctx.clearRect(0, 0, iframe.width, iframe.height)
        ctx.drawImage(bitmap, 0, 0, iframe.width, iframe.height)
    }*/
    //<canvas {id} style="aspect-ratio: {capture?.size?.width || 16}/{capture?.size?.height || 9};" class="previewCanvas" bind:this={canvas} />
</script>

<div class="center" class:fullscreen class:disabled {style} bind:offsetWidth={width} bind:offsetHeight={height}>
    <webview {id} style="aspect-ratio: {capture?.size?.width || 16}/{capture?.size?.height || 9};" class="previewCanvas" bind:this={webview} title="Preview" />
</div>

<style>
    .center {
        display: flex;
        align-items: center;
        justify-content: center;

        height: 100%;
        width: 100%;
    }
    .center.fullscreen webview {
        width: unset;
        height: 100%;
    }

    .center.disabled {
        opacity: 0.5;
    }

    webview {
        width: 100%;
        aspect-ratio: 16/9;
        background-color: black;
    }
</style>
