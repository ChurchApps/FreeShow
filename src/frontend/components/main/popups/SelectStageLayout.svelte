<script lang="ts">
    import { onDestroy } from "svelte"
    import { activePage, activePopup, currentOutputSettings, popupData, stageShows } from "../../../stores"
    import { keysToID, sortByName } from "../../helpers/array"
    import T from "../../helpers/T.svelte"
    import SkeletonStageSlide from "../../stage/SkeletonStageSlide.svelte"
    import StageSlide from "../../stage/StageSlide.svelte"
    import Center from "../../system/Center.svelte"
    import { triggerClickOnEnterSpace } from "../../../utils/clickable"
    import { getAccess } from "../../../utils/profile"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import { uid } from "uid"
    import { history } from "../../helpers/history"

    const profile = getAccess("stage")

    let stageLayouts = sortByName(keysToID($stageShows)).filter((a) => profile[a.id] !== "none" && Object.values($stageShows[a.id]?.items).some((a) => a.currentOutput?.source !== $currentOutputSettings))

    let active = $popupData.active || ""

    // lazy loader
    let lazyLoader = 0
    let timeout: NodeJS.Timeout | null = null
    let loaded = false

    onDestroy(() => {
        if (timeout) clearTimeout(timeout)
    })

    $: if (!loaded && stageLayouts?.length) {
        if (lazyLoader >= stageLayouts.length) {
            loaded = true
        } else {
            if (timeout) clearTimeout(timeout)
            timeout = setTimeout(() => {
                const batch = lazyLoader === 0 ? 2 : Math.min(16, lazyLoader * 2)
                lazyLoader += batch
            }, lazyLoader === 0 ? 80 : 40)
        }
    }

    function select(selectedId: string) {
        active = selectedId

        if ($popupData.trigger) {
            $popupData.trigger(selectedId)
        }

        popupData.set({ id: "select_stage_layout", value: selectedId })

        setTimeout(() => {
            setTimeout(() => popupData.set({}), 500) // reset after closing
            activePopup.set(null)
        })
    }

    function createNew() {
        const layoutId = uid()
        history({ id: "UPDATE", oldData: { id: layoutId }, location: { page: "stage", id: "stage" } })
        select(layoutId)
        activePage.set("stage")
    }
</script>

<MaterialButton class="popup-options" icon="add" iconSize={1.3} title="new.style" on:click={createNew} white />

<div style="position: relative;height: 100%;width: calc(100vw - (var(--navigation-width) + 20px) * 2);overflow-y: auto;">
    {#if stageLayouts.length}
        <div class="grid">
            {#each stageLayouts as layout, i (layout.id)}
                <div class="stageLayout" role="button" tabindex="0" on:click={() => select(layout.id)} on:keydown={triggerClickOnEnterSpace}>
                    {#if loaded || i < lazyLoader}
                        <StageSlide id={layout.id} {layout} active={active === layout.id} selectable={false} />
                    {:else}
                        <SkeletonStageSlide {layout} active={active === layout.id} />
                    {/if}
                </div>
            {/each}
        </div>
    {:else}
        <Center size={1.2} faded style="height: 100px;padding-top: 20px;">
            <T id="empty.general" />
        </Center>
    {/if}
</div>

<style>
    .grid {
        display: flex;
        flex-wrap: wrap;
        flex: 1;
        padding: 5px;
        place-content: flex-start;
    }

    .stageLayout {
        width: 25%;
        cursor: pointer;
    }
    .stageLayout:focus {
        outline: 2px solid var(--secondary);
        outline-offset: 2px;
    }
</style>
