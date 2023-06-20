<script lang="ts">
    import { activePopup, activeShow, labelsDisabled, mediaOptions, outputs, playerVideos } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import { findMatchingOut, setOutput } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Center from "../../system/Center.svelte"
    import SelectElem from "../../system/SelectElem.svelte"
    import Card from "../Card.svelte"

    export let active: any
    export let searchValue: string = ""

    $: videos = Object.entries($playerVideos)
        .map(([id, video]: any) => ({ rid: id, ...video }))
        .filter((a) => a.type === active)
        .sort((a: any, b: any) => a.name.localeCompare(b.name))

    // search
    $: if (videos || searchValue !== undefined) filterSearch()
    const filter = (s: string) => s.toLowerCase().replace(/[.,\/#!?$%\^&\*;:{}=\-_`~()]/g, "")
    let fullFilteredVideos: any[] = []
    function filterSearch() {
        fullFilteredVideos = JSON.parse(JSON.stringify(videos))
        if (searchValue.length > 1) fullFilteredVideos = fullFilteredVideos.filter((a) => filter(a.name).includes(searchValue))
    }

    let loaded: any = {}

    let nextScrollTimeout: any = null
    function wheel(e: any) {
        if (!e.ctrlKey && !e.metaKey) return
        if (nextScrollTimeout) return

        mediaOptions.set({ ...$mediaOptions, columns: Math.max(2, Math.min(10, $mediaOptions.columns + (e.deltaY < 0 ? -100 : 100) / 100)) })

        // don't start timeout if scrolling with mouse
        if (e.deltaY > 100 || e.deltaY < -100) return
        nextScrollTimeout = setTimeout(() => {
            nextScrollTimeout = null
        }, 500)
    }

    // thumbnail
    // https://stackoverflow.com/a/20542029
    // https://stackoverflow.com/a/61662687
    function getThumbnail(videoId: string) {
        if (!videoId) return ""

        if (active === "youtube") {
            return `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`
        }
        if (active === "vimeo") {
            return `https://vumbnail.com/${videoId}.jpg`
        }

        return ""
    }
</script>

<!-- TODO: loading -->
<div class="main">
    <div class="scroll">
        <div class="grid" on:wheel={wheel}>
            {#if fullFilteredVideos.length}
                {#each fullFilteredVideos as video}
                    <Card
                        loaded={loaded[video.rid]}
                        class="context #player_button"
                        preview={$activeShow?.id === video.rid}
                        active={findMatchingOut(video.rid, $outputs) !== null}
                        outlineColor={findMatchingOut(video.rid, $outputs)}
                        label={video.name || ""}
                        title={video.id || ""}
                        on:click={(e) => {
                            if (e.ctrlKey || e.metaKey) return
                            setOutput("background", { id: video.rid, type: "player" })
                        }}
                        on:dblclick={() => {
                            activeShow.set({ id: video.rid, type: "player" })
                        }}
                    >
                        <SelectElem id="player" data={video.rid} draggable>
                            <img src={getThumbnail(video.id)} style="width: 100%;height: 100%;aspect-ratio: 19/9;object-fit: cover;" on:load={() => (loaded[video.rid] = true)} />
                        </SelectElem>
                    </Card>
                {/each}
            {:else}
                <Center size={1.2} faded>
                    {#if videos.length}
                        <T id="empty.search" />
                    {:else}
                        <T id="empty.player" />
                    {/if}
                </Center>
            {/if}
        </div>
    </div>
    <div style="display: flex;background-color: var(--primary-darkest);">
        <Button style="width: 100%;" on:click={() => activePopup.set("player")} center>
            <Icon id="add" right={!$labelsDisabled} />
            {#if !$labelsDisabled}<T id="settings.add" />{/if}
        </Button>
    </div>
</div>

<!-- <iframe src={url} title="Web" frameborder="0" /> -->
<style>
    .main {
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        background-color: var(--primary-darker);
        flex: 1;
    }

    /* .main :global(iframe) {
    height: 100%;
    width: 100%;
    overflow: hidden;
  } */

    .grid {
        height: 100%;
        display: flex;
        flex-wrap: wrap;
        flex: 1;
        padding: 5px;
        place-content: flex-start;
    }

    .scroll :global(button) {
        padding: 10px;
        width: 100%;
        display: flex;
        justify-content: space-between;

        background-color: inherit;
        color: inherit;
        font-size: 0.9em;
        border: none;
        display: flex;
        align-items: center;
        padding: 0.2em 0.8em;
        transition: background-color 0.2s;
    }

    .scroll {
        overflow-y: auto;
        flex: 1;
    }

    /* .content {
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    background-color: var(--primary-darker);
    height: 100%;
  } */
</style>
