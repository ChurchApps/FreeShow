<script lang="ts">
    import LensFlares from "./LensFlares.svelte"
    import Spinner from "./Spinner.svelte"

    export let effect
    $: console.log("EFFECT", effect)

    const effects = {
        spinner: Spinner,
        lensFlares: LensFlares,
    }
</script>

{#if effects[effect.id]}
    <svelte:component this={effects[effect.id]} />
{/if}
