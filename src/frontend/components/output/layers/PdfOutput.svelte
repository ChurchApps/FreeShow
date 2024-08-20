<script lang="ts">
    export let slide
</script>

{#key slide.page}
    <iframe src="{slide.id}#toolbar=0&view=fit&page={slide.page}" class:hideScrollbar={slide.pages > 1} frameborder="0" scrolling="no"></iframe>
{/key}

<style>
    iframe {
        width: 100%;
        height: 100%;

        pointer-events: none;
    }

    iframe.hideScrollbar {
        /* do this to hide scrollbar until the url parameter to hide is supported */
        width: calc(100% + 18px);
    }
</style>
