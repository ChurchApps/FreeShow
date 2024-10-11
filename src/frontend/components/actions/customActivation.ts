/// CREATE A CUSTOM ACTION ACTIVATION ///

// 1. Add an entry here in this file
// 2. Add a string entry in en.json>"actions">ID
// 3. Place a call to "customActionActivation(ID)" where the activation should be triggered

// That's it! :)

export const customActionActivations = [
    { id: "startup", name: "$:actions.activate_on_startup:$" },
    { id: "save", name: "$:actions.activate_save:$" },
    { id: "slide_click", name: "$:actions.activate_slide_clicked:$" },
    { id: "video_start", name: "$:actions.activate_video_starting:$" },
    { id: "video_end", name: "$:actions.activate_video_ending:$" },
    { id: "audio_start", name: "$:actions.activate_audio_starting:$" },
    { id: "audio_end", name: "$:actions.activate_audio_ending:$" },
    { id: "timer_end", name: "$:actions.activate_timer_ending:$" },
    { id: "scripture_start", name: "$:actions.activate_scripture_start:$" },
    { id: "slide_cleared", name: "$:actions.activate_slide_cleared:$" },
    { id: "background_cleared", name: "$:actions.activate_background_cleared:$" },
    { id: "show_created", name: "$:actions.activate_show_created:$" },
    { id: "audio_playlist_ended", name: "$:actions.activate_audio_playlist_ended:$" },
]
