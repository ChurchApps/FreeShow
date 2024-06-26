<script lang="ts">
    import { activeDays, activePopup, dictionary, eventEdit, events } from "../../../stores"
    import { actionData } from "../../actions/actionData"
    import { getActionName } from "../../actions/actions"
    import { sortByTime } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Center from "../../system/Center.svelte"
    import { copyDate, getTime, isBetween, isSameDay } from "./calendar"

    export let type: string = "event"

    let current = new Date($activeDays[0])
    let currentEvents: any[] = []

    activeDays.subscribe(updateEvents)
    events.subscribe(updateEvents)
    $: if (type) updateEvents()

    function updateEvents() {
        current = new Date($activeDays[0])
        let tempEvents: any[] = []

        Object.entries($events).forEach(([id, a]) => {
            if (isBetween(new Date(a.from), new Date(a.to), copyDate(current))) tempEvents.push({ id, ...a })
        })

        // sort
        tempEvents = tempEvents.filter((a) => a.type === type)
        currentEvents = tempEvents.sort(sortByTime)
    }

    function getEventIcon(type: string, { actionId }) {
        if (type === "event") return "calendar"
        if (type === "action") return actionData[actionId]?.icon || "actions"
        return type
    }
</script>

{#if $activeDays.length}
    <div class="main">
        <span class="date">
            {current.getDate()}. {$dictionary.month?.[current.getMonth() + 1]}
            {current.getFullYear()}
        </span>

        <div class="scroll">
            {#if currentEvents.length}
                {#each currentEvents as event}
                    {@const eventIcon = getEventIcon(event.type, { actionId: event.action?.id })}
                    {@const customName = type === "action" ? getActionName(event.action?.id, event.action?.data) : ""}

                    <div
                        class="event context #event"
                        style="color: {event.color || 'unset'}"
                        id={event.id}
                        title={customName}
                        on:click={() => {
                            eventEdit.set(event.id)
                            activePopup.set("edit_event")
                        }}
                    >
                        {#if event.time}
                            <span class="time">
                                {#if isSameDay(new Date(event.from), current)}
                                    {getTime(new Date(event.from))}
                                {/if}
                                {#if !isSameDay(new Date(event.from), current) || new Date(event.from).getTime() - new Date(event.to).getTime() > 0}
                                    {#if isSameDay(new Date(event.to), current)}
                                        {#if isSameDay(new Date(event.from), current)}
                                            -
                                        {/if}
                                        {getTime(new Date(event.to))}
                                    {/if}
                                {/if}
                            </span>
                        {/if}

                        <div style="display: flex;align-items: center;overflow: hidden;">
                            <Icon id={eventIcon} right white />
                            <p>
                                {#if event.name}
                                    {#if customName}
                                        {event.name}: {customName}
                                    {:else}
                                        {event.name}
                                    {/if}
                                {:else}
                                    <span style="opacity: 0.5;">
                                        <T id="main.unnamed" />
                                    </span>
                                {/if}
                            </p>
                        </div>
                    </div>
                {/each}
            {:else}
                <Center faded>
                    <T id="empty.events" />
                </Center>
            {/if}
        </div>
    </div>
{/if}

<style>
    .main {
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        overflow-x: hidden;
        height: 100%;
        padding: 10px;
    }

    .date {
        font-size: 1.6em;
        display: flex;
        justify-content: center;
        font-weight: 600;
        white-space: nowrap;
        margin-bottom: 10px;
    }

    .scroll {
        height: 100%;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        /* gap: 5px; */
    }

    .event {
        background-color: var(--primary-darker);
        padding: 10px;
        display: flex;
        cursor: pointer;
    }
    .event:hover {
        background-color: var(--hover);
    }

    .time {
        padding-right: 10px;
        color: var(--text);
        opacity: 0.9;
        white-space: nowrap;
    }
</style>
