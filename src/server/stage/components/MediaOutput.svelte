<script lang="ts">
    export let background: any
    $: path = background.path

    // let filter: string = ""
    // let flipped: boolean = false
    // let fit: MediaFit = "contain"
    // let speed: string = "1"

    // $: if (background !== null) updateFilter()
    // function updateFilter() {
    //     let temp: any = { ...background }
    //     filter = temp.filter || ""
    //     flipped = temp.flipped || false
    //     fit = temp.fit || "contain"
    //     speed = temp.speed || "1"
    // }
</script>

{#key path}
    <div style="height: 100%;">
        <!-- {filter} {flipped} {fit} -->
        <img src={path} />
    </div>
{/key}

<!-- {#if type === "media"}
    {#if getMediaType(getExtension(path)) === "video"}
        <Media {path} {transition} bind:video bind:videoData bind:videoTime {startAt} {mirror} {filter} {flipped} {fit} {speed} on:playing={playing} on:loaded={loaded} />
    {:else}
        {#key path}
            <div style="height: 100%;" transition:custom={transition}>
                <Image {path} {filter} {flipped} {fit} />
            </div>
        {/key}
    {/if}
{:else if type === "screen"}
    {#key id}
        <div transition:custom={transition} bind:clientWidth={width} bind:clientHeight={height}>
            <Window {id} class="media" style="{getStyleResolution({ width: video?.videoWidth || 0, height: video?.videoHeight || 0 }, width, height, 'cover')};" />
        </div>
    {/key}
{:else if type === "camera"}
    {#key id}
        <div transition:custom={transition} bind:clientWidth={width} bind:clientHeight={height}>
            <Camera {id} groupId={cameraGroup} class="media" style="{getStyleResolution({ width: video?.videoWidth || 0, height: video?.videoHeight || 0 }, width, height, 'cover')};" bind:videoElem={video} />
        </div>
    {/key}
{:else if type === "player"}
    {#key id}
        <div transition:custom={transition}>
            <Player {id} bind:videoData bind:videoTime bind:title {startAt} />
        </div>
    {/key}
{/if} -->

<style>
    div {
        /* position: relative; */
        position: absolute;
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    div :global(.media) {
        max-width: 100%;
        max-height: 100%;
    }

    img {
        height: 100%;
        width: 100%;
    }

    /* .overlay {
        position: absolute;
        width: 100%;
        height: 100%;
        background-color: transparent;
        z-index: 1;
    } */
</style>
