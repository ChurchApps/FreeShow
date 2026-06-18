<script lang="ts">
    import { actions, actionTags, activeActionTagFilter, activePopup, labelsDisabled, popupData, runningActions, special, timelineRecordingAction } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { getAccess } from "../../../utils/profile"
    import { getActionIcon, runAction } from "../../actions/actions"
    import { customActionActivations } from "../../actions/customActivation"
    import { convertOldMidiToNewAction, midiToNote, receivedMidi } from "../../actions/midi"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { keysToID, sortByName } from "../../helpers/array"
    import FloatingInputs from "../../input/FloatingInputs.svelte"
    import Button from "../../inputs/Button.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import Center from "../../system/Center.svelte"
    import SelectElem from "../../system/SelectElem.svelte"

    export let searchValue

    const profile = getAccess("actions")
    const readOnly = profile.global === "read"

    function newAction() {
        popupData.set({})
        activePopup.set("action")
    }

    $: sortedActions = sortByName(keysToID($actions), "name", true).map(convertOldMidiToNewAction)
    $: filteredActionsTags = sortedActions.filter((a) => !$activeActionTagFilter.length || (a.tags?.length && !$activeActionTagFilter.some((tagId) => !a.tags?.includes(tagId)))).filter((a) => !a.tags?.some((tagId) => profile[tagId] === "none"))
    $: filteredActionsSearch = searchValue.length > 1 ? filteredActionsTags.filter((a) => a.name.toLowerCase().includes(searchValue.toLowerCase())) : filteredActionsTags

    // GRID VIEW

    $: gridCentered = filteredActionsSearch.length > 0 && filteredActionsSearch.length <= 12

    let showGrid = false
    $: if ($activeActionTagFilter) shouldShowGrid()
    function shouldShowGrid() {
        if ($activeActionTagFilter.length !== 1) {
            showGrid = false
            return
        }

        const tagId = $activeActionTagFilter[0]
        const key = "actions_grid" + tagId
        showGrid = !!$special[key]
    }

    function toggleShowGrid() {
        if ($activeActionTagFilter.length !== 1) return

        showGrid = !showGrid

        const tagId = $activeActionTagFilter[0]
        const key = "actions_grid" + tagId
        special.update((a) => {
            a[key] = showGrid
            return a
        })
    }

    function keydown(e: KeyboardEvent) {
        if (e.key === "Enter" && searchValue.length > 1 && e.target?.closest(".search")) {
            let action = filteredActionsSearch[0]
            if (!action) return

            // play
            if (e.ctrlKey || e.metaKey) {
                runAction(action)
                return
            }

            // add to project (no need)
        }
    }
</script>

<svelte:window on:keydown={keydown} />

