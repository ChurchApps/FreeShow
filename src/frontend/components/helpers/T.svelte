<script lang="ts">
    import { dictionary, language } from "../../stores"

    export let id: string
    export let index = 0
    export let lowercase = false
    export let replace: string[] = []

    const hasPeriod = id?.includes(".")
    const periodIndex = id?.indexOf(".")
    $: category = hasPeriod ? id.slice(0, periodIndex).replace("$:", "") : ""
    $: key = hasPeriod ? id.slice(periodIndex + 1, id.length).replace(":$", "") : ""

    $: keyString = replacePlaceholders($dictionary[category]?.[key] || "", replace)

    function replacePlaceholders(input: string, values: string[]) {
        if (!values.length) return input
        return input.replace(/\$(\d+)/g, (_, index) => values[index - 1] || "")
    }
</script>

{#key language}
    {#if keyString.includes("{}")}
        {keyString.split("{}")[index] || `[${id}]`}
    {:else if lowercase}
        {keyString.toLowerCase() || `[${id}]`}
    {:else}
        {keyString || `[${id}]`}
    {/if}
{/key}
