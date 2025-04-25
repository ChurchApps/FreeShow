<script lang="ts">
    import { activeDays, dictionary, drawerTabsData, events, nextActionEventPaused, nextActionEventStart } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { joinTimeBig } from "../../helpers/time"
    import Button from "../../inputs/Button.svelte"
    import CreateCalendarShow from "../calendar/CreateCalendarShow.svelte"
    import Day from "../calendar/Day.svelte"
    import { getSelectedEvents } from "../calendar/calendar"

    let type = "event"
    $: type = $drawerTabsData.calendar?.activeSubTab || "event"

    let currentEvents: any[] = []
    $: if ($activeDays || $events) currentEvents = getSelectedEvents()

    // $: currentEvents = currentEvents.filter((a) => a.type === type)
</script>

{#if type === "event"}
    {#if $activeDays.length > 1}
        <CreateCalendarShow {currentEvents} />
    {:else}
        <Day {type} />
    {/if}
{:else}
    <Day {type} />

    {#if $nextActionEventStart.timeLeft}
        <Button on:click={() => nextActionEventPaused.set(!$nextActionEventPaused)} title={$nextActionEventPaused ? $dictionary.actions?.start_timer : $dictionary.media?.pause} dark>
            <Icon id={$nextActionEventPaused ? "play" : "pause"} white={$nextActionEventPaused} right />
            {#if $nextActionEventPaused}
                <T id="actions.start_timer" />
            {:else}
                <p>{joinTimeBig($nextActionEventStart.timeLeft / 1000)} <T id="calendar.repeat_until" /> "{$nextActionEventStart.name}"</p>
            {/if}
        </Button>
    {/if}
{/if}
