<script lang="ts">
    export let component: () => Promise<any>
    export let show = false

    let loadedComponent: any = null

    $: if (show && !loadedComponent) {
        component().then(module => {
            loadedComponent = module.default
        })
    }
</script>

{#if loadedComponent}
    <svelte:component this={loadedComponent} />
{/if}