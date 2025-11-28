<script lang="ts">
    import { onDestroy } from "svelte"
    import { dictionary, actions, actionTags, activeActionTagFilter, variables, activeVariableTagFilter, timers, triggers, activeTimers, runningActions, functionsSubTab } from "../../../../../util/stores"
    import { translate, keysToID, sortByName, formatTime } from "../../../../../util/helpers"
    import { send } from "../../../../../util/socket"
    import Button from "../../../../../../common/components/Button.svelte"
    import Icon from "../../../../../../common/components/Icon.svelte"
    import Center from "../../../../../../common/components/Center.svelte"

    // Actions
    $: sortedActions = sortByName(keysToID($actions), "name", true)
    $: filteredActionsTags = sortedActions.filter(a => !$activeActionTagFilter.length || (a.tags?.length && !$activeActionTagFilter.find(tagId => !a.tags?.includes(tagId))))

    function runAction(action: any) {
        send("API:run_action", { id: action.id })
    }

    // Timers
    const typeOrder: { [key: string]: number } = { counter: 1, clock: 2, event: 3 }
    $: sortedTimers = sortByName(keysToID($timers), "name", true).sort((a, b) => (typeOrder[a.type] || 4) - (typeOrder[b.type] || 4))

    // Force re-render every second to update timer displays
    let tick = 0
    const interval = setInterval(() => {
        tick++
    }, 1000)
    onDestroy(() => clearInterval(interval))

    function getCurrentTimerValue(timer: any, _tick: number) {
        const activeTimer = $activeTimers.find(a => a.id === timer.id)
        if (activeTimer?.currentTime !== undefined) return activeTimer.currentTime
        return timer.start || 0
    }

    function getTimeRemaining(timer: any, currentValue: number): number {
        const end = timer.end || 0
        return Math.abs(end - currentValue)
    }

    function playPauseTimer(timerId: string) {
        const activeTimer = $activeTimers.find(a => a.id === timerId)
        if (activeTimer && !activeTimer.paused) {
            send("API:id_pause_timer", { id: timerId })
        } else {
            send("API:id_start_timer", { id: timerId })
        }
    }

    function resetTimer(timerId: string) {
        send("API:id_stop_timer", { id: timerId })
    }

    // Variables
    $: sortedVariables = sortByName(keysToID($variables), "name", true).sort((a, b) => {
        const varTypeOrder: { [key: string]: number } = { number: 1, text: 2 }
        return (varTypeOrder[a.type] || 3) - (varTypeOrder[b.type] || 3)
    })
    $: filteredVariablesTags = sortedVariables.filter(a => !$activeVariableTagFilter.length || (a.tags?.length && !$activeVariableTagFilter.find(tagId => !a.tags?.includes(tagId))))

    $: numberVariables = filteredVariablesTags.filter(a => a.type === "number")
    $: otherVariables = filteredVariablesTags.filter(a => a.type !== "number" && a.type !== "random_number" && a.type !== "text_set")

    function updateVariable(id: string, key: string, value: any) {
        send("API:change_variable", { id, key, value })
    }

    function incrementVariable(variable: any) {
        const current = Number(variable.number) || 0
        const step = Number(variable.step) || 1
        const max = Number(variable.maxValue ?? 1000)
        const newValue = Math.min(max, current + step)
        updateVariable(variable.id, "number", newValue)
    }

    function decrementVariable(variable: any) {
        const current = Number(variable.number) || 0
        const step = Number(variable.step) || 1
        const min = Number(variable.minValue ?? 0)
        const newValue = Math.max(min, current - step)
        updateVariable(variable.id, "number", newValue)
    }

    function resetVariable(variable: any) {
        const defaultValue = Number(variable.default) || 0
        updateVariable(variable.id, "number", defaultValue)
    }

    // Triggers
    $: sortedTriggers = sortByName(keysToID($triggers))

    let triggerStatus: { [key: string]: string } = {}

    async function activateTrigger(triggerId: string) {
        triggerStatus[triggerId] = "pending"
        triggerStatus = triggerStatus

        send("API:start_trigger", { id: triggerId })

        // Auto-clear status after 2 seconds
        setTimeout(() => {
            if (triggerStatus[triggerId] === "pending") {
                triggerStatus[triggerId] = ""
                triggerStatus = triggerStatus
            }
        }, 2000)
    }
</script>

