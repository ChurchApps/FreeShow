<script lang="ts">
    import Icon from "../helpers/Icon.svelte"
    import Button from "../inputs/Button.svelte"
    import { activePopup, os } from "../../stores"
    import { scale, fade } from "svelte/transition"
    import T from "../helpers/T.svelte"
    import DeleteShow from "./popups/DeleteShow.svelte"
    import CreateShow from "./popups/CreateShow.svelte"
    import ChangeIcon from "./popups/ChangeIcon.svelte"
    import Rename from "./popups/Rename.svelte"
    import About from "./popups/About.svelte"
    import Unsaved from "./popups/Unsaved.svelte"
    import Initialize from "./popups/Initialize.svelte"
    import Shortcuts from "./popups/Shortcuts.svelte"
    import Import from "./popups/Import.svelte"
    import Export from "./popups/Export.svelte"
    import Transition from "./popups/Transition.svelte"
    import Alert from "./popups/Alert.svelte"
    import ResetAll from "./popups/ResetAll.svelte"
    import ImportScripture from "./popups/ImportScripture.svelte"
    import Timer from "./popups/Timer.svelte"
    import EditEvent from "./popups/EditEvent.svelte"
    import Color from "./popups/Color.svelte"
    import ChooseScreen from "./popups/ChooseScreen.svelte"
    import AdvancedScreen from "./popups/AdvancedScreen.svelte"
    import CreatePlayer from "./popups/CreatePlayer.svelte"
    import History from "./popups/History.svelte"
    import Midi from "./popups/Midi.svelte"
    import CloudUpdate from "./popups/CloudUpdate.svelte"

    function mousedown(e: any) {
        if (e.target.classList.contains("popup")) activePopup.set(null)
    }

    const popups: any = {
        initialize: Initialize,
        import: Import,
        export: Export,
        show: CreateShow,
        delete_show: DeleteShow,
        icon: ChangeIcon,
        player: CreatePlayer,
        rename: Rename,
        color: Color,
        timer: Timer,
        transition: Transition,
        import_scripture: ImportScripture,
        edit_event: EditEvent,
        choose_screen: ChooseScreen,
        advanced_settings: AdvancedScreen,
        about: About,
        shortcuts: Shortcuts,
        unsaved: Unsaved,
        reset_all: ResetAll,
        alert: Alert,
        history: History,
        midi: Midi,
        cloud_update: CloudUpdate,
    }
</script>

{#if $activePopup !== null}
    {#key $activePopup}
        <div style={$os.platform === "win32" ? "height: calc(100% - 30px);" : null} class="popup" transition:fade={{ duration: 100 }} on:mousedown={mousedown}>
            <div class="card" class:fill={$activePopup === "import_scripture"} transition:scale={{ duration: 200 }}>
                <div style="position: relative;">
                    {#if $activePopup !== "alert"}
                        {#key $activePopup}
                            <h2 style="text-align: center;margin: 10px 50px;"><T id="popup.{$activePopup}" /></h2>
                        {/key}
                    {/if}
                    <Button style="position: absolute;right: 0;top: 0;height: 100%;min-height: 30px;" on:click={() => activePopup.set(null)}>
                        <Icon id="close" size={2} />
                    </Button>
                </div>
                <div style="display: flex;flex-direction: column;margin: 20px;">
                    <svelte:component this={popups[$activePopup]} />
                </div>
            </div>
        </div>
    {/key}
{/if}

<style>
    .popup {
        position: absolute;
        background-color: rgb(0 0 0 / 0.8);
        /* pointer-events: none; */
        width: 100%;
        height: 100%;
        padding: 20px 300px;
        z-index: 80;

        font-size: 1.2em;

        display: flex;
        align-items: center;
        justify-content: center;
    }
    .card {
        position: relative;
        background-color: var(--primary);
        overflow-y: auto;

        min-width: 50%;
        min-height: 50px;
        max-width: 100%;
        max-height: 100%;
    }

    .fill {
        width: 100%;
        height: 100%;
    }
</style>
