import { get } from "svelte/store"
import { shows } from "../../stores"

export const actionData = {
    // PROJECT
    index_select_project: { name: "", icon: "", input: "index" },
    next_project_item: { name: "", icon: "" },
    previous_project_item: { name: "", icon: "" },
    index_select_project_item: { name: "", icon: "", input: "index" },

    // SHOWS
    name_select_show: { name: "", icon: "", input: "strval" },
    start_show: { slideId: "startShow", getName: ({ id }) => get(shows)[id]?.name || "", name: "preview._start", icon: "showIcon", input: "id", common: true },

    // PRESENTATION
    next_slide: { name: "", icon: "" },
    previous_slide: { name: "", icon: "" },
    index_select_slide: { name: "", icon: "", input: "index" },
    name_select_slide: { name: "", icon: "", input: "strval" },
    lock_output: { name: "", icon: "", input: "bolval" },
    toggle_output_windows: { name: "", icon: "" },
    id_select_group: { name: "", icon: "", input: "id" },

    // STAGE
    id_select_stage_layout: { name: "", icon: "", input: "id" },

    // CLEAR
    restore_output: { name: "", icon: "" },
    clear_all: { name: "", icon: "", common: true },
    clear_background: { slideId: "clearBackground", name: "clear.background", icon: "background", red: true, common: true },
    clear_slide: { name: "", icon: "" },
    clear_overlays: { slideId: "clearOverlays", name: "clear.overlays", icon: "overlays", red: true, common: true },
    clear_audio: { slideId: "clearAudio", name: "clear.audio", icon: "audio", red: true, common: true },
    clear_next_timer: { name: "", icon: "" },

    // OVERLAYS
    index_select_overlay: { name: "", icon: "", input: "index" },
    name_select_overlay: { name: "", icon: "", input: "strval" },

    // AUDIO
    change_volume: { name: "", icon: "", input: "volume" },
    start_audio_stream: { slideId: "audioStream", name: "popup.audio_stream", icon: "audio_stream", input: "id" },

    // TIMERS
    start_slide_timers: { slideId: "startTimer", name: "actions.start_timer", icon: "timer", common: true },
    stop_timers: { slideId: "stopTimers", name: "actions.stop_timers", icon: "stop", red: true, common: true },

    // VISUAL
    id_select_output_style: { slideId: "outputStyle", name: "actions.change_output_style", icon: "styles", input: "id", common: true },
    change_transition: { name: "", icon: "", input: "transition" },

    // OTHER
    change_variable: { name: "", icon: "", input: "variable" },
    start_trigger: { slideId: "trigger", name: "popup.trigger", icon: "trigger", input: "id" },
    send_midi: { slideId: "sendMidi", name: "actions.send_midi", icon: "music", input: "midi" },
    run_action: { name: "", icon: "actions", input: "id" },
}
