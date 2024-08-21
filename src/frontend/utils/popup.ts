import type { ComponentType } from "svelte"
import type { Popups } from "../../types/Main"
import { activePopup, popupData } from "../stores"
import About from "../components/main/popups/About.svelte"
import Action from "../components/main/popups/Action.svelte"
import AdvancedScreen from "../components/main/popups/AdvancedScreen.svelte"
import Alert from "../components/main/popups/Alert.svelte"
import Animate from "../components/main/popups/Animate.svelte"
import AudioStream from "../components/main/popups/AudioStream.svelte"
import ChangeIcon from "../components/main/popups/ChangeIcon.svelte"
import ChangeOutputValues from "../components/main/popups/ChangeOutputValues.svelte"
import ChooseCamera from "../components/main/popups/ChooseCamera.svelte"
import ChooseScreen from "../components/main/popups/ChooseScreen.svelte"
import CloudMethod from "../components/main/popups/CloudMethod.svelte"
import CloudUpdate from "../components/main/popups/CloudUpdate.svelte"
import Color from "../components/main/popups/Color.svelte"
import Connect from "../components/main/popups/Connect.svelte"
import CreatePlayer from "../components/main/popups/CreatePlayer.svelte"
import CreateShow from "../components/main/popups/CreateShow.svelte"
import DeleteShow from "../components/main/popups/DeleteShow.svelte"
import EditEvent from "../components/main/popups/EditEvent.svelte"
import EditList from "../components/main/popups/EditList.svelte"
import Export from "../components/main/popups/export/Export.svelte"
import FindReplace from "../components/main/popups/FindReplace.svelte"
import History from "../components/main/popups/History.svelte"
import Import from "../components/main/popups/Import.svelte"
import ImportScripture from "../components/main/popups/ImportScripture.svelte"
import Initialize from "../components/main/popups/Initialize.svelte"
import ManageColors from "../components/main/popups/ManageColors.svelte"
import ManageIcons from "../components/main/popups/ManageIcons.svelte"
import NextTimer from "../components/main/popups/NextTimer.svelte"
import Rename from "../components/main/popups/Rename.svelte"
import ResetAll from "../components/main/popups/ResetAll.svelte"
import SelectShow from "../components/main/popups/SelectShow.svelte"
import SetTime from "../components/main/popups/SetTime.svelte"
import Shortcuts from "../components/main/popups/Shortcuts.svelte"
import SongbeamerImport from "../components/main/popups/SongbeamerImport.svelte"
import Timer from "../components/main/popups/Timer.svelte"
import Transition from "../components/main/popups/Transition.svelte"
import Trigger from "../components/main/popups/Trigger.svelte"
import Unsaved from "../components/main/popups/Unsaved.svelte"
import Variable from "../components/main/popups/Variable.svelte"
import ChooseChord from "../components/main/popups/ChooseChord.svelte"
import { get } from "svelte/store"

export const popups: { [key in Popups]: ComponentType } = {
    initialize: Initialize,
    import: Import,
    songbeamer_import: SongbeamerImport,
    export: Export,
    show: CreateShow,
    delete_show: DeleteShow,
    select_show: SelectShow,
    icon: ChangeIcon,
    manage_icons: ManageIcons,
    manage_colors: ManageColors,
    choose_chord: ChooseChord,
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
    action: Action,
    connect: Connect,
    cloud_update: CloudUpdate,
    cloud_method: CloudMethod,
}

export function waitForPopupData(popupId: Popups): Promise<any> {
    popupData.set({ ...get(popupData), id: "", value: "" })
    activePopup.set(popupId)

    return new Promise((resolve) => {
        // check that popup is still active
        let interval = setInterval(() => {
            if (get(activePopup) !== popupId) finish(undefined)
        }, 1000)

        popupData.subscribe((a) => {
            if (a.id !== popupId) return
            activePopup.set(null)
            finish(a.value)
        })

        function finish(value) {
            clearTimeout(interval)
            resolve(value)
        }
    })
}
