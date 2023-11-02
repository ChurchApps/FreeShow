<script lang="ts">
    let width: number = 0
    let height: number = 0
</script>

<div class="main" bind:offsetWidth={width} bind:offsetHeight={height}>
    <slot {width} {height} />
</div>

<style>
    .main {
        display: flex;
        flex-direction: column;
        height: 100%;
    }
</style>
