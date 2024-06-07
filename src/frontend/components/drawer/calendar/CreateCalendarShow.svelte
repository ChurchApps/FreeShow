<script lang="ts">
    import { activePopup, activeProject, calendarAddShow, dictionary, popupData, shows } from "../../../stores"
    import { history } from "../../helpers/history"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Center from "../../system/Center.svelte"
    import { createSlides } from "./calendar"

    export let currentEvents: any[] = []

    async function createShow() {
        let { show } = await createSlides(currentEvents)
        // new calendar shows are private
        history({ id: "UPDATE", newData: { data: show, remember: { project: $activeProject } }, location: { page: "show", id: "show" } })
    }

    $: if ($popupData?.action === "select_show" && $popupData?.location === "calendar" && $popupData?.showId) selectedShow()
    function selectedShow() {
        calendarAddShow.set($popupData.id)
        popupData.set({})
    }
</script>

<div class="main border">
    <div class="main" style="padding: 10px;">
        {#if currentEvents.length}
            {#each currentEvents as day}
                <b style="margin-top: 10px;">{new Date(day.date).getDate()}. {$dictionary.month?.[new Date(day.date).getMonth() + 1]}</b>
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

    <div class="options">
        <Button
            on:click={() => {
                if ($calendarAddShow) {
                    calendarAddShow.set("")
                    return
                }

                popupData.set({ action: "select_show", location: "calendar" })
                activePopup.set("select_show")
            }}
            style="flex: 1;overflow: hidden;"
            dark
            center
        >
            <Icon id="showIcon" right />
            <p style="white-space: normal;"><T id="calendar.add_slides_from_show" />{$calendarAddShow ? ": " + $shows[$calendarAddShow]?.name || "—" : ""}</p>
        </Button>
    </div>

    <Button on:click={createShow} disabled={!currentEvents.length} dark center>
        <Icon id="show" right />
        <T id="new.show" />
        {#if currentEvents.length > 1}
            <span style="opacity: 0.5;margin-left: 0.5em;">({currentEvents.length})</span>
        {/if}
    </Button>
</div>

<style>
    .main {
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        overflow-x: hidden;
        height: 100%;
    }

    .options {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        background-color: var(--primary-darker);
    }
</style>
