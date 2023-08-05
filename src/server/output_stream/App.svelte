<script lang="ts">
    import { onMount } from "svelte"
    import Icon from "./helpers/Icon.svelte"
    import { io } from "socket.io-client"

    let socket = io()
    let imgElem: any
    
    socket.on("OUTPUT_STREAM", (msg) => {
        switch (msg.channel) {
            case "STREAM":
                if (!imgElem) return

                const base64 = msg.data?.base64
                imgElem.src = base64

                break
        }
    })

    let isFullscreen: boolean = false
    function toggleFullscreen() {
        var doc = window.document
        var docElem = doc.documentElement

        if (!doc.fullscreenElement) {
            docElem.requestFullscreen.call(docElem)
            isFullscreen = true
        } else {
            doc.exitFullscreen.call(doc)
            isFullscreen = false
        }
    }

    // screen stretch
    let screenWidth: number = 0
    let imgHeight = false

    onMount(checkSize)
    $: if (screenWidth) checkSize()
    function checkSize() {
        if (screenWidth < imgElem?.width) imgHeight = true
        else imgHeight = false
    }

    // show button
    let clicked: boolean = false
    let timeout: any = null
    function click() {
        clicked = true
        if (timeout) clearTimeout(timeout)

        timeout = setTimeout(() => {
            clicked = false
            timeout = null
        }, 2000)
    }
</script>

<svelte:window on:click={click} />

<div class="center" bind:offsetWidth={screenWidth}>
    <img class:imgHeight bind:this={imgElem} onerror="this.style.display='none'" />
</div>

{#if clicked}
    <button on:click={toggleFullscreen}>
        <Icon id={isFullscreen ? "exitFullscreen" : "fullscreen"} size={2.2} />
    </button>
{/if}

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
        /* background-color: var(--primary); */
        background-color: #000000;
        color: var(--text);
        /* transition: background-color 0.5s; */
        -webkit-tap-highlight-color: transparent;

        font-family: system-ui;
        font-size: 1.5em;

        height: 100svh;
        width: 100svw;

        overflow: hidden;
    }

    :root {
        --primary: #292c36;
        --primary-lighter: #363945;
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

    /* VIDEO */
    .center {
        display: flex;
        align-items: center;
        justify-content: center;

        width: 100%;
        height: 100%;
    }

    img {
        background-color: #000000;
        aspect-ratio: 16/9;
        /* width: 100%; */
        height: 100%;
        /* object-fit: contain; */
    }

    .imgHeight {
        height: initial;
        width: 100%;
    }

    /* fullscreen */
    button {
        position: absolute;
        right: 20px;
        bottom: 20px;
        width: 60px;
        height: 60px;
        
        display: flex;
        justify-content: center;
        align-items: center;

        background-color: white;
        padding: 10px;
        border-radius: 50%;
        border: 2px solid black;
    }
    button:hover, button:active {
        background-color: rgb(255 255 255 / 0.8);
    }
</style>
