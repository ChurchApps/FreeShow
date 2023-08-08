<script lang="ts">
    export let src: string
    export let clickable: boolean = false
</script>

<webview class:clickable id="webview" {src} />

<style>
    webview {
        position: absolute;
        width: 100%;
        height: 100%;

        pointer-events: none;
    }

    webview.clickable {
        pointer-events: initial;
    }
</style>