<div class="main">
    {#if $functionsSubTab === "actions"}
        <!-- Actions Content -->
        {#if filteredActionsTags.length}
            <div class="actions">
                {#each filteredActionsTags as action}
                    <div class="action" class:running={$runningActions.includes(action.id)}>
                        <Button on:click={() => runAction(action)} style="width: 100%; justify-content: space-between; text-align: start;" dark>
                            <span style="display: flex; align-items: center; gap: 8px;">
                                {#if action.shows?.length}
                                    <Icon id="slide" />
                                {:else if action.triggers?.length !== 1}
                                    <Icon id="actions" />
                                {:else}
                                    <Icon id="actions" />
                                {/if}
                                <p style="font-size: 1em; font-weight: normal;">
                                    {action.name || translate("main.unnamed", $dictionary)}
                                </p>
                            </span>

                            {#if $activeActionTagFilter.length && action.tags?.length}
                                <span class="tags">
                                    {#each action.tags as tagId}
                                        {@const tag = $actionTags[tagId] || {}}
                                        {#if !$activeActionTagFilter.includes(tagId)}
                                            <span class="tag" style="--color: {tag.color || 'white'};">
                                                {tag.name}
                                            </span>
                                        {/if}
                                    {/each}
                                </span>
                            {/if}
                        </Button>
                    </div>
                {/each}
            </div>
        {:else}
            <Center>
                <p style="opacity: 0.5;">{translate("empty.general", $dictionary)}</p>
            </Center>
        {/if}
    {:else if $functionsSubTab === "timer"}
        <!-- Timers Content -->
        {#if sortedTimers.length}
            <div class="timers">
                {#each sortedTimers as timer}
                    {@const isPlaying = timer.type !== "counter" || $activeTimers.find(a => a.id === timer.id && a.paused !== true)}
                    {@const currentValue = getCurrentTimerValue(timer, tick)}
                    {@const timeRemaining = getTimeRemaining(timer, currentValue)}
                    {@const isCountingDown = (timer.start || 0) > (timer.end || 0)}
                    {@const minValue = Math.min(timer.start || 0, timer.end || 0)}
                    {@const maxValue = Math.max(timer.start || 0, timer.end || 0)}
                    {@const totalDuration = isCountingDown ? timer.start || 0 : timer.end || 0}

                    <div class="timer" class:outline={$activeTimers.find(a => a.id === timer.id)}>
                        <div class="timer-left">
                            <Button disabled={timer.type !== "counter"} on:click={() => playPauseTimer(timer.id)} style="padding: 8px;">
                                <Icon id={isPlaying ? "pause" : "play"} white={!isPlaying} />
                            </Button>
                            <span class="time">
                                {formatTime(totalDuration)}
                            </span>
                        </div>

                        {#if timer.type === "counter"}
                            <input type="range" class="timer-slider" class:invert={isCountingDown} value={currentValue} min={minValue} max={maxValue} disabled />
                        {/if}

                        <div class="timer-right">
                            {#if timer.type === "counter" && timer.end !== undefined && timer.end !== timer.start}
                                <span class="time-end">
                                    {formatTime(timeRemaining)}
                                </span>
                            {/if}
                            {#if timer.type === "counter"}
                                <Button on:click={() => resetTimer(timer.id)} disabled={!$activeTimers.find(a => a.id === timer.id)} style="padding: 8px;">
                                    <Icon id="stop" white={!isPlaying} />
                                </Button>
                            {/if}
                        </div>
                    </div>
                {/each}
            </div>
        {:else}
            <Center>
                <p style="opacity: 0.5;">{translate("empty.timers", $dictionary)}</p>
            </Center>
        {/if}
    {:else if $functionsSubTab === "variables"}
        <!-- Variables Content -->
        {#if filteredVariablesTags.length}
            <div class="variables">
                <!-- Number Variables -->
                {#if numberVariables.length}
                    <div class="number-variables">
                        {#each numberVariables as variable}
                            {@const number = Number(variable.number) || 0}
                            {@const min = Number(variable.minValue ?? 0)}
                            {@const max = Number(variable.maxValue ?? 1000)}

                            <div class="numberBox">
                                <div class="reset-btn">
                                    <Button on:click={() => resetVariable(variable)} style="padding: 5px;">
                                        <Icon id="reset" white />
                                    </Button>
                                </div>

                                <div class="bigNumber">{number}</div>

                                <span class="var-name">
                                    <Icon id="number" />
                                    <p data-title={variable.name}>
                                        {variable.name || translate("main.unnamed", $dictionary)}
                                    </p>
                                </span>

                                <div class="buttons">
                                    <Button on:click={() => decrementVariable(variable)} disabled={number <= min} style="flex: 1;" dark>
                                        <Icon id="remove" size={2} white />
                                    </Button>
                                    <Button on:click={() => incrementVariable(variable)} disabled={number >= max} style="flex: 1;" dark>
                                        <Icon id="add" size={2} white />
                                    </Button>
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}

                <!-- Text Variables -->
                {#if otherVariables.length}
                    <div class="text-variables">
                        {#each otherVariables as variable}
                            <div class="variable">
                                <span class="var-info">
                                    <Icon id={variable.type} />
                                    <p>{variable.name || translate("main.unnamed", $dictionary)}</p>
                                </span>
                                <span class="var-value">
                                    {variable.text || "—"}
                                </span>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        {:else}
            <Center>
                <p style="opacity: 0.5;">{translate("empty.general", $dictionary)}</p>
            </Center>
        {/if}
    {:else if $functionsSubTab === "triggers"}
        <!-- Triggers Content -->
        {#if sortedTriggers.length}
            <div class="triggers" class:center={sortedTriggers.length <= 10}>
                {#each sortedTriggers as trigger}
                    <div class="trigger" class:pending={triggerStatus[trigger.id] === "pending"} class:success={triggerStatus[trigger.id] === "success"} class:error={triggerStatus[trigger.id] === "error"}>
                        <Button on:click={() => activateTrigger(trigger.id)} style="width: 100%; height: 100%; padding: 5px;">
                            <p>
                                {trigger.name || translate("main.unnamed", $dictionary)}
                            </p>
                        </Button>
                    </div>
                {/each}
            </div>
        {:else}
            <Center>
                <p style="opacity: 0.5;">{translate("empty.general", $dictionary)}</p>
            </Center>
        {/if}
    {:else}
        <Center>
            <p style="opacity: 0.5;">{translate("remote.no_content", $dictionary)}</p>
        </Center>
    {/if}
</div>

<style>
    .main {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow-y: auto;
        background-color: var(--primary-darker);
        padding: 5px;
    }

    /* Actions styles */
    .actions {
        flex: 1;
        overflow: auto;
    }

    .actions .action:nth-child(even) {
        background-color: rgb(0 0 20 / 0.08);
    }

    .action {
        display: flex;
        width: 100%;
        min-height: 40px;
    }

    .action.running {
        outline: 2px solid var(--secondary);
        outline-offset: -2px;
    }

    .action :global(button) {
        background: transparent;
    }

    .tags {
        display: flex;
        gap: 5px;
        padding-left: 10px;
    }

    .tag {
        --color: white;
        display: flex;
        padding: 2px 6px;
        color: var(--color);
        font-weight: 600;
        font-size: 0.8em;
        border-radius: 12px;
        border: 2px solid var(--color);
    }

    /* Timers styles */
    .timers {
        flex: 1;
        overflow: auto;
    }

    .timers .timer:nth-child(even) {
        background-color: rgb(0 0 20 / 0.08);
    }

    .timer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 3px;
    }

    .timer.outline {
        outline: 2px solid var(--secondary);
        outline-offset: -2px;
    }

    .timer-left,
    .timer-right {
        display: flex;
        align-items: center;
        gap: 5px;
    }

    .time {
        font-size: 1em;
        font-weight: 500;
        min-width: 50px;
    }

    .time-end {
        opacity: 0.6;
        font-size: 0.85em;
        min-width: 50px;
        text-align: right;
    }

    /* Timer slider - matches frontend Slider.svelte */
    .timer-slider {
        -webkit-appearance: none;
        appearance: none;
        flex: 1;
        height: 10px;
        background: var(--primary-darkest);
        outline: none;
        border-radius: 10px;
        margin: 0 10px;
    }

    .timer-slider.invert {
        transform: rotate(180deg);
    }

    .timer-slider:disabled {
        opacity: 1;
    }

    .timer-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 10px;
        height: 10px;
        background: var(--secondary);
        cursor: pointer;
        pointer-events: none;
        opacity: 0.8;
        border-radius: 50%;
    }

    .timer-slider::-moz-range-thumb {
        width: 10px;
        height: 10px;
        background: var(--secondary);
        cursor: pointer;
        pointer-events: none;
        opacity: 0.8;
        border-radius: 50%;
        border: none;
    }

    /* Variables styles */
    .variables {
        flex: 1;
        overflow: auto;
        padding: 5px;
    }

    .number-variables {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 10px;
        margin-bottom: 15px;
    }

    .numberBox {
        display: flex;
        flex-direction: column;
        align-items: center;
        border: 2px solid var(--focus);
        padding: 10px;
        min-width: 120px;
        max-width: 150px;
        position: relative;
    }

    .reset-btn {
        position: absolute;
        top: 5px;
        right: 5px;
    }

    .bigNumber {
        font-size: 3em;
        font-weight: bold;
        padding: 10px 0;
    }

    .var-name {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 5px;
        width: 100%;
        justify-content: center;
    }

    .var-name p {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100px;
    }

    .buttons {
        display: flex;
        width: 100%;
        gap: 5px;
    }

    .text-variables {
        display: flex;
        flex-direction: column;
    }

    .text-variables .variable:nth-child(even) {
        background-color: rgb(0 0 20 / 0.08);
    }

    .variable {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px;
        min-height: 40px;
    }

    .var-info {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .var-value {
        opacity: 0.8;
        font-style: italic;
    }

    /* Triggers styles */
    .triggers {
        display: flex;
        flex-wrap: wrap;
        align-content: flex-start;
        justify-content: space-evenly;
        gap: 8px;
        padding: 8px;
        flex: 1;
        overflow: auto;
    }

    .triggers.center {
        align-content: center;
    }

    .trigger {
        width: 100px;
        height: 100px;
        border: 2px solid rgb(255 255 255 / 0.4);
        border-radius: 8px;
        background-color: var(--primary-darkest);
        transition: 0.2s border;
        overflow: hidden;
    }

    .trigger.pending {
        border-color: var(--secondary);
    }

    .trigger.success {
        border-color: rgb(35, 175, 35);
    }

    .trigger.error {
        border-color: rgb(255, 35, 35);
    }

    .trigger p {
        font-size: 1em;
        width: 100%;
        height: 100%;
        white-space: normal;
        word-break: break-word;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
    }
</style>
