<script lang="ts">
    import { selected } from "../../stores"
    import { DropAreas, ondrop, validateDrop } from "../helpers/drop"
    import { deselect } from "../helpers/select"
    import T from "../helpers/T.svelte"

    export let id: DropAreas
    export let selectChildren = false
    export let hoverTimeout = 500
    export let file = false
    let active = false
    let hover = false

    $: active = validateDrop(id, $selected.id)

    let count = 0
    function enter() {
        if (!active || !selectChildren) return

        count++
        setTimeout(() => {
            if (count > 0) hover = false
        }, hoverTimeout)
    }

    function leave() {
        if (!active || !selectChildren) return

        count = Math.max(0, count - 1)
        setTimeout(() => {
            if (count === 0) hover = true
        }, 10)
    }

    async function dropEvent(e: any) {
        const files = getFiles(e)
        if (files.length) {
            const webMediaFiles = files.filter((file) => isWebMediaFile(file))
            if (webMediaFiles.length) {
                // convert web media files to base64
                const mediaData = await Promise.all(webMediaFiles.map((file) => fileToBase64(file)))
                selected.set({ id: "media", data: mediaData })
                ondrop(e, id)
                return
            }

            // Regular local files
            selected.set({ id: "files", data: files })
            ondrop(e, id)
            return
        }

        const urls = getUrls(e)
        if (urls.length) {
            selected.set({ id: "urls", data: urls })
            ondrop(e, id)
            return
        }

        fileOver = false
        hover = false
        console.log($selected.id, "=>", id)

        if (validateDrop(id, $selected.id, true)) ondrop(e, id)
    }

    function getFiles(e: any): any[] {
        let files: any[] = []

        // DataTransferItemList interface
        if (e.dataTransfer.items) {
            for (let i = 0; i < e.dataTransfer.items.length; i++) {
                // If dropped items aren't files, reject them
                if (e.dataTransfer.items[i].kind === "file") {
                    files.push(e.dataTransfer.items[i].getAsFile())
                }
            }

            return files
        }

        // DataTransfer interface
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
            files.push(e.dataTransfer.files[i])
        }

        return files
    }

    function getUrls(e: any): string[] {
        let urls: string[] = []

        // try to get any URL data
        const urlData = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain")
        if (!urlData) return []

        const lines = urlData.split("\n")
        for (const line of lines) {
            const trimmed = line.trim()
            if (trimmed && !trimmed.startsWith("#") && isValidUrl(trimmed)) urls.push(trimmed)
        }

        return urls
    }

    function isValidUrl(string: string): boolean {
        try {
            const url = new URL(string)
            return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "file:"
        } catch {
            return false
        }
    }

    function isWebMediaFile(file: File): boolean {
        const isMediaFile = file.type.startsWith("image/") || file.type.startsWith("video/") || file.type.startsWith("audio/")
        if (!isMediaFile) return false

        const isFromWeb =
            // Blob URLs are definitely from web
            file.name.includes("blob:") ||
            // Files with unusual extensions or no extensions (common for web files)
            !/\.\w{2,4}$/i.test(file.name) ||
            // Files with very recent modification times (within last few seconds) are likely from web
            Date.now() - file.lastModified < 5000 ||
            // Files with size 0 that aren't obviously empty file types
            (file.size === 0 && !file.name.endsWith(".txt"))

        return isFromWeb
    }

    async function fileToBase64(file: File): Promise<{ name: string; path: string }> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => {
                const result = reader.result as string
                resolve({ name: file.name, path: result })
            }
            reader.onerror = reject
            reader.readAsDataURL(file)
        })
    }

    let fileOver = false

    function endDrag() {
        deselect()
        hover = false
        // fileOver = false
    }

    // TOUCH SCREEN

    function onTouchStart() {
        hover = true
    }

    function onTouchEnd(e: TouchEvent) {
        if (hover && active) {
            // simulate a drop event
            ondrop(e, id)
        }
        hover = false
    }
</script>

<svelte:window on:click={() => (hover = false)} on:dragend={endDrag} on:dragstart={() => (hover = active)} />

<div
    class="droparea"
    class:hover
    on:drop|preventDefault={dropEvent}
    on:dragover|preventDefault={(e) => {
        if (file && e.dataTransfer?.items[0]?.kind === "file") fileOver = true
    }}
    on:dragenter={enter}
    on:dragleave={leave}
    on:touchstart={onTouchStart}
    on:touchend={onTouchEnd}
>
    <span class="ParentBlock">
        <slot {fileOver} />
    </span>
</div>
{#if hover}
    <span class="text">
        <T id="main.drop" />
    </span>
{/if}

<style>
    .droparea {
        flex: 1;
        height: 100%;
        width: 100%;
        align-self: flex-start;
        transition: 0.3s opacity;
        position: relative;
        overflow: auto;
    }
    .droparea.hover {
        opacity: 0.3;
        background-color: rgb(0 0 0 / 0.4);
    }
    .droparea.hover span {
        pointer-events: none;
    }

    .text {
        pointer-events: none;
        height: 100%;
        width: 100%;
        position: absolute;
        top: 0;
        left: 0;
        display: flex;
        align-items: center;
        justify-content: center;

        /* Starting a drop area with many slides in e.g. overlays/templates drawer is very laggy when the content is
        smaller than the "Drop here" text (or invisible), because that creates a custom scrollbar. Here is the fix! */
        overflow: hidden;
    }
</style>
