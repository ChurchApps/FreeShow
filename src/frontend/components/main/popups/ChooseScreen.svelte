<script>
    import { onMount } from "svelte"
    import { activePopup, alertMessage } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Screens from "../../settings/Screens.svelte"

    let error = false
    $: if ($alertMessage === "error.display") error = true

    onMount(() => {
        setTimeout(() => {
            alertMessage.set("")
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

    <Screens activateOutput={error} />
</main>

<style>
    main {
        min-height: 250px;
    }

    .error {
        font-size: 0.9em;
        /* font-style: italic;
      font-weight: bold; */
        opacity: 0.7;
    }
</style>
