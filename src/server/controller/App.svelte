<script lang="ts">
    import { io } from "socket.io-client"
    import Icon from "../common/components/Icon.svelte"

    let socket = io()

    console.log(socket)

    let outputId: string = ""

    socket.on("connect", () => {
        // id = socket.id
        socket.emit("CONTROLLER", { channel: "GET_OUTPUT_ID" })
    })

    let aspectRatio = 16 / 9
    let thumbnailBackground: string = ""

    socket.on("CONTROLLER", (msg) => {
        if (msg.channel !== "OUTPUT_FRAME") console.log("MESSAGE:", msg)
        switch (msg.channel) {
            case "OUTPUT_FRAME":
                thumbnailBackground = msg.data.frame || ""
                if (msg.data.width && msg.data.height) aspectRatio = msg.data.width / msg.data.height
                frameReceived = true
                break
            case "GET_OUTPUT_ID":
                outputId = msg.data
                break
        }
    })

    let thumbnailInterval: any = null
    let frameReceived = true
    $: if (draw) thumbnailInterval = setInterval(requestThumbnail, 800)
    else if (thumbnailInterval) clearInterval(thumbnailInterval)
    function requestThumbnail() {
        if (!outputId || !frameReceived) return
        frameReceived = false
        socket.emit("CONTROLLER", { channel: "OUTPUT_FRAME", data: { outputId } })
    }

    function sendAction(id: string) {
        socket.emit("CONTROLLER", { channel: "ACTION", data: { id } })

        if (justCleared) {
            clearTimeout(justCleared)
            justCleared = null
        } else if (id === "clear") {
            justCleared = setTimeout(() => (justCleared = null), 2000)
        }
    }

    let justCleared: any = null

    let draw = false
    let mouseDown = false
    function mousedown() {
        mouseDown = true
    }
    function mouseup() {
        if (!mouseDown) return
        mouseDown = false

        let data: any = { offset: null }
        if (tool === "Zoom") data.tool = null

        socket.emit("CONTROLLER", {
            channel: "FOCUS",
            data
        })
    }

    let padElem: HTMLElement | undefined
    function mousemove(e: any) {
        if (!mouseDown || !padElem) return

        var elemRect = padElem.getBoundingClientRect()
        var x = (e.pageX ?? e.targetTouches[0].pageX) - elemRect.left
        var y = (e.pageY ?? e.targetTouches[0].pageY) - elemRect.top

        let offset = { x: x / elemRect.width, y: y / elemRect.height }
        offset = {
            x: Math.max(0, Math.min(offset.x, 1)),
            y: Math.max(0, Math.min(offset.y, 1))
        }

        socket.emit("CONTROLLER", {
            channel: "FOCUS",
            data: { offset, tool: tool.toLowerCase() }
        })
    }

    const tools: string[] = ["Focus", "Pointer", "Zoom", "Particles", "Paint"]
    let tool = "Focus"
    function changeTool(e: any) {
        tool = e.target.value
    }

    // keyboard shortcuts
    function keydown(e: KeyboardEvent) {
        if ([" ", "Arrow", "Page"].includes(e.key)) e.preventDefault()

        if ([" ", "ArrowRight", "PageDown"].includes(e.key)) sendAction("next")
        else if (["ArrowLeft", "PageUp"].includes(e.key)) sendAction("previous")
        else if (e.key === "Escape") sendAction("clear")
    }
</script>

<svelte:window on:keydown={keydown} on:mouseup={mouseup} on:touchend={mouseup} on:mousemove={mousemove} on:touchmove={mousemove} />

