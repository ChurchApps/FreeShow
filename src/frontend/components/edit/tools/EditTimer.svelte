<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import type { Item } from "../../../../types/Show"
    import { timers } from "../../../stores"
    import { keysToID, sortByName } from "../../helpers/array"
    import Dropdown from "../../inputs/Dropdown.svelte"

    export let item: Item

    const typeOrder = { counter: 1, clock: 2, event: 3 }
    $: timersList = sortByName(keysToID($timers), "name", true).sort((a, b) => typeOrder[a.type] - typeOrder[b.type])

    let dispatch = createEventDispatcher()
    function changeTimer(e) {
        dispatch("change", e.detail.id)
    }
</script>

<Dropdown options={timersList} value={timersList.find((a) => a.id === item.timerId)?.name || "—"} on:click={changeTimer} />
