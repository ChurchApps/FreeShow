export interface ContextMenuItem {
    id?: string
    color?: string
    style?: string
    label: string
    translate?: boolean
    items?: string[]
    icon?: string
    iconColor?: string
    shortcuts?: string[]
    enabled?: boolean
    disabled?: boolean
    external?: boolean

    type?: string // remove layers
}

export const contextMenuItems: { [key: string]: ContextMenuItem } = {
    // MENU
    save: { label: "actions.save", icon: "save", iconColor: "#b7ffac", shortcuts: ["Ctrl+S"] },
    import_more: { label: "actions.import", icon: "import", shortcuts: ["Ctrl+I"] },
    export_more: { label: "actions.export", icon: "export", shortcuts: ["Ctrl+E"] },
    undo: { label: "actions.undo", icon: "undo", shortcuts: ["Ctrl+Z"] },
    redo: { label: "actions.redo", icon: "redo", shortcuts: ["Ctrl+Y"] },
    history: { label: "popup.history", icon: "history", iconColor: "var(--secondary)", shortcuts: ["Ctrl+H"] },
    cut: { label: "actions.cut", icon: "cut", iconColor: "#97c7ff", shortcuts: ["Ctrl+X"] },
    copy: { label: "actions.copy", icon: "copy", iconColor: "#97c7ff", shortcuts: ["Ctrl+C"] },
    paste: { label: "actions.paste", icon: "paste", iconColor: "#97c7ff", shortcuts: ["Ctrl+V"] },
    docs: { label: "main.docs", icon: "document", external: true },
    quick_search: { label: "main.quick_search", icon: "search", shortcuts: ["Ctrl+G"] },
    quick_start_guide: { label: "guide.start", icon: "guide" },
    focus_mode: { label: "actions.focus_mode", icon: "focus_mode", shortcuts: ["Ctrl+Shift+F"] },
    fullscreen: { label: "actions.fullscreen", icon: "fullscreen", shortcuts: ["F11"] },
    resetZoom: { label: "actions.resetZoom", icon: "reset", iconColor: "#ff5454" },
    zoomIn: { label: "actions.zoomIn", icon: "zoomIn" },
    zoomOut: { label: "actions.zoomOut", icon: "zoomOut" },
    // MAIN
    quit: { label: "main.quit", icon: "close", iconColor: "#ff5454" },
    settings: { label: "menu.settings", icon: "settings", iconColor: "var(--secondary)" },
    about: { label: "main.about", icon: "info" },
    shortcuts: { label: "popup.shortcuts", icon: "shortcut", shortcuts: ["Ctrl+?"] },
    rename: { label: "actions.rename", icon: "rename", iconColor: "#6effbe", shortcuts: ["F2"] },
    delete: { label: "actions.delete", icon: "delete", iconColor: "#ff5454", shortcuts: ["Del"] },
    delete_remove: { label: "actions.remove", icon: "remove", iconColor: "#ff5454", shortcuts: ["Del"] },
    delete_all: { label: "actions.delete_all", icon: "delete", iconColor: "#ff5454" },
    import: { label: "actions.import", icon: "import" },
    export: { label: "actions.export", icon: "export" },
    custom_text: { label: "popup.custom_text", icon: "rename", iconColor: "#6effbe" },
    // DRAWER
    enabledTabs: { label: "context.enabledTabs", items: ["LOAD_enabled_drawer_tabs"] },
    manage_show_tags: { label: "popup.manage_tags", icon: "edit", iconColor: "#97c7ff" },
    tag_set: { label: "context.setTag", icon: "tag", iconColor: "#979aff", items: ["LOAD_tag_set"] },
    tag_filter: { label: "context.filterByTags", icon: "tag", iconColor: "#979aff", items: ["LOAD_tag_filter"] },
    manage_media_tags: { label: "popup.manage_tags", icon: "edit", iconColor: "#97c7ff" },
    media_tag_set: { label: "context.setTag", icon: "tag", iconColor: "#979aff", items: ["LOAD_media_tag_set"] },
    media_tag_filter: { label: "context.filterByTags", icon: "tag", iconColor: "#979aff", items: ["LOAD_media_tag_filter"] },
    manage_action_tags: { label: "popup.manage_tags", icon: "edit", iconColor: "#97c7ff" },
    action_tag_set: { label: "context.setTag", icon: "tag", iconColor: "#979aff", items: ["LOAD_action_tag_set"] },
    action_tag_filter: { label: "context.filterByTags", icon: "tag", iconColor: "#979aff", items: ["LOAD_action_tag_filter"] },
    manage_variable_tags: { label: "popup.manage_tags", icon: "edit", iconColor: "#97c7ff" },
    variable_tag_set: { label: "context.setTag", icon: "tag", iconColor: "#979aff", items: ["LOAD_variable_tag_set"] },
    variable_tag_filter: { label: "context.filterByTags", icon: "tag", iconColor: "#979aff", items: ["LOAD_variable_tag_filter"] },
    newCategory: { label: "context.newCategory", icon: "add", iconColor: "var(--secondary)" },
    newScripture: { label: "new.scripture", icon: "add", iconColor: "var(--secondary)" },
    createCollection: { label: "new.collection", icon: "collection" },
    changeIcon: { label: "context.changeIcon", icon: "star", iconColor: "#6effbe" },
    category_action: { label: "popup.category_action", icon: "actions", iconColor: "#d497ff" },
    category_template: { label: "popup.category_template", icon: "templates", iconColor: "#d497ff" },
    use_as_archive: { label: "context.use_as_archive", icon: "archive" },
    archive: { label: "actions.move_to_archive", icon: "archive" },
    toggle_clock: { label: "context.toggle_clock", icon: "clock" },
    // OUTPUTS
    force_output: { label: "context.force_outputs", icon: "outputs" },
    align_with_screen: { label: "context.align_with_screen", icon: "resize" },
    choose_screen: { label: "popup.choose_screen", icon: "screen" },
    toggle_output: { label: "context.toggle_output", icon: "outputs" },
    move_to_front: { label: "context.move_to_front", icon: "toFront" },
    hide_from_preview: { label: "context.hide_from_preview", icon: "hide" },
    test_pattern: { label: "preview.test_pattern", icon: "test" },
    live_prepare: { label: "preview.live_prepare", icon: "hide" },
    // PROJECT
    close: { label: "actions.close", icon: "close", iconColor: "#ff5454" },
    newProject: { label: "new.project", icon: "add", iconColor: "var(--secondary)" },
    newFolder: { label: "new.folder", icon: "folder", iconColor: "var(--secondary)" },
    newShowPopup: { label: "new.show", icon: "add", iconColor: "var(--secondary)" },
    newShow: { label: "new.empty_show", icon: "add", iconColor: "var(--secondary)" },
    create_show: { label: "new.show_convert", icon: "slide", iconColor: "var(--secondary)" },
    // newPrivateShow: { label: "new.private", icon: "private" },
    private: { label: "actions.toggle_private", icon: "private", iconColor: "#ff5454" },
    unlink_pco: { label: "actions.unlink_pco", icon: "bind", iconColor: "#ff5454" },
    duplicate: { label: "actions.duplicate", icon: "duplicate", iconColor: "#97c7ff", shortcuts: ["Ctrl+D"] },
    section: { label: "new.section", icon: "section", iconColor: "var(--secondary)" },
    copy_to_template: { label: "actions.create_template", icon: "templates", iconColor: "#97c7ff" },
    // SORT
    sort_shows_by: { label: "sort.sort_by", icon: "sort", iconColor: "#979aff", items: ["LOAD_sort_shows"] },
    sort_projects_by: { label: "sort.sort_by", icon: "sort", iconColor: "#979aff", items: ["LOAD_sort_projects"] },
    sort_media_by: { label: "sort.sort_by", icon: "sort", iconColor: "#979aff", items: ["LOAD_sort_media"] },
    // SHOWS
    addToProject: { label: "context.addToProject", icon: "project" },
    lock_show: { label: "context.lockForChanges", icon: "lock", iconColor: "#ff5454" },
    remove: { label: "actions.remove", icon: "remove", iconColor: "#ff5454" },
    remove_group: { label: "actions.remove", icon: "remove", iconColor: "#ff5454" },
    remove_slide: { label: "actions.remove_group", icon: "remove", iconColor: "#ff5454", shortcuts: ["Del"] },
    delete_slide: { label: "actions.delete_slide", icon: "delete", iconColor: "#ff5454" },
    delete_group: { label: "actions.delete_group", icon: "delete", iconColor: "#ff5454", shortcuts: ["Del"] },
    manage_groups: { label: "popup.manage_groups", icon: "edit", iconColor: "#97c7ff" },
    manage_metadata: { label: "popup.manage_metadata", icon: "edit", iconColor: "#97c7ff" },
    slideGroups: { label: "context.changeGroup", icon: "groups", iconColor: "#ff97d9", items: ["rename", "recolor", "SEPARATOR", "LOAD_slide_groups"] }, // "remove_group" (currently broken & probably not needed) | , "SEPARATOR", "manage_groups"
    editSlideText: { label: "menu.edit", icon: "edit", iconColor: "#97c7ff" }, // actions.edit_slide_text
    selectAll: { label: "context.selectAll", icon: "select", shortcuts: ["Ctrl+A"] },
    newSlide: { label: "new.slide", icon: "add", iconColor: "var(--secondary)" },
    // newGroup: { label: "context.createNew", icon: "add", iconColor: "var(--secondary)" },
    // SLIDE VIEWS
    view_grid: { label: "show.grid", icon: "grid" },
    view_simple: { label: "show.simple", icon: "simple" },
    view_groups: { label: "show.groups", icon: "groups" },
    view_list: { label: "show.list", icon: "list" },
    view_lyrics: { label: "show.lyrics", icon: "lyrics" },
    // SLIDE
    slide_transition: { label: "popup.transition", icon: "transition", iconColor: "#ffd5bb" },
    disable: { label: "actions.disable", icon: "disable", iconColor: "#ff5454" },
    edit: { label: "menu.edit", icon: "edit", iconColor: "#97c7ff" },
    recolor: { label: "actions.recolor", icon: "color", iconColor: "#6effbe" },
    actions: { label: "actions.slide_actions", icon: "actions", iconColor: "#d497ff", items: ["LOAD_actions"] },
    bind_to: { label: "actions.bind_to", icon: "bind", iconColor: "#d497ff", items: ["LOAD_bind_slide"] },
    remove_layers: { label: "actions.remove_layers", icon: "remove_layers", iconColor: "#ff5454", items: ["LOAD_remove_layers"] },
    set_key: { label: "actions.set_key", icon: "chords", items: ["LOAD_keys"] },
    chord_list: { label: "edit.chords", icon: "chords", items: ["LOAD_chord_list"] },
    custom_key: { label: "actions.custom_key", icon: "edit", iconColor: "#97c7ff" },
    // ITEM
    item_actions: { label: "actions.item_actions", icon: "actions", iconColor: "#d497ff", items: ["LOAD_item_actions"] },
    transition: { label: "popup.transition", icon: "transition", iconColor: "#ffd5bb" },
    dynamic_values: { label: "actions.dynamic_values", icon: "dynamic", iconColor: "#ff91fd" },
    conditions: { label: "actions.conditions", icon: "light", iconColor: "#ff91fd" },
    item_bind_to: { label: "actions.bind_to", icon: "bind", iconColor: "#d497ff", items: ["LOAD_bind_item"] },
    format: { label: "actions.format", icon: "format", iconColor: "#93f190", items: ["find_replace", "SEPARATOR", "cut_in_half", "merge", "SEPARATOR", "uppercase", "lowercase", "capitalize", "trim"] },
    rearrange: { label: "actions.rearrange", icon: "rearrange", iconColor: "#93f190", items: ["to_front", "forward", "backward", "to_back"] },
    rearrange_stage: { label: "actions.rearrange", icon: "rearrange", iconColor: "#93f190", items: ["to_front_stage", "forward_stage", "backward_stage", "to_back_stage"] },
    // stage
    stage: { label: "menu.stage", id: "stage" },
    // formatting
    find_replace: { label: "actions.find_replace", icon: "find_replace", iconColor: "#90f1cc" },
    cut_in_half: { label: "actions.cut_in_half", icon: "cut_in_half", iconColor: "#90f1b5" },
    merge: { label: "actions.merge", icon: "merge", iconColor: "#90f1b5" },
    uppercase: { label: "actions.uppercase", icon: "increase_text", iconColor: "#93f190" },
    lowercase: { label: "actions.lowercase", icon: "decrease_text", iconColor: "#93f190" },
    capitalize: { label: "actions.capitalize", icon: "capitalize", iconColor: "#93f190" },
    trim: { label: "actions.trim", icon: "cut", iconColor: "#93f190" },
    // rearrange
    to_front: { label: "actions.to_front", icon: "to_front", iconColor: "#93f190" },
    forward: { label: "actions.forward", icon: "up", iconColor: "#93f190" },
    backward: { label: "actions.backward", icon: "down", iconColor: "#93f190" },
    to_back: { label: "actions.to_back", icon: "to_back", iconColor: "#93f190" },
    to_front_stage: { label: "actions.to_front", icon: "to_front", iconColor: "#93f190" },
    forward_stage: { label: "actions.forward", icon: "up", iconColor: "#93f190" },
    backward_stage: { label: "actions.backward", icon: "down", iconColor: "#93f190" },
    to_back_stage: { label: "actions.to_back", icon: "to_back", iconColor: "#93f190" },
    // MEDIA
    preview: { label: "preview.show_preview", icon: "eye", iconColor: "#ffc3d3" },
    play: { label: "media.play", icon: "play", iconColor: "#7d81ff" },
    play_no_audio: { label: "media.play_no_audio", icon: "play", iconColor: "#7d81ff" },
    play_no_filters: { label: "media.play_no_filters", icon: "play", iconColor: "#7d81ff" },
    favourite: { label: "media.favourite", icon: "star", iconColor: "#fff1ad" },
    effects_library_add: { label: "media.effects_library_add", icon: "effect", iconColor: "#fff1ad" },
    system_open: { label: "main.system_open", icon: "launch" },
    // LIVE
    startup_activate: { label: "actions.activate_on_startup", icon: "startup" },
    recording: { label: "actions.start_recording", icon: "record", iconColor: "#ff7a7a" },
    // OVERLAYS
    lock_to_output: { label: "context.lock_to_output", icon: "locked", iconColor: "#ff5454" },
    place_under_slide: { label: "context.place_under_slide", icon: "under", iconColor: "#d497ff" },
    display_duration: { label: "popup.display_duration", icon: "clock", iconColor: "#d497ff" },
    // TEMPLATES
    template_actions: { label: "tabs.actions", icon: "actions", iconColor: "#d497ff" },
    // STAGE
    move_connections: { label: "context.move_connections", icon: "up" },
    // SETTINGS
    reset_theme: { label: "settings.reset_theme", icon: "reset", iconColor: "#ff5454" },
    reset: { label: "actions.reset", icon: "reset", iconColor: "#ff5454" }
}