{#if draw}
    <div class="draw">
        <select name="tools" value={tool} on:change={changeTool}>
            {#each tools as toolKey}
                <option value={toolKey}>{toolKey}</option>
            {/each}
        </select>

        <div bind:this={padElem} class="pad" style="aspect-ratio: {thumbnailBackground ? aspectRatio : 1};" on:mousedown={mousedown} on:touchstart={mousedown}>
            {#if thumbnailBackground}
                <div class="thumbnail">
                    <!-- object-fit: {thumbnailBackground.mediaStyle?.fit || 'contain'}; -->
                    <img src={thumbnailBackground} alt="" style="width: 100%;height: 100%;object-fit: fill;opacity: 0.5;" />
                </div>
            {/if}
        </div>

        {#if tool === "Paint"}
            <button on:click={() => sendAction("clear_painting")} title="Clear painting">
                <Icon id="clear" size={2} white right />
            </button>
        {/if}
    </div>
{:else}
    <div class="controller">
        <button class="quart" on:click={() => sendAction("previous")}>
            <Icon id="previous" size={4} />
        </button>
        <button class="quart" on:click={() => sendAction("next")}>
            <Icon id="next" size={4} />
        </button>
        <!-- <button class="quart" />
  <button class="quart" /> -->
        <button class="center" class:red={justCleared} on:click={() => sendAction("clear")}>
            <Icon id="clear" size={4} white />
            <!-- <Icon id={justCleared ? "clear" : "slide"} size={4} white /> -->
        </button>
    </div>
{/if}

<div class="toggles">
    <button on:click={() => (draw = false)} class="noright" style={draw ? "background-color: var(--primary-darker);" : ""}>
        <Icon id="pad" size={2.5} white={draw === true} />
    </button>
    <button on:click={() => (draw = true)} class="noleft" style={draw ? "" : "background-color: var(--primary-darker);"}>
        <Icon id="draw" size={2.5} white={draw === false} />
    </button>
</div>

<style>
    :global(*) {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
        user-select: none;

        outline-offset: -4px;
        outline-color: var(--secondary);
    }

    :global(html) {
        height: 100%;
    }

    :global(body) {
        background-color: var(--primary);
        color: var(--text);
        /* transition: background-color 0.5s; */
        -webkit-tap-highlight-color: transparent;

        font-family: system-ui;
        font-size: 1.5em;

        height: 100%;
        /* width: 100vw;
  height: 100vh; */
    }

    :root {
        --primary: #242832;
        --primary-lighter: #2f3542;
        --primary-darker: #191923;
        --primary-darkest: #12121c;
        --text: #f0f0ff;
        --textInvert: #131313;
        --secondary: #f0008c;
        --secondary-opacity: rgba(240, 0, 140, 0.5);
        --secondary-text: #f0f0ff;

        --hover: rgb(255 255 255 / 0.05);
        --focus: rgb(255 255 255 / 0.1);
        /* --active: rgb(230 52 156 / .8); */

        /* --navigation-width: 18vw; */
        --navigation-width: 300px;
    }

    :global(svg.white) {
        fill: var(--text) !important;
    }

    /* toggle */
    .toggles {
        position: absolute;
        bottom: 50px;
        left: 50%;
        transform: translateX(-50%);
        width: 80vw;
        display: flex;
        /* gap: 10px; */
    }
    .toggles button,
    select {
        padding: 10px;
        color: var(--text);
        width: 100%;
        text-transform: uppercase;
        font-size: 0.8em;
        border-radius: 5px;
        display: flex;
        justify-content: center;
    }
    select {
        width: 80vw;
        background-color: var(--primary-darkest);
        border: none;
        text-align: center;
        font-weight: bold;
    }

    .toggles .noleft {
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
    }
    .toggles .noright {
        border-top-right-radius: 0;
        border-bottom-right-radius: 0;
    }

    /* pad */
    .draw {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
    }

    .pad {
        height: 55vw;
        /* width: 80vw; */
        border-radius: 5px;
        background-color: var(--primary-darkest);
        touch-action: none;
        align-self: center;

        position: relative;
    }

    .thumbnail {
        pointer-events: none;
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
    }

    /* controller */
    .controller {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        /* transform: translate(-50%, -50%) rotate(45deg); */

        height: 80vw;
        width: 80vw;
        border-radius: 50%;
        overflow: hidden;
    }

    @media only screen and (min-width: 800px) {
        .controller {
            height: 70vh;
            width: 70vh;
        }
    }
    @media only screen and (min-width: 620px) {
        .pad {
            height: 55vh;
            /* width: 55vh; */
        }
    }
    /* (orientation: landscape) */
    @media (min-width: 600px) and (max-height: 700px) {
        .controller {
            top: 45%;
            height: 70vh;
            width: 70vh;
        }
        .draw {
            top: 45%;
        }
        .pad {
            height: 45vh;
            /* width: 65vh; */
        }
        .toggles {
            bottom: 20px;
            height: 30px;
            width: 60vw;
        }
        .toggles :global(svg) {
            height: 1.5rem;
        }
    }

    .quart {
        position: absolute;
        /* height: 50%; */
        height: 100%;
        width: 50%;
        /* transition: all 0.4s; */
    }
    .quart:nth-child(1) {
        top: 0;
        left: 0;
        border-inline-end: 5px solid var(--primary);
    }
    .quart:nth-child(1) :global(svg) {
        transform: translate(-40%);
    }
    .quart:nth-child(2) {
        top: 0;
        left: 50%;
        border-inline-start: 5px solid var(--primary);
    }
    .quart:nth-child(2) :global(svg) {
        transform: translate(40%);
    }
    /* .quart:nth-child(3) {
    top: 50%;
    left: 0;
  }
  .quart:nth-child(4) {
    top: 50%;
    left: 50%;
  } */
    .center {
        height: 40%;
        width: 40%;
        position: absolute;
        top: 30%;
        inset-inline-start: 30%;
        border-radius: 50%;
        text-align: center;
        border: 10px solid var(--primary);
    }

    button {
        display: flex;
        align-items: center;
        justify-content: center;

        border: none;
        cursor: pointer;
        padding: 5px;
        border-radius: 5px;
        background-color: var(--primary-darkest);

        transition: background-color 0.1s;
    }
    button:active {
        background: var(--primary-lighter);
    }

    button.red {
        background-color: #4d0d15;
    }
</style>
