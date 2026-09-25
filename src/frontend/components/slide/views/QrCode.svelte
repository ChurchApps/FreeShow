<script lang="ts">
    import qrcode from "qrcode-generator"
    import type { Item } from "../../../../types/Show"
    import Icon from "../../helpers/Icon.svelte"

    export let item: Item
    export let edit: boolean = false

    let svg = ""

    $: qrData = item?.qr_code
    $: text = qrData?.text || ""
    $: color = qrData?.color || "#000000"
    $: background = qrData?.background ?? "#FFFFFF"

    $: if (text) generate(text, color, background)
    else svg = ""

    function generate(data: string, qrColor: string, qrBg: string) {
        try {
            const qr = qrcode(0, "M")
            qr.addData(data)
            qr.make()
            svg = qr.createSvgTag({ scalable: true, margin: 3 })
        } catch {
            try {
                const qr = qrcode(0, "L")
                qr.addData(data)
                qr.make()
                svg = qr.createSvgTag({ scalable: true, margin: 3 })
            } catch (e) {
                console.error("Failed to generate QR code:", e)
                svg = ""
            }
        }

        if (!svg) return

        svg = svg.replace(/preserveAspectRatio="[^"]*"/, 'preserveAspectRatio="xMidYMid meet"')

        if (qrBg) svg = svg.replace(/<rect\s+width="100%"\s+height="100%"\s+fill="[^"]*"/, `<rect width="100%" height="100%" fill="${qrBg}"`)
        else svg = svg.replace(/<rect\s+width="100%"\s+height="100%"\s+fill="[^"]*"\s*cx="[^"]*"\s*cy="[^"]*"\/>/, "")
        if (qrColor) svg = svg.replace(/fill="black"/g, `fill="${qrColor}"`)
    }
</script>

<div class="qrItem">
    {#if svg}
        {@html svg}
    {:else if edit}
        <div class="emptyQr">
            <Icon id="qr_code" white />
        </div>
    {/if}
</div>

<style>
    .qrItem {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
    }

    .qrItem :global(svg) {
        width: 100%;
        height: 100%;
    }

    .emptyQr {
        width: 100%;
        height: 100%;
        opacity: 0.3;
    }
</style>
