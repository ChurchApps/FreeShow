<script lang="ts">
    import { io } from "socket.io-client"
    import Icon from "./helpers/Icon.svelte"
    let socket = io()

    console.log(socket)

    // socket.on("connect", () => {
    //   id = socket.id
    // })

    function sendAction(id: string) {
        socket.emit("CONTROLLER", { channel: "ACTION", data: { id } })
    }

    let draw = false
    let mouseDown = false
    function mousedown() {
        mouseDown = true
    }
    function mouseup() {
        if (!mouseDown) return
        mouseDown = false

        socket.emit("CONTROLLER", {
            channel: "FOCUS",
            data: { offset: null },
        })
    }

    let padElem: any = null
    function mousemove(e: any) {
        if (!mouseDown) return

        var elemRect = padElem.getBoundingClientRect()
        var x = (e.pageX ?? e.targetTouches[0].pageX) - elemRect.left
        var y = (e.pageY ?? e.targetTouches[0].pageY) - elemRect.top

        let offset = { x: x / elemRect.width, y: y / elemRect.height }
        offset = {
            x: Math.max(0, Math.min(offset.x, 1)),
            y: Math.max(0, Math.min(offset.y, 1)),
        }

        socket.emit("CONTROLLER", {
            channel: "FOCUS",
            data: { offset, tool: tool.toLowerCase() },
        })
    }

    const tools: string[] = ["Focus", "Pointer", "Particles"]
    let tool = "Focus"
    function changeTool(e: any) {
        tool = e.target.value
    }
</script>

<svelte:window on:mouseup={mouseup} on:touchend={mouseup} on:mousemove={mousemove} on:touchmove={mousemove} />

{#if draw}
    <div class="draw">
        <select name="tools" on:change={changeTool}>
            {#each tools as tool}
                <option value={tool}>{tool}</option>
            {/each}
        </select>
        <div bind:this={padElem} class="pad" on:mousedown={mousedown} on:touchstart={mousedown} />
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
        <button class="center" on:click={() => sendAction("clear")}>
            <Icon id="clear" size={4} white />
        </button>
    </div>
{/if}

<div class="toggles">
    <button on:click={() => (draw = false)} style={draw ? "background-color: var(--primary-darker);" : ""}>
        <Icon id="pad" size={2.5} white={draw === true} />
    </button>
    <button on:click={() => (draw = true)} style={draw ? "" : "background-color: var(--primary-darker);"}>
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
        --primary: #2d313b;
        --primary-lighter: #41444c;
        --primary-darker: #202129;
        --primary-darkest: #191923;
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

    /* pad */
    .draw {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .pad {
        height: 80vw;
        width: 80vw;
        border-radius: 5px;
        background-color: var(--primary-darkest);
        touch-action: none;
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
        border-right: 5px solid var(--primary);
    }
    .quart:nth-child(1) :global(svg) {
        transform: translate(-40%);
    }
    .quart:nth-child(2) {
        top: 0;
        left: 50%;
        border-left: 5px solid var(--primary);
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
        left: 30%;
        border-radius: 50%;
        text-align: center;
        border: 10px solid var(--primary);
    }

    button {
        border: none;
        cursor: pointer;
        background-color: var(--primary-darkest);
    }
    button:active {
        background: var(--primary-lighter);
    }
</style>
