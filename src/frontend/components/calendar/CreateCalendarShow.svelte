<script lang="ts">
    import { activeDays, activeProject, dictionary, events } from "../../stores"
    import { history } from "../helpers/history"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"
    import Center from "../system/Center.svelte"
    import { createSlides, getSelectedEvents } from "./calendar"

    let currentEvents: any[] = []
    activeDays.subscribe(() => {
        currentEvents = getSelectedEvents()
    })
    events.subscribe(() => {
        currentEvents = getSelectedEvents()
    })

    function createShow() {
        let { show } = createSlides(currentEvents)
        // new calendar shows are private
        history({ id: "UPDATE", newData: { data: show, remember: { project: $activeProject } }, location: { page: "show", id: "show" } })
    }
</script>

<div class="main border">
    {#if currentEvents.length}
        {#each currentEvents as day}
            {#if currentEvents.length > 1}
                <b style="margin-top: 10px;">{new Date(day.date).getDate()}. {$dictionary.month?.[new Date(day.date).getMonth() + 1]}</b>
            {/if}
            <ul style="list-style-position: inside;">
                {#each day.events as event}
                    <li class="event">
                        <p style="display: inline;color: {event.color || 'unset'}">
                            {#if event.name}
                                {event.name}
                            {:else}
                                <span style="opacity: 0.5;">
                                    <T id="main.unnamed" />
                                </span>
                            {/if}
                        </p>
                    </li>
                {/each}
            </ul>
        {/each}
    {:else}
        <Center faded>
            <T id="empty.events" />
        </Center>
    {/if}
</div>
<Button on:click={createShow} disabled={!currentEvents.length} dark center>
    <Icon id="show" right />
    <T id="new.show" />
    {#if currentEvents.length > 1}
        <span style="opacity: 0.5;margin-left: 0.5em;">({currentEvents.length})</span>
    {/if}
</Button>

<!-- TODO: settings -->

<!-- add transition, replace near dates with weekday, display position & notes -->
<style>
    .main {
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        overflow-x: hidden;
        height: 100%;
        padding: 10px;
    }
</style>
