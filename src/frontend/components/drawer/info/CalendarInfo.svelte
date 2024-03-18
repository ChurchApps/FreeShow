<script lang="ts">
    import { activeDays, activeTimers, dictionary, drawerTabsData, events, nextShowEventPaused, nextShowEventStart } from "../../../stores"
    import CreateCalendarShow from "../calendar/CreateCalendarShow.svelte"
    import Day from "../calendar/Day.svelte"
    import { getSelectedEvents } from "../calendar/calendar"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { joinTimeBig } from "../../helpers/time"
    import Button from "../../inputs/Button.svelte"
    import TimerInfo from "../timers/TimerInfo.svelte"

    let type: string = "event"
    $: type = $drawerTabsData.calendar?.activeSubTab || "event"

    let currentEvents: any[] = []
    activeDays.subscribe(() => {
        currentEvents = getSelectedEvents()
    })
    events.subscribe(() => {
        currentEvents = getSelectedEvents()
    })

    // $: currentEvents = currentEvents.filter((a) => a.type === type)
</script>

{#if type === "timer"}
    {#if $activeTimers.length}
        <TimerInfo />
    {/if}
{:else if type === "event"}
    {#if $activeDays.length > 1}
        <CreateCalendarShow {currentEvents} />
    {:else}
        <Day {type} />
    {/if}
{:else}
    <Day {type} />

    {#if $nextShowEventStart.timeLeft}
        <Button on:click={() => nextShowEventPaused.set(!$nextShowEventPaused)} title={$nextShowEventPaused ? $dictionary.actions?.start_timer : $dictionary.media?.pause} dark>
            <Icon id={$nextShowEventPaused ? "play" : "pause"} white={$nextShowEventPaused} right />
            {#if $nextShowEventPaused}
                <T id="actions.start_timer" />
            {:else}
                <p>{joinTimeBig($nextShowEventStart.timeLeft / 1000)} <T id="calendar.repeat_until" /> "{$nextShowEventStart.name}"</p>
            {/if}
        </Button>
    {/if}
{/if}
