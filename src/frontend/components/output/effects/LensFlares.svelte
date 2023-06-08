<script lang="ts">
    // SOURCE: https://github.com/foumart/JS.LensFlare

    import LensFlare from "./lensFlare"
    import EffectCanvas from "./EffectCanvas.svelte"

    let canvas
    $: if (canvas) LensFlare().init(canvas)
</script>

<EffectCanvas bind:canvas />
