<script lang="ts">
    import { activePopup } from "../../../stores"
    import { closeApp, save } from "../../../utils/save"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"

    const actions = {
        n: () => activePopup.set(null),
        q: () => closeApp(),
        y: () => save(true),
    }

    function keydown(e: any) {
        if (actions[e.key]) {
            e.preventDefault()
            actions[e.key]()
        }
    }
</script>

<svelte:window on:keydown={keydown} />

<CombinedInput>
    <Button
        style="width: 100%;"
        on:click={() => {
            activePopup.set(null)
        }}
        dark
        center
    >
        <T id="popup.cancel" />
        <span>N</span>
    </Button>
</CombinedInput>
<CombinedInput>
    <Button style="width: 100%;" on:click={closeApp} dark center>
        <div style="display: inline;opacity: 0.7;display: flex;align-items: center;"><T id="popup.quit" /></div>
        <span>Q</span>
    </Button>
</CombinedInput>
<CombinedInput>
    <Button style="width: 100%;background-color: var(--secondary-opacity);" on:click={() => save(true)} dark center>
        <T id="popup.save_quit" />
        <span>Y</span>
    </Button>
</CombinedInput>

<style>
    span {
        display: flex;
        justify-content: end;
        align-items: center;

        position: absolute;
        right: 10px;

        color: var(--text);
        opacity: 0.6;
    }
</style>
