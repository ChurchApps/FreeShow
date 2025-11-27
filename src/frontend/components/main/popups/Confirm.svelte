<script lang="ts">
    import { activePopup, popupData } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"

    let prompt = $popupData.prompt || ""
    let textInput = !!$popupData.textInput

    function keydown(e: KeyboardEvent) {
        if (e.key === "Enter") confirm()
    }

    function close() {
        popupData.set({})
        activePopup.set(null)
    }

    let textValue = ""
    function confirm() {
        popupData.set({ ...$popupData, id: "confirm", value: textInput ? textValue : true })
    }
</script>

<svelte:window on:keydown={keydown} />

{#if textInput}
    <MaterialTextInput label={prompt} value="" on:input={e => (textValue = e.detail)} on:keydown={keydown} autofocus />

    <MaterialButton variant="contained" style="margin-top: 20px;" on:click={confirm}>
        <T id="remote.submit" />
    </MaterialButton>
{:else}
    {#if prompt}
        <p style="margin-bottom: 20px;">{@html prompt}</p>
    {/if}

    <InputRow style="display: flex;justify-content: center;gap: 5px;">
        <MaterialButton style="min-width: 150px;" on:click={close}>
            <Icon id="close" style="fill: #ff5454;" size={1.1} white />
            <T id="main.no" />
        </MaterialButton>
        <MaterialButton style="min-width: 150px;" on:click={confirm}>
            <Icon id="check" style="fill: #b7ffac;" size={1.1} white />
            <T id="main.yes" />
        </MaterialButton>
    </InputRow>
{/if}

<style>
    p {
        white-space: initial;
    }
</style>
