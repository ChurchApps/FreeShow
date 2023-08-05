<script lang="ts">
    import { activePopup, activeProject, activeTimers, dictionary, labelsDisabled, projects, showsCache, timers } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Slider from "../../inputs/Slider.svelte"
    import Timer from "../../slide/views/Timer.svelte"
    import Center from "../../system/Center.svelte"
    import SelectElem from "../../system/SelectElem.svelte"
    import { getCurrentTimerValue, loadProjectTimers, playPauseGlobal, resetTimer } from "./timers"

    export let searchValue

    $: globalList = Object.entries($timers).map(([id, a]) => ({ ...a, id }))

    $: sortedTimers = globalList.sort((a, b) => a.name.localeCompare(b.name))
    $: sortedTimersWithProject = sortedTimers.sort((a, b) => (list.includes(a.id) && !list.includes(b.id) ? -1 : 1))
    $: filteredTimers = searchValue.length > 1 ? sortedTimersWithProject.filter((a) => a.name.toLowerCase().includes(searchValue.toLowerCase())) : sortedTimersWithProject

    // project
    $: projectShows = $projects[$activeProject!]?.shows || []
    let list: string[] = []
    $: if (projectShows.length || $showsCache) getList()
    async function getList() {
        list = await loadProjectTimers(projectShows)
    }

    // TODO: check overlays

    let today = new Date()
    setInterval(() => (today = new Date()), 1000)

    function getCurrentValue(timer: any, ref: any, _updater: any) {
        let currentTime = getCurrentTimerValue(timer, ref, today)
        console.log(currentTime)
        // if (timer.end < timer.start) currentTime = timer.start - currentTime
        return currentTime
    }

    function updateActiveTimer(e: any, ref: any, timer: any) {
        let time = Number(e.target.value)
        activeTimers.update((a) => {
            let index = a.findIndex((timer) => (ref.showId ? ref.showId === timer.showId && ref.slideId === timer.slideId && ref.id === timer.id : timer.id === ref.id))
            if (index < 0) a.push({ ...timer, ...ref, currentTime: time, paused: true })
            else a[index].currentTime = time
            return a
        })
    }
</script>

<!-- TODO: sort by type (category) -->

{#if filteredTimers.length}
    <div class="timers">
        {#each filteredTimers as timer}
            <!-- {@const playing = $activeTimers.find((a) => a.id === id && a.paused !== true)} -->
            <SelectElem id="global_timer" data={timer}>
                <div class:outline={$activeTimers.find((a) => a.id === timer.id)} class:project={list.includes(timer.id)} class="context #global_timer" style="display: flex;justify-content: space-between;padding: 3px;">
                    <div style="display: flex;width: 50%;">
                        <Button disabled={timer.type !== "counter"} on:click={() => playPauseGlobal(timer.id, timer)} title={$activeTimers.find((a) => a.id === timer.id && a.paused !== true) ? $dictionary.media?.pause : $dictionary.media?.play}>
                            <Icon id={timer.type !== "counter" || $activeTimers.find((a) => a.id === timer.id && a.paused !== true) ? "pause" : "play"} />
                        </Button>
                        <p style="align-self: center;padding: 0 5px;" title={timer.name}>
                            {#if timer.name}
                                {timer.name}
                            {:else}
                                <span style="opacity: 0.5;">
                                    <T id="main.unnamed" />
                                </span>
                            {/if}
                        </p>
                    </div>

                    <Slider
                        style="background: var(--primary);align-self: center;margin: 0 10px;"
                        on:input={(e) => updateActiveTimer(e, { id: timer.id }, timer)}
                        value={getCurrentValue(timer, { id: timer.id }, $activeTimers)}
                        min={Math.min(timer.start || 0, timer.end || 0)}
                        max={Math.max(timer.start || 0, timer.end || 0)}
                        invert={(timer.end || 0) < (timer.start || 0)}
                    />

                    <div style="display: flex;">
                        <span style="display: flex;align-self: center;padding: 0 5px;">
                            <Timer id={timer.id} {today} />
                            <!-- {getTimes(list[active].timer.start, list[active].timer.format)} -->
                        </span>
                        <!-- <Button
        on:click={() => {
            select("timer", { id })
            activePopup.set("timer")
        }}
        title={$dictionary.menu?.edit}
        >
        <Icon id="edit" />
        </Button> -->
                        {#if timer.type === "counter"}
                            <Button on:click={() => resetTimer(timer.id)} title={$dictionary.actions?.reset}>
                                <Icon id="reset" />
                            </Button>
                        {/if}
                        <!-- <Button on:click={() => deleteTimer(id)}>
        <Icon id="delete" title={$dictionary.actions?.delete} />
        </Button> -->
                    </div>
                </div>
            </SelectElem>
        {/each}
    </div>
{:else}
    <Center faded>
        <T id="empty.timers" />
    </Center>
{/if}

<div style="display: flex;background-color: var(--primary-darkest);">
    <!-- TODO: enable!! -->
    <Button style="flex: 1;" on:click={() => activePopup.set("timer")} center title={$dictionary.new?.timer}>
        <Icon id="add" right={!$labelsDisabled} />
        {#if !$labelsDisabled}<T id="new.timer" />{/if}
    </Button>
</div>

<style>
    .timers {
        flex: 1;
        overflow: auto;
    }
    .timers :global(.selectElem:not(.isSelected):nth-child(even)) {
        background-color: rgb(0 0 20 / 0.08);
    }

    .timers div.outline {
        outline-offset: -2px;
        outline: 2px solid var(--secondary) !important;
    }

    .timers div.project {
        background-color: var(--primary-darkest);
    }
</style>
