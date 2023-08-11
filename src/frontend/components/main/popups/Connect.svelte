<script lang="ts">
    import { onMount } from "svelte"
    import { activePopup, popupData, ports } from "../../../stores"
    import Link from "../../inputs/Link.svelte"
    import T from "../../helpers/T.svelte"
    import Icon from "../../helpers/Icon.svelte"
    import qrcode from "qrcode-generator"

    let id = "stage"
    let ip = "localhost"

    onMount(() => {
        id = $popupData.id
        ip = $popupData.ip
        popupData.set({})
    })

    const defaultPorts = {
        remote: 5510,
        stage: 5511,
        controller: 5512,
        output_stream: 5513,
    }

    $: url = "http://" + ip + ":" + ($ports[id] || defaultPorts[id])
    $: if (url) generateQR(url)

    function mousedown(e: any) {
        if (e.target.closest("a")) {
            activePopup.set(null)
        }
    }

    let qrImg = ""
    function generateQR(text) {
        var qr = qrcode(0, "L")
        qr.addData(text)
        qr.make()
        qrImg = qr.createImgTag(8, 8)
    }
</script>

<div on:mousedown={mousedown}>
    <p><T id="settings.connect" />:</p>
    <Link {url}>
        {url}
        <Icon id="launch" white />
    </Link>

    <br />

    <p style="margin-bottom: 5px;"><T id="settings.connect_qr" />:</p>
    {@html qrImg}
</div>

<style>
    div {
        text-align: center;
    }

    div :global(a) {
        display: flex;
        align-items: center;
        justify-content: center;
    }
</style>
