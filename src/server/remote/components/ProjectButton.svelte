<script lang="ts">
    import Button from "../../common/components/Button.svelte"

    export let name: string
    export let active: boolean
</script>

<Button on:click {active} bold={false} border>
    <span>{name}</span>
</Button>
