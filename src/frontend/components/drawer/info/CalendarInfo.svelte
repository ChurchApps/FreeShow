<script lang="ts">
    import { activeDays, calendarAddShow, drawerTabsData, events, language, nextActionEventPaused, nextActionEventStart, shows, special } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { joinTimeBig } from "../../helpers/time"
    import Button from "../../inputs/Button.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialPopupButton from "../../inputs/MaterialPopupButton.svelte"
    import CreateCalendarShow from "../calendar/CreateCalendarShow.svelte"
    import Day from "../calendar/Day.svelte"
    import { getSelectedEvents } from "../calendar/calendar"

    export let optionsOpen: boolean

    let type = "event"
    $: type = $drawerTabsData.calendar?.activeSubTab || "event"

    let currentEvents: any[] = []
    $: if ($activeDays || $events) currentEvents = getSelectedEvents()

    // $: currentEvents = currentEvents.filter((a) => a.type === type)

    function updateSpecial(value, key) {
        special.update((a) => {
            a[key] = value
            return a
        })
    }

    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Locale/getWeekInfo
    const firstWeekDayOptions = [
        { value: "1", label: translateText("weekday.1"), style: "text-transform: capitalize;" },
        { value: "7", label: translateText("weekday.7"), style: "text-transform: capitalize;" }
    ]

    $: if (!$special.firstDayOfWeek) getPreferredFirstDay()
    function getPreferredFirstDay() {
        const localeInfo: any = new Intl.Locale(navigator.language || $language)
        const firstDay = localeInfo.getWeekInfo().firstDay
        if (firstDay) updateSpecial(firstDay.toString(), "firstDayOfWeek")
    }
</script>

{#if optionsOpen}
    <main style="flex: 1;overflow-x: hidden;padding: 10px;">
        <MaterialDropdown label="calendar.first_day" options={firstWeekDayOptions} value={$special.firstDayOfWeek || "1"} on:change={(e) => updateSpecial(e.detail, "firstDayOfWeek")} />

        {#if type === "event"}
            <!-- create show options -->
            <MaterialPopupButton label="calendar.add_slides_from_show" style="margin-top: 5px;" value={$calendarAddShow} name={$shows[$calendarAddShow]?.name || "—"} popupId="select_show" icon="showIcon" data={{ action: "select_show", location: "calendar" }} on:change={(e) => calendarAddShow.set(e.detail)} allowEmpty />
        {/if}
    </main>
{:else if type === "event"}
    {#if $activeDays.length > 1}
        <CreateCalendarShow {currentEvents} />
    {:else}
        <Day {type} />
    {/if}
{:else}
    <Day {type} />

    {#if $nextActionEventStart.timeLeft}
        <Button on:click={() => nextActionEventPaused.set(!$nextActionEventPaused)} title={translateText($nextActionEventPaused ? "actions.start_timer" : "media.pause")} dark>
            <Icon id={$nextActionEventPaused ? "play" : "pause"} white={$nextActionEventPaused} right />
            {#if $nextActionEventPaused}
                <T id="actions.start_timer" />
            {:else}
                <p>{joinTimeBig($nextActionEventStart.timeLeft / 1000)} <T id="calendar.repeat_until" /> "{$nextActionEventStart.name}"</p>
            {/if}
        </Button>
    {/if}
{/if}
