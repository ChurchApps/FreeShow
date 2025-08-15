export interface ContextMenuItem {
    id?: string
    color?: string
    label: string
    translate?: boolean
    items?: string[]
    icon?: string
    shortcuts?: string[]
    enabled?: boolean
    disabled?: boolean
    external?: boolean

    type?: string // remove layers
}

export const contextMenuItems: { [key: string]: ContextMenuItem } = {
    // MENU
    save: { label: "actions.save", icon: "save", shortcuts: ["Ctrl+S"] },
    import_more: { label: "actions.import", icon: "import", shortcuts: ["Ctrl+I"] },
    export_more: { label: "actions.export", icon: "export", shortcuts: ["Ctrl+E"] },
    undo: { label: "actions.undo", icon: "undo", shortcuts: ["Ctrl+Z"] },
    redo: { label: "actions.redo", icon: "redo", shortcuts: ["Ctrl+Y"] },
    history: { label: "popup.history", icon: "history", shortcuts: ["Ctrl+H"] },
    cut: { label: "actions.cut", icon: "cut", shortcuts: ["Ctrl+X"] },
    copy: { label: "actions.copy", icon: "copy", shortcuts: ["Ctrl+C"] },
    paste: { label: "actions.paste", icon: "paste", shortcuts: ["Ctrl+V"] },
    docs: { label: "main.docs", icon: "document", external: true },
    quick_search: { label: "main.quick_search", icon: "search", shortcuts: ["Ctrl+G"] },
    quick_start_guide: { label: "guide.start", icon: "guide" },
    focus_mode: { label: "actions.focus_mode", icon: "focus_mode", shortcuts: ["Ctrl+Shift+F"] },
    fullscreen: { label: "actions.fullscreen", icon: "fullscreen", shortcuts: ["F11"] },
    resetZoom: { label: "actions.resetZoom", icon: "reset" },
    zoomIn: { label: "actions.zoomIn", icon: "zoomIn" },
    zoomOut: { label: "actions.zoomOut", icon: "zoomOut" },
    // MAIN
    quit: { label: "main.quit", icon: "close" },
    settings: { label: "menu.settings", icon: "settings" },
    about: { label: "main.about", icon: "info" },
    shortcuts: { label: "popup.shortcuts", icon: "shortcut", shortcuts: ["Ctrl+?"] },
    rename: { label: "actions.rename", icon: "rename", shortcuts: ["F2"] },
    delete: { label: "actions.delete", icon: "delete", shortcuts: ["Del"] },
    delete_remove: { label: "actions.remove", icon: "remove", shortcuts: ["Del"] },
    delete_all: { label: "actions.delete_all", icon: "delete" },
    import: { label: "actions.import", icon: "import" },
    export: { label: "actions.export", icon: "export" },
    custom_text: { label: "popup.custom_text", icon: "rename" },
    // DRAWER
    enabledTabs: { label: "context.enabledTabs", items: ["LOAD_enabled_drawer_tabs"] },
    manage_show_tags: { label: "popup.manage_tags", icon: "edit" },
    tag_set: { label: "context.setTag", icon: "tag", items: ["LOAD_tag_set"] },
    tag_filter: { label: "context.filterByTags", icon: "tag", items: ["LOAD_tag_filter"] },
    manage_media_tags: { label: "popup.manage_tags", icon: "edit" },
    media_tag_set: { label: "context.setTag", icon: "tag", items: ["LOAD_media_tag_set"] },
    media_tag_filter: { label: "context.filterByTags", icon: "tag", items: ["LOAD_media_tag_filter"] },
    manage_action_tags: { label: "popup.manage_tags", icon: "edit" },
    action_tag_set: { label: "context.setTag", icon: "tag", items: ["LOAD_action_tag_set"] },
    action_tag_filter: { label: "context.filterByTags", icon: "tag", items: ["LOAD_action_tag_filter"] },
    manage_variable_tags: { label: "popup.manage_tags", icon: "edit" },
    variable_tag_set: { label: "context.setTag", icon: "tag", items: ["LOAD_variable_tag_set"] },
    variable_tag_filter: { label: "context.filterByTags", icon: "tag", items: ["LOAD_variable_tag_filter"] },
    newCategory: { label: "context.newCategory", icon: "add" },
    newScripture: { label: "new.scripture", icon: "add" },
    createCollection: { label: "new.collection", icon: "collection" },
    changeIcon: { label: "context.changeIcon", icon: "star" },
    category_action: { label: "popup.category_action", icon: "actions" },
    use_as_archive: { label: "context.use_as_archive", icon: "archive" },
    archive: { label: "actions.archive", icon: "archive" },
    toggle_clock: { label: "context.toggle_clock", icon: "clock" },
    // OUTPUTS
    force_output: { label: "context.force_outputs", icon: "outputs" },
    align_with_screen: { label: "context.align_with_screen", icon: "resize" },
    choose_screen: { label: "popup.choose_screen", icon: "screen" },
    toggle_output: { label: "context.toggle_output", icon: "outputs" },
    move_to_front: { label: "context.move_to_front", icon: "toFront" },
    hide_from_preview: { label: "context.hide_from_preview", icon: "hide" },
    // PROJECT
    close: { label: "actions.close", icon: "close" },
    newProject: { label: "new.project", icon: "add" },
    newFolder: { label: "new.folder", icon: "folder" },
    newShowPopup: { label: "new.show", icon: "add" },
    newShow: { label: "new.empty_show", icon: "add" },
    create_show: { label: "new.show_convert", icon: "slide" },
    // newPrivateShow: { label: "new.private", icon: "private" },
    private: { label: "actions.toggle_private", icon: "private" },
    unlink_pco: { label: "actions.unlink_pco", icon: "bind" },
    duplicate: { label: "actions.duplicate", icon: "duplicate", shortcuts: ["Ctrl+D"] },
    section: { label: "new.section", icon: "section" },
    copy_to_template: { label: "actions.create_template", icon: "templates" },
    // SORT
    sort_shows_by: { label: "sort.sort_by", icon: "sort", items: ["LOAD_sort_shows"] },
    sort_projects_by: { label: "sort.sort_by", icon: "sort", items: ["LOAD_sort_projects"] },
    sort_media_by: { label: "sort.sort_by", icon: "sort", items: ["LOAD_sort_media"] },
    // SHOWS
    addToProject: { label: "context.addToProject", icon: "project" },
    lock_show: { label: "context.lockForChanges", icon: "lock" },
    remove: { label: "actions.remove", icon: "remove" },
    remove_group: { label: "actions.remove", icon: "remove" },
    remove_slide: { label: "actions.remove_group", icon: "remove", shortcuts: ["Del"] },
    delete_slide: { label: "actions.delete_slide", icon: "delete" },
    delete_group: { label: "actions.delete_group", icon: "delete", shortcuts: ["Del"] },
    manage_groups: { label: "popup.manage_groups", icon: "edit" },
    manage_metadata: { label: "popup.manage_metadata", icon: "edit" },
    slideGroups: { label: "context.changeGroup", icon: "groups", items: ["rename", "recolor", "SEPERATOR", "LOAD_slide_groups"] }, // "remove_group" (currently broken & probably not needed) | , "SEPERATOR", "manage_groups"
    editSlideText: { label: "menu.edit", icon: "edit" }, // actions.edit_slide_text
    selectAll: { label: "context.selectAll", icon: "select", shortcuts: ["Ctrl+A"] },
    newSlide: { label: "new.slide", icon: "add" },
    // newGroup: { label: "context.createNew", icon: "add" },
    // SLIDE VIEWS
    view_grid: { label: "show.grid", icon: "grid" },
    view_simple: { label: "show.simple", icon: "simple" },
    view_groups: { label: "show.groups", icon: "groups" },
    view_list: { label: "show.list", icon: "list" },
    view_lyrics: { label: "show.lyrics", icon: "lyrics" },
    // SLIDE
    slide_transition: { label: "popup.transition", icon: "transition" },
    disable: { label: "actions.disable", icon: "disable" },
    edit: { label: "menu.edit", icon: "edit" },
    recolor: { label: "actions.recolor", icon: "color" },
    actions: { label: "actions.slide_actions", icon: "actions", items: ["LOAD_actions"] },
    bind_to: { label: "actions.bind_to", icon: "bind", items: ["LOAD_bind_slide"] },
    remove_layers: { label: "actions.remove_layers", icon: "remove_layers", items: ["LOAD_remove_layers"] },
    set_key: { label: "actions.set_key", icon: "chords", items: ["LOAD_keys"] },
    chord_list: { label: "edit.chords", icon: "chords", items: ["LOAD_chord_list"] },
    custom_key: { label: "actions.custom_key", icon: "edit" },
    // ITEM
    item_actions: { label: "actions.item_actions", icon: "actions", items: ["LOAD_item_actions"] },
    transition: { label: "popup.transition", icon: "transition" },
    dynamic_values: { label: "actions.dynamic_values", icon: "dynamic" },
    conditions: { label: "actions.conditions", icon: "light" },
    item_bind_to: { label: "actions.bind_to", icon: "bind", items: ["LOAD_bind_item"] },
    format: { label: "actions.format", icon: "format", items: ["find_replace", "SEPERATOR", "cut_in_half", "merge", "SEPERATOR", "uppercase", "lowercase", "capitalize", "trim"] },
    rearrange: { label: "actions.rearrange", icon: "rearrange", items: ["to_front", "forward", "backward", "to_back"] },
    rearrange_stage: { label: "actions.rearrange", icon: "rearrange", items: ["to_front_stage", "forward_stage", "backward_stage", "to_back_stage"] },
    // stage
    stage: { label: "menu.stage", id: "stage" },
    // formatting
    find_replace: { label: "actions.find_replace", icon: "find_replace" },
    cut_in_half: { label: "actions.cut_in_half", icon: "cut_in_half" },
    merge: { label: "actions.merge", icon: "merge" },
    uppercase: { label: "actions.uppercase", icon: "increase_text" },
    lowercase: { label: "actions.lowercase", icon: "decrease_text" },
    capitalize: { label: "actions.capitalize", icon: "capitalize" },
    trim: { label: "actions.trim", icon: "cut" },
    // rearrange
    to_front: { label: "actions.to_front", icon: "to_front" },
    forward: { label: "actions.forward", icon: "up" },
    backward: { label: "actions.backward", icon: "down" },
    to_back: { label: "actions.to_back", icon: "to_back" },
    to_front_stage: { label: "actions.to_front", icon: "to_front" },
    forward_stage: { label: "actions.forward", icon: "up" },
    backward_stage: { label: "actions.backward", icon: "down" },
    to_back_stage: { label: "actions.to_back", icon: "to_back" },
    // MEDIA
    preview: { label: "preview.show_preview", icon: "eye" },
    play: { label: "media.play", icon: "play" },
    play_no_audio: { label: "media.play_no_audio", icon: "play" },
    play_no_filters: { label: "media.play_no_filters", icon: "play" },
    favourite: { label: "media.favourite", icon: "star" },
    effects_library_add: { label: "media.effects_library_add", icon: "effect" },
    system_open: { label: "main.system_open", icon: "launch" },
    // LIVE
    recording: { label: "actions.start_recording", icon: "record" },
    // OVERLAYS
    lock_to_output: { label: "context.lock_to_output", icon: "locked" },
    place_under_slide: { label: "context.place_under_slide", icon: "under" },
    display_duration: { label: "popup.display_duration", icon: "clock" },
    // TEMPLATES
    template_actions: { label: "tabs.actions", icon: "actions" },
    // STAGE
    move_connections: { label: "context.move_connections", icon: "up" },
    // SETTINGS
    reset_theme: { label: "settings.reset_theme", icon: "reset" },
    reset: { label: "actions.reset", icon: "reset" }
}

