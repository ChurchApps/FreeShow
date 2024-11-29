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
}

export const contextMenuItems: { [key: string]: ContextMenuItem } = {
    // MENU
    save: { label: "actions.save", icon: "save", shortcuts: ["Ctrl+S"] },
    import: { label: "actions.import", icon: "import", shortcuts: ["Ctrl+I"] },
    export_more: { label: "actions.export", icon: "export", shortcuts: ["Ctrl+E"] },
    undo: { label: "actions.undo", icon: "undo", shortcuts: ["Ctrl+Z"] },
    redo: { label: "actions.redo", icon: "redo", shortcuts: ["Ctrl+Y"] },
    history: { label: "popup.history", icon: "history", shortcuts: ["Ctrl+H"] },
    cut: { label: "actions.cut", icon: "cut", shortcuts: ["Ctrl+X"] },
    copy: { label: "actions.copy", icon: "copy", shortcuts: ["Ctrl+C"] },
    paste: { label: "actions.paste", icon: "paste", shortcuts: ["Ctrl+V"] },
    docs: { label: "main.docs", icon: "document", external: true },
    quick_start_guide: { label: "guide.start", icon: "guide" },
    focus_mode: { label: "actions.focus_mode", icon: "focus_mode" },
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
    delete_all: { label: "actions.delete_all", icon: "delete" },
    export: { label: "actions.export", icon: "export" },
    // DRAWER
    enabledTabs: { label: "context.enabledTabs", items: ["LOAD_enabled_drawer_tabs"] },
    tag_set: { label: "context.setTag", icon: "tag", items: ["LOAD_tag_set"] },
    tag_filter: { label: "context.filterByTags", icon: "tag", items: ["LOAD_tag_filter"] },
    newCategory: { label: "context.newCategory", icon: "add" },
    newScripture: { label: "new.scripture", icon: "add" },
    createCollection: { label: "new.collection", icon: "collection" },
    changeIcon: { label: "context.changeIcon", icon: "star" },
    category_action: { label: "popup.category_action", icon: "actions" },
    use_as_archive: { label: "context.use_as_archive", icon: "archive" },
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
    newProject: { label: "new.project", icon: "project" },
    newFolder: { label: "new.folder", icon: "folder" },
    newShowPopup: { label: "new.show", icon: "add" },
    newShow: { label: "new.empty_show", icon: "add" },
    create_show: { label: "new.show", icon: "slide" },
    // newPrivateShow: { label: "new.private", icon: "private" },
    private: { label: "actions.toggle_private", icon: "private" },
    duplicate: { label: "actions.duplicate", icon: "duplicate", shortcuts: ["Ctrl+D"] },
    section: { label: "new.section", icon: "section" },
    copy_to_template: { label: "actions.create_template", icon: "templates" },
    // SORT
    sort_shows_by: { label: "sort.sort_by", icon: "sort", items: ["LOAD_sort_shows"] },
    sort_projects_by: { label: "sort.sort_by", icon: "sort", items: ["LOAD_sort_projects"] },
    // SHOWS
    addToProject: { label: "context.addToProject", icon: "project" },
    lock_show: { label: "context.lockForChanges", icon: "lock" },
    remove: { label: "actions.remove", icon: "remove" },
    remove_group: { label: "actions.remove", icon: "remove" },
    remove_slide: { label: "actions.remove_group", icon: "remove", shortcuts: ["Del"] },
    delete_slide: { label: "actions.delete_slide", icon: "delete" },
    delete_group: { label: "actions.delete_group", icon: "delete", shortcuts: ["Del"] },
    slideGroups: { label: "context.changeGroup", icon: "groups", items: ["rename", "recolor", "SEPERATOR", "LOAD_slide_groups"] }, // "remove_group" (currently broken & probably not needed)
    editSlideText: { label: "menu.edit", icon: "edit" }, // actions.edit_slide_text
    selectAll: { label: "context.selectAll", icon: "select", shortcuts: ["Ctrl+A"] },
    newSlide: { label: "new.slide", icon: "add" },
    // newGroup: { label: "context.createNew", icon: "add" },
    // SLIDE VIEWS
    view_grid: { label: "show.grid", icon: "grid" },
    view_simple: { label: "show.simple", icon: "simple" },
    view_list: { label: "show.list", icon: "list" },
    view_lyrics: { label: "show.lyrics", icon: "lyrics" },
    view_text: { label: "show.text", icon: "text" },
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
    dynamic_values: { label: "actions.dynamic_values", icon: "star", items: ["LOAD_dynamic_values"] },
    item_bind_to: { label: "actions.bind_to", icon: "bind", items: ["LOAD_bind_item"] },
    format: { label: "actions.format", icon: "format", items: ["find_replace", "cut_in_half", "merge", "SEPERATOR", "uppercase", "lowercase", "capitalize", "trim"] },
    rearrange: { label: "actions.rearrange", icon: "rearrange", items: ["to_front", "forward", "backward", "to_back"] },
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
    // MEDIA
    preview: { label: "preview.show_preview", icon: "eye" },
    play: { label: "media.play", icon: "play" },
    play_no_audio: { label: "media.play_no_audio", icon: "play" },
    play_no_filters: { label: "media.play_no_filters", icon: "play" },
    favourite: { label: "media.favourite", icon: "star" },
    system_open: { label: "main.system_open", icon: "launch" },
    // LIVE
    recording: { label: "actions.start_recording", icon: "record" },
    // OVERLAYS
    lock_to_output: { label: "context.lock_to_output", icon: "locked" },
    place_under_slide: { label: "context.place_under_slide", icon: "under" },
    // TEMPLATES
    template_actions: { label: "tabs.actions", icon: "actions" },
    // STAGE
    move_connections: { label: "context.move_connections", icon: "up" },
    // SETTINGS
    reset_theme: { label: "settings.reset_theme", icon: "reset" },
    reset: { label: "actions.reset", icon: "reset" },
}

