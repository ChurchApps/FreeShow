<script lang="ts">
    import { onDestroy } from "svelte"
    import { activePopup, activeTimers, disableDragging, labelsDisabled, timers, activeTimerTagFilter } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { getAccess } from "../../../utils/profile"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { clone, keysToID, sortByName } from "../../helpers/array"
    import { joinTime, secondsToTime } from "../../helpers/time"
    import FloatingInputs from "../../input/FloatingInputs.svelte"
    import Button from "../../inputs/Button.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import Slider from "../../inputs/Slider.svelte"
    import Timer from "../../slide/views/Timer.svelte"
    import Center from "../../system/Center.svelte"
    import SelectElem from "../../system/SelectElem.svelte"
    import { getCurrentTimerValue, getTimerDynamicValue, playPauseGlobal, resetTimer } from "./timers"
    import { openDrawer } from "../../edit/scripts/edit"

    export let searchValue
    export let onlyPlaying: boolean = false

    const profile = getAccess("timers")
    const readOnly = profile.global === "read"

    // $: sortedTimers = getSortedTimers($timers)
    const typeOrder = { counter: 1, clock: 2, event: 3 }
    $: sortedTimers = sortByName(keysToID(clone($timers)), "name", true)
        .filter((a) => (onlyPlaying ? a.type === "counter" && $activeTimers.some((at) => a.id === at.id) : true))
        .sort((a, b) => typeOrder[a.type] - typeOrder[b.type])
    $: filteredTimersTags = sortedTimers.filter((a) => !$activeTimerTagFilter.length || (a.tags?.length && !$activeTimerTagFilter.find((tagId) => !a.tags?.includes(tagId)))).filter((a) => !a.tags?.some((tagId) => profile[tagId] === "none"))
    $: sortedTimersWithProject = filteredTimersTags.sort((a, b) => (list.includes(a.id) && !list.includes(b.id) ? -1 : 1))
    $: filteredTimers = searchValue.length > 1 ? sortedTimersWithProject.filter((a) => a.name.toLowerCase().includes(searchValue.toLowerCase())) : sortedTimersWithProject

    // place timers in shows in project first
    const list: string[] = []
    // $: projectShows = $projects[$activeProject!]?.shows || []
    // $: if (projectShows.length || $showsCache || $timers) getList()
    // async function getList() {
    //     list = (await loadProjectTimers(projectShows)).filter((id) => $timers[id])
    // }

    let today = new Date()
    const interval = setInterval(() => (today = new Date()), 1000)
    onDestroy(() => clearInterval(interval))

    function getCurrentValue(timer: any, ref: any, _updater: any) {
        const currentTime = getCurrentTimerValue(timer, ref, today)
        // if (timer.end < timer.start) currentTime = timer.start - currentTime
        return currentTime
    }

    function adjustTimer(delta: number, ref: any, minVal: number, maxVal: number) {
        activeTimers.update((a) => {
            const index = a.findIndex((t) => (ref.showId ? ref.showId === t.showId && ref.slideId === t.slideId && ref.id === t.id : t.id === ref.id))
            if (index < 0) return a
            const current = a[index].currentTime ?? minVal
            a[index].currentTime = Math.max(minVal, Math.min(maxVal, current + delta))
            delete a[index].startTime
            return a
        })
    }

    function updateActiveTimer(e: any, ref: any, timer: any) {
        const time = Number(e.target.value)
        activeTimers.update((a) => {
            const index = a.findIndex((timer) => (ref.showId ? ref.showId === timer.showId && ref.slideId === timer.slideId && ref.id === timer.id : timer.id === ref.id))
            if (index < 0) a.push({ ...timer, ...ref, currentTime: time, paused: true })
            else {
                a[index].currentTime = time
                delete a[index].startTime
            }

            return a
        })
    }

    function openTimers() {
        if (onlyPlaying) openDrawer("timer")
    }

    const timerTypeNames = {
        counter: "timer.from_to",
        clock: "timer.to_time",
        event: "timer.to_event"
    }

    function keydown(e: KeyboardEvent) {
        if (e.key === "Enter" && searchValue.length > 1 && e.target?.closest(".search")) {
            const timer = filteredTimers[0]
            if (!timer) return

            // play
            if (e.ctrlKey || e.metaKey) {
                playPauseGlobal(timer.id, timer, true)
                return
            }

            // add to project (no need)
        }
    }
</script>

<svelte:window on:keydown={keydown} on:mouseup={() => disableDragging.set(false)} />

