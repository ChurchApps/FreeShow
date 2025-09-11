<script lang="ts">
    import { onDestroy } from "svelte"
    import { activePopup, activeTimers, dictionary, disableDragging, labelsDisabled, timers } from "../../../stores"
    import { getAccess } from "../../../utils/profile"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { clone, keysToID, sortByName } from "../../helpers/array"
    import FloatingInputs from "../../input/FloatingInputs.svelte"
    import Button from "../../inputs/Button.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import Slider from "../../inputs/Slider.svelte"
    import Timer from "../../slide/views/Timer.svelte"
    import Center from "../../system/Center.svelte"
    import SelectElem from "../../system/SelectElem.svelte"
    import { getCurrentTimerValue, playPauseGlobal, resetTimer } from "./timers"

    export let searchValue

    const profile = getAccess("functions")
    const readOnly = profile.timers === "read"

    // $: sortedTimers = getSortedTimers($timers)
    const typeOrder = { counter: 1, clock: 2, event: 3 }
    $: sortedTimers = sortByName(keysToID(clone($timers)), "name", true).sort((a, b) => typeOrder[a.type] - typeOrder[b.type])
    $: sortedTimersWithProject = sortedTimers.sort((a, b) => (list.includes(a.id) && !list.includes(b.id) ? -1 : 1))
    $: filteredTimers = searchValue.length > 1 ? sortedTimersWithProject.filter((a) => a.name.toLowerCase().includes(searchValue.toLowerCase())) : sortedTimersWithProject

    // place timers in shows in project first
    let list: string[] = []
    // $: projectShows = $projects[$activeProject!]?.shows || []
    // $: if (projectShows.length || $showsCache || $timers) getList()
    // async function getList() {
    //     list = (await loadProjectTimers(projectShows)).filter((id) => $timers[id])
    // }

    let today = new Date()
    const interval = setInterval(() => (today = new Date()), 1000)
    onDestroy(() => clearInterval(interval))

    function getCurrentValue(timer: any, ref: any, _updater: any) {
        let currentTime = getCurrentTimerValue(timer, ref, today)
        // if (timer.end < timer.start) currentTime = timer.start - currentTime
        return currentTime
    }

    function updateActiveTimer(e: any, ref: any, timer: any) {
        let time = Number(e.target.value)
        activeTimers.update((a) => {
            let index = a.findIndex((timer) => (ref.showId ? ref.showId === timer.showId && ref.slideId === timer.slideId && ref.id === timer.id : timer.id === ref.id))
            if (index < 0) a.push({ ...timer, ...ref, currentTime: time, paused: true })
            else {
                a[index].currentTime = time
                delete a[index].startTime
            }

            return a
        })
    }

    const timerTypeNames = {
        counter: "timer.from_to",
        clock: "timer.to_time",
        event: "timer.to_event"
    }
</script>

<svelte:window on:mouseup={() => disableDragging.set(false)} />

{#if filteredTimers.length}
    <div class="timers">
        {#each filteredTimers as timer, i}
            {@const title = timer.type === filteredTimers[i - 1]?.type ? "" : timer.type}
            {@const isPlaying = timer.type !== "counter" || $activeTimers.find((a) => a.id === timer.id && a.paused !== true)}

            {#if i === 0 && list.length}
                <h5><T id="remote.project" /></h5>
            {:else if title && i > 0}
                <h5><T id={timerTypeNames[title]} /></h5>
            {/if}

            <!-- {@const playing = $activeTimers.find((a) => a.id === id && a.paused !== true)} -->
            <SelectElem id="global_timer" data={timer} draggable>
                <div class:outline={$activeTimers.find((a) => a.id === timer.id)} class:project={list.includes(timer.id)} class="context #global_timer{readOnly ? '_readonly' : ''}" style="display: flex;justify-content: space-between;padding: 3px;">
                    <div style="display: flex;width: 50%;">
                        <Button disabled={timer.type !== "counter"} on:click={() => playPauseGlobal(timer.id, timer)} title={$activeTimers.find((a) => a.id === timer.id && a.paused !== true) ? $dictionary.media?.pause : $dictionary.media?.play}>
                            <Icon id={isPlaying ? "pause" : "play"} white={!isPlaying} />
                        </Button>
                        <p style="align-self: center;padding: 0 5px;min-width: 100px;" data-title={timer.name}>
                            {#if timer.name}
                                {timer.name}
                            {:else}
                                <span style="opacity: 0.5;">
                                    <T id="main.unnamed" />
                                </span>
                            {/if}
                        </p>
                    </div>

                    {#if timer.type === "counter"}
                        <Slider
                            style="background: var(--primary);align-self: center;margin: 0 10px;"
                            on:input={(e) => updateActiveTimer(e, { id: timer.id }, timer)}
                            on:mousedown={() => disableDragging.set(true)}
                            value={getCurrentValue(timer, { id: timer.id }, $activeTimers)}
                            min={Math.min(timer.start || 0, timer.end || 0)}
                            max={Math.max(timer.start || 0, timer.end || 0)}
                            invert={(timer.end || 0) < (timer.start || 0)}
                        />
                    {/if}

                    <div style="display: flex;min-width: 125px;justify-content: end;">
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
                            <Button on:click={() => resetTimer(timer.id)} title={$dictionary.media?.stop} disabled={!$activeTimers.find((a) => a.id === timer.id)}>
                                <Icon id="stop" white={!isPlaying} />
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

<FloatingInputs onlyOne>
    <MaterialButton disabled={readOnly} icon="add" title="new.timer" on:click={() => activePopup.set("timer")}>
        {#if !$labelsDisabled}<T id="new.timer" />{/if}
    </MaterialButton>
</FloatingInputs>

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

    h5 {
        overflow: visible;
        text-align: center;
        padding: 5px;
        background-color: var(--primary-darkest);
        color: var(--text);
        font-size: 0.8em;
        text-transform: uppercase;
    }
</style>
