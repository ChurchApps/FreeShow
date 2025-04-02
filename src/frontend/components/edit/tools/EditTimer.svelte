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

    export let item: Item | StageItem
    export let isStage: boolean = false

    const typeOrder = { counter: 1, clock: 2, event: 3 }
    $: timersList = sortByName(keysToID($timers), "name", true)
        .sort((a, b) => typeOrder[a.type] - typeOrder[b.type])
        .map((a) => ({ id: a.id, name: a.name || a.id }))
    $: if (isStage) timersList = [{ id: "", name: "$:stage.first_active_timer:$" }, ...timersList]

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
        <Button on:click={() => openDrawer("timer")} style="width: 100%;" center>
            <Icon id="add" right />
            <T id="new.timer" />
        </Button>
    {/if}
</CombinedInput>