{#if filteredTimers.length}
    <div class="timers context #timers{readOnly ? '_readonly' : ''}" style={onlyPlaying ? "" : "padding-bottom: 60px;"}>
        {#each filteredTimers as timer, i}
            {@const isReadOnly = readOnly || timer.tags?.some((tagId) => profile[tagId] === "read")}
            {@const title = timer.type === filteredTimers[i - 1]?.type ? "" : timer.type}
            {@const isActive = $activeTimers.find((a) => a.id === timer.id)}
            {@const isPlaying = timer.type !== "counter" || $activeTimers.find((a) => a.id === timer.id && a.paused !== true)}
            {@const startTime = timer.startDynamic !== undefined ? (getTimerDynamicValue(timer.startDynamic) ?? 0) : timer.start || 0}
            {@const endTime = timer.endDynamic !== undefined ? (getTimerDynamicValue(timer.endDynamic) ?? 0) : timer.end || 0}

            {#if i === 0 && list.length}
                <h5><T id="remote.project" /></h5>
            {:else if title && i > 0}
                <h5><T id={timerTypeNames[title]} /></h5>
            {/if}

            <SelectElem id="global_timer" data={timer} draggable={!onlyPlaying} selectable={!onlyPlaying}>
                <div class:outline={!onlyPlaying && isActive} class:project={list.includes(timer.id)} class={onlyPlaying ? "" : `context #global_timer${isReadOnly ? "_readonly" : ""}`} style="display: flex;justify-content: space-between;padding: 3px;">
                    <div style="display: flex;{onlyPlaying ? '' : 'width: 50%;'}">
                        <Button disabled={isReadOnly || timer.type !== "counter"} on:click={() => playPauseGlobal(timer.id, timer)} title={translateText(isPlaying ? "media.pause" : "media.play")}>
                            <Icon id={isPlaying ? "pause" : "play"} white={!isPlaying} />
                        </Button>
                        {#if !onlyPlaying}
                            <p style="align-self: center;padding: 0 5px;{onlyPlaying ? '' : 'min-width: 100px;'}" data-title={timer.name}>
                                {#if timer.name}
                                    {timer.name}
                                {:else}
                                    <span style="opacity: 0.5;">
                                        <T id="main.unnamed" />
                                    </span>
                                {/if}
                            </p>
                        {/if}
                    </div>

                    {#if timer.type === "counter"}
                        <Slider disabled={isReadOnly} style="background: var(--primary);align-self: center;margin: 0 10px;" on:input={(e) => updateActiveTimer(e, { id: timer.id }, timer)} on:mousedown={() => disableDragging.set(true)} value={getCurrentValue(timer, { id: timer.id }, $activeTimers)} min={Math.min(startTime, endTime)} max={Math.max(startTime, endTime)} invert={endTime < startTime} />
                    {/if}

                    <div style="display: flex;justify-content: end;flex-shrink: 0;{onlyPlaying ? '' : 'min-width: 220px;'}">
                        <span style="display: flex;align-self: center;padding: 0 5px;" role="none" on:click={openTimers}>
                            <Timer id={timer.id} {today} />
                            <!-- {getTimes(list[active].timer.start, list[active].timer.format)} -->

                            {#if timer.type === "counter" && endTime && endTime !== 0}
                                <span class="end" style="opacity: 0.6;font-size: 0.8em;align-self: center;margin-left: 5px;">
                                    {joinTime(secondsToTime(endTime))}
                                </span>
                            {/if}
                        </span>

                        {#if timer.type === "counter" && isActive}
                            {@const currentVal = getCurrentValue(timer, { id: timer.id }, $activeTimers)}
                            {@const minVal = Math.min(startTime, endTime)}
                            {@const maxVal = Math.max(startTime, endTime)}
                            {@const delta = currentVal < 60 ? 10 : 60}

                            {#if !onlyPlaying}
                                <Button disabled={isReadOnly || currentVal >= maxVal} on:click={() => adjustTimer(delta, { id: timer.id }, minVal, maxVal)} title={delta === 10 ? "-10 sec" : "-1 min"}>{delta === 10 ? "-10s" : "-1m"}</Button>
                                <Button disabled={isReadOnly || currentVal <= minVal} on:click={() => adjustTimer(-delta, { id: timer.id }, minVal, maxVal)} title={delta === 10 ? "+10 sec" : "+1 min"}>{delta === 10 ? "+10s" : "+1m"}</Button>
                            {/if}

                            <Button on:click={() => resetTimer(timer.id)} title={translateText("media.stop")} disabled={isReadOnly || !isActive}>
                                <Icon id="stop" white={!isPlaying} />
                            </Button>
                        {/if}
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

{#if !onlyPlaying}
    <FloatingInputs onlyOne>
        <MaterialButton disabled={readOnly} icon="add" title="new.timer" on:click={() => activePopup.set("timer")}>
            {#if !$labelsDisabled}<T id="new.timer" />{/if}
        </MaterialButton>
    </FloatingInputs>
{/if}

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
