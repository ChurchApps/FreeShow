<script lang="ts">
    export let src: string
    export let clickable: boolean = false

    let parsedSrc: string = ""
    $: if (src) checkURL()

    function checkURL() {
        let valid = false

        // format url
        src = src.replaceAll("&amp;", "&").replaceAll("{", "%7B").replaceAll("}", "%7D")

        try {
            new URL(src)
            valid = true
        } catch (err) {
            console.error(err)
        }

        parsedSrc = valid ? src : ""
    }

    let webview: any
    $: if (webview) {
        /*
        webview?.addEventListener("did-finish-load", () => {
            webview.executeJavaScript(`
            document.body.style.transform = 'scale(0.1)';
            document.body.style.transformOrigin = '0 0';
            document.body.style.width = '1000%';  // Scale factor inverse to maintain full width
            document.body.style.height = '1000%';  // Scale factor inverse to maintain full height
        `)
        })
        */
    }
</script>

<webview class:clickable id="webview" src={parsedSrc} bind:this={webview} />

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
