<script lang="ts">
    export let src: string
    export let clickable: boolean = false

    let parsedSrc: string = ""
    $: if (src) checkURL()

    function checkURL() {
        let valid = false

        try {
            new URL(src)
            valid = true
        } catch (err) {
            console.error(err)
        }

        parsedSrc = valid ? src : ""
    }
</script>

<webview class:clickable id="webview" src={parsedSrc} />

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
