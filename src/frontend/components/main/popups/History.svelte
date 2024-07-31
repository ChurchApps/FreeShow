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
        // SAVE: "Saved",
        initial: "Initial state",
        // NEW
        // STAGE
        STAGE_SHOW: "Updated stage show",
        SHOWS: "Updated shows",
        SLIDES: "Updated slides",
        TEMPLATE: "Changed template",
        SHOW_LAYOUT: "Updated show layout",
        SHOW_ITEMS: "Updated show items",
        // UPDATE
        UPDATE_stage: "Updated stage show",
        UPDATE_project: "Updated project",
        UPDATE_project_folder: "Updated project folder",
        UPDATE_project_key: "Changed project",
        UPDATE_project_folder_key: "Changed project folder",
        UPDATE_project_ref: "Updated items in project",
        UPDATE_section: "Updated section in project",
        UPDATE_category_shows: "Updated shows category",
        UPDATE_category_overlays: "Updated overlays category",
        UPDATE_category_templates: "Updated templates category",
        UPDATE_category_media: "Updated media folder",
        UPDATE_category_audio: "Updated audio folder",
        UPDATE_overlay: "Updated overlay",
        UPDATE_overlay_items: "Updated overlay items",
        UPDATE_overlay_name: "Updated overlay name",
        UPDATE_overlay_color: "Updated overlay color",
        UPDATE_overlay_category: "Updated overlay category",
        UPDATE_template: "Updated template",
        UPDATE_template_items: "Updated template items",
        UPDATE_template_name: "Updated template name",
        UPDATE_template_color: "Updated template color",
        UPDATE_template_category: "Updated template category",
        UPDATE_template_settings: "Updated template settings",
        UPDATE_player_video: "Updated player video",
        UPDATE_event: "Updated event",
        UPDATE_stage_item_style: "Updated stage item style",
        UPDATE_stage_item_position: "Updated stage item position",
        UPDATE_stage_item_content: "Updated stage item content",
        UPDATE_show: "Updated show",
        UPDATE_show_layout: "Updated show layout",
        UPDATE_show_key: "Changed show",
        UPDATE_global_group: "Updated global group",
        UPDATE_tag: "Updated tag",
        UPDATE_settings_theme: "Updated settings: theme",
        UPDATE_settings_style: "Updated settings: style",
        UPDATE_settings_output: "Updated settings: output",
        // UPDATE_ ... (historyHelpers)

        // edit
        textStyle: "Updated text style",
        textAlign: "Updated text align",
        deleteItem: "Deleted item",
        setItems: "Changed item",
        setStyle: "Changed item style",
        slideStyle: "Changed slide style",

        slide: "Added slide",
        showMedia: "Added media to show",
        showAudio: "Added audio to show",
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

    function getItemId(item) {
        if (item.id === "UPDATE") return item.id + "_" + item.location?.id

        return item.id
    }
</script>

{#if rHistory.length || uHistory.length}
    {#each rHistory as item, i}
        {@const itemId = getItemId(item)}
        <Button on:click={() => callRedo(i)} style="opacity: 0.5;">
            <p>
                <span style={historyIdToString[itemId] ? "" : "opacity: 0.3;font-style: italic;"}>
                    {historyIdToString[itemId] || itemId}
                </span>
                <span class="time" title={getDateAndTimeString(item.time || 0)}>{timeAgo(item.time || 0)}</span>
            </p>
        </Button>
    {/each}
    {#each uHistory as item, i}
        {@const itemId = getItemId(item)}
        <Button on:click={() => callUndo(i - 1)} outline={i === 0}>
            <p>
                <span style={historyIdToString[itemId] ? "" : "opacity: 0.3;font-style: italic;"}>
                    {historyIdToString[itemId] || itemId}
                </span>
                <span class="time" title={getDateAndTimeString(item.time || 0)}>{timeAgo(item.time || 0)}</span>
            </p>
        </Button>
    {/each}

    <br />

    <Button on:click={clearHistory} center dark>
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
