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
}

// WIP get Cmd when on MacOS
const ctrl = "Ctrl" // get(os).platform === "darwin" ? "Cmd" :

export const contextMenuItems: { [key: string]: ContextMenuItem } = {
    // MENU
    save: { label: "actions.save", icon: "save", shortcuts: [ctrl + "+S"] },
    import: { label: "actions.import", icon: "import", shortcuts: [ctrl + "+I"] },
    export_more: { label: "actions.export", icon: "export", shortcuts: [ctrl + "+E"] },
    undo: { label: "actions.undo", icon: "undo", shortcuts: [ctrl + "+Z"] },
    redo: { label: "actions.redo", icon: "redo", shortcuts: [ctrl + "+Y"] },
    history: { label: "popup.history", icon: "history", shortcuts: [ctrl + "+H"] },
    cut: { label: "actions.cut", icon: "cut", shortcuts: [ctrl + "+X"] },
    copy: { label: "actions.copy", icon: "copy", shortcuts: [ctrl + "+C"] },
    paste: { label: "actions.paste", icon: "paste", shortcuts: [ctrl + "+V"] },
    docs: { label: "main.docs", icon: "document" },
    fullscreen: { label: "actions.fullscreen", icon: "fullscreen", shortcuts: ["F11"] },
    resetZoom: { label: "actions.resetZoom", icon: "reset" },
    zoomIn: { label: "actions.zoomIn", icon: "zoomIn" },
    zoomOut: { label: "actions.zoomOut", icon: "zoomOut" },
    // MAIN
    quit: { label: "main.quit", icon: "close" },
    settings: { label: "menu.settings", icon: "settings" },
    about: { label: "main.about", icon: "info" },
    shortcuts: { label: "popup.shortcuts", icon: "shortcut", shortcuts: [ctrl + "+?"] },
    rename: { label: "actions.rename", icon: "rename", shortcuts: ["F2"] },
    delete: { label: "actions.delete", icon: "delete", shortcuts: ["Del"] },
    delete_all: { label: "actions.delete_all", icon: "delete" },
    export: { label: "actions.export", icon: "export" },
    // DRAWER
    enabledTabs: { label: "context.enabledTabs", items: ["LOAD_enabled_drawer_tabs"] },
    newCategory: { label: "context.newCategory", icon: "add" },
    newScripture: { label: "new.scripture", icon: "add" },
    createCollection: { label: "new.collection", icon: "collection" },
    changeIcon: { label: "context.changeIcon", icon: "noIcon" },
    toggle_clock: { label: "context.toggle_clock", icon: "clock" },
    // OUTPUTS
    force_output: { label: "context.force_outputs", icon: "outputs" },
    choose_screen: { label: "popup.choose_screen", icon: "screen" },
    toggle_output: { label: "context.toggle_output", icon: "outputs" },
    move_to_front: { label: "context.move_to_front", icon: "toFront" },
    // PROJECT
    close: { label: "actions.close", icon: "close" },
    newProject: { label: "new.project", icon: "project" },
    newFolder: { label: "new.folder", icon: "folder" },
    newShowPopup: { label: "new.show", icon: "add" },
    newShow: { label: "new.empty_show", icon: "add" },
    newPrivateShow: { label: "new.private", icon: "private" },
    private: { label: "actions.toggle_private", icon: "private" },
    duplicate: { label: "actions.duplicate", icon: "duplicate", shortcuts: [ctrl + "+D"] },
    section: { label: "new.section", icon: "section" },
    // SORT
    sort_shows_by: { label: "sort.sort_by", icon: "sort", items: ["LOAD_sort_shows"] },
    sort_projects_by: { label: "sort.sort_by", icon: "sort", items: ["LOAD_sort_projects"] },
    // SHOWS
    addToProject: { label: "context.addToProject", icon: "project" },
    remove: { label: "actions.remove", icon: "remove" },
    remove_group: { label: "actions.remove", icon: "remove" },
    remove_slide: { label: "actions.remove_group", icon: "remove", shortcuts: ["Del"] },
    delete_slide: { label: "actions.delete", icon: "delete" },
    slideGroups: { label: "context.changeGroup", icon: "groups", items: ["rename", "recolor", "remove_group", "SEPERATOR", "LOAD_slide_groups"] },
    selectAll: { label: "context.selectAll", icon: "select", shortcuts: [ctrl + "+A"] },
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
    actions: { label: "actions.actions", icon: "actions", items: ["LOAD_actions"] },
    item_actions: { label: "actions.actions", icon: "actions", items: ["LOAD_item_actions"] },
    remove_layers: { label: "actions.remove_layers", icon: "remove_layers", items: ["LOAD_remove_layers"] },
    set_key: { label: "actions.set_key", icon: "chords", items: ["LOAD_keys"] },
    chord_list: { label: "edit.chords", icon: "chords", items: ["LOAD_chord_list"] },
    custom_key: { label: "actions.custom_key", icon: "edit" },
    // ITEM
    bind_to: { label: "actions.bind_to", icon: "bind", items: ["LOAD_output_list"] },
    format: { label: "actions.format", icon: "format", items: ["find_replace", "cut_in_half", "SEPERATOR", "uppercase", "lowercase", "capitalize", "trim"] },
    // stage
    stage: { label: "menu.stage", id: "stage" },
    // formatting
    find_replace: { label: "actions.find_replace", icon: "find_replace" },
    cut_in_half: { label: "actions.cut_in_half", icon: "cut_in_half" },
    uppercase: { label: "actions.uppercase", icon: "increase_text" },
    lowercase: { label: "actions.lowercase", icon: "decrease_text" },
    capitalize: { label: "actions.capitalize", icon: "capitalize" },
    trim: { label: "actions.trim", icon: "cut" },
    // MEDIA
    preview: { label: "preview.show_preview", icon: "eye" },
    play: { label: "media.play", icon: "play" },
    play_no_filters: { label: "media.play_no_filters", icon: "play" },
    favourite: { label: "media.favourite", icon: "star" },
    system_open: { label: "main.system_open", icon: "launch" },
    // LIVE
    recording: { label: "actions.start_recording", icon: "record" },
    // OVERLAYS
    lock_to_output: { label: "context.lock_to_output", icon: "locked" },
    place_under_slide: { label: "context.place_under_slide", icon: "under" },
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
    view: ["fullscreen"], // , "resetZoom", "zoomIn", "zoomOut"
    help: ["shortcuts", "docs", "about"],
    // MAIN
    default: ["settings", "history", "about", "SEPERATOR", "quit"],
    rename: ["rename"],
    close: ["close"],
    output_window: ["close"],

    // TOP
    output: ["force_output", "choose_screen"],

    // OUTPUTS
    output_active_button: ["toggle_output", "move_to_front", "edit"],

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
    category_shows_button: ["rename", "changeIcon", "delete"],
    category_overlays_button: ["rename", "changeIcon", "delete"],
    category_templates_button: ["rename", "changeIcon", "delete"],
    category_media_button: ["rename", "delete", "SEPERATOR", "system_open"],
    category_audio_button: ["rename", "delete", "SEPERATOR", "system_open"],
    category_scripture_button: ["createCollection", "SEPERATOR", "rename", "delete"],
    // CONTENT
    drawer_show: ["newShowPopup", "newShow", "sort_shows_by", "selectAll"],
    // , "changeCategory" ? edit with rename & categories...
    // , "convertToOverlay"
    // , "SEPERATOR", "export"
    drawer_show_button: ["addToProject", "SEPERATOR", "rename", "duplicate", "delete"],
    drawer_new_show: ["newShowPopup", "newShow"],
    // media / audio
    // "play", "play_no_filters", "SEPERATOR", "edit",
    media_preview: ["close"],
    // , "delete_all"
    show_media: ["preview", "play_no_filters", "SEPERATOR", "edit", "SEPERATOR", "system_open"],
    show_audio: ["preview", "SEPERATOR", "system_open"],
    midi: ["play", "SEPERATOR", "edit", "delete"],
    // , "addToShow"
    // show_in_explorer!!
    media_card: ["addToProject", "SEPERATOR", "preview", "play_no_filters", "SEPERATOR", "edit", "favourite", "SEPERATOR", "system_open"],
    // "addToFirstSlide",
    overlay_card: ["edit", "lock_to_output", "place_under_slide", "SEPERATOR", "rename", "recolor", "duplicate", "delete"],
    // "addToShow",
    template_card: ["edit", "SEPERATOR", "rename", "recolor", "duplicate", "delete"],
    effect_card: ["edit"],
    player_button: ["addToProject", "SEPERATOR", "preview", "SEPERATOR", "rename", "delete"],
    audio_button: ["addToProject", "SEPERATOR", "preview", "favourite", "SEPERATOR", "system_open"],
    // "addToFirstSlide"
    live_card: ["recording"],

    // PROJECT
    projects: ["newProject", "newFolder", "sort_projects_by"],
    projectTab: ["export", "SEPERATOR", "close"],
    project: ["newShowPopup", "newPrivateShow", "section"], // "newShow"(empty) , "newPrivateShow"
    project_button: ["rename", "duplicate", "delete", "SEPERATOR", "export"], // "open",
    folder: ["rename", "duplicate", "delete"],
    project_media: ["play", "play_no_filters", "remove"],
    project_audio: ["remove"],
    project_player: ["remove"],
    project_show: ["rename", "private", "duplicate", "remove"],
    project_section: ["remove"],
    shows: ["newSlide", "selectAll"],
    // TIMER
    timer: ["play", "edit"], // , "reset"
    global_timer: ["play", "edit", "SEPERATOR", "delete"], // , "reset"
    // VARIABLE
    variable: ["edit", "SEPERATOR", "delete"],
    // TRIGGER
    trigger: ["edit", "SEPERATOR", "delete"],

    // SHOWS
    // , "copy", "paste"
    slide: ["slideGroups", "actions", "format", "remove_layers", "slide_transition", "disable", "edit", "SEPERATOR", "duplicate", "delete_slide", "remove_slide"],
    slideChild: ["slideGroups", "actions", "format", "remove_layers", "slide_transition", "disable", "edit", "SEPERATOR", "duplicate", "delete_slide", "remove_slide"],
    group: ["rename", "recolor", "disable", "selectAll", "SEPERATOR", "duplicate", "delete"],
    global_group: ["edit"],
    // global_group: ["rename"],
    layout: ["rename", "duplicate", "remove"],
    slideViews: ["view_grid", "view_simple", "view_list", "view_lyrics", "view_text"],
    // TODO: change chords (m, dim, sus, left, guitar, custom value, ...)
    // chord notations
    // https://jazz-library.com/articles/chord-symbols/
    // https://www.musicnotes.com/now/tips/a-complete-guide-to-chord-symbols-in-music/
    chord: ["set_key", "chord_list", "custom_key", "SEPERATOR", "delete"],

    // MEDIA
    video_marker: ["rename", "delete"],

    // STAGE
    stage_slide: ["move_connections", "rename", "disable", "SEPERATOR", "duplicate", "delete"],

    // EDIT
    edit_box: ["bind_to", "item_actions", "format", "delete", "SEPERATOR", "duplicate", "copy", "paste"],

    // CALENDAR
    event: ["edit", "duplicate", "delete", "delete_all"],

    // SETTINGS
    theme: ["rename", "duplicate", "delete", "SEPERATOR", "reset_theme"],
    style: ["rename", "duplicate", "delete", "SEPERATOR", "reset"],
    output_screen: ["rename", "recolor", "duplicate", "delete", "SEPERATOR", "reset"],
    output_screen_stage: ["rename", "recolor", "SEPERATOR", "reset"],
}
