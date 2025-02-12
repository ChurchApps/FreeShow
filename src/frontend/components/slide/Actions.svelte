<script lang="ts">
    import { activeShow, dictionary, shows, templates } from "../../stores"
    import { translate } from "../../utils/language"
    import { actionData } from "../actions/actionData"
    import { getActionName, getActionTriggerId } from "../actions/actions"
    import { clone } from "../helpers/array"
    import { history } from "../helpers/history"
    import Icon from "../helpers/Icon.svelte"
    import Button from "../inputs/Button.svelte"

    export let columns: number
    export let index: number = -1
    export let templateId: string = ""
    export let actions: any

    $: currentShow = $shows[$activeShow?.id || ""] || {}

    function changeAction(id: string, save: boolean = true) {
        if (templateId || currentShow.locked) return

        let data = { ...actions, [id]: actions[id] ? !actions[id] : true }

        if (id === "slide_shortcut") delete data[id]
        else if (id === "outputStyle" && !data[id]) delete data.styleOutputs

        history({ id: "SHOW_LAYOUT", save, newData: { key: "actions", data, indexes: [index] } })
    }

    function deleteSlideAction(id: string) {
        if (currentShow.locked) return

        let slideActions = clone(actions.slideActions)
        let actionIndex = slideActions.findIndex((a) => a.id === id || a.triggers?.[0] === id)
        if (actionIndex < 0) return
        slideActions.splice(actionIndex, 1)

        if (templateId) {
            let templateSettings = $templates[templateId]?.settings || {}
            templateSettings.actions = slideActions

            let newData = { key: "settings", data: templateSettings }
            history({ id: "UPDATE", newData, oldData: { id: templateId }, location: { page: "drawer", id: "template_settings", override: `actions_${templateId}` } })

            return
        }

        let data = { ...actions, slideActions }

        history({ id: "SHOW_LAYOUT", newData: { key: "actions", data, indexes: [index] } })
    }

    const actionsList: any = [
        { id: "nextAfterMedia", title: $dictionary.actions?.next_after_media, icon: "forward" },
        { id: "animate", title: $dictionary.popup?.animate, icon: "stars" },
        { id: "receiveMidi", title: $dictionary.actions?.play_on_midi, icon: "play" },
    ]

    // WIP MIDI convert into new
    // actionData get slideId and convert into slideActions

    $: zoom = 4 / columns
</script>

<div class="icons" style="zoom: {zoom};">
    {#if actions.slide_shortcut?.key}
        <div class="button white" style="border: 1px solid var(--secondary);">
            <Button style="padding: 3px;" redHover title="{$dictionary.actions?.remove}: {$dictionary.actions?.play_with_shortcut}" {zoom} on:click={() => changeAction("slide_shortcut")}>
                <p style="font-weight: bold;text-transform: capitalize;padding: 0 4px;font-size: 1.2em;">{actions.slide_shortcut.key}</p>
            </Button>
        </div>
    {/if}

    {#each actionsList as action}
        {#if actions[action.id]}
            <div class="button white">
                <Button style="padding: 3px;" redHover title="{$dictionary.actions?.remove}: {action.title}" {zoom} on:click={() => changeAction(action.id)}>
                    <Icon id={action.icon} size={0.9} white />
                </Button>
            </div>
        {/if}
    {/each}

    <!-- slide actions -->
    {#if actions.slideActions?.length}
        {#each actions.slideActions as action}
            <!-- should be always just one trigger on each action when on a slide -->
            {@const actionId = getActionTriggerId(action.triggers?.[0])}
            {@const actionValue = action?.actionValues?.[actionId] || {}}
            {@const customData = actionData[actionId] || {}}
            {@const customName = getActionName(actionId, actionValue) || (action.name !== translate(customData.name) ? action.name : "")}

            <div class="button {customData.red ? '' : 'white'}">
                <Button
                    style="padding: 3px;"
                    redHover
                    title="{$dictionary.actions?.remove}: {translate(customData.name)}{action.name !== translate(customData.name) ? ` (${action.name})` : ''}"
                    {zoom}
                    on:click={() => deleteSlideAction(action.id || actionId)}
                >
                    {#if customName}<p>{customName}</p>{/if}
                    <Icon id={customData.icon || "actions"} size={0.9} white />
                </Button>
            </div>
        {/each}
    {/if}
</div>

<style>
    .icons {
        pointer-events: none;
        display: flex;
        flex-direction: column;
        position: absolute;
        right: 2px;
        z-index: 1;
        font-size: 0.9em;

        height: 80%;
        flex-wrap: wrap-reverse;
        place-items: end;
    }
    .icons div {
        opacity: 0.9;
        display: flex;
    }
    .icons .button {
        background-color: rgb(0 0 0 / 0.6);
        pointer-events: all;
    }

    .button:not(.white) :global(svg) {
        fill: #ff5050;
    }

    .button p {
        pointer-events: all;
        background-color: rgb(0 0 0 / 0.4);
        padding-right: 5px;
        font-size: 0.8em;
        font-weight: normal;
        max-width: 60px;
    }
</style>
