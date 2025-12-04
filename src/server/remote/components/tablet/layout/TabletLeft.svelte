<script lang="ts">
    import Project from "../../pages/Project.svelte"
</script>

<div class="left-panel">
    <Project />
</div>

<style>
    .left-panel {
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        background-color: var(--primary-darker);
    }
</style>
