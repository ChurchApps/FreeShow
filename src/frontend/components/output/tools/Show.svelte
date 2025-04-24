<script lang="ts">
    import type { Output } from "../../../../types/Output"
    import type { LayoutRef } from "../../../../types/Show"
    import { activeFocus, activeShow, focusMode, presentationData, showsCache } from "../../../stores"
    import T from "../../helpers/T.svelte"

    export let currentOutput: Output
    export let ref: LayoutRef[] | { temp: boolean; items: any; id: string }[]
    export let linesIndex: null | number
    export let maxLines: null | number

    $: slide = currentOutput?.out?.slide

    $: name = slide?.name || $showsCache[slide?.id || ""]?.name || "—"
    $: length = ref?.length || 0

    function openShow() {
        if (!slide || slide.id === "temp") return

        if (slide?.layout && $showsCache[slide.id]) {
            showsCache.update((a) => {
                a[slide.id].settings.activeLayout = slide?.layout!
                return a
            })
        }

        if ($focusMode) activeFocus.set({ id: slide?.id, type: slide?.type || "show" })
        else activeShow.set({ id: slide?.id, type: slide?.type || "show" })
    }

    $: currentIndex = slide?.type === "ppt" ? $presentationData.stat?.position : (slide?.page || slide?.index || 0) + 1
    $: totalLength = slide?.type === "ppt" ? $presentationData.stat?.slides : slide?.pages || length
</script>

{#if slide}
    <span class="name" style="justify-content: space-between;" on:click={openShow}>
        <p>
            {#if name.length}
                {name}
            {:else}
                <T id="main.unnamed" />
            {/if}
        </p>
        {#if totalLength}
            <span style="opacity: 0.6;white-space: nowrap;">
                {currentIndex}/{totalLength}
                {#if linesIndex !== null && maxLines !== null}
                    <span style="opacity: 0.8;font-size: 0.8em;">({linesIndex + 1}/{maxLines})</span>
                {/if}
            </span>
        {/if}
    </span>
{/if}

<style>
    .name {
        display: flex;
        justify-content: center;
        padding: 5px 10px;
        opacity: 0.8;

        cursor: pointer;
    }

    .name:hover {
        background-color: var(--primary-darker);
    }
</style>
