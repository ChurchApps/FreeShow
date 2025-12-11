import type { ComponentType } from "svelte"
import { get } from "svelte/store"
import type { Popups } from "../../types/Main"
import About from "../components/main/popups/About.svelte"
import Action from "../components/main/popups/Action.svelte"
import ActionHistory from "../components/main/popups/ActionHistory.svelte"
import Alert from "../components/main/popups/Alert.svelte"
import Animate from "../components/main/popups/Animate.svelte"
import AspectRatio from "../components/main/popups/AspectRatio.svelte"
import AudioStream from "../components/main/popups/AudioStream.svelte"
import CategoryAction from "../components/main/popups/CategoryAction.svelte"
import ChangeIcon from "../components/main/popups/ChangeIcon.svelte"
import ChangeOutputValues from "../components/main/popups/ChangeOutputValues.svelte"
import ChooseCamera from "../components/main/popups/ChooseCamera.svelte"
import ChooseChord from "../components/main/popups/ChooseChord.svelte"
import ChooseOutput from "../components/main/popups/ChooseOutput.svelte"
import ChooseScreen from "../components/main/popups/ChooseScreen.svelte"
import ChooseStyle from "../components/main/popups/ChooseStyle.svelte"
import ChurchAppsSyncCategories from "../components/main/popups/ChurchAppsSyncCategories.svelte"
import CloudMethod from "../components/main/popups/CloudMethod.svelte"
import CloudUpdate from "../components/main/popups/CloudUpdate.svelte"
import Color from "../components/main/popups/Color.svelte"
import ColorGradient from "../components/main/popups/ColorGradient.svelte"
import Conditions from "../components/main/popups/Conditions.svelte"
import Confirm from "../components/main/popups/Confirm.svelte"
import Connect from "../components/main/popups/Connect.svelte"
import CreateCollection from "../components/main/popups/CreateCollection.svelte"
import CreatePlayer from "../components/main/popups/CreatePlayer.svelte"
import CreateShow from "../components/main/popups/createShow/CreateShow.svelte"
import CustomAction from "../components/main/popups/CustomAction.svelte"
import CustomText from "../components/main/popups/CustomText.svelte"
import DeleteDuplicatedShows from "../components/main/popups/DeleteDuplicatedShows.svelte"
import DeleteShow from "../components/main/popups/DeleteShow.svelte"
import DisplayDuration from "../components/main/popups/DisplayDuration.svelte"
import DynamicValues from "../components/main/popups/DynamicValues.svelte"
import EditEvent from "../components/main/popups/EditEvent.svelte"
import EffectItems from "../components/main/popups/EffectItems.svelte"
import Emitters from "../components/main/popups/Emitters.svelte"
import Export from "../components/main/popups/export/Export.svelte"
import FindReplace from "../components/main/popups/FindReplace.svelte"
import History from "../components/main/popups/History.svelte"
import Import from "../components/main/popups/Import.svelte"
import ImportScripture from "../components/main/popups/ImportScripture.svelte"
import Initialize from "../components/main/popups/Initialize.svelte"
import Translate from "../components/main/popups/localization/Translate.svelte"
import ManageColors from "../components/main/popups/ManageColors.svelte"
import ManageDynamicValues from "../components/main/popups/ManageDynamicValues.svelte"
import ManageGroups from "../components/main/popups/ManageGroups.svelte"
import ManageIcons from "../components/main/popups/ManageIcons.svelte"
import ManageMetadata from "../components/main/popups/ManageMetadata.svelte"
import ManageTags from "../components/main/popups/ManageTags.svelte"
import MaxLines from "../components/main/popups/MaxLines.svelte"
import MediaFit from "../components/main/popups/MediaFit.svelte"
import MetadataDisplay from "../components/main/popups/MetadataDisplay.svelte"
import NextTimer from "../components/main/popups/NextTimer.svelte"
import OutputSelector from "../components/main/popups/OutputSelector.svelte"
import Rename from "../components/main/popups/Rename.svelte"
import ResetAll from "../components/main/popups/ResetAll.svelte"
import ScriptureShow from "../components/main/popups/ScriptureShow.svelte"
import SelectShow from "../components/main/popups/SelectShow.svelte"
import SelectStageLayout from "../components/main/popups/SelectStageLayout.svelte"
import SelectStyle from "../components/main/popups/SelectStyle.svelte"
import SelectTemplate from "../components/main/popups/SelectTemplate.svelte"
import SetTime from "../components/main/popups/SetTime.svelte"
import Shortcuts from "../components/main/popups/Shortcuts.svelte"
import SlideMidi from "../components/main/popups/SlideMidi.svelte"
import SlideShortcut from "../components/main/popups/SlideShortcut.svelte"
import SongbeamerImport from "../components/main/popups/SongbeamerImport.svelte"
import TemplateStyleOverrides from "../components/main/popups/TemplateStyleOverrides.svelte"
import Timer from "../components/main/popups/Timer.svelte"
import Transition from "../components/main/popups/Transition.svelte"
import Trigger from "../components/main/popups/Trigger.svelte"
import Unsaved from "../components/main/popups/Unsaved.svelte"
import Variable from "../components/main/popups/Variable.svelte"
import { activePopup, popupData } from "../stores"
import NowPlaying from "../components/main/popups/NowPlaying.svelte"
import Restore from "../components/main/popups/Restore.svelte"

