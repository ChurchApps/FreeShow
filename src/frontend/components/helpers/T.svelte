<script lang="ts">
    import { dictionary, language } from "../../stores"

    export let id: string
    export let index: number = 0
    export let lowercase: boolean = false

    const hasPeriod = id?.includes(".")
    const periodIndex = id?.indexOf(".")
    $: category = hasPeriod ? id.slice(0, periodIndex).replace("$:", "") : ""
    $: key = hasPeriod ? id.slice(periodIndex + 1, id.length).replace(":$", "") : ""
</script>

{#key language}
    {#if $dictionary[category]?.[key]?.includes("{}")}
        {$dictionary[category]?.[key].split("{}")[index] || `[${id}]`}
    {:else if lowercase}
        {$dictionary[category]?.[key].toLowerCase() || `[${id}]`}
    {:else}
        {$dictionary[category]?.[key] || `[${id}]`}
    {/if}
{/key}