export const contextMenuLayouts: { [key: string]: string[] } = {
    // MENU
    file: ["save", "import_more", "export_more", "SEPARATOR", "quit"],
    edit: ["undo", "redo", "history", "SEPARATOR", "cut", "copy", "paste", "delete", "SEPARATOR", "selectAll"], // , "cut"
    view: ["focus_mode", "fullscreen"], // , "resetZoom", "zoomIn", "zoomOut"
    help: ["quick_search", "shortcuts", "docs", "quick_start_guide", "about"],
    // MAIN
    default: ["save", "settings", "history", "SEPARATOR", "about", "quit"],
    splash: ["custom_text"],
    rename: ["rename"],
    close: ["close"],
    output_window: ["close"],
    input: ["copy", "paste"],

    // TOP
    output: ["force_output", "SEPARATOR", "align_with_screen", "choose_screen"], // , "SEPARATOR", "edit"

    // OUTPUTS
    output_preview: ["edit", "SEPARATOR", "live_prepare", "SEPARATOR", "test_pattern"],
    output_active_button: ["edit", "SEPARATOR", "toggle_output", "move_to_front", "SEPARATOR", "hide_from_preview"],

    // DRAWER
    drawer_top: ["enabledTabs"],
    drawer_info: ["toggle_clock"],
    // NAVIGATION
    category_shows: ["newCategory"],
    category_overlays: ["newCategory"],
    category_templates: ["newCategory"],
    category_media: ["newFolder"],
    category_audio: ["newFolder"],
    category_scripture: ["newScripture", "createCollection"],
    category_shows_button: ["rename", "changeIcon", "delete", "SEPARATOR", "category_action", "category_template", "SEPARATOR", "use_as_archive"],
    category_shows_button_readonly: [],
    category_overlays_button: ["rename", "changeIcon", "delete", "SEPARATOR", "use_as_archive"],
    category_templates_button: ["rename", "changeIcon", "delete", "SEPARATOR", "use_as_archive"],
    category_media_button: ["rename", "delete_remove", "SEPARATOR", "system_open"],
    category_audio_button: ["rename", "delete_remove", "SEPARATOR", "system_open"],
    category_scripture_button: ["rename", "delete", "SEPARATOR", "favourite"],
    playlist: ["rename", "delete"],
    // CONTENT
    drawer_show: ["newShowPopup", "SEPARATOR", "manage_show_tags", "tag_filter", "sort_shows_by"],
    // , "changeCategory" ? edit with rename & categories...
    // , "convertToOverlay"
    // , "SEPARATOR", "export"
    drawer_show_button: ["addToProject", "SEPARATOR", "edit", "lock_show", "SEPARATOR", "rename", "duplicate", "delete", "SEPARATOR", "tag_set", "tag_filter", "sort_shows_by", "SEPARATOR", "selectAll"],
    drawer_show_button_readonly: ["tag_filter", "sort_shows_by", "SEPARATOR", "selectAll"], // "addToProject", "SEPARATOR",
    drawer_new_show: ["newShow"],
    // media / audio
    // "play", "play_no_audio", "play_no_filters", "SEPARATOR", "edit",
    media_preview: ["create_show", "SEPARATOR", "close"],
    overlay_preview: ["close"],
    // , "delete_all"
    show_media: ["edit", "preview", "SEPARATOR", "play_no_filters", "SEPARATOR", "system_open"], // "play_no_audio"
    show_audio: ["preview", "SEPARATOR", "system_open"],
    slide_recorder_item: ["remove"],
    // , "addToShow"
    // show_in_explorer!!
    media: ["manage_media_tags", "media_tag_filter", "sort_media_by"],
    media_card: ["addToProject", "SEPARATOR", "edit", "preview", "SEPARATOR", "play_no_audio", "play_no_filters", "SEPARATOR", "favourite", "SEPARATOR", "media_tag_set", "media_tag_filter", "sort_media_by", "SEPARATOR", "system_open"],
    // "addToFirstSlide",
    overlay_card: ["edit", "preview", "SEPARATOR", "display_duration", "SEPARATOR", "lock_to_output", "place_under_slide", "SEPARATOR", "rename", "recolor", "duplicate", "delete"],
    overlay_card_default: ["edit", "preview", "SEPARATOR", "duplicate", "delete"],
    overlay_card_readonly: ["preview"],
    // "addToShow",
    template_card: ["edit", "SEPARATOR", "template_actions", "SEPARATOR", "rename", "recolor", "duplicate", "delete", "SEPARATOR", "export"],
    template_card_default: ["edit", "SEPARATOR", "duplicate", "delete"],
    template_card_readonly: [],
    effect_card: ["edit", "SEPARATOR", "display_duration", "SEPARATOR", "place_under_slide", "SEPARATOR", "rename", "recolor", "duplicate", "delete"],
    effect_card_default: ["edit", "SEPARATOR", "duplicate", "delete"],
    player_button: ["addToProject", "SEPARATOR", "edit", "preview", "SEPARATOR", "rename", "delete"],
    audio_button: ["addToProject", "SEPARATOR", "edit", "preview", "SEPARATOR", "effects_library_add", "favourite", "SEPARATOR", "system_open"],
    audio_effect_button: ["rename", "remove", "SEPARATOR", "system_open"],
    audio_button_playlist: ["edit", "preview", "SEPARATOR", "remove"],
    // "addToFirstSlide"
    screen_card: ["recording"],
    camera_card: ["edit", "SEPARATOR", "startup_activate", "SEPARATOR", "recording"],
    // actions
    actions: ["manage_action_tags", "action_tag_filter"],
    actions_readonly: ["action_tag_filter"],
    action: ["edit", "SEPARATOR", "disable", "SEPARATOR", "duplicate", "delete", "SEPARATOR", "action_tag_set", "action_tag_filter"],
    action_readonly: ["action_tag_filter"],
    scripture_verse: ["create_show", "SEPARATOR", "selectAll"],
    scripture_chapter: ["create_show"],

    // PROJECT
    projects: ["newProject", "newFolder", "SEPARATOR", "sort_projects_by"],
    projectsTab: ["import"],
    projectTab: ["export", "SEPARATOR", "close"],
    project: ["newShowPopup", "section"], // "newShow"(empty) , "newPrivateShow"
    project_button: ["rename", "duplicate", "delete", "SEPARATOR", "export", "copy_to_template", "archive", "SEPARATOR", "sort_projects_by"], // "open",
    project_button_readonly: ["export", "SEPARATOR", "sort_projects_by"],
    project_template: ["rename", "delete"],
    folder: ["rename", "duplicate", "delete"],
    folder_readonly: ["sort_projects_by"],
    project_media: ["play", "play_no_audio", "play_no_filters", "SEPARATOR", "remove"],
    project_audio: ["remove"],
    project_player: ["remove"],
    // "delete" removed as too many users thought it just removed the show from the project
    // "duplicate" removed as it was people did not get that it only duplicated the reference in project, and not the entire show (keyboard / menu bar shortcuts can be used)
    project_show: ["remove", "SEPARATOR", "private", "SEPARATOR", "rename"],
    pco_item: ["unlink_pco"],
    project_section: ["recolor", "SEPARATOR", "remove"],
    project_overlay: ["remove"],
    project_pdf: ["remove"], // "rename",
    project_ppt: ["remove"], // "rename",
    project_screen: ["remove"],
    project_ndi: ["remove"],
    project_camera: ["remove"],
    project_folder: ["remove"], // "rename",
    shows: ["newSlide", "selectAll"],
    // TIMER
    // timer: ["edit", "SEPARATOR", "play"], // , "reset"
    global_timer: ["edit", "SEPARATOR", "play", "SEPARATOR", "duplicate", "delete"], // , "reset"
    global_timer_readonly: ["play"], // , "reset"
    // VARIABLE
    variables: ["manage_variable_tags", "variable_tag_filter"],
    variables_readonly: ["variable_tag_filter"],
    variable: ["edit", "SEPARATOR", "duplicate", "delete", "SEPARATOR", "variable_tag_set", "variable_tag_filter"],
    variable_readonly: ["variable_tag_filter"],
    // TRIGGER
    trigger: ["edit", "SEPARATOR", "delete"],
    // AUDIO STREAM
    audio_stream: ["edit", "SEPARATOR", "delete"],

    // SHOWS
    // , "copy", "paste"
    slide: ["edit", "SEPARATOR", "slideGroups", "actions", "bind_to", "format", "remove_layers", "slide_transition", "disable", "SEPARATOR", "duplicate", "delete_slide", "remove_slide"],
    slideChild: ["edit", "SEPARATOR", "slideGroups", "actions", "bind_to", "format", "remove_layers", "slide_transition", "disable", "SEPARATOR", "duplicate", "delete_slide", "remove_slide"],
    slideFocus: ["editSlideText"],
    group: ["rename", "recolor", "SEPARATOR", "selectAll", "SEPARATOR", "duplicate", "delete_group"],
    global_group: ["manage_groups"],
    metadata_tools: ["manage_metadata"],
    // global_group: ["rename"],
    layout: ["rename", "duplicate", "remove"],
    slideViews: ["view_grid", "view_list", "view_lyrics", "SEPARATOR", "view_simple", "view_groups"],
    tag: ["rename", "recolor", "SEPARATOR", "delete"],
    chord: ["set_key", "chord_list", "custom_key", "SEPARATOR", "delete"],
    meta_message: ["dynamic_values"],
    edit_custom_action: ["edit"],

    // MEDIA
    video_subtitle: ["rename", "delete"],
    video_subtitle_embedded: ["rename"],
    video_marker: ["rename", "delete"],

    // SCRIPTURE
    bible_book_local: ["rename"],

    // STAGE
    stage_slide: ["move_connections", "rename", "disable", "SEPARATOR", "duplicate", "delete"],
    stage_slide_readonly: ["move_connections"],
    stage_item: ["conditions", "SEPARATOR", "rearrange_stage", "SEPARATOR", "duplicate", "delete"],
    stage_item_output: ["rearrange_stage", "SEPARATOR", "delete"],
    stage_text_item: ["dynamic_values", "conditions", "SEPARATOR", "rearrange_stage", "SEPARATOR", "duplicate", "delete"],
    items_list_item_stage: ["to_front_stage", "forward_stage", "backward_stage", "to_back_stage"],

    // EDIT
    edit_box: ["dynamic_values", "conditions", "item_actions", "item_bind_to", "format", "rearrange", "transition", "SEPARATOR", "duplicate", "delete"], // "copy", "paste" (shortcut or top menubar)
    items_list_item: ["to_front", "forward", "backward", "to_back"],

    // CALENDAR
    event: ["edit", "duplicate", "delete", "delete_all"],

    // SETTINGS
    theme: ["rename", "duplicate", "delete", "SEPARATOR", "export", "SEPARATOR", "reset_theme"],
    style: ["rename", "duplicate", "delete", "SEPARATOR", "reset"],
    profile_tab: ["rename", "recolor", "duplicate", "delete", "SEPARATOR", "reset"],
    output_screen: ["rename", "recolor", "duplicate", "delete"], // , "SEPARATOR", "reset"
    output_screen_stage: ["rename", "recolor", "duplicate", "delete"] // , "SEPARATOR", "reset"
}
