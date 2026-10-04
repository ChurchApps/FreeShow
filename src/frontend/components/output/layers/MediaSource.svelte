<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { OUTPUT } from "../../../../types/Channels"
    import type { MediaStyle } from "../../../../types/Main"
    import { destroy, receive, send } from "../../../utils/request"
    import Video from "../../media/Video.svelte"

    // A media window (see MediaLayers.ts): decodes one background video once for every captured output that
    // shows it, drawn exactly as those outputs would draw it; the capture worker composites it under their pages.
    let source: { outputId: string; path: string; startAt?: number; mediaStyle: MediaStyle } | null = null

    receive(OUTPUT, { MEDIA_SOURCE: (data: typeof source) => (source = data) }, "MEDIA_SOURCE")
    onMount(() => send(OUTPUT, ["MEDIA_SOURCE_READY"]))
    onDestroy(() => destroy(OUTPUT, "MEDIA_SOURCE"))
</script>

<div class="source">
    {#if source}
        {#key source.path}
            <Video outputId={source.outputId} path={source.path} syncPath={source.path} startAt={source.startAt || 0} mediaStyle={source.mediaStyle} />
        {/key}
    {/if}
</div>

<style>
    .source {
        position: absolute;
        inset: 0;
        background: black;
        overflow: hidden;
    }
</style>
