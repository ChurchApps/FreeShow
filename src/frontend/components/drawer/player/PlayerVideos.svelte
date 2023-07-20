<script lang="ts">
    import { activeShow, outputs, playerVideos } from "../../../stores"
    import { findMatchingOut, setOutput } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
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
