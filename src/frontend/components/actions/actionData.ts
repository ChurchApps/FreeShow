export const actionData = {
    // PROJECT
    index_select_project: { name: "actions.index_select_project", icon: "project", input: "index" },
    next_project_item: { name: "actions.next_project_item", icon: "project" },
    previous_project_item: { name: "actions.previous_project_item", icon: "project" },
    index_select_project_item: { name: "actions.index_select_project_item", icon: "project", input: "index" },

    // SHOWS
    name_select_show: { name: "actions.name_select_show", icon: "showIcon", input: "strval" },
    start_show: { slideId: "startShow", name: "preview._start", icon: "showIcon", input: "id" },

    // PRESENTATION
    next_slide: { name: "preview._next_slide", icon: "slide" },
    previous_slide: { name: "preview._previous_slide", icon: "slide" },
    random_slide: { name: "actions.random_slide", icon: "slide" },
    index_select_slide: { name: "actions.index_select_slide", icon: "slide", input: "index" },
    name_select_slide: { name: "actions.name_select_slide", icon: "groups", input: "strval" },
    id_select_group: { name: "actions.id_select_group", icon: "groups", input: "id" },
    lock_output: { name: "actions.toggle_output_lock", icon: "locked", input: "bolval" },
    toggle_output_windows: { name: "actions.toggle_output_windows", icon: "outputs" },

    // STAGE
    id_select_stage_layout: { name: "actions.id_change_stage_layout", icon: "stage", input: "id" },

    // CLEAR
    restore_output: { name: "preview.restore_output", icon: "reset" },
    clear_all: { name: "clear.all", icon: "clear" },
    clear_background: { slideId: "clearBackground", name: "clear.background", icon: "background", red: true },
    clear_slide: { name: "clear.slide", icon: "slide", red: true },
    clear_overlays: { slideId: "clearOverlays", name: "clear.overlays", icon: "overlays", red: true },
    clear_audio: { slideId: "clearAudio", name: "clear.audio", icon: "audio", red: true },
    clear_next_timer: { name: "clear.nextTimer", icon: "timer", red: true },

    // OVERLAYS
    index_select_overlay: { name: "actions.index_select_overlay", icon: "overlays", input: "index" },
    name_select_overlay: { name: "actions.name_select_overlay", icon: "overlays", input: "strval" },

    // AUDIO
    change_volume: { name: "actions.change_volume", icon: "volume", input: "volume" },
    start_audio_stream: { slideId: "audioStream", name: "actions.start_audio_stream", icon: "audio_stream", input: "id" },
    start_playlist: { name: "actions.start_playlist", icon: "playlist", input: "id" },

    // TIMERS
    start_slide_timers: { slideId: "startTimer", name: "actions.start_slide_timers", icon: "timer" },
    stop_timers: { slideId: "stopTimers", name: "actions.stop_timers", icon: "stop", red: true },

    // VISUAL
    id_select_output_style: { name: "actions.id_select_output_style", icon: "styles", input: "id" },
    change_output_style: { slideId: "outputStyle", name: "actions.change_output_style", icon: "styles", input: "output_style" },
    change_transition: { name: "actions.change_transition", icon: "transition", input: "transition" },

    // OTHER
    change_variable: { name: "actions.change_variable", icon: "variable", input: "variable" },
    start_trigger: { slideId: "trigger", name: "actions.start_trigger", icon: "trigger", input: "id" },
    send_midi: { slideId: "sendMidi", name: "actions.send_midi", icon: "music", input: "midi" },
    run_action: { name: "actions.run_action", icon: "actions", input: "id" },
}
