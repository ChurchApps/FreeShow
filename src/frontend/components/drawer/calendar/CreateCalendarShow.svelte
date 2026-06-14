<script lang="ts">
    import { activeProject, calendarAddShow, popupData } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { history } from "../../helpers/history"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import Center from "../../system/Center.svelte"
    import { createSlides } from "./calendar"

    export let currentEvents: any[] = []

    async function createShow() {
        const { show } = await createSlides(currentEvents)
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
                <b style="margin-top: 10px;">{new Date(day.date).getDate()}. {translateText("month." + (new Date(day.date).getMonth() + 1))}</b>
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

            <MaterialButton variant="outlined" icon="slide" style="margin-top: 10px;" info={currentEvents.length > 1 ? `${currentEvents.length}` : ""} on:click={createShow}>
                <T id="new.show_convert" />
            </MaterialButton>
        {:else}
            <Center faded>
                <T id="empty.events" />
            </Center>
        {/if}
    </div>
</div>

<style>
    .main {
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        overflow-x: hidden;
        height: 100%;
    }
</style>
