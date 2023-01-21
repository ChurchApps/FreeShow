<script lang="ts">
    import { activePopup, activeProject, activeTimers, dictionary, projects, shows, showsCache, timers } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Slider from "../../inputs/Slider.svelte"
    import Timer from "../../slide/views/Timer.svelte"
    import Center from "../../system/Center.svelte"
    import SelectElem from "../../system/SelectElem.svelte"
    import { getCurrentTimerValue, loadProjectTimers, playPause, playPauseGlobal, resetTimer } from "./timers"

    export let active
    export let searchValue
    console.log(active, searchValue)

    $: globalList = $timers
    $: console.log(globalList)

    $: projectShows = $projects[$activeProject!]?.shows || []
    let list: any[] = []
    $: if (projectShows.length || $showsCache) getList()
    async function getList() {
        list = await loadProjectTimers(projectShows)
        console.log(list)
    }

    // TODO: check overlays

    $: activeTimer = 0

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

<!-- TODO: clean this code! -->
{#if Object.keys(globalList).length || list.length}
    <div style="flex: 1;overflow: auto;padding: 10px 0;">
        <!-- {#if Object.keys(globalList).length} -->
        {#if active === "timer"}
            {#each Object.entries(globalList) as [id, timer]}
                <!-- {@const playing = $activeTimers.find((a) => a.id === id && a.paused !== true)} -->
                <SelectElem id="global_timer" data={{ id, timer }}>
                    <div class:outline={$activeTimers.find((a) => a.id === id)} class="context #global_timer" style="display: flex;justify-content: space-between;">
                        <div style="display: flex;width: 50%;">
                            <Button
                                disabled={timer.type !== "counter"}
                                on:click={() => playPauseGlobal(id, timer)}
                                title={$activeTimers.find((a) => a.id === id && a.paused !== true) ? $dictionary.media?.pause : $dictionary.media?.play}
                            >
                                <Icon id={timer.type !== "counter" || $activeTimers.find((a) => a.id === id && a.paused !== true) ? "pause" : "play"} />
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
                            on:input={(e) => updateActiveTimer(e, { id }, timer)}
                            value={getCurrentValue(timer, { id }, $activeTimers)}
                            min={Math.min(timer.start || 0, timer.end || 0)}
                            max={Math.max(timer.start || 0, timer.end || 0)}
                            invert={(timer.end || 0) < (timer.start || 0)}
                        />

                        <div style="display: flex;">
                            <span style="display: flex;align-self: center;padding: 0 5px;">
                                <Timer {timer} ref={{ id }} {today} />
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
                                <Button on:click={() => resetTimer(id)} title={$dictionary.actions?.reset}>
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
        {/if}
        <!-- {#if list.length} -->
        {#if active === "project"}
            {#each list as item}
                {@const timer = item.timer}
                <!-- {@const playing = $activeTimers.find((a) => a.showId === item.showId && a.slideId === item.slideId && a.id === item.timer.id && a.paused !== true)} -->
                <SelectElem id="timer" data={item}>
                    <div
                        class:outline={$activeTimers.find((a) => a.showId === item.showId && a.slideId === item.slideId && a.id === timer.id)}
                        class="context #timer"
                        style="display: flex;justify-content: space-between;"
                    >
                        <div style="display: flex;width: 50%;">
                            <Button
                                disabled={timer.type !== "counter"}
                                on:click={() => playPause(item)}
                                title={$activeTimers.find((a) => a.showId === item.showId && a.slideId === item.slideId && a.id === timer.id && a.paused !== true)
                                    ? $dictionary.media?.pause
                                    : $dictionary.media?.play}
                            >
                                <Icon
                                    id={timer.type !== "counter" ||
                                    $activeTimers.find((a) => a.showId === item.showId && a.slideId === item.slideId && a.id === timer.id && a.paused !== true)
                                        ? "pause"
                                        : "play"}
                                />
                            </Button>
                            <p style="align-self: center;padding: 0 5px;" title={$shows[list[activeTimer].showId].name}>
                                {#if timer.name}
                                    {timer.name}
                                {:else if $showsCache[item.showId]}
                                    <span style="opacity: 0.5;">
                                        {$showsCache[item.showId].name}
                                    </span>
                                {:else}
                                    <span style="opacity: 0.5;">
                                        <T id="main.unnamed" />
                                    </span>
                                {/if}
                            </p>
                        </div>

                        <Slider
                            style="background: var(--primary);align-self: center;margin: 0 10px;"
                            on:input={(e) => updateActiveTimer(e, { showId: item.showId, slideId: item.slideId, id: item.id }, timer)}
                            value={getCurrentValue(timer, { showId: item.showId, slideId: item.slideId, id: item.id }, $activeTimers)}
                            min={Math.min(timer.start || 0, timer.end || 0)}
                            max={Math.max(timer.start || 0, timer.end || 0)}
                            invert={(timer.end || 0) < (timer.start || 0)}
                        />

                        <div style="display: flex;">
                            <span style="display: flex;align-self: center;padding: 0 5px;">
                                <Timer {item} ref={{ showId: item.showId, slideId: item.slideId, id: item.id }} {today} />
                            </span>
                            <!-- <Button
              on:click={() => {
                select("timer", { id: item.id, showId: item.showId, slideId: item.slideId })
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
                        </div>
                    </div>
                </SelectElem>
            {/each}
        {/if}
    </div>
{:else}
    <Center faded>
        <T id="empty.timers" />
    </Center>
{/if}

<div style="display: flex;flex-wrap: wrap;">
    {#if active === "timer"}
        <!-- TODO: enable!! -->
        <Button style="flex: 1;background-color: var(--primary-darkest);" on:click={() => activePopup.set("timer")} center title={$dictionary.new?.timer}>
            <Icon id="timer" right />
            <span style="color: var(--secondary);">
                <T id="new.timer" />
            </span>
        </Button>
    {/if}
</div>

<style>
    div.outline {
        outline-offset: -2px;
        outline: 2px solid var(--secondary) !important;
    }
</style>
