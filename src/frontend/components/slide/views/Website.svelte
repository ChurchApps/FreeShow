<script lang="ts">
    export let src: string
    export let clickable: boolean = false

    let webview: any
    export let ratio: number

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

    $: if (webview && ratio) {
        const inverse = Math.round(100 / ratio)
        webview?.addEventListener("did-finish-load", () => {
            webview.executeJavaScript(`
            document.body.style.transform = 'scale(${ratio})';
            document.body.style.transformOrigin = '0 0';
            document.body.style.width = '${inverse}%';  // Scale factor inverse to maintain full width
            document.body.style.height = '${inverse}%';  // Scale factor inverse to maintain full height
        `)
        })
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
