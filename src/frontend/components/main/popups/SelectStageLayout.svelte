<script lang="ts">
    import { activePopup, popupData, stageShows } from "../../../stores"
    import { keysToID, sortByName } from "../../helpers/array"
    import T from "../../helpers/T.svelte"
    import StageSlide from "../../stage/StageSlide.svelte"
    import Center from "../../system/Center.svelte"
    import { triggerClickOnEnterSpace } from "../../../utils/clickable"

    let stageLayouts = sortByName(keysToID($stageShows))

    let active = $popupData.active || ""

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
</script>

<div style="position: relative;height: 100%;width: calc(100vw - (var(--navigation-width) + 20px) * 2);overflow-y: auto;">
    {#if stageLayouts.length}
        <div class="grid">
            {#each stageLayouts as layout}
                <div class="stageLayout" role="button" tabindex="0" on:click={() => select(layout.id)} on:keydown={triggerClickOnEnterSpace}>
                    <StageSlide id={layout.id} {layout} active={active === layout.id} selectable={false} />
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