<div class="context #actions{readOnly ? '_readonly' : ''}" style="position: relative;height: 100%;overflow-y: auto;display: flex;flex-direction: column;">
    {#if filteredActionsSearch.length}
        <div class="actions{showGrid ? ' grid' : ''}{showGrid && gridCentered ? ' grid-centered' : ''}">
            {#each filteredActionsSearch as action}
                {@const isReadOnly = readOnly || action.tags?.some((tagId) => profile[tagId] === "read")}

                <div class="action context #action{isReadOnly ? '_readonly' : ''}{showGrid ? ' grid-item' : ''}">
                    <SelectElem id="action" data={action} style={showGrid ? "display: block; width: 100%; height: 100%;" : "display: flex; flex: 1;"} draggable>
                        <!-- WIP MIDI if slide action.action ... -->
                        <Button
                            title="{translateText('media.play')}: <b>{action.name}</b>"
                            on:click={(e) => {
                                if (e.ctrlKey || e.metaKey) return
                                if (action.shows?.length) {
                                    receivedMidi({ id: action.id, bypass: true })
                                    return
                                }

                                runAction(action)
                                timelineRecordingAction.set({ id: "run_action", data: { id: action.id } })
                            }}
                            outline={$runningActions.includes(action.id)}
                            bold={false}
                            dark
                            style={showGrid ? "width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 6px 4px 4px;" : ""}
                        >
                            <span style={showGrid ? "display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%; gap: 6px;" : "display: flex;align-items: center;justify-content: space-between;width: 100%;"}>
                                <span style={showGrid ? "display: flex; flex-direction: column; gap: 8px; align-items: center; justify-content: center; width: 100%; height: 100%;" : "display: flex; align-items: center; gap: 8px;"}>
                                    <span style={showGrid ? "display: flex; align-items: center; justify-content: center; width: 100%; min-height: 2.8em;" : "display: flex; align-items: center; justify-content: center;"}>
                                        {#if action.shows?.length}
                                            <Icon id="slide" size={showGrid ? 4 : 1} white />
                                        {:else if action.customIcon}
                                            <img src={action.customIcon} style="width: {showGrid ? 4 : 1}rem; height: {showGrid ? 4 : 1}rem; object-fit: contain;border-radius: 2px;" />
                                        {:else if action.triggers?.length !== 1}
                                            <Icon id="actions" size={showGrid ? 4 : 1} />
                                        {:else}
                                            <Icon id={getActionIcon(action.id)} size={showGrid ? 4 : 1} />
                                        {/if}
                                    </span>
                                    <span style={showGrid ? "font-size: 1em; text-align: center; font-size: 0.9em;white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 112px; max-width: 112px; display: block; margin: 0 auto;" : "display: flex;align-items: center;gap: 8px;"}>
                                        {#if action.shows?.length}
                                            <T id="actions.play_on_midi" />
                                        {:else}
                                            {action.name || "—"}
                                        {/if}
                                        {#if action.keypressActivate}
                                            <span class="key">{action.keypressActivate}</span>
                                        {/if}
                                    </span>
                                </span>

                                {#if !showGrid}
                                    <p style="opacity: 0.8;display: flex;gap: 20px;" class:deactivated={action.enabled === false}>
                                        {#if action.customActivation || action.startupEnabled}
                                            <span>
                                                {#key action.customActivation}
                                                    {translateText(customActionActivations.find((a) => a.id === action.customActivation)?.name || "actions.custom_activation")}
                                                {/key}
                                            </span>
                                        {/if}

                                        {#if action.midiEnabled && action.midi}
                                            <span>
                                                <!-- ({action.midi.input || "—"}) -->
                                                <!-- <T id="midi.note" />: {action.midi.values?.note} - {midiToNote(action.midi.values?.note)}, -->
                                                <T id="midi.note" />: {action.midi.type === "control" ? action.midi.values?.controller || 0 : midiToNote(action.midi.values?.note)},
                                                {#if action.midi.type === "control"}
                                                    <T id="variables.value" />: {action.midi.values?.value},
                                                {:else if action.midi.values?.velocity > -1}
                                                    <T id="midi.velocity" />: {action.midi.values?.velocity},
                                                {/if}
                                                <T id="midi.channel" />: {action.midi.values?.channel}
                                                {#if action.midi.type !== "noteon"}
                                                    — {action.midi.type}{/if}
                                            </span>
                                        {/if}
                                    </p>
                                {/if}
                            </span>

                            <!-- this is probably not in use: -->
                            {#if !showGrid}
                                <p style="opacity: 0.5;font-style: italic;">{action.shows?.length > 1 ? action.shows.length : ""}</p>
                            {/if}

                            <!-- tags -->
                            {#if $activeActionTagFilter.length && !showGrid}
                                <span class="tags">
                                    {#each action.tags as tagId}
                                        {@const tag = $actionTags[tagId]}
                                        {#if tag && !$activeActionTagFilter.includes(tagId)}
                                            <span class="tag" style="--color: {tag.color || 'white'};">
                                                <p>{tag.name || "—"}</p>
                                            </span>
                                        {/if}
                                    {/each}
                                </span>
                            {/if}
                        </Button>
                    </SelectElem>
                </div>
            {/each}
        </div>
    {:else}
        <Center faded>
            <T id="empty.general" />
        </Center>
    {/if}
</div>

{#if $activeActionTagFilter.length === 1}
    <FloatingInputs side="left">
        <MaterialButton on:click={toggleShowGrid} title="show.{showGrid ? 'grid' : 'list'}">
            <Icon size={1.3} id={showGrid ? "grid" : "list"} white />
        </MaterialButton>
    </FloatingInputs>
{/if}

<FloatingInputs onlyOne>
    <MaterialButton disabled={readOnly} icon="add" title="new.action" on:click={newAction}>
        {#if !$labelsDisabled}<T id="new.action" />{/if}
    </MaterialButton>
</FloatingInputs>

<style>
    .actions {
        flex: 1;
        overflow: auto;

        padding-bottom: 60px;
    }
    .actions :global(.action:nth-child(even)) {
        background-color: rgb(0 0 20 / 0.08);
    }
    .actions :global(.selectElem button:not(.hover)) {
        background: transparent;
    }

    .action {
        display: flex;
        flex-direction: row;
        width: 100%;
        min-height: 35px;
    }
    /* .customActivation {
        color: var(--secondary);
    } */

    .action :global(button:nth-child(1)) {
        width: 100%;
        justify-content: space-between;
        text-align: start;
    }

    .key {
        color: var(--secondary);
        font-weight: bold;
        text-transform: uppercase;
    }

    .deactivated {
        opacity: 0.5 !important;
        text-decoration: line-through;
    }

    /* Grid mode */

    .actions.grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, 130px);
        grid-auto-rows: 130px;
        gap: 10px;
        padding: 12px 4px;
        align-items: start;
        align-content: start;
        justify-items: center;
        justify-content: center;
        min-height: 0;
        height: auto;
        width: 100%;
        margin-inline: 0;
        box-sizing: border-box;
    }
    .actions.grid.grid-centered {
        align-content: center;
        min-height: 100%;
        height: 100%;
    }
    .actions.grid :global(.action) {
        background-color: rgb(0 0 20 / 0.08);
        border-radius: 10px;
        width: 130px;
        max-width: none;
        aspect-ratio: 1 / 1;
        border: 1px solid transparent;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        transition:
            transform 0.2s ease,
            border-color 0.2s ease,
            background-color 0.2s ease;
        padding: 0;
        overflow: hidden;
    }
    .actions.grid :global(.action:hover) {
        background-color: rgb(0 0 20 / 0.14);
        border-color: rgb(255 255 255 / 0.2);
    }
    .actions.grid :global(.selectElem button) {
        background: transparent;
        width: 100%;
        height: 100%;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 0;
        transition: background-color 0.2s ease;
        cursor: pointer;
    }
    .actions.grid :global(.selectElem button:hover) {
        background-color: rgb(255 255 255 / 0.03);
    }

    /* tags */

    .tags {
        display: flex;
        gap: 5px;
        padding-left: 10px;
    }

    .tag {
        --color: white;

        display: flex;
        padding: 0px 5px;

        color: var(--color);
        font-weight: 600;

        border-radius: 20px;
        border: 2px solid var(--color);
    }
</style>
