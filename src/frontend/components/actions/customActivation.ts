/// CREATE A CUSTOM ACTION ACTIVATION ///

// 1. Add an entry here in this file
// 2. Add a string entry in en.json>"actions">ID
// 3. Place a call to "customActionActivation(ID)" where the activation should be triggered

// That's it! :)

export const customActionActivations = [
    { id: "startup", name: "actions.activate_on_startup", icon: "upload" },
    { id: "save", name: "actions.activate_save", icon: "save" },

    { id: "show_created", name: "actions.activate_show_created", icon: "slide" },
    { id: "show_opened", name: "actions.activate_show_opened", icon: "slide" },
    { id: "slide_click", name: "actions.activate_slide_clicked", icon: "slide" },
    { id: "group_start", common: true, name: "actions.activate_group_start", icon: "groups", inputs: true },

    { id: "slide_cleared", common: true, name: "actions.activate_slide_cleared", icon: "slide" },
    { id: "background_cleared", common: true, name: "actions.activate_background_cleared", icon: "background" },

    { id: "scripture_start", common: true, name: "actions.activate_scripture_start", icon: "scripture" },

    { id: "video_start", common: true, name: "actions.activate_video_starting", icon: "video" },
    { id: "video_end", common: true, name: "actions.activate_video_ending", icon: "video" },

    { id: "audio_start", common: true, name: "actions.activate_audio_starting", icon: "music" },
    { id: "audio_end", name: "actions.activate_audio_ending", icon: "music" },
    { id: "audio_playlist_ended", common: true, name: "actions.activate_audio_playlist_ended", icon: "music" },

    { id: "timer_start", common: true, name: "actions.activate_timer_starting", icon: "timer", inputs: true },
    { id: "timer_end", common: true, name: "actions.activate_timer_ending", icon: "timer", inputs: true },

    { id: "midi_signal_received", common: true, name: "midi.activate", icon: "companion", inputs: true }
]

// WIP Custom activations
// background_start
// slide_start
// overlay_start
// overlay_cleared
