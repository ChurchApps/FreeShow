<script lang="ts">
    import { redoHistory, undoHistory } from "../../../stores"
    import { redo, undo } from "../../helpers/history"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { getDateAndTimeString, timeAgo } from "../../helpers/time"
    import Button from "../../inputs/Button.svelte"
    import Center from "../../system/Center.svelte"

    const INITIAL: any = { id: "initial", time: 0 }

    $: rHistory = [...$redoHistory]
    $: uHistory = [INITIAL, ...$undoHistory].reverse()

    const historyIdToString = {
        SAVE: "Saved",
        initial: "Initial state",
        // NEW
        // STAGE
        STAGE_SHOW: "Updated stage show",
        SHOWS: "Updated shows",
        SLIDES: "Updated slides",
        // UPDATE
        UPDATE_stage: "Updated stage show",
        UPDATE_category_shows: "Updated shows category",
        UPDATE_category_overlays: "Updated overlays category",
        UPDATE_category_templates: "Updated templates category",
        UPDATE_folder_media: "Updated media folder",
        UPDATE_folder_audio: "Updated audio folder",
        UPDATE_overlay: "Updated overlay",
        UPDATE_template: "Updated template",
        // UPDATE_ ... (historyHelpers)

        // edit
        textStyle: "Updated text style",
        textAlign: "Updated text align",
        deleteItem: "Deleted item",
        setItems: "Changed item",
        setStyle: "Changed item style",
        slideStyle: "Changed slide style",
        // stage
        stageItemAlign: "Changed stage item align",
        stageItemStyle: "Changed stage item style",
        // new
        newProject: "Added project",
        newFolder: "Added folder in project",
        newSection: "Added section in project",
        newShow: "Created show",
        newSlide: "Added slide",
        newItem: "Added item",
        // delete
        deleteFolder: "Deleted project folder",
        deleteProject: "Deleted project",
        removeSlides: "Removed slide(s)",
        deleteSlides: "Deleted slide(s)",
        deleteGroups: "Deleted slide group(s)",
        deletePlayerVideo: "Deleted player video",
        deleteLayout: "Deleted layout",
        // add
        addShowToProject: "Added show to project",
        addLayout: "Added new layout",
        // show
        deleteShow: "Deleted show",
        updateShow: "Updated show",
        slide: "Added slide",
        changeSlide: "Changed slide",
        showMedia: "Added media to show",
        showAudio: "Added audio to show",
        changeLayoutsSlides: "Changed layout slides",
        changeLayoutKey: "Changed layout key",
        changeLayout: "Changed layout",
        changeLayouts: "Changed layouts",
        // project
        updateProject: "Changed project",
        updateProjectFolder: "Updated project folder",
        // other
        slideToOverlay: "Cloned slide to overlay",
        newEvent: "Created event",
        deleteEvent: "Deleted event",
        template: "Changed show template",
        // settings
        theme: "Changed theme",
        addTheme: "Added theme",
        addGlobalGroup: "Added global group",
    }

    function callUndo(index) {
        for (let i = 0; i <= index; i++) {
            setTimeout(() => {
                undo()
            }, i * 300)
        }
    }

    function callRedo(index) {
        for (let i = rHistory.length - 1; i >= index; i--) {
            setTimeout(() => {
                redo()
            }, i * 300)
        }
    }

    function clearHistory() {
        undoHistory.set([])
        redoHistory.set([])
    }
</script>

{#if rHistory.length || uHistory.length}
    {#each rHistory as item, i}
        <Button on:click={() => callRedo(i)} style="opacity: 0.5;">
            <p>
                <span>
                    {#if item.id === "SAVE"}<Icon id="save" />{/if}
                    {historyIdToString[item.id === "UPDATE" ? item.id + "_" + item.location?.id : item.id] || item.id}
                </span>
                <!-- TODO: get clock as well: -->
                <span class="time" title={getDateAndTimeString(item.time || 0)}>{timeAgo(item.time || 0)}</span>
            </p>
        </Button>
    {/each}
    {#each uHistory as item, i}
        <Button on:click={() => callUndo(i - 1)} outline={i === 0}>
            <p>
                <span>
                    {#if item.id === "SAVE"}<Icon id="save" />{/if}
                    {historyIdToString[item.id === "UPDATE" ? item.id + "_" + item.location?.id : item.id] || item.id}
                </span>
                <span class="time" title={getDateAndTimeString(item.time || 0)}>{timeAgo(item.time || 0)}</span>
            </p>
        </Button>
    {/each}

    <br />

    <Button on:click={clearHistory} center>
        <Icon id="delete" right />
        <T id="actions.clear_history" />
    </Button>
    <!-- <div>
        <p>Delete oldest automaticly when more than</p>
        <NumberInput value={$historyCacheCount} on:change={(e) => historyCacheCount.set(e.detail)} buttons={false} />
    </div> -->
{:else}
    <Center>
        <T id="empty.general" />
    </Center>
{/if}

<style>
    p {
        width: 100%;
        display: flex;
        justify-content: space-between;
    }

    span {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    p .time {
        opacity: 0.8;
        font-size: 0.8em;
        font-style: italic;
    }
</style>
