<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { activePopup, categories, dictionary, popupData } from "../../stores"
    import { translate } from "../../utils/language"
    import { formatSearch } from "../../utils/search"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import { clone } from "../helpers/array"
    import { _show } from "../helpers/shows"
    import HRule from "../input/HRule.svelte"
    import Button from "../inputs/Button.svelte"
    import Checkbox from "../inputs/Checkbox.svelte"
    import CombinedInput from "../inputs/CombinedInput.svelte"
    import Dropdown from "../inputs/Dropdown.svelte"
    import TextInput from "../inputs/TextInput.svelte"
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
        "start_trigger",
        "send_midi",
        "run_action"
    ]
    // remove actions that are not fully implemented to CustomInput yet
    const removeActions = ["change_transition"]
    // remove run action if creating an action (not "template" or "slide")
    if (!mode) removeActions.push("run_action")
    // remove toggle action from anything other than drawer actions
    else removeActions.push("toggle_action")
    // slide action only
    if (mode !== "slide") removeActions.push("start_slide_timers")

    let usedSections: string[] = []

    let previousSection = ""
    $: ACTIONS = [
        ...Object.keys(API_ACTIONS)
            .map((id) => {
                let data = actionData[id] || {}
                let name = translate(data.name || "") || id
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
        ...((list && !full) || mode ? [] : [{ id: "wait", name: $dictionary.animate?.wait || "", icon: "time_in", common: true, section: "popup.action" }])
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
    function search(e: any = null) {
        searchValue = formatSearch(e?.target?.value || "")

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

    const isChecked = (e: any) => e.target.checked

    let commonOnly = full && mode !== "slide"
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
        <CombinedInput style="border-bottom: 2px solid var(--secondary);">
            <TextInput placeholder={$dictionary.main?.search} value="" on:input={search} autofocus />
        </CombinedInput>

        {#if mode !== "slide"}
            <CombinedInput>
                <p>Common only</p>
                <span class="alignRight">
                    <Checkbox checked={commonOnly} on:change={(e) => (commonOnly = isChecked(e))} />
                </span>
            </CombinedInput>
        {/if}

        {#if searchedActions.length}
            <div class="buttons" style={searchValue.length ? "padding-top: 20px;" : ""}>
                {#each searchedActions as action, i}
                    {#if action.section && !searchValue.length}
                        <!-- might not properly update always on common toggle, without the key refresh -->
                        {#key action.section}
                            <HRule title={action.section} />
                        {/key}
                    {/if}

                    <!-- disabled={$popupData.existing.includes(action.id)} -->
                    <!-- bold={action.common} -->
                    <Button
                        on:click={() => changeAction({ ...action, index: full ? undefined : 0 })}
                        outline={getActionTriggerId(actionId) === action.id}
                        active={(existingActionsFiltered || $popupData.existing || []).map(getActionTriggerId).includes(action.id)}
                        style="width: 100%;{searchValue.length && i === 0 ? 'background-color: var(--primary-lighter);' : ''}"
                        bold={false}
                    >
                        <Icon id={action.icon} right />
                        <p>{action.name}</p>
                    </Button>
                {/each}
            </div>
        {:else}
            <Center size={1.2} faded style="height: 100px;padding-top: 20px;">
                <T id="empty.search" />
            </Center>
        {/if}
    {/if}
{:else}
    <CombinedInput textWidth={38} style={actionNameIndex > 1 || !actionId ? "border-top: 2px solid var(--primary-lighter);" : ""}>
        <p style="font-weight: 600;">
            <T id="midi.start_action" />
            <span style="color: var(--secondary);display: flex;align-items: center;margin-inline-start: 8px;">
                {#if actionNameIndex}#{actionNameIndex}{/if}
            </span>
        </p>

        {#if !choosePopup}
            <Dropdown activeId={actionId} value={findName(actionId) || "—"} options={[...(actionNameIndex ? [{ id: "remove", name: "—" }] : []), ...ACTIONS]} on:click={(e) => changeAction(e.detail)} />
        {:else}
            <Button on:click={() => dispatch("choose")} title={$dictionary.actions?.choose_action} bold={!actionId}>
                <div style="display: flex;align-items: center;padding: 0;">
                    <Icon id={findIcon(actionId)} style="margin-inline-start: 0.5em;" right />
                    <p>
                        {#if actionId}
                            {findName(actionId) || "—"}
                        {:else}
                            <T id="actions.choose_action" />
                        {/if}
                    </p>
                </div>
            </Button>
        {/if}

        <!-- isLast -->
        {#if actionId && existingActions.length > 1}
            <Button title={$dictionary.actions?.remove} on:click={() => changeAction({ id: "remove", index: actionNameIndex - 1 })} redHover>
                <Icon id="close" size={1.2} white />
            </Button>
        {/if}

        {#if dataInputs && !dataOpened}
            <Button style="padding: 0 8.5px !important" class="submenu_open" on:click={() => (dataMenuOpened = !dataMenuOpened)}>
                {#if dataMenuOpened}
                    <Icon class="submenu_open" id="arrow_down" size={1.4} style="fill: var(--secondary);" />
                {:else}
                    <Icon class="submenu_open" id="arrow_right" size={1.4} style="fill: var(--text);" />
                {/if}
            </Button>
        {/if}
    </CombinedInput>
{/if}

{#if dataInputs && (dataOpened || dataMenuOpened)}
    <CustomInput {mainId} inputId={input} actionIndex={actionNameIndex} value={actionValue} actionId={getActionTriggerId(actionId)} on:change={(e) => changeAction({ id: actionId, actionValue: e.detail })} list />
{/if}

{#if mode === "slide" && getActionTriggerId(actionId) === "run_action" && $categories[_show().get().category]?.action}
    <CombinedInput>
        <p style="flex: 1;"><T id="actions.override_category_action" /></p>
        <span class="alignRight" style="flex: 0;padding: 0 10px;">
            <Checkbox checked={customData.overrideCategoryAction} on:change={(e) => changeAction({ id: actionId, customDataKey: "overrideCategoryAction", customDataValue: isChecked(e) })} />
        </span>
    </CombinedInput>
{/if}

<style>
    .buttons {
        display: flex;
        flex-direction: column;
    }
    .buttons :global(button:not(.active):nth-child(even)) {
        background-color: rgb(0 0 20 / 0.08);
    }
</style>
