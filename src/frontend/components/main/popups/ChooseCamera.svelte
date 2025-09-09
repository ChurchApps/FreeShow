<script lang="ts">
    import { activePopup, popupData } from "../../../stores"
    import Cameras from "../../drawer/live/Cameras.svelte"

    // const active = $popupData.active || ""

    function selectCamera({ detail }) {
        let camera = detail.cam

        if ($popupData.trigger) $popupData.trigger(camera)
        else popupData.set({ ...$popupData, value: camera })

        activePopup.set(null)
    }
</script>

<div class="cameras">
    <Cameras on:click={selectCamera} showPlayOnHover={false} />
</div>

<style>
    .cameras {
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        padding: 10px;
        gap: 5px;

        background-color: var(--primary-darker);
        border-radius: 8px;
    }

    .cameras :global(.main) {
        background-color: var(--primary-darkest);
        border-radius: 4px;

        overflow: hidden;
    }
</style>
