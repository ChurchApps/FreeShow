<script lang="ts">
    export let notes: string
    export let autoSize: number = 100
</script>

<div style="font-size: {autoSize}px;">
    {notes}
</div>

<style>
    div {
        font-size: 100px;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
    }
</style>
