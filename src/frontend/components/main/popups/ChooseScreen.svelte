<script lang="ts">
    import { alertMessage, popupData } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import Screens from "../../settings/Screens.svelte"

    let error = $alertMessage === "error.display"
    let activateOutput = $popupData.activateOutput

    $: if ($alertMessage || $popupData.activateOutput) {
        alertMessage.set("")
        popupData.set({})
    }
</script>

<main>
    {#if error}
        <p class="error"><T id="error.display" /></p>
    {/if}

    <Screens {activateOutput} />
</main>

<style>
    main {
        min-height: 280px;
        min-width: 50vw;
    }

    .error {
        margin-bottom: 2px;

        font-size: 0.9em;
        opacity: 0.9;

        text-decoration-line: underline;
        text-decoration-color: rgb(255 0 0 / 0.7);
    }
</style>
