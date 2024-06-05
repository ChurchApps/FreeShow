<script lang="ts">
    import { dictionary } from "../../stores"
    import { translate } from "../../utils/language"
    import { actionData } from "../actions/actionData"
    import { clone } from "../helpers/array"
    import { history } from "../helpers/history"
    import Icon from "../helpers/Icon.svelte"
    import Button from "../inputs/Button.svelte"

    export let columns: number
    export let index: number
    export let actions: any

    function changeAction(id: string, save: boolean = true) {
        let data = { ...actions, [id]: actions[id] ? !actions[id] : true }

        if (id === "outputStyle" && !data[id]) delete data.styleOutputs

        history({ id: "SHOW_LAYOUT", save, newData: { key: "actions", data, indexes: [index] } })
    }

    function deleteSlideAction(id: string) {
        let slideActions = clone(actions.slideActions)
        let actionIndex = actions.slideActions.findIndex((a) => a.id === id)
        slideActions.splice(actionIndex, 1)

        let data = { ...actions, slideActions }

        history({ id: "SHOW_LAYOUT", newData: { key: "actions", data, indexes: [index] } })
    }

    const actionsList: any = [
        { id: "nextAfterMedia", title: $dictionary.actions?.next_after_media, icon: "forward" },
        { id: "animate", title: $dictionary.popup?.animate, icon: "stars" },
        { id: "receiveMidi", title: $dictionary.actions?.play_on_midi, icon: "play" },
    ]

    $: zoom = 4 / columns
</script>

<div class="icons" style="zoom: {zoom};">
    {#each actionsList as action}
        {#if actions[action.id]}
            <div class="button white">
                <Button style="padding: 3px;" redHover title="{$dictionary.actions?.remove}: {action.name}" {zoom} on:click={() => changeAction(action.id)}>
                    {#if action.getName}
                        <p>{action.getName(actions[action.id])}</p>
                    {/if}
                    <Icon id={action.icon} size={0.9} white />
                </Button>
            </div>
        {/if}
    {/each}

    <!-- slide actions -->
    {#if actions.slideActions?.length}
        {#each Object.keys(actionData) as actionId}
            <!-- should be always just one trigger on each action when on a slide -->
            {@const action = actions.slideActions.find((a) => a.triggers?.[0] === actionId)}
            {@const customData = actionData[actionId] || {}}

            {#if action}
                <div class="button {customData.red ? '' : 'white'}">
                    <Button style="padding: 3px;" redHover title="{$dictionary.actions?.remove}: {translate(customData.name)}" {zoom} on:click={() => deleteSlideAction(actionId)}>
                        {#if customData.getName}
                            <p>{customData.getName(actions.slideActions.actionValues?.[actionId]?.id)}</p>
                        {/if}
                        <Icon id={customData.icon || "actions"} size={0.9} white />
                    </Button>
                </div>
            {/if}
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
