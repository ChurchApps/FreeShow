<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import type { Item } from "../../../../types/Show"
    import type { StageItem } from "../../../../types/Stage"
    import { timers } from "../../../stores"
    import { keysToID, sortByName } from "../../helpers/array"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import Button from "../../inputs/Button.svelte"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { openDrawer } from "../scripts/edit"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import { getCurrentTimerValue } from "../../drawer/timers/timers"
    import { joinTimeBig } from "../../helpers/time"

    export let item: Item | StageItem
    export let isStage = false

    let today = new Date()

    const typeOrder = { counter: 1, clock: 2, event: 3 }
    $: timersList = sortByName(keysToID($timers), "name", true)
        .sort((a, b) => typeOrder[a.type] - typeOrder[b.type])
        .map((a) => {
            const currentTime = getCurrentTimerValue(a, { id: a.id }, today)
            const timeValue = joinTimeBig(typeof currentTime === "number" ? currentTime : 0, item?.timer?.showHours !== false)
            return { id: a.id, name: a.name || a.id, extraInfo: timeValue }
        })
    $: if (isStage) timersList = [{ id: "", name: "$:stage.first_active_timer:$", extraInfo: "" }, ...timersList]

    let dispatch = createEventDispatcher()
    function changeTimer(e) {
        dispatch("change", e.detail.id)
    }

    $: name = timersList.find((a) => a.id === (item.timer?.id || (item as any).timerId || ""))?.name
</script>

<CombinedInput>
    {#if timersList.length > (isStage ? 1 : 0)}
        <Dropdown style="width: 100%;" options={timersList} value={name || "—"} on:click={changeTimer} />
    {:else}
        <Button on:click={() => openDrawer("timer", true)} style="width: 100%;" center>
            <Icon id="add" right />
            <T id="new.timer" />
        </Button>
    {/if}
</CombinedInput>
