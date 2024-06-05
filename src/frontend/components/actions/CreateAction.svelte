<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { activePopup, popupData } from "../../stores"
    import { translate } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"
    import CombinedInput from "../inputs/CombinedInput.svelte"
    import Dropdown from "../inputs/Dropdown.svelte"
    import { actionData } from "./actionData"
    import { API_ACTIONS } from "./api"
    import CustomInput from "./CustomInput.svelte"

    export let list: boolean = false
    export let actionId: string
    export let actionValue: any = {}
    export let existingActions: string[] = []
    export let actionNameIndex: number = 0

    let dispatch = createEventDispatcher()
    function changeAction(e: any) {
        dispatch("change", e)
        pickAction = false
    }

    // WIP some actions like "run_action" do you often want more than one... (actions with input's can be added multiple times)

    $: ACTIONS = Object.keys(API_ACTIONS)
        .map((id) => {
            let data = actionData[id] || {}
            let name = (data.getName ? data.getName(actionId) : translate(data.name || "")) || id
            let icon = data.icon || "actions"
            let common = !!data.common

            return { id, name, icon, common }
        })
        .filter(({ id }) => id === actionId || !existingActions.includes(id))

    let pickAction: boolean = false

    let input = ""
    $: if (actionId && !pickAction) loadInputs()
    function loadInputs() {
        input = actionData[actionId]?.input || ""
        console.log("input", input)

        if (input || !list) return

        // close popup if no custom inputs
        activePopup.set(null)
    }

    function findName(): string {
        return ACTIONS.find((a) => a.id === actionId)?.name || actionId || ""
    }
</script>

{#if list}
    {#if actionId && !pickAction}
        <div style="display: flex;align-items: center;">
            <Icon id={actionData[actionId]?.icon || "actions"} right />
            <p>{findName()}</p>
        </div>

        <Button on:click={() => (pickAction = true)} style="width: 100%;margin-top: 5px;" center dark>
            <p>Change action</p>
        </Button>
    {:else}
        <div class="buttons">
            {#each ACTIONS as action}
                <Button disabled={$popupData.existing.includes(actionId)} on:click={() => changeAction({ ...action, index: 0 })} active={actionId === action.id || $popupData.existing.includes(actionId)} style="width: 100%;" bold={action.common}>
                    <Icon id={action.icon} right />
                    <p>{action.name}</p>
                </Button>
            {/each}
        </div>
    {/if}
{:else}
    <CombinedInput>
        <p>
            <T id="midi.start_action" />
            {#if actionNameIndex}#{actionNameIndex}{/if}
        </p>
        <Dropdown value={findName() || "—"} options={[...(actionNameIndex ? [{ id: "remove", name: "—" }] : []), ...ACTIONS]} on:click={(e) => changeAction(e.detail)} />
    </CombinedInput>
{/if}

{#if input && actionId && !pickAction}
    <CustomInput inputId={input} value={actionValue} {actionId} on:change={(e) => changeAction({ id: actionId, actionValue: e.detail })} />
{/if}

<style>
    .buttons {
        display: flex;
        flex-direction: column;
    }
    .buttons :global(button:nth-child(even)) {
        background-color: rgb(0 0 20 / 0.08);
    }
</style>
