<script lang="ts">
    import { activePopup } from "../../../stores"
    import CanvaLink from "../../drawer/media/CanvaLink.svelte"
</script>

<div style="min-width: 420px;">
    <CanvaLink showInfo={false} on:added={() => activePopup.set(null)} />
</div>