export const popups: { [key in Popups]: ComponentType } = {
    initialize: Initialize,
    confirm: Confirm,
    custom_text: CustomText,
    import: Import,
    songbeamer_import: SongbeamerImport,
    export: Export,
    show: CreateShow,
    delete_show: DeleteShow,
    select_show: SelectShow,
    select_template: SelectTemplate,
    select_style: SelectStyle,
    select_stage_layout: SelectStageLayout,
    delete_duplicated_shows: DeleteDuplicatedShows,
    icon: ChangeIcon,
    manage_groups: ManageGroups,
    manage_icons: ManageIcons,
    manage_colors: ManageColors,
    manage_metadata: ManageMetadata,
    manage_dynamic_values: ManageDynamicValues,
    template_style_overrides: TemplateStyleOverrides,
    choose_chord: ChooseChord,
    choose_camera: ChooseCamera,
    player: CreatePlayer,
    rename: Rename,
    color: Color,
    color_gradient: ColorGradient,
    find_replace: FindReplace,
    timer: Timer,
    variable: Variable,
    trigger: Trigger,
    audio_stream: AudioStream,
    now_playing: NowPlaying,
    aspect_ratio: AspectRatio,
    max_lines: MaxLines,
    transition: Transition,
    media_fit: MediaFit,
    metadata_display: MetadataDisplay,
    import_scripture: ImportScripture,
    create_collection: CreateCollection,
    scripture_show: ScriptureShow,
    edit_event: EditEvent,
    choose_screen: ChooseScreen,
    choose_output: ChooseOutput,
    choose_style: ChooseStyle,
    change_output_values: ChangeOutputValues,
    output_selector: OutputSelector,
    set_time: SetTime,
    assign_shortcut: SlideShortcut,
    dynamic_values: DynamicValues,
    conditions: Conditions,
    animate: Animate,
    translate: Translate,
    next_timer: NextTimer,
    display_duration: DisplayDuration,
    manage_tags: ManageTags,
    about: About,
    shortcuts: Shortcuts,
    unsaved: Unsaved,
    restore: Restore,
    reset_all: ResetAll,
    alert: Alert,
    history: History,
    action_history: ActionHistory,
    manage_emitters: Emitters,
    action: Action,
    category_action: CategoryAction,
    custom_action: CustomAction,
    slide_midi: SlideMidi,
    connect: Connect,
    cloud_update: CloudUpdate,
    cloud_method: CloudMethod,
    sync_categories: ChurchAppsSyncCategories,
    effect_items: EffectItems
}

export function waitForPopupData(popupId: Popups): Promise<any> {
    popupData.set({ ...get(popupData), id: "", value: "" })
    activePopup.set(popupId)

    return new Promise((resolve) => {
        // check that popup is still active
        const interval = setInterval(() => {
            if (get(activePopup) !== popupId) finish(undefined)
        }, 1000)

        const unsubscribe = popupData.subscribe((a) => {
            if (a.id !== popupId) return
            activePopup.set(null)
            finish(a.value)
        })

        function finish(value) {
            unsubscribe()
            clearInterval(interval)
            resolve(value)
        }
    })
}

export async function confirmCustom(prompt: string) {
    popupData.set({ prompt })
    const data = await waitForPopupData("confirm")
    return !!data
}

export async function promptCustom(prompt: string) {
    popupData.set({ prompt, textInput: true })
    const data = (await waitForPopupData("confirm")) || ""
    return data as string
}
