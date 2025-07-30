<script lang="ts">
    import { activePopup, popupData } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"

    let prompt = $popupData.prompt

    function keydown(e: KeyboardEvent) {
        if (e.key === "Enter") confirm()
    }

    function close() {
        popupData.set({})
        activePopup.set(null)
    }

    function confirm() {
        popupData.set({ ...$popupData, id: "confirm", value: true })
    }
</script>

<svelte:window on:keydown={keydown} />

<p>{@html prompt}</p>

<CombinedInput style="margin-top: 20px;">
    <Button style="flex: 1;" on:click={close} center dark>
        <Icon id="close" size={1.1} right />
        <T id="main.no" />
    </Button>
    <Button on:click={confirm} center dark>
        <Icon id="check" size={1.1} right />
        <T id="main.yes" />
    </Button>
</CombinedInput>

<style>
    p {
        white-space: initial;
    }
</style>
