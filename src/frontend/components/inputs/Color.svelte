<script lang="ts">
    export let value: any = "#FFF"
    export let height: number = 0
    export let width: number = 0
</script>

<div class="color" style={(height ? "height: " + height + "px;" : "") + (width ? "width: " + width + "px;" : "") + "background-color: " + value + ";" + ($$props.style || "")}>
    <input style={(height ? "height: " + height + "px;" : "") + (width ? "width: " + width + "px;" : "")} type="color" bind:value on:input />
</div>

<style>
    .color {
        border: 2px solid var(--primary-darker);
        transition: background-color 0.2s;
    }
    .color:hover {
        /* filter: brightness(1.2); */
        opacity: 0.98;
    }
    input[type="color"] {
        opacity: 0;
        width: 100%;
        border: none;
    }
</style>