export const contextMenuLayouts: { [key: string]: string[] } = {
    // MENU
    file: ["save", "import", "export_more", "SEPERATOR", "quit"],
    edit: ["undo", "redo", "history", "SEPERATOR", "cut", "copy", "paste", "delete", "SEPERATOR", "selectAll"], // , "cut"
    view: ["focus_mode", "fullscreen"], // , "resetZoom", "zoomIn", "zoomOut"
    help: ["shortcuts", "docs", "quick_start_guide", "about"],
    // MAIN
    default: ["save", "settings", "history", "SEPERATOR", "about", "quit"],
    rename: ["rename"],
    close: ["close"],
    output_window: ["close"],
    input: ["paste"],

    // TOP
    output: ["force_output", "SEPERATOR", "align_with_screen", "choose_screen"], // , "SEPERATOR", "edit"

    // OUTPUTS
    output_active_button: ["toggle_output", "move_to_front", "SEPERATOR", "hide_from_preview", "SEPERATOR", "edit"],

    // DRAWER
    drawer_top: ["enabledTabs"],
    drawer_info: ["toggle_clock"],
    // NAVIGATION
    category_shows: ["newCategory"],
    category_overlays: ["newCategory"],
    category_templates: ["newCategory"],
    category_media: ["newFolder"],
    category_audio: ["newFolder"],
    category_scripture: ["newScripture"],
    category_shows_button: ["rename", "changeIcon", "delete", "SEPERATOR", "category_action", "use_as_archive"],
    category_overlays_button: ["rename", "changeIcon", "delete", "SEPERATOR", "use_as_archive"],
    category_templates_button: ["rename", "changeIcon", "delete", "SEPERATOR", "use_as_archive"],
    category_media_button: ["rename", "delete", "SEPERATOR", "system_open"],
    category_audio_button: ["rename", "delete", "SEPERATOR", "system_open"],
    category_scripture_button: ["createCollection", "SEPERATOR", "rename", "delete"],
    playlist: ["rename", "delete"],
    // CONTENT
    drawer_show: ["newShowPopup", "newShow", "SEPERATOR", "tag_filter", "sort_shows_by"],
    // , "changeCategory" ? edit with rename & categories...
    // , "convertToOverlay"
    // , "SEPERATOR", "export"
    drawer_show_button: ["addToProject", "lock_show", "SEPERATOR", "rename", "duplicate", "delete", "tag_set", "SEPERATOR", "tag_filter", "sort_shows_by", "selectAll"],
    drawer_new_show: ["newShowPopup", "newShow"],
    // media / audio
    // "play", "play_no_audio", "play_no_filters", "SEPERATOR", "edit",
    media_preview: ["close"],
    overlay_preview: ["close"],
    // , "delete_all"
    show_media: ["edit", "preview", "SEPERATOR", "play_no_filters", "SEPERATOR", "system_open"], // "play_no_audio"
    show_audio: ["preview", "SEPERATOR", "system_open"],
    slide_recorder_item: ["remove"],
    midi: ["play", "SEPERATOR", "edit", "delete"],
    // , "addToShow"
    // show_in_explorer!!
    media_card: ["addToProject", "SEPERATOR", "edit", "preview", "favourite", "SEPERATOR", "play_no_audio", "play_no_filters", "SEPERATOR", "system_open"],
    // "addToFirstSlide",
    overlay_card: ["edit", "preview", "SEPERATOR", "lock_to_output", "place_under_slide", "SEPERATOR", "rename", "recolor", "duplicate", "delete"],
    // "addToShow",
    template_card: ["edit", "SEPERATOR", "template_actions", "SEPERATOR", "rename", "recolor", "duplicate", "delete", "SEPERATOR", "export"],
    effect_card: ["edit"],
    player_button: ["addToProject", "SEPERATOR", "preview", "SEPERATOR", "rename", "delete"],
    audio_button: ["addToProject", "SEPERATOR", "preview", "favourite", "SEPERATOR", "system_open"],
    audio_button_playlist: ["preview", "SEPERATOR", "remove"],
    // "addToFirstSlide"
    live_card: ["recording"],
    // actions
    action: ["duplicate"],
    scripture_verse: ["create_show", "SEPERATOR", "selectAll"],
    scripture_chapter: ["create_show"],

    // PROJECT
    projects: ["newProject", "newFolder", "sort_projects_by"],
    projectTab: ["export", "SEPERATOR", "close"],
    project: ["newShowPopup", "section"], // "newShow"(empty) , "newPrivateShow"
    project_button: ["rename", "duplicate", "delete", "SEPERATOR", "export", "copy_to_template"], // "open",
    project_template: ["rename", "delete"],
    folder: ["rename", "duplicate", "delete"],
    project_media: ["play", "play_no_audio", "play_no_filters", "remove"],
    project_audio: ["remove"],
    project_player: ["remove"],
    project_show: ["private", "duplicate", "remove", "SEPERATOR", "rename"], // "delete" removed as too many users thought it just removed the show from the project
    project_section: ["remove"],
    project_pdf: ["remove"], // "rename",
    project_ppt: ["remove"], // "rename",
    shows: ["newSlide", "selectAll"],
    // TIMER
    timer: ["play", "edit"], // , "reset"
    global_timer: ["play", "edit", "SEPERATOR", "delete"], // , "reset"
    // VARIABLE
    variable: ["edit", "SEPERATOR", "delete"],
    // TRIGGER
    trigger: ["edit", "SEPERATOR", "delete"],
    // AUDIO STREAM
    audio_stream: ["edit", "SEPERATOR", "delete"],

    // SHOWS
    // , "copy", "paste"
    slide: ["slideGroups", "actions", "bind_to", "format", "remove_layers", "slide_transition", "disable", "edit", "SEPERATOR", "duplicate", "delete_slide", "remove_slide"],
    slideChild: ["slideGroups", "actions", "bind_to", "format", "remove_layers", "slide_transition", "disable", "edit", "SEPERATOR", "duplicate", "delete_slide", "remove_slide"],
    slideFocus: ["editSlideText"],
    group: ["rename", "recolor", "SEPERATOR", "selectAll", "SEPERATOR", "duplicate", "delete_group"],
    global_group: ["edit"],
    // global_group: ["rename"],
    layout: ["rename", "duplicate", "remove"],
    slideViews: ["view_grid", "view_simple", "view_list", "view_lyrics", "view_text"],
    tag: ["rename", "recolor", "SEPERATOR", "delete"],
    chord: ["set_key", "chord_list", "custom_key", "SEPERATOR", "delete"],
    meta_message: ["dynamic_values"],

    // MEDIA
    video_marker: ["rename", "delete"],

    // STAGE
    stage_slide: ["move_connections", "rename", "disable", "SEPERATOR", "duplicate", "delete"],

    // EDIT
    edit_box: ["item_actions", "dynamic_values", "item_bind_to", "format", "rearrange", "transition", "SEPERATOR", "duplicate", "delete"], // "copy", "paste" (shortcut or top menubar)

    // CALENDAR
    event: ["edit", "duplicate", "delete", "delete_all"],

    // SETTINGS
    theme: ["rename", "duplicate", "delete", "SEPERATOR", "export", "SEPERATOR", "reset_theme"],
    style: ["rename", "duplicate", "delete", "SEPERATOR", "reset"],
    output_screen: ["rename", "recolor", "duplicate", "delete", "SEPERATOR", "reset"],
    output_screen_stage: ["rename", "recolor", "duplicate", "delete", "SEPERATOR", "reset"],
}
