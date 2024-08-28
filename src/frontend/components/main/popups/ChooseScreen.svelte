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
        font-size: 0.9em;
        /* font-style: italic;
      font-weight: bold; */
        opacity: 0.7;
    }
</style>
