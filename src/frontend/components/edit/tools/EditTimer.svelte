<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { timers } from "../../../stores"
    import Dropdown from "../../inputs/Dropdown.svelte"

    export let item: any

    $: timersList = Object.entries($timers).map(([id, timer]: any) => ({ id, name: timer.name }))

    let dispatch = createEventDispatcher()
    function changeTimer(e) {
        dispatch("change", e.detail.id)
    }
</script>

<Dropdown options={timersList} value={timersList.find((a) => a.id === item.timerId)?.name || "—"} on:click={changeTimer} />
