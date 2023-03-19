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
        let newData = createSlides(currentEvents)
        history({ id: "newShow", newData, location: { page: "show", project: $activeProject || undefined } })
    }

    // function createCategory() {
    //   // TODO: history
    //   categories.update((a) => {
    //     a.event = { name: "category.events", icon: "event", default: true }
    //     return a
    //   })
    // }
</script>

<div class="main border">
    <!-- <span style="opacity: 0.8;text-align: center;font-size: 1.2em;">
    {from.getDate()}. {$dictionary.month?.[from.getMonth() + 1]}
    {from.getFullYear()}
    {#if sortedDays[0] - sortedDays[1] < 0}
      - {to.getDate()}. {$dictionary.month?.[to.getMonth() + 1]}
      {to.getFullYear()}
    {/if}
  </span>
  <br /> -->
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
