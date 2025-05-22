export const actionData = {
    // PROJECT
    id_select_project: { SECTION: "guide_title.project", name: "actions.id_select_project", icon: "project", input: "id" },
    next_project_item: { name: "actions.next_project_item", icon: "project", incompatible: ["previous_project_item", "index_select_project_item"] },
    previous_project_item: { name: "actions.previous_project_item", icon: "project", incompatible: ["next_project_item", "index_select_project_item"] },
    index_select_project_item: { name: "actions.index_select_project_item", icon: "project", input: "index", incompatible: ["next_project_item", "previous_project_item"] },

    // SHOWS
    name_select_show: { SECTION: "guide_title.show", name: "actions.name_select_show", icon: "showIcon", input: "strval" },
    start_show: { slideId: "startShow", name: "preview._start", icon: "showIcon", input: "id" }, // any play actions are incompatible with clear actions...
    set_template: { name: "actions.set_template_active", icon: "templates", input: "id" },
    transpose_show_up: { name: "edit.transpose_up", icon: "up" },
    transpose_show_down: { name: "edit.transpose_down", icon: "down" },

    // PRESENTATION
    next_slide: { SECTION: "preview.slide", name: "preview._next_slide", icon: "slide", incompatible: ["previous_slide", "random_slide", "index_select_slide", "name_select_slide", "id_select_group"] },
    previous_slide: { name: "preview._previous_slide", icon: "slide", incompatible: ["next_slide", "random_slide", "index_select_slide", "name_select_slide", "id_select_group"] },
    random_slide: { name: "actions.random_slide", icon: "slide", incompatible: ["next_slide", "previous_slide", "index_select_slide", "name_select_slide", "id_select_group"] },
    index_select_slide: { name: "actions.index_select_slide", icon: "slide", input: "index", incompatible: ["next_slide", "previous_slide", "random_slide", "name_select_slide", "id_select_group"] },
    name_select_slide: { name: "actions.name_select_slide", icon: "groups", input: "strval", incompatible: ["next_slide", "previous_slide", "random_slide", "index_select_slide", "id_select_group"] },
    id_select_group: { name: "actions.id_select_group", icon: "groups", input: "id", incompatible: ["next_slide", "previous_slide", "random_slide", "index_select_slide", "name_select_slide"] },
    start_slide_recording: { name: "recording.action_play", icon: "record" },

    // CLEAR
    restore_output: { SECTION: "clear.general", name: "preview.restore_output", icon: "reset", incompatible: ["clear_all", "clear_background", "clear_slide", "clear_overlays", "clear_audio", "clear_next_timer"] },
    clear_all: { name: "clear.all", icon: "clear", incompatible: ["restore_output", "clear_background", "clear_slide", "clear_overlays", "clear_audio", "clear_next_timer"] },
    clear_background: { slideId: "clearBackground", name: "clear.background", icon: "background", red: true, incompatible: ["restore_output", "clear_all"] },
    clear_slide: { name: "clear.slide", icon: "slide", red: true, incompatible: ["restore_output", "clear_all"] },
    clear_overlays: { slideId: "clearOverlays", name: "clear.overlays", icon: "overlays", red: true, incompatible: ["restore_output", "clear_all", "clear_overlay"] },
    clear_overlay: { name: "clear.overlay", icon: "overlays", input: "id", red: true, incompatible: ["restore_output", "clear_all", "clear_overlays"] },
    clear_audio: { slideId: "clearAudio", name: "clear.audio", icon: "audio", red: true, incompatible: ["restore_output", "clear_all"] },
    clear_next_timer: { name: "clear.nextTimer", icon: "timer", red: true, incompatible: ["restore_output", "clear_all"] },
    clear_drawing: { name: "clear.drawing", icon: "paint", red: true },

    // MEDIA
    start_camera: { SECTION: "tabs.media", name: "actions.start_camera", icon: "camera", input: "camera" },
    start_screen: { name: "actions.start_screen", icon: "screen", input: "screen" },

    // OVERLAYS
    // SECTION: "tabs.overlays",
    id_select_overlay: { canAddMultiple: true, name: "actions.id_select_overlay", icon: "overlays", input: "id" },

    // OUTPUT
    lock_output: { SECTION: "guide_title.output", name: "actions.toggle_output_lock", icon: "locked", input: "bolval" },
    toggle_output_windows: { name: "actions.toggle_output_windows", icon: "outputs", incompatible: ["toggle_output"] },
    toggle_output: { canAddMultiple: true, name: "actions.toggle_output_window", icon: "outputs", input: "id", incompatible: ["toggle_output_windows"] },
    // id_select_output_style: { name: "actions.id_select_output_style", icon: "styles", input: "id" },
    change_output_style: { slideId: "outputStyle", name: "actions.change_output_style", icon: "styles", input: "output_style" },
    change_transition: { name: "actions.change_transition", icon: "transition", input: "transition" },

    // STAGE
    // SECTION: "menu.stage",
    change_stage_output_layout: { name: "actions.change_stage_output_layout", icon: "stage", input: "stage_output_layout" },
    id_select_stage_layout: { name: "actions.id_change_stage_layout", icon: "stage", input: "id" },

    // AUDIO
    change_volume: { SECTION: "tabs.audio", name: "actions.change_volume", icon: "volume", input: "volume" },
    start_audio_stream: { slideId: "audioStream", name: "actions.start_audio_stream", icon: "audio_stream", input: "id" },
    start_playlist: { name: "actions.start_playlist", icon: "playlist", input: "id", incompatible: ["playlist_next"] },
    playlist_next: { name: "actions.playlist_next", icon: "playlist", incompatible: ["start_playlist"] },
    start_metronome: { name: "actions.start_metronome", icon: "metronome", input: "metronome" },

    // TIMERS
    id_start_timer: { SECTION: "tabs.timers", name: "actions.id_start_timer", icon: "timer", input: "id", incompatible: ["pause_timers", "stop_timers"] },
    start_slide_timers: { slideId: "startTimer", name: "actions.start_slide_timers", icon: "timer", incompatible: ["pause_timers", "stop_timers"] },
    pause_timers: { name: "actions.pause_timers", icon: "pause", incompatible: ["id_start_timer", "start_slide_timers", "stop_timers"] },
    stop_timers: { slideId: "stopTimers", name: "actions.stop_timers", icon: "stop", red: true, incompatible: ["id_start_timer", "start_slide_timers", "pause_timers"] },

    // FUNCTIONS
    change_variable: { SECTION: "tabs.functions", canAddMultiple: true, name: "actions.change_variable", icon: "variable", input: "variable" },
    start_trigger: { canAddMultiple: true, slideId: "trigger", name: "actions.start_trigger", icon: "trigger", input: "id" },

    // EMIT
    // send_midi: { SECTION: "actions.emit_data", canAddMultiple: true, slideId: "sendMidi", name: "actions.send_midi", icon: "music", input: "midi" },
    // send_rest_command: { canAddMultiple: true, name: "actions.send_rest_command", icon: "trigger", input: "rest" },
    emit_action: { SECTION: "actions.emit_data", canAddMultiple: true, name: "actions.emit_data", icon: "emitter", input: "emitter" },

    // ACTION
    run_action: { SECTION: "popup.action", canAddMultiple: true, name: "actions.run_action", icon: "actions", input: "id" },
    toggle_action: { canAddMultiple: true, name: "actions.toggle_action", icon: "actions", input: "toggle_action" },

    // SPECIAL
    // SECTION: "edit.special",
    wait: { canAddMultiple: true, name: "animate.wait", icon: "time_in", input: "number" }
}