export const contextMenuLayouts: { [key: string]: string[] } = {
    // MENU
    file: ["save", "import_more", "export_more", "SEPERATOR", "quit"],
    edit: ["undo", "redo", "history", "SEPERATOR", "cut", "copy", "paste", "delete", "SEPERATOR", "selectAll"], // , "cut"
    view: ["focus_mode", "fullscreen"], // , "resetZoom", "zoomIn", "zoomOut"
    help: ["quick_search", "shortcuts", "docs", "quick_start_guide", "about"],
    // MAIN
    default: ["save", "settings", "history", "SEPERATOR", "about", "quit"],
    splash: ["custom_text"],
    rename: ["rename"],
    close: ["close"],
    output_window: ["close"],
    input: ["copy", "paste"],

    // TOP
    output: ["force_output", "SEPERATOR", "align_with_screen", "choose_screen"], // , "SEPERATOR", "edit"

    // OUTPUTS
    output_preview: ["edit", "SEPERATOR", "toggle_output"],
    output_active_button: ["edit", "SEPERATOR", "toggle_output", "move_to_front", "SEPERATOR", "hide_from_preview"],

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
    category_shows_button: ["rename", "changeIcon", "delete", "SEPERATOR", "category_action", "use_as_archive"],
    category_shows_button_readonly: [],
    category_overlays_button: ["rename", "changeIcon", "delete", "SEPERATOR", "use_as_archive"],
    category_templates_button: ["rename", "changeIcon", "delete", "SEPERATOR", "use_as_archive"],
    category_media_button: ["rename", "delete_remove", "SEPERATOR", "system_open"],
    category_audio_button: ["rename", "delete_remove", "SEPERATOR", "system_open"],
    category_scripture_button: ["createCollection", "SEPERATOR", "rename", "delete"],
    playlist: ["rename", "delete"],
    // CONTENT
    drawer_show: ["newShowPopup", "SEPERATOR", "manage_show_tags", "tag_filter", "sort_shows_by"],
    // , "changeCategory" ? edit with rename & categories...
    // , "convertToOverlay"
    // , "SEPERATOR", "export"
    drawer_show_button: ["addToProject", "SEPERATOR", "edit", "lock_show", "SEPERATOR", "rename", "duplicate", "delete", "SEPERATOR", "tag_set", "tag_filter", "sort_shows_by", "SEPERATOR", "selectAll"],
    drawer_show_button_readonly: ["tag_filter", "sort_shows_by", "SEPERATOR", "selectAll"], // "addToProject", "SEPERATOR",
    drawer_new_show: ["newShow"],
    // media / audio
    // "play", "play_no_audio", "play_no_filters", "SEPERATOR", "edit",
    media_preview: ["close"],
    overlay_preview: ["close"],
    // , "delete_all"
    show_media: ["edit", "preview", "SEPERATOR", "play_no_filters", "SEPERATOR", "system_open"], // "play_no_audio"
    show_audio: ["preview", "SEPERATOR", "system_open"],
    slide_recorder_item: ["remove"],
    // , "addToShow"
    // show_in_explorer!!
    media: ["manage_media_tags", "media_tag_filter", "sort_media_by"],
    media_card: ["addToProject", "SEPERATOR", "edit", "preview", "SEPERATOR", "play_no_audio", "play_no_filters", "SEPERATOR", "favourite", "SEPERATOR", "media_tag_set", "media_tag_filter", "sort_media_by", "SEPERATOR", "system_open"],
    // "addToFirstSlide",
    overlay_card: ["edit", "preview", "SEPERATOR", "display_duration", "SEPERATOR", "lock_to_output", "place_under_slide", "SEPERATOR", "rename", "recolor", "duplicate", "delete"],
    overlay_card_default: ["preview", "SEPERATOR", "duplicate", "delete"],
    overlay_card_readonly: ["preview"],
    // "addToShow",
    template_card: ["edit", "SEPERATOR", "template_actions", "SEPERATOR", "rename", "recolor", "duplicate", "delete", "SEPERATOR", "export"],
    template_card_default: ["duplicate", "delete"],
    template_card_readonly: [],
    effect_card: ["edit", "SEPERATOR", "display_duration", "SEPERATOR", "place_under_slide", "SEPERATOR", "rename", "recolor", "duplicate", "delete"],
    effect_card_default: ["duplicate", "delete"],
    player_button: ["addToProject", "SEPERATOR", "edit", "preview", "SEPERATOR", "rename", "delete"],
    audio_button: ["addToProject", "SEPERATOR", "edit", "preview", "SEPERATOR", "effects_library_add", "favourite", "SEPERATOR", "system_open"],
    audio_effect_button: ["rename", "remove", "SEPERATOR", "system_open"],
    audio_button_playlist: ["edit", "preview", "SEPERATOR", "remove"],
    // "addToFirstSlide"
    screen_card: ["recording"],
    camera_card: ["edit", "SEPERATOR", "recording"],
    // actions
    actions: ["manage_action_tags", "action_tag_filter"],
    actions_readonly: ["action_tag_filter"],
    action: ["edit", "SEPERATOR", "disable", "SEPERATOR", "duplicate", "delete", "SEPERATOR", "action_tag_set", "action_tag_filter"],
    action_readonly: ["action_tag_filter"],
    scripture_verse: ["create_show", "SEPERATOR", "selectAll"],
    scripture_chapter: ["create_show"],

    // PROJECT
    projects: ["newProject", "newFolder", "SEPERATOR", "sort_projects_by"],
    projectsTab: ["import"],
    projectTab: ["export", "SEPERATOR", "close"],
    project: ["newShowPopup", "section"], // "newShow"(empty) , "newPrivateShow"
    project_button: ["rename", "duplicate", "delete", "SEPERATOR", "export", "copy_to_template", "archive", "SEPERATOR", "sort_projects_by"], // "open",
    project_button_readonly: ["export", "SEPERATOR", "sort_projects_by"],
    project_template: ["rename", "delete"],
    folder: ["rename", "duplicate", "delete"],
    folder_readonly: ["sort_projects_by"],
    project_media: ["play", "play_no_audio", "play_no_filters", "SEPERATOR", "remove"],
    project_audio: ["remove"],
    project_player: ["remove"],
    // "delete" removed as too many users thought it just removed the show from the project
    // "duplicate" removed as it was people did not get that it only duplicated the reference in project, and not the entire show (keyboard / menu bar shortcuts can be used)
    project_show: ["remove", "SEPERATOR", "private", "SEPERATOR", "rename"],
    pco_item: ["unlink_pco"],
    project_section: ["recolor", "SEPERATOR", "remove"],
    project_overlay: ["remove"],
    project_pdf: ["remove"], // "rename",
    project_ppt: ["remove"], // "rename",
    project_screen: ["remove"],
    project_ndi: ["remove"],
    project_camera: ["remove"],
    project_folder: ["remove"], // "rename",
    shows: ["newSlide", "selectAll"],
    // TIMER
    // timer: ["edit", "SEPERATOR", "play"], // , "reset"
    global_timer: ["edit", "SEPERATOR", "play", "SEPERATOR", "duplicate", "delete"], // , "reset"
    global_timer_readonly: ["play"], // , "reset"
    // VARIABLE
    variables: ["manage_variable_tags", "variable_tag_filter"],
    variables_readonly: ["variable_tag_filter"],
    variable: ["edit", "SEPERATOR", "duplicate", "delete", "SEPERATOR", "variable_tag_set", "variable_tag_filter"],
    variable_readonly: ["variable_tag_filter"],
    // TRIGGER
    trigger: ["edit", "SEPERATOR", "delete"],
    // AUDIO STREAM
    audio_stream: ["edit", "SEPERATOR", "delete"],

    // SHOWS
    // , "copy", "paste"
    slide: ["edit", "SEPERATOR", "slideGroups", "actions", "bind_to", "format", "remove_layers", "slide_transition", "disable", "SEPERATOR", "duplicate", "delete_slide", "remove_slide"],
    slideChild: ["edit", "SEPERATOR", "slideGroups", "actions", "bind_to", "format", "remove_layers", "slide_transition", "disable", "SEPERATOR", "duplicate", "delete_slide", "remove_slide"],
    slideFocus: ["editSlideText"],
    group: ["rename", "recolor", "SEPERATOR", "selectAll", "SEPERATOR", "duplicate", "delete_group"],
    global_group: ["manage_groups"],
    metadata_tools: ["manage_metadata"],
    // global_group: ["rename"],
    layout: ["rename", "duplicate", "remove"],
    slideViews: ["view_grid", "view_list", "view_lyrics", "SEPERATOR", "view_simple", "view_groups"],
    tag: ["rename", "recolor", "SEPERATOR", "delete"],
    chord: ["set_key", "chord_list", "custom_key", "SEPERATOR", "delete"],
    meta_message: ["dynamic_values"],
    edit_custom_action: ["edit"],

    // MEDIA
    video_subtitle: ["rename", "delete"],
    video_subtitle_embedded: ["rename"],
    video_marker: ["rename", "delete"],

    // SCRIPTURE
    bible_book_local: ["rename"],

    // STAGE
    stage_slide: ["move_connections", "rename", "disable", "SEPERATOR", "duplicate", "delete"],
    stage_slide_readonly: ["move_connections"],
    stage_item: ["conditions", "SEPERATOR", "rearrange_stage", "SEPERATOR", "duplicate", "delete"],
    stage_item_output: ["rearrange_stage", "SEPERATOR", "delete"],
    stage_text_item: ["dynamic_values", "conditions", "SEPERATOR", "rearrange_stage", "SEPERATOR", "duplicate", "delete"],
    items_list_item_stage: ["to_front_stage", "forward_stage", "backward_stage", "to_back_stage"],

    // EDIT
    edit_box: ["dynamic_values", "conditions", "item_actions", "item_bind_to", "format", "rearrange", "transition", "SEPERATOR", "duplicate", "delete"], // "copy", "paste" (shortcut or top menubar)
    items_list_item: ["to_front", "forward", "backward", "to_back"],

    // CALENDAR
    event: ["edit", "duplicate", "delete", "delete_all"],

    // SETTINGS
    theme: ["rename", "duplicate", "delete", "SEPERATOR", "export", "SEPERATOR", "reset_theme"],
    style: ["rename", "duplicate", "delete", "SEPERATOR", "reset"],
    profile_tab: ["rename", "recolor", "duplicate", "delete", "SEPERATOR", "reset"],
    output_screen: ["rename", "recolor", "duplicate", "delete"], // , "SEPERATOR", "reset"
    output_screen_stage: ["rename", "recolor", "duplicate", "delete"] // , "SEPERATOR", "reset"
}
