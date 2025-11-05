<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { actionRevealUsed, actions, activePopup, audioPlaylists, audioStreams, categories, effects, emitters, outputs, overlays, popupData, projects, shows, stageShows, styles, templates, timers, triggers, variables } from "../../stores"
    import { translateText } from "../../utils/language"
    import { formatSearch } from "../../utils/search"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import { clone } from "../helpers/array"
    import { _show } from "../helpers/shows"
    import HRule from "../input/HRule.svelte"
    import InputRow from "../input/InputRow.svelte"
    import Button from "../inputs/Button.svelte"
    import CombinedInput from "../inputs/CombinedInput.svelte"
    import Dropdown from "../inputs/Dropdown.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import MaterialTextInput from "../inputs/MaterialTextInput.svelte"
    import MaterialToggleSwitch from "../inputs/MaterialToggleSwitch.svelte"
    import { getGlobalGroupName } from "../show/tools/groups"
    import Center from "../system/Center.svelte"
    import CustomInput from "./CustomInput.svelte"
    import { actionData } from "./actionData"
    import { getActionTriggerId } from "./actions"
    import { API_ACTIONS } from "./api"

    export let list = false
    export let full = false
    export let mainId = ""
    export let mode = ""
    export let actionId: string
    export let actionValue: any = {}
    export let customData: any = {}
    export let existingActions: string[] = []
    export let actionNameIndex = 0
    export let choosePopup = false

    $: existingActionsFiltered = choosePopup ? existingActions : existingActions.filter((a) => a !== actionId)

    let dispatch = createEventDispatcher()
    function changeAction(data: any) {
        dispatch("change", data)
        pickAction = false
    }

    const slideActions = [
        "start_show",
        "clear_background",
        "clear_overlays",
        "clear_audio",
        // "change_volume",
        "start_audio_stream",
        "start_playlist",
        "start_metronome",
        "start_slide_timers",
        "stop_timers",
        "start_slide_recording",
        "change_output_style",
        "change_stage_output_layout",
        "start_trigger",
        "send_midi",
        "run_action"
    ]
    // remove actions that are not fully implemented to CustomInput yet
    const removeActions = ["change_transition"]
    // // remove run action if creating an action (not "template" or "slide")
    // if (!mode) removeActions.push("run_action")
    // // remove toggle action from anything other than drawer actions
    // else removeActions.push("toggle_action")
    if (mode) removeActions.push("toggle_action")
    // slide action only
    if (mode !== "slide") removeActions.push("start_slide_timers")

    let usedSections: string[] = []

    let previousSection = ""
    $: ACTIONS = [
        ...Object.keys(API_ACTIONS)
            .map((id) => {
                let data = actionData[id] || {}
                let name = translateText(data.name || "") || id
                let icon = data.icon || "actions"
                let common = !!data.common

                if (data.SECTION) previousSection = data.SECTION
                return { id, name, icon, common, section: previousSection }
            })
            .filter(({ id }) => {
                // don't show actions with no custom data
                if (!actionData[id]) return false
                // remove uncommon
                if (commonOnly && !actionData[id].common) return false
                // show if it is the currently selected
                if (id === actionId) return true
                // don't show action if incompatible with any existing action (and no wait action is added)
                if (!existingActionsFiltered.find((a) => a.includes("wait")) && actionData[id].incompatible?.find((id) => existingActionsFiltered.includes(id))) return false
                // don't display GET actions
                if (id.includes("get_")) return false

                // WIP MIDI multiple of the same (needs a new way of setting the id)
                // show if it has an input (because you probably want to have multiple)
                // if (actionData[actionId]?.input) return true
                // remove already added or custom ones
                if (removeActions.includes(id) || (!actionData[id].canAddMultiple && existingActionsFiltered.includes(id))) return false
                // custom slide actions list
                if (list && !full && !slideActions.includes(id)) return false
                // if (list && id.includes("index_select")) return false
                return true
            }),
        // custom special
        ...((list && !full) || mode ? [] : [{ id: "wait", name: translateText("animate.wait"), icon: "time_in", common: true, section: "popup.action" }])
    ].map((a, i) => {
        if (i === 0) usedSections = []

        let section = a.section || ""

        if (usedSections.includes(section)) section = ""
        if (section) usedSections.push(section)

        return { ...a, section }
    })

    let pickAction = false

    let input = ""
    $: if (actionId && !pickAction) loadInputs()
    function loadInputs() {
        input = actionData[getActionTriggerId(actionId)]?.input || ""

        if (!list || full) return

        if (!input) {
            // close popup if no custom inputs
            activePopup.set(null)
            return
        }
    }

    function findName(actionId: string): string {
        actionId = getActionTriggerId(actionId)
        return ACTIONS.find((a) => a.id === actionId)?.name || actionId || ""
    }

    function findIcon(actionId: string): string {
        actionId = getActionTriggerId(actionId)
        return ACTIONS.find((a) => a.id === actionId)?.icon || "actions"
    }

    $: dataInputs = !!(input && actionId && !pickAction && !full)
    let dataOpened = !Object.keys(actionValue).length || !existingActions?.length // || existingActions.length < 2
    let dataMenuOpened = false

    // $: isLast = actionNameIndex >= existingActionsFiltered.length

    // SEARCH

    let searchedActions = clone(ACTIONS) // initially empty
    $: if (ACTIONS || commonOnly !== undefined) search()
    let searchValue = ""
    // let previousSearchValue = ""
    function search(value: string | null = null) {
        searchValue = formatSearch(value || "")

        let actionsList = clone(ACTIONS) //.filter((a) => (commonOnly ? a.common : true))

        if (searchValue.length < 2) {
            searchedActions = actionsList
            return
        }

        let currentActionsList = actionsList // searchedActions
        // reset if search value changed
        // if (!searchValue.includes(previousSearchValue)) currentActionsList = list

        searchedActions = currentActionsList.filter((a) => formatSearch(a.name || "").includes(searchValue))

        // previousSearchValue = searchValue
    }

    function chooseAction(e: KeyboardEvent) {
        if (e.key !== "Enter" || !searchValue.length || !searchedActions.length) return
        changeAction({ ...searchedActions[0], index: full ? undefined : 0 })
    }

    const getName = (object) => object[actionValue.id]?.name || ""
    function getActionInfo(actionId: string): string {
        const id = actionId.split(":")[0]
        // console.log(id, actionValue)

        if (id === "change_variable") return getName($variables)
        if (id === "id_start_timer") return getName($timers)
        if (id === "start_playlist") return getName($audioPlaylists)
        if (id === "id_select_overlay" || id === "clear_overlay") return getName($overlays)
        if (id === "emit_action") return $emitters[actionValue.emitter]?.name || ""
        if (id === "start_trigger") return getName($triggers)
        if (id === "run_action" || id === "toggle_action") return getName($actions)
        if (id === "id_start_effect") return getName($effects)
        if (id === "start_show") return getName($shows)
        if (id === "id_select_project") return getName($projects)
        if (id === "set_template") return getName($templates)
        if (id === "toggle_output") return getName($outputs)
        if (id === "id_select_stage_layout") return getName($stageShows)
        if (id === "start_audio_stream") return getName($audioStreams)
        if (id === "wait") return Number(actionValue.number) + "s"
        if (id === "id_select_group") return getGlobalGroupName(actionValue.id)
        if (id === "start_camera") return actionValue.label || ""
        if (id === "start_screen") return actionValue.name || ""
        if (id === "change_volume") return ((actionValue.volume || 1) * 100).toString()
        if (id.includes("index")) return actionValue.index || "0"
        if (id.includes("name")) return actionValue.value || ""
        if (id === "change_stage_output_layout") return `${actionValue.outputId ? ($outputs[actionValue.outputId]?.name || "—") + ": " : ""}${$stageShows[actionValue.stageLayoutId]?.name || ""}`
        if (id === "change_output_style") return `${actionValue.outputId ? ($outputs[actionValue.outputId]?.name || "—") + ": " : ""}${actionValue.styleId ? $styles[actionValue.styleId]?.name || "" : translateText("main.none")}`

        return ""
    }

    let commonOnly = !$actionRevealUsed && full && mode !== "slide"
