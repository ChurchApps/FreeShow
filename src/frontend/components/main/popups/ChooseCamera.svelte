<script lang="ts">
    import { activePopup, popupData } from "../../../stores"
    import Cameras from "../../drawer/live/Cameras.svelte"

    function selectCamera({ detail }) {
        let camera = detail.cam

        popupData.set({ ...$popupData, value: camera })
        activePopup.set(null)
    }
</script>

<div class="cameras">
    <Cameras on:click={selectCamera} />
</div>

<style>
    .cameras {
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        padding: 10px;
        gap: 5px;

        background-color: var(--primary-darker);
    }

    .cameras :global(.main) {
        background-color: var(--primary-darkest);
    }
</style>
