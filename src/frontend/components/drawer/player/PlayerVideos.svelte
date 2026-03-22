<script lang="ts">
    import type { Category } from "../../../../types/Tabs"
    import { activeFocus, activePlayerTagFilter, activeShow, focusMode, outLocked, outputs, playerTags, playerVideos } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { clone, sortByName } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import { findMatchingOut, setOutput } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import { clearBackground, clearSlide } from "../../output/clear"
    import Center from "../../system/Center.svelte"
    import SelectElem from "../../system/SelectElem.svelte"
    import Card from "../Card.svelte"

    export let active: string
    export let searchValue = ""

    $: videos = sortByName(
        Object.entries($playerVideos)
            .map(([id, video]) => ({ rid: id, ...video }))
            .filter((a) => a.type === active)
    )

    // search
    $: if (videos || searchValue !== undefined || $activePlayerTagFilter) filterSearch()
    const filter = (s: string) => s.toLowerCase().replace(/[.,\/#!?$%\^&\*;:{}=\-_`~()]/g, "")
    let fullFilteredVideos: (Category & { rid: string })[] = []
    function filterSearch() {
        fullFilteredVideos = clone(videos)

        // filter by tag
        if ($activePlayerTagFilter.length) {
            fullFilteredVideos = fullFilteredVideos.filter((a) => a.tags?.length && !$activePlayerTagFilter.find((tagId) => !a.tags!.includes(tagId)))
        }

        if (searchValue.length > 1) fullFilteredVideos = fullFilteredVideos.filter((a) => filter(a.name).includes(searchValue))
    }

    let loaded: { [key: string]: boolean } = {}

    // thumbnail
    // https://stackoverflow.com/a/20542029
    // https://stackoverflow.com/a/61662687
    function getThumbnail(videoId: string) {
        if (!videoId) return ""

        if (active === "youtube") {
            return `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`
        }
        if (active === "vimeo") {
            return `https://vumbnail.com/${videoId}_medium.jpg`
        }

        return ""
    }

    let iconClicked: NodeJS.Timeout | null = null
    function removeStyle(key: string, id: string | undefined) {
        if (!id) return
        iconClicked = setTimeout(() => (iconClicked = null), 50)

        playerVideos.update((a) => {
            if (!a[id]) return a

            if (key === "tags") {
                a[id].tags = []
            }

            return a
        })
    }
</script>

{#if fullFilteredVideos.length}
    {#each fullFilteredVideos as video}
        {@const tags = video.tags || []}

        <Card
            loaded={loaded[video.rid]}
            class="context #player_button"
            preview={$activeShow?.id === video.rid}
            active={findMatchingOut(video.rid, $outputs) !== null}
            outlineColor={findMatchingOut(video.rid, $outputs)}
            label={video.name || ""}
            renameId="player_{video.rid}"
            title={video.id || ""}
            showPlayOnHover
            on:click={(e) => {
                if ($outLocked || e.ctrlKey || e.metaKey || iconClicked) return
                if (e.target?.closest(".edit")) return

                if (findMatchingOut(video.rid, $outputs)) {
                    clearBackground()
                    return
                }

                // set as "foreground" type (clear slide & ignore "background" layer)
                clearSlide()
                setOutput("background", { id: video.rid, type: "player", muted: false, loop: false, startAt: 0, ignoreLayer: true })
            }}
            on:dblclick={() => {
                if (iconClicked) return
                if ($focusMode) activeFocus.set({ id: video.rid, type: "player" })
                else activeShow.set({ id: video.rid, type: "player" })
            }}
        >
            <!-- icons -->
            <div class="icons">
                {#if tags.length}
                    <div style="max-width: 100%;">
                        <div class="button">
                            <Button style="padding: 3px;" redHover title={translateText("actions.remove")} on:click={() => removeStyle("tags", video.rid)}>
                                <Icon id="tag" size={0.9} white />
                            </Button>
                        </div>
                        <span style="max-width: 100%;">
                            <p>{tags.length === 1 ? $playerTags[tags[0]]?.name || "—" : tags.length}</p>
                        </span>
                    </div>
                {/if}
            </div>

            <SelectElem id="player" data={video.rid} style="width: 100%;" draggable>
                <img src={getThumbnail(video.id || "")} alt="Video thumbnail for {video.name || 'video'}" style="width: 100%;height: 100%;aspect-ratio: 19/9;object-fit: cover;" on:load={() => (loaded[video.rid] = true)} />
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

<style>
    /* icons */

    .icons {
        pointer-events: none;
        display: flex;
        flex-direction: column;
        position: absolute;
        left: 0;
        z-index: 1;
        font-size: 0.9em;

        height: 80%;
        flex-wrap: wrap;

        max-width: calc(100% - 21px);
    }
    .icons div {
        opacity: 0.9;
        display: flex;
    }
    .icons .button {
        background-color: rgb(0 0 0 / 0.6);
        pointer-events: all;
    }
    .icons span {
        pointer-events: all;
        background-color: rgb(0 0 0 / 0.6);
        padding: 3px;
        font-size: 0.75em;
        font-weight: bold;
        display: flex;
        align-items: center;
    }
</style>
