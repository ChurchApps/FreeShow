<script lang="ts">
    import { Main } from "../../../types/IPC/Main"
    import type { Show } from "../../../types/Show"
    import { sendMain } from "../../IPC/main"
    import { activeDrawerTab, activeShow, drawer, labelsDisabled, openScripture, scriptures, shows } from "../../stores"
    import { createSlides, getDateString, getSelectedEvents, sortDays } from "../drawer/calendar/calendar"
    import { history } from "../helpers/history"
    import { setDrawerTabData } from "../helpers/historyHelpers"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"

    export let show: Show

    $: data = show?.reference?.data || {}

    async function updateCalendar() {
        let currentEvents = getSelectedEvents(data.days)

        let showId: string = $activeShow?.id || ""
        let slidesData = await createSlides(currentEvents, showId)

        history({ id: "UPDATE", newData: { data: slidesData.show }, oldData: { id: showId }, location: { page: "show", id: "show_key" } })
    }

    function getDaysString() {
        let { sortedDays, from, to } = sortDays(data.days)
        let string = getDateString(from)
        if (sortedDays[0] - sortedDays[1] < 0) string += " - " + getDateString(to)
        return string
    }

    function openTab() {
        let collection = data.collection
        if (!collection || !show) return

        let scriptureId = $scriptures[collection] ? collection : Object.values($scriptures).find((a) => a.id === collection)
        if (!scriptureId) return

        openScripture.set(show.reference!.data)

        setDrawerTabData("scripture", collection)
        activeDrawerTab.set("scripture")
        // WIP set book, chapter and verses too

        // open drawer if closed
        if ($drawer.height <= 40) drawer.set({ height: $drawer.stored || 300, stored: null })
    }

    function openURL(url: string) {
        sendMain(Main.URL, url)
    }

    function removeMarkdownURL(text: string) {
        return text.replace(/\[([^\]]+)\][^\)]+\)/g, "$1")
    }
</script>

<div>
    {#if show?.reference?.type === "calendar"}
        <p>
            <T id="menu.calendar" />: {getDaysString()}
            {#if data.show && $shows[data.show]}
                {" + "}{$shows[show.reference.data.show].name}
            {/if}
        </p>

        <Button on:click={updateCalendar} style="white-space: nowrap;">
            <Icon id="calendar" right={!$labelsDisabled} />
            {#if !$labelsDisabled}<T id="show.update" />{/if}
        </Button>
    {:else if show?.reference?.type === "scripture"}
        <p data-title={data.version || ""}><T id="tabs.scripture" />: {data.version || ""}</p>

        <Button on:click={openTab} style="white-space: nowrap;">
            <Icon id="scripture" right={!$labelsDisabled} />
            {#if !$labelsDisabled}<T id="main.open" />{/if}
        </Button>
    {:else if show?.reference?.type === "lessons"}
        <p>
            {#if data.studyName}
                {data.studyName}{#if data.about}:{/if}
            {/if}
            {#if data.about}
                <span style="font-size: 0.8em;opacity: 0.8;">{removeMarkdownURL(data.about)}</span>
            {/if}
        </p>

        <Button title="Open Lessons.church Website" on:click={() => openURL("https://lessons.church")} style="white-space: nowrap;">
            <Icon id="book" right />
            Lessons.church
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
        opacity: 0.8;
    }
</style>
