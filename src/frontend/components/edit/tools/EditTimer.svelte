<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { timers } from "../../../stores"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import { keysToID, sortByName } from "../../helpers/array"

    export let item: any

    const typeOrder = { counter: 1, clock: 2, event: 3 }
    $: timersList = sortByName(keysToID($timers), "name", true).sort((a, b) => typeOrder[a.type] - typeOrder[b.type])

    let dispatch = createEventDispatcher()
    function changeTimer(e) {
        dispatch("change", e.detail.id)
    }
</script>

<Dropdown options={timersList} value={timersList.find((a) => a.id === item.timerId)?.name || "—"} on:click={changeTimer} />
