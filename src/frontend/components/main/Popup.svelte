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
    import CloudMethod from "./popups/CloudMethod.svelte"
    import ChangeOutputValues from "./popups/ChangeOutputValues.svelte"
    import ChooseStyle from "./popups/ChooseStyle.svelte"
    import SelectShow from "./popups/SelectShow.svelte"
    import EditList from "./popups/EditList.svelte"
    import Connect from "./popups/Connect.svelte"
    import FindReplace from "./popups/FindReplace.svelte"
    import NextTimer from "./popups/NextTimer.svelte"
    import ManageIcons from "./popups/ManageIcons.svelte"
    import ChooseCamera from "./popups/ChooseCamera.svelte"
    import Animate from "./popups/Animate.svelte"
    import SetTime from "./popups/SetTime.svelte"
    import Variable from "./popups/Variable.svelte"
    import Trigger from "./popups/Trigger.svelte"
    import ManageColors from "./popups/ManageColors.svelte"
    import AudioStream from "./popups/AudioStream.svelte"
    import { disablePopupClose } from "../../utils/shortcuts"

    function mousedown(e: any) {
        if (disablePopupClose.includes(popupId)) return

        if (e.target.classList.contains("popup")) activePopup.set(null)
    }

    const popups: any = {
        initialize: Initialize,
        import: Import,
        export: Export,
        show: CreateShow,
        delete_show: DeleteShow,
        select_show: SelectShow,
        icon: ChangeIcon,
        manage_icons: ManageIcons,
        manage_colors: ManageColors,
        choose_camera: ChooseCamera,
        player: CreatePlayer,
        rename: Rename,
        color: Color,
        find_replace: FindReplace,
        edit_list: EditList,
        timer: Timer,
        variable: Variable,
        trigger: Trigger,
        audio_stream: AudioStream,
        transition: Transition,
        import_scripture: ImportScripture,
        edit_event: EditEvent,
        choose_screen: ChooseScreen,
        change_output_values: ChangeOutputValues,
        choose_style: ChooseStyle,
        set_time: SetTime,
        animate: Animate,
        next_timer: NextTimer,
        advanced_settings: AdvancedScreen,
        about: About,
        shortcuts: Shortcuts,
        unsaved: Unsaved,
        reset_all: ResetAll,
        alert: Alert,
        history: History,
        midi: Midi,
        connect: Connect,
        cloud_update: CloudUpdate,
        cloud_method: CloudMethod,
    }

    // prevent svelte transition lock
    let popupId: any = null
    let popupTimeout: any = null
    $: if ($activePopup !== undefined) updatePopup()
    function updatePopup() {
        if (popupTimeout) return

        popupTimeout = setTimeout(() => {
            popupId = $activePopup
            popupTimeout = null
        }, 100)
    }
</script>

{#if popupId !== null}
    {#key popupId}
        <div style={$os.platform === "win32" ? "height: calc(100% - 30px);" : null} class="popup" transition:fade={{ duration: 100 }} on:mousedown={mousedown}>
            <div class="card" class:fill={popupId === "import_scripture"} transition:scale={{ duration: 200 }}>
                <div style="position: relative;">
                    {#if popupId !== "alert"}
                        {#key popupId}
                            <h2 style="text-align: center;padding: 10px 50px;"><T id="popup.{popupId}" /></h2>
                        {/key}
                    {/if}

                    {#if popupId !== "alert" && !disablePopupClose.includes(popupId)}
                        <Button style="position: absolute;right: 0;top: 0;height: 100%;min-height: 40px;" on:click={() => activePopup.set(null)}>
                            <Icon id="close" size={2} />
                        </Button>
                    {/if}
                </div>
                <div style="display: flex;flex-direction: column;margin: 20px;min-width: 38vw;">
                    <svelte:component this={popups[popupId]} />
                </div>
            </div>
        </div>
    {/key}
{/if}

<style>
    h2 {
        color: var(--text);
    }

    .popup {
        position: absolute;
        background-color: rgb(0 0 0 / 0.8);
        /* pointer-events: none; */
        width: 100%;
        height: 100%;
        padding: 20px 300px;
        z-index: 5000;

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

    /* WIP dropdown */
    /* .popup :global(.dropdown) {
        position: fixed !important;
        width: fit-content;
        max-height: 150px;
    } */
</style>
