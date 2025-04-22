<script lang="ts">
    import { selected } from "../../stores"
    import { DropAreas, ondrop, validateDrop } from "../helpers/drop"
    import { deselect } from "../helpers/select"
    import T from "../helpers/T.svelte"

    export let id: DropAreas
    export let selectChildren: boolean = false
    export let hoverTimeout: number = 500
    export let file: boolean = false
    let active: boolean = false
    let hover: boolean = false

    $: active = validateDrop(id, $selected.id)

    let count: number = 0
    function enter() {
        if (!active || !selectChildren) return

        count++
        setTimeout(() => {
            if (count > 0) hover = false
        }, hoverTimeout)
    }

    function leave(_e: any) {
        if (!active || !selectChildren) return

        count = Math.max(0, count - 1)
        setTimeout(() => {
            if (count === 0) hover = true
        }, 10)
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

    let fileOver: boolean = false

    function endDrag() {
        deselect()
        hover = false
        // fileOver = false
    }
</script>

<svelte:window on:click={() => (hover = false)} on:dragend={endDrag} on:dragstart={() => (hover = active)} />

<div
    class="droparea"
    class:hover
    on:drop|preventDefault={(e) => {
        let files = getFiles(e)
        if (files.length) selected.set({ id: "files", data: files })
        fileOver = false
        hover = false
        console.log($selected.id, "=>", id)

        if (validateDrop(id, $selected.id, true) || files.length) ondrop(e, id)
    }}
    on:dragover|preventDefault={(e) => {
        if (file && e.dataTransfer?.items[0]?.kind === "file") fileOver = true
    }}
    on:dragenter={enter}
    on:dragleave={leave}
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
        inset-inline-start: 0;
        display: flex;
        align-items: center;
        justify-content: center;

        /* Starting a drop area with many slides in e.g. overlays/templates drawer is very laggy when the content is
        smaller than the "Drop here" text (or invisible), because that creates a custom scrollbar. Here is the fix! */
        overflow: hidden;
    }
</style>
