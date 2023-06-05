<script lang="ts">
    import type { Show } from "../../../types/Show"
    import { activeDrawerTab, activeShow, drawer, drawerTabsData, scriptures, shows } from "../../stores"
    import { createSlides, getDateString, getSelectedEvents, sortDays } from "../calendar/calendar"
    import { history } from "../helpers/history"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"

    export let show: Show

    $: console.log(show)

    async function updateCalendar() {
        let currentEvents: any[] = getSelectedEvents(show.reference?.data?.days)

        let showId: string = $activeShow?.id || ""
        let data = await createSlides(currentEvents, showId)

        history({ id: "UPDATE", newData: { data: data.show }, oldData: { id: showId }, location: { page: "show", id: "show_key" } })
    }

    function getDaysString() {
        let { sortedDays, from, to } = sortDays(show.reference?.data?.days)
        let string = getDateString(from)
        if (sortedDays[0] - sortedDays[1] < 0) string += " - " + getDateString(to)
        return string
    }

    function openTab() {
        let collection = show.reference?.data?.collection
        if (!collection || !$scriptures[collection]) return

        drawerTabsData.update((a) => {
            a.scripture.activeSubTab = collection
            return a
        })
        activeDrawerTab.set("scripture")
        // WIP set book, chapter and verses too

        // open drawer if closed
        if ($drawer.height <= 40) drawer.set({ height: $drawer.stored || 300, stored: null })
    }
</script>

<div>
    {#if show.reference?.type === "calendar"}
        <p>
            <T id="menu.calendar" />: {getDaysString()}
            {#if show.reference?.data?.show && $shows[show.reference?.data?.show]}
                {" + "}{$shows[show.reference.data.show].name}
            {/if}
        </p>
        <Button on:click={updateCalendar} style="white-space: nowrap;" dark>
            <Icon id="calendar" right />
            <T id="show.update" />
        </Button>
    {:else if show.reference?.type === "scripture"}
        <p title={show.reference?.data?.version || ""}><T id="tabs.scripture" />: {show.reference?.data?.version || ""}</p>
        <Button on:click={openTab} style="white-space: nowrap;" dark>
            <Icon id="scripture" right />
            <T id="tabs.scripture" />
        </Button>
    {/if}
</div>

<style>
    div {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        overflow: hidden;
    }

    p {
        padding: 0 10px;
    }
</style>
