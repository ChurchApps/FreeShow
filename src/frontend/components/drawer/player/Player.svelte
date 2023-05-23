<script lang="ts">
    import { activePopup, activeShow, labelsDisabled, playerVideos } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import { findMatchingOut, setOutput } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import HiddenInput from "../../inputs/HiddenInput.svelte"
    import Center from "../../system/Center.svelte"
    import SelectElem from "../../system/SelectElem.svelte"

    export let active: any
    export let searchValue: string = ""

    function changeName(name: string, id: string) {
        playerVideos.update((a) => {
            a[id].name = name
            return a
        })
    }

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
</script>

<!-- TODO: loading -->
<div class="main">
    <div class="scroll">
        <div class="content" style="height: 100%;">
            {#if fullFilteredVideos.length}
                {#each fullFilteredVideos as video}
                    <SelectElem id="player" data={video.rid} draggable>
                        <Button
                            class="context #player_button"
                            on:click={(e) => {
                                if (e.ctrlKey || e.metaKey) return
                                activeShow.set({ id: video.rid, type: "player" })
                            }}
                            on:dblclick={() => setOutput("background", { id: video.rid, type: "player" })}
                            active={$activeShow?.id === video.rid}
                            outlineColor={findMatchingOut(video.rid)}
                            outline={findMatchingOut(video.rid) !== null}
                            bold={false}
                            border
                        >
                            <HiddenInput value={video.name || ""} id={"player_" + video.rid} on:edit={(e) => changeName(e.detail.value, video.rid)} />
                            <span style="opacity: 0.5;">{video.id}</span>
                        </Button>
                    </SelectElem>
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