</script>

<svelte:window on:keydown={chooseAction} />

{#if list}
    {#if actionId && !pickAction && !full}
        <CombinedInput textWidth={38}>
            <Button on:click={() => (pickAction = true)} style="width: 100%;" center dark>
                <Icon id={actionData[actionId]?.icon || "actions"} right />
                <p style="display: contents;">{findName(actionId)}</p>
            </Button>
        </CombinedInput>
    {:else}
        <MaterialTextInput label="main.search" value="" on:input={(e) => search(e.detail)} autofocus />

        {#if mode !== "slide"}
            <MaterialButton
                class="popup-options {!commonOnly ? 'active' : ''}"
                icon={!commonOnly ? "eye" : "hide"}
                iconSize={1.3}
                title={!commonOnly ? "actions.close" : "create_show.more_options"}
                on:click={() => {
                    commonOnly = !commonOnly
                    actionRevealUsed.set(!commonOnly)
                }}
                white
            />
        {/if}

        {#if searchedActions.length}
            <div class="buttons" style="margin-top: 10px;">
                {#each searchedActions as action, i}
                    {#if action.section && !searchValue.length}
                        <!-- might not properly update always on common toggle, without the key refresh -->
                        {#key action.section}
                            <HRule title={action.section} />
                        {/key}
                    {/if}

                    <!-- disabled={$popupData.existing.includes(action.id)} -->
                    <!-- bold={action.common} -->
                    <MaterialButton
                        style="width: 100%;font-weight: normal;justify-content: start;padding: 5px 20px;gap: 12px;{searchValue.length && i === 0 ? 'background-color: var(--primary-lighter);' : ''}"
                        showOutline={getActionTriggerId(actionId) === action.id}
                        isActive={(existingActionsFiltered || $popupData.existing || []).map(getActionTriggerId).includes(action.id)}
                        on:click={() => changeAction({ ...action, index: full ? undefined : 0 })}
                    >
                        <Icon id={action.icon} />
                        <p>{action.name}</p>
                    </MaterialButton>
                {/each}
            </div>
        {:else}
            <Center size={1.2} faded style="height: 100px;padding-top: 20px;">
                <T id="empty.search" />
            </Center>
        {/if}
    {/if}
{:else}
    <div class="box" style={actionNameIndex > 1 ? "margin-top: 5px;" : ""}>
        <div class="part">
            <p style="font-weight: 600;padding: 0 10px;display: flex;align-items: center;">
                <T id="midi.start_action" />
                <span style="color: var(--secondary);display: flex;align-items: center;margin-inline-start: 8px;">
                    {#if actionNameIndex}#{actionNameIndex}{/if}
                </span>
            </p>

            <div style="display: flex;align-items: center;gap: 3px;">
                {#if actionId && existingActions.length > 1}
                    {#if actionNameIndex > 1}
                        <MaterialButton style="padding: 8px;" icon="up" on:click={() => changeAction({ id: "move_up", index: actionNameIndex - 1 })} />
                    {/if}
                    <MaterialButton style="padding: 6.5px;" title="actions.remove" on:click={() => changeAction({ id: "remove", index: actionNameIndex - 1 })}>
                        <Icon id="close" size={1.2} white />
                    </MaterialButton>
                {/if}
            </div>
        </div>

        <InputRow style="background-color: var(--primary-darker);" arrow={dataInputs && !dataOpened} bind:open={dataMenuOpened}>
            {#if !choosePopup}
                <Dropdown activeId={actionId} value={findName(actionId) || "—"} options={[...(actionNameIndex ? [{ id: "remove", name: "—" }] : []), ...ACTIONS]} on:click={(e) => changeAction(e.detail)} />
                <!-- <MaterialDropdown value={actionId} options={[...(actionNameIndex ? [{ value: "remove", label: "—" }] : []), ...ACTIONS]} on:change={(e) => changeAction(e.detail)} /> -->
            {:else}
                <MaterialButton style="flex: 1;justify-content: start;{actionId ? 'font-weight: normal;' : ''}" title="actions.choose_action" on:click={() => dispatch("choose")}>
                    <Icon id={findIcon(actionId)} style="margin-inline-start: 0.5em;" />
                    <p>
                        {#if actionId}
                            {findName(actionId) || "—"}
                        {:else}
                            <T id="actions.choose_action" />
                        {/if}
                    </p>

                    {#if dataInputs && !dataOpened && !dataMenuOpened}
                        <span style="opacity: 0.5;font-size: 0.8em;">
                            {getActionInfo(actionId)}
                        </span>
                    {/if}
                </MaterialButton>
            {/if}
        </InputRow>
    </div>
{/if}

{#if dataInputs && (dataOpened || dataMenuOpened)}
    <CustomInput {mainId} inputId={input} actionIndex={actionNameIndex} value={actionValue} actionId={getActionTriggerId(actionId)} on:change={(e) => changeAction({ id: actionId, actionValue: e.detail })} list />
{/if}

{#if mode === "slide" && getActionTriggerId(actionId) === "run_action" && $categories[_show().get().category]?.action}
    <MaterialToggleSwitch
        label="actions.override_category_action"
        checked={customData.overrideCategoryAction}
        defaultValue={false}
        on:change={(e) => changeAction({ id: actionId, customDataKey: "overrideCategoryAction", customDataValue: e.detail })}
    />
{/if}

<style>
    .box {
        display: flex;
        flex-direction: column;

        border-radius: 8px;
        overflow: hidden;
    }

    .part {
        padding: 3px;
        font-size: 0.8em;

        background-color: var(--primary-darker);
        border-bottom: 1px solid var(--primary-lighter);

        display: flex;
        justify-content: space-between;
        gap: 5px;
    }

    /* list */

    .buttons {
        display: flex;
        flex-direction: column;

        background-color: var(--primary-darker);
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
        overflow: hidden;

        padding: 10px 0;
    }
    .buttons :global(button:not(.active):nth-child(odd)) {
        background-color: rgb(0 0 20 / 0.08) !important;
    }
</style>
