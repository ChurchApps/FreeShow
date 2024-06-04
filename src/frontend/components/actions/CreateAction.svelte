<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { popupData } from "../../stores"
    import { translate } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"
    import CombinedInput from "../inputs/CombinedInput.svelte"
    import Dropdown from "../inputs/Dropdown.svelte"
    import { actionData } from "./actionData"
    import { API_ACTIONS } from "./api"

    export let list: boolean = false
    export let actionId: string
    export let trigger: string = ""

    let dispatch = createEventDispatcher()
    function changeAction(e: any) {
        dispatch("change", e)
    }

    const ACTIONS = Object.keys(API_ACTIONS).map((id) => {
        let data = actionData[id] || {}
        let name = (data.getName ? data.getName(trigger) : translate(data.name || "")) || id
        let icon = data.icon || "actions"
        let common = !!data.common

        return { id, name, icon, common }
    })

    // WIP MIDI OLD:

    // const actionOptions = Object.keys(midiActions).map((id) => ({ id, name: "$:" + (midiNames[id] || "actions." + id) + ":$", translate: true }))

    // const groupsList = sortByName(Object.keys($groups).map((id) => ({ id, name: $dictionary.groups?.[$groups[id].name] || $groups[id].name })))

    // $: stylesList = getStyles($styles)
    // function getStyles(styles) {
    //     let list = Object.entries(styles).map(([id, obj]: any) => ({ ...obj, id }))
    //     return [{ id: null, name: "—" }, ...sortByName(list)]
    // }

    let pickAction: boolean = false
</script>

<!-- WIP MIDI full list with icons + trigger "Action" -->
{#if list}
    {#if actionId && !pickAction}
        <div style="display: flex;">
            <Icon id={actionData[actionId]?.icon || "actions"} right />
            <p>{actionData[actionId]?.name || actionId}</p>
        </div>

        <div class="buttons">
            <Button on:click={() => (pickAction = true)} style="width: 100%;" center>
                <p>Change action</p>
            </Button>
        </div>
    {:else}
        {#each ACTIONS as action}
            <Button disabled={$popupData.existing.includes(actionId)} on:click={() => changeAction(action)} active={actionId === action.id || $popupData.existing.includes(actionId)} style="width: 100%;" bold={action.common}>
                <Icon id={action.icon} right />
                <p>{action.name}</p>
            </Button>
        {/each}
    {/if}
{:else}
    <CombinedInput>
        <p><T id="midi.start_action" /></p>
        <Dropdown value={actionData[actionId]?.name || actionId || "—"} options={ACTIONS} on:click={(e) => changeAction(e.detail)} />
    </CombinedInput>
{/if}

{#if actionId && !pickAction}
    <!-- WIP MIDI custom inputs -->
    <!-- TODO: if no custom inputs close popup -->
{/if}

<!-- {#if action?.includes("index_")}
    <CombinedInput>
        <p style="font-size: 0.7em;opacity: 0.8;">
            <T id="midi.tip_index_by_velocity" />
        </p>
    </CombinedInput>
{/if}

{#if action === "index_select_slide"}
    <CombinedInput>
        <p style="font-size: 0.7em;opacity: 0.8;">
            <T id="midi.tip_action" />
        </p>
    </CombinedInput>
{/if} -->

<!-- {#if action === "goto_group"}
    <CombinedInput>
        <p><T id="actions.choose_group" /></p>
        <Dropdown value={groupsList.find((a) => a.id === actionData?.group)?.name || "—"} options={groupsList} on:click={(e) => (actionData = { group: e.detail.id })} />
    </CombinedInput>
{:else if action === "change_output_style"}
    <CombinedInput>
        <p><T id="actions.change_output_style" /></p>
        <Dropdown value={$styles[actionData?.style]?.name || "—"} options={stylesList} on:click={(e) => (actionData = { style: e.detail.id })} />
    </CombinedInput>
{/if} -->

<style>
    .buttons {
        display: flex;
    }
    .buttons :global(button:nth-child(even)) {
        background-color: rgb(0 0 20 / 0.08);
    }
</style>
