<script lang="ts">
    import { dictionary, mediaOptions, outLocked, outputs, overlayCategories, overlays } from "../../stores"
    import { history } from "../helpers/history"
    import Icon from "../helpers/Icon.svelte"
    import { findMatchingOut, getResolution, setOutput } from "../helpers/output"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"
    import Textbox from "../slide/Textbox.svelte"
    import Zoomed from "../slide/Zoomed.svelte"
    import Center from "../system/Center.svelte"
    import DropArea from "../system/DropArea.svelte"
    import SelectElem from "../system/SelectElem.svelte"
    import Card from "./Card.svelte"

    export let active: string | null
    export let searchValue: string = ""

    $: resolution = getResolution(null, $outputs)

    let filteredOverlays: any[] = []
    $: filteredOverlays = Object.keys($overlays)
        .map((id) => ({ id, ...$overlays[id] }))
        .filter((s: any) => active === "all" || active === s.category || (active === "unlabeled" && (s.category === null || !$overlayCategories[s.category])))
        .sort((a, b) => a.name.localeCompare(b.name))

    // search
    $: if (filteredOverlays || searchValue !== undefined) filterSearch()
    const filter = (s: string) => s.toLowerCase().replace(/[.,\/#!?$%\^&\*;:{}=\-_`~()]/g, "")
    let fullFilteredOverlays: any[] = []
    function filterSearch() {
        fullFilteredOverlays = JSON.parse(JSON.stringify(filteredOverlays))
        if (searchValue.length > 1) fullFilteredOverlays = fullFilteredOverlays.filter((a) => filter(a.name).includes(searchValue))
    }

    function wheel(e: any) {
        if (e.ctrlKey || e.metaKey) mediaOptions.set({ ...$mediaOptions, columns: Math.max(2, Math.min(10, $mediaOptions.columns + (e.deltaY < 0 ? -100 : 100) / 100)) })
    }
</script>

<div style="position: relative;height: 100%;overflow-y: auto;" on:wheel={wheel}>
    <DropArea id="overlays">
        {#if fullFilteredOverlays.length}
            <div class="grid">
                {#each fullFilteredOverlays as overlay}
                    <Card
                        class="context #overlay_card"
                        outlineColor={findMatchingOut(overlay.id, $outputs)}
                        active={findMatchingOut(overlay.id, $outputs) !== null}
                        label={overlay.name || "—"}
                        color={overlay.color}
                        icon={overlay.locked ? "locked" : null}
                        {resolution}
                        on:click={(e) => {
                            if (!$outLocked && !e.ctrlKey && !e.metaKey) setOutput("overlays", overlay.id, true)
                        }}
                    >
                        <SelectElem id="overlay" data={overlay.id} fill draggable>
                            <Zoomed {resolution} background={overlay.items.length ? "black" : "transparent"}>
                                {#each overlay.items as item}
                                    <Textbox {item} ref={{ type: "overlay", id: overlay.id }} />
                                {/each}
                            </Zoomed>
                        </SelectElem>
                    </Card>
                {/each}
            </div>
        {:else}
            <Center size={1.2} faded>
                {#if filteredOverlays.length}
                    <T id="empty.search" />
                {:else}
                    <T id="empty.general" />
                {/if}
            </Center>
        {/if}
    </DropArea>
</div>
<div class="tabs">
    <Button
        style="flex: 1;"
        on:click={() => {
            history({ id: "UPDATE", location: { page: "drawer", id: "overlay" } })
        }}
        center
        title={$dictionary.new?.overlay}
    >
        <Icon id="overlays" right />
        <span style="color: var(--secondary);">
            <T id="new.overlay" />
        </span>
    </Button>
</div>

<style>
    .grid {
        display: flex;
        flex-wrap: wrap;
        flex: 1;
        padding: 5px;
        place-content: flex-start;
    }

    .grid :global(.isSelected) {
        outline: 5px solid var(--secondary-text);
    }

    .tabs {
        display: flex;
        background-color: var(--primary-darkest);
    }
</style>
