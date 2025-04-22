<script lang="ts">
    export let settings: { [key: string]: any }

    // RAINBOW

    $: if (settings?.rainbow && !timeout) generate()
    $: rainbow = settings?.rainbow ? "rgb(0, 0, 0)" : null

    let r = 0
    let g = 0
    let b = 0

    let timeout: NodeJS.Timeout | null = null
    function generate() {
        if (r <= 255 && g == 0 && b == 0) r++
        if (r == 255 && b == 0 && g <= 255) g++
        if (r == 255 && g == 255 && b <= 255) b++
        if (b == 255 && g == 255 && r > 0) r--
        if (r == 0 && b == 255 && g > 0) g--
        if (r == 0 && g == 0 && b > 0) b--

        rainbow = "rgb(" + r + "," + g + "," + b + ")"
        if (settings?.rainbow) timeout = setTimeout(generate, 10)
        else timeout = null
    }
</script>

<div class="fill" style="background-color: {rainbow || settings?.color};opacity: {settings?.opacity};" />

<style>
    .fill {
        position: absolute;
        top: 0;
        inset-inline-start: 0;
        width: 100%;
        height: 100%;
        background-color: black;
        opacity: 0.8;
    }
</style>
