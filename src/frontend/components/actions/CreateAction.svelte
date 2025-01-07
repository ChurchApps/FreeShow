<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { activePopup, dictionary, popupData } from "../../stores"
    import { translate } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import { _show } from "../helpers/shows"
    import Button from "../inputs/Button.svelte"
    import CombinedInput from "../inputs/CombinedInput.svelte"
    import Dropdown from "../inputs/Dropdown.svelte"
    import CustomInput from "./CustomInput.svelte"
    import { actionData } from "./actionData"
    import { API_ACTIONS } from "./api"

    export let list: boolean = false
    export let mainId: string = ""
    export let actionId: string
    export let actionValue: any = {}
    export let existingActions: string[] = []
    export let actionNameIndex: number = 0

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
    ]
    // remove actions that are not fully implemented to CustomInput yet
    const removeActions = ["change_transition"]
    if ($popupData.mode !== "template") removeActions.push("run_action")

    $: ACTIONS = [
        ...Object.keys(API_ACTIONS)
            .map((id) => {
                let data = actionData[id] || {}
                let name = translate(data.name || "") || id
                let icon = data.icon || "actions"
                let common = !!data.common

                return { id, name, icon, common }
            })
            .filter(({ id }) => {
                // don't show actions with no custom data
                if (!actionData[id]) return false
                // show if it is the currently selected
                if (id === actionId) return true
                // don't display GET actions
                if (id.includes("get_")) return false

                // WIP MIDI multiple of the same (needs a new way of setting the id)
                // show if it has an input (because you probably want to have multiple)
                // if (actionData[actionId]?.input) return true
                // remove already added or custom ones
                if (removeActions.includes(id) || existingActions.includes(id)) return false
                // custom slide actions list
                if (list && !slideActions.includes(id)) return false
                // if (list && id.includes("index_select")) return false
                return true
            }),
        // custom special
        ...(list ? [] : [{ id: "wait", name: $dictionary.animate?.wait || "", icon: "time_in", common: false }]),
    ]

    let pickAction: boolean = false

    let input = ""
    $: if (actionId && !pickAction) loadInputs()
    function loadInputs() {
        input = actionData[getId(actionId)]?.input || ""

        if (!list) return

        if (!input) {
            // close popup if no custom inputs
            activePopup.set(null)
            return
        }
    }

    function getId(actionId: string) {
        let multiple = actionId.indexOf(":")
        if (multiple > -1) actionId = actionId.slice(0, multiple)
        return actionId
    }

    function findName(actionId: string): string {
        actionId = getId(actionId)
        return ACTIONS.find((a) => a.id === actionId)?.name || actionId || ""
    }
</script>

{#if list}
    {#if actionId && !pickAction}
        <CombinedInput>
            <Button on:click={() => (pickAction = true)} style="width: 100%;" center dark>
                <Icon id={actionData[actionId]?.icon || "actions"} right />
                <p style="display: contents;">{findName(actionId)}</p>
            </Button>
        </CombinedInput>
    {:else}
        <div class="buttons">
            {#each ACTIONS as action}
                <!-- disabled={$popupData.existing.includes(action.id)} -->
                <Button on:click={() => changeAction({ ...action, index: 0 })} outline={actionId === action.id} active={$popupData.existing.includes(action.id)} style="width: 100%;" bold={action.common}>
                    <Icon id={action.icon} right />
                    <p>{action.name}</p>
                </Button>
            {/each}
        </div>
    {/if}
{:else}
    <CombinedInput>
        <p style="font-weight: 600;">
            <T id="midi.start_action" />
            <span style="color: var(--secondary);display: flex;align-items: center;margin-left: 8px;">
                {#if actionNameIndex}#{actionNameIndex}{/if}
            </span>
        </p>
        <Dropdown activeId={actionId} value={findName(actionId) || "—"} options={[...(actionNameIndex ? [{ id: "remove", name: "—" }] : []), ...ACTIONS]} on:click={(e) => changeAction(e.detail)} />
    </CombinedInput>
{/if}

{#if input && actionId && !pickAction}
    <CustomInput {mainId} inputId={input} actionIndex={actionNameIndex} value={actionValue} actionId={getId(actionId)} on:change={(e) => changeAction({ id: actionId, actionValue: e.detail })} list />
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
