<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { dateToString } from "../helpers/time"

    let d: Date = new Date()

    let dateInterval: NodeJS.Timeout | null = null
    onMount(() => {
        // check for new day every 10 seconds
        dateInterval = setInterval(() => (d = new Date()), 10000)
    })
    onDestroy(() => {
        if (dateInterval) clearInterval(dateInterval)
    })

    $: dateString = dateToString(d)
</script>

<div>
    {#key d}
        {dateString}
    {/key}
</div>
