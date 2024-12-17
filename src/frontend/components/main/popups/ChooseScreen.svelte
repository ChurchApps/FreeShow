<script lang="ts">
    import { onMount } from "svelte"
    import { alertMessage, popupData } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import Screens from "../../settings/Screens.svelte"

    let error = false
    let activateOutput = $popupData.activateOutput

    onMount(() => {
        if ($alertMessage === "error.display") error = true

        setTimeout(() => {
            alertMessage.set("")
            popupData.set({})
        }, 100)
    })
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
