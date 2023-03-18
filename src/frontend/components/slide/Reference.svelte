<script lang="ts">
    import type { Show } from "../../../types/Show"
    import { activeShow, showsCache } from "../../stores"
    import { createSlides, getDateString, getSelectedEvents, sortDays } from "../calendar/calendar"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"

    export let show: Show

    $: console.log(show)

    function updateCalendar() {
        let currentEvents: any[] = getSelectedEvents(show.reference?.data?.days)

        let showId: string = $activeShow?.id || ""
        let newData = createSlides(currentEvents, showId)
        console.log(newData)
        // history({ id: "updateShow", newData: { key: "slides", values: [newData.show.slides] }, location: { page: "show", shows: [{ id: showId }] } })
        // TODO: history
        showsCache.update((a) => {
            a[showId] = newData.show
            return a
        })
    }

    function getDaysString() {
        let { sortedDays, from, to } = sortDays(show.reference?.data?.days)
        let string = getDateString(from)
        if (sortedDays[0] - sortedDays[1] < 0) string += " - " + getDateString(to)
        return string
    }
</script>

<div>
    {#if show.reference?.type === "calendar"}
        <span><T id="menu.calendar" />: {getDaysString()}</span>
        <Button on:click={updateCalendar} style="color: var(--secondary);" dark>
            <Icon id="calendar" right />
            <T id="show.update" />
        </Button>
    {:else if show.reference?.type === "scripture"}
        <span><T id="tabs.scripture" />: {show.reference?.data?.version || ""}</span>
    {/if}
</div>

<style>
    div {
        display: flex;
        justify-content: space-between;
        width: 100%;
    }

    span {
        padding: 0 10px;
    }
</style>
