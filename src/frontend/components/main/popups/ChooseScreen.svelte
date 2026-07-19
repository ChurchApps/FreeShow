<script lang="ts">
    import { alertMessage, popupData } from "../../../stores"
    import Screens from "../../settings/Screens.svelte"
    import Tip from "../Tip.svelte"

    let error = $alertMessage === "error.display"
    let activateOutput = $popupData.activateOutput

    $: if ($alertMessage || $popupData.activateOutput) {
        alertMessage.set("")
        popupData.set({})
    }
</script>

<main>
    {#if error}
        <Tip type="warning" value="error.display" bottom={10} />
    {/if}

    <Screens {activateOutput} />
</main>

<style>
    main {
        min-height: 310px;
        min-width: 50vw;
    }
</style>
