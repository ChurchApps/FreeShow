<script>
    import { onMount } from "svelte"
    import { activePopup, alertMessage, popupData } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
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
        <p class="error"><T id={$alertMessage} /></p>
    {/if}

    <p style="margin-bottom: 10px;"><T id="settings.select_display" /></p>
    <Button on:click={() => activePopup.set("change_output_values")} style="width: 100%;" dark center>
        <Icon id="screen" right />
        <p><T id="settings.manual_input_hint" /></p>
    </Button>

    <br />

    <Screens {activateOutput} />
</main>

<style>
    main {
        min-height: 250px;
        min-width: 50vw;
    }

    .error {
        font-size: 0.9em;
        /* font-style: italic;
      font-weight: bold; */
        opacity: 0.7;
    }
</style>
