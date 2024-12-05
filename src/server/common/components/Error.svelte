<script lang="ts">
    export let errors: string[] = []
</script>

{#if errors.length}
    <div class="error">
        {#each errors as error}
            <span>{error}</span>
        {/each}
    </div>
{/if}

<style>
    .error {
        color: red;
        position: absolute;
        margin: 10px;
        padding: 10px;
        width: calc(100% - 20px);
        text-align: center;
        background-color: var(--primary-darker);
        display: flex;
        flex-direction: column;
    }
</style>
