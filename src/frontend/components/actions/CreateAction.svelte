<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { activePopup, dictionary, popupData } from "../../stores"
    import { translate } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"
    import CombinedInput from "../inputs/CombinedInput.svelte"
    import Dropdown from "../inputs/Dropdown.svelte"
    import CustomInput from "./CustomInput.svelte"
    import { actionData } from "./actionData"
    import { getActionTriggerId } from "./actions"
    import { API_ACTIONS } from "./api"
    import HRule from "../input/HRule.svelte"

    export let list: boolean = false
    export let full: boolean = false
    export let mainId: string = ""
    export let actionId: string
    export let actionValue: any = {}
    export let existingActions: string[] = []
    export let actionNameIndex: number = 0
    export let choosePopup: boolean = false

    let dispatch = createEventDispatcher()
    function changeAction(e: any) {
        dispatch("change", e)
        pickAction = false
    }

    const slideActions = [
        "start_show",
        "set_template",
        "clear_background",
        "clear_overlays",
        "clear_audio",
        "change_volume",
        "start_audio_stream",
        "start_playlist",
        "start_metronome",
        "start_slide_timers",
        "stop_timers",
        "start_slide_recording",
        "change_output_style",
        "start_trigger",
        "send_midi",
        "run_action",
    ]
    // remove actions that are not fully implemented to CustomInput yet
    const removeActions = ["change_transition"]
    // remove run action if creating an action (not "template" or "slide")
    if (!$popupData.mode) removeActions.push("run_action")

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
                // show if it is the currently selected
                if (id === actionId) return true
                // don't show action if incompatible with any existing action
                if (actionData[id].incompatible?.find((id) => existingActions.includes(id))) return false
                // don't display GET actions
                if (id.includes("get_")) return false

                // WIP MIDI multiple of the same (needs a new way of setting the id)
                // show if it has an input (because you probably want to have multiple)
                // if (actionData[actionId]?.input) return true
                // remove already added or custom ones
                if (removeActions.includes(id) || (!actionData[id].canAddMultiple && existingActions.includes(id))) return false
                // custom slide actions list
                if (list && !full && !slideActions.includes(id)) return false
                // if (list && id.includes("index_select")) return false
                return true
            }),
        // custom special
        ...(list && !full ? [] : [{ id: "wait", name: $dictionary.animate?.wait || "", icon: "time_in", common: false, section: "edit.special" }]),
    ].map((a, i) => {
        if (i === 0) usedSections = []

        let section = a.section || ""

        if (usedSections.includes(section)) section = ""
        if (section) usedSections.push(section)

        return { ...a, section }
    })

    let pickAction: boolean = false

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
</script>

{#if list}
    {#if actionId && !pickAction && !full}
        <CombinedInput textWidth={38}>
            <Button on:click={() => (pickAction = true)} style="width: 100%;" center dark>
                <Icon id={actionData[actionId]?.icon || "actions"} right />
                <p style="display: contents;">{findName(actionId)}</p>
            </Button>
        </CombinedInput>
    {:else}
        <div class="buttons">
            {#each ACTIONS as action}
                {#if action.section}
                    <HRule title={action.section} />
                {/if}

                <!-- disabled={$popupData.existing.includes(action.id)} -->
                <Button
                    on:click={() => changeAction({ ...action, index: full ? undefined : 0 })}
                    outline={getActionTriggerId(actionId) === action.id}
                    active={(existingActions || $popupData.existing || []).map(getActionTriggerId).includes(action.id)}
                    style="width: 100%;"
                    bold={action.common}
                >
                    <Icon id={action.icon} right />
                    <p>{action.name}</p>
                </Button>
            {/each}
        </div>
    {/if}
{:else}
    <CombinedInput textWidth={38} style={actionNameIndex > 1 || !actionId ? "border-top: 2px solid var(--primary-lighter);" : ""}>
        <p style="font-weight: 600;">
            <T id="midi.start_action" />
            <span style="color: var(--secondary);display: flex;align-items: center;margin-left: 8px;">
                {#if actionNameIndex}#{actionNameIndex}{/if}
            </span>
        </p>

        {#if !choosePopup}
            <Dropdown activeId={actionId} value={findName(actionId) || "—"} options={[...(actionNameIndex ? [{ id: "remove", name: "—" }] : []), ...ACTIONS]} on:click={(e) => changeAction(e.detail)} />
        {:else}
            <Button on:click={() => dispatch("choose")} title={$dictionary.actions?.choose_action} bold={!actionId}>
                <div style="display: flex;align-items: center;padding: 0;">
                    <Icon id={findIcon(actionId)} style="margin-left: 0.5em;" right />
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

        {#if dataInputs && !dataOpened}
            <Button class="submenu_open" on:click={() => (dataMenuOpened = !dataMenuOpened)}>
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

<style>
    .buttons {
        display: flex;
        flex-direction: column;
    }
    .buttons :global(button:not(.active):nth-child(even)) {
        background-color: rgb(0 0 20 / 0.08);
    }
</style>
