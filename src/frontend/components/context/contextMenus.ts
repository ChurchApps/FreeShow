export interface ContextMenuItem {
  id?: string
  color?: string
  label: string
  translate?: boolean
  items?: string[]
  icon?: string
  shortcuts?: string[]
  enabled?: boolean
}

export const contextMenuItems: { [key: string]: ContextMenuItem } = {
  // MENU
  save: { label: "actions.save", icon: "save", shortcuts: ["Ctrl+S"] },
  import: { label: "actions.import", icon: "import" },
  export_more: { label: "actions.export", icon: "export" },
  undo: { label: "actions.undo", icon: "undo", shortcuts: ["Ctrl+Z"] },
  redo: { label: "actions.redo", icon: "redo", shortcuts: ["Ctrl+Y"] },
  cut: { label: "actions.cut", icon: "cut", shortcuts: ["Ctrl+X"] },
  copy: { label: "actions.copy", icon: "copy", shortcuts: ["Ctrl+C"] },
  paste: { label: "actions.paste", icon: "paste", shortcuts: ["Ctrl+V"] },
  docs: { label: "main.docs", icon: "document" },
  fullscreen: { label: "actions.fullscreen", icon: "fullscreen", shortcuts: ["F11"] },
  resetZoom: { label: "actions.resetZoom", icon: "reset" },
  zoomIn: { label: "actions.zoomIn", icon: "zoomIn" },
  zoomOut: { label: "actions.zoomOut", icon: "zoomOut" },
  // MAIN
  quit: { label: "main.quit", icon: "close" },
  settings: { label: "menu.settings", icon: "settings" },
  about: { label: "main.about", icon: "info" },
  shortcuts: { label: "popup.shortcuts", icon: "shortcut" },
  rename: { label: "actions.rename", icon: "rename" },
  delete: { label: "actions.delete", icon: "delete" },
  delete_all: { label: "actions.delete_all", icon: "delete" },
  export: { label: "actions.export", icon: "export" },
  // DRAWER
  enabledTabs: { label: "context.enabledTabs", items: ["LOAD_enabled_drawer_tabs"] },
  newCategory: { label: "context.newCategory", icon: "all" },
  newScripture: { label: "new.scripture", icon: "scripture" },
  changeIcon: { label: "context.changeIcon", icon: "noIcon" },
  toggle_clock: { label: "context.toggle_clock", icon: "clock" },
  // OUTPUTS
  force_output: { label: "context.force_outputs", icon: "outputs" },
  toggle_output: { label: "context.toggle_output", icon: "outputs" },
  move_to_front: { label: "context.move_to_front", icon: "toFront" },
  // PROJECT
  close: { label: "actions.close", icon: "close" },
  newProject: { label: "new.project", icon: "project" },
  newFolder: { label: "new.folder", icon: "folder" },
  newShowPopup: { label: "new.show", icon: "showIcon" },
  newShow: { label: "new.empty_show", icon: "showIcon" },
  newPrivateShow: { label: "new.private", icon: "private" },
  private: { label: "actions.private", icon: "private" },
  duplicate: { label: "actions.duplicate", icon: "duplicate" },
  section: { label: "new.section", icon: "icon" },
  // SHOWS
  addToProject: { label: "context.addToProject", icon: "project" },
  remove: { label: "actions.remove", icon: "remove" },
  remove_slide: { label: "actions.remove", icon: "remove" },
  slideGroups: { label: "context.changeGroup", icon: "groups", items: ["rename", "recolor", "remove", "SEPERATOR", "LOAD_slide_groups"] },
  selectAll: { label: "context.selectAll", icon: "select", shortcuts: ["Ctrl+A"] },
  newSlide: { label: "new.slide", icon: "add" },
  // newGroup: { label: "context.createNew", icon: "add" },
  // SLIDE VIEWS
  view_grid: { label: "show.grid", icon: "grid" },
  view_list: { label: "show.list", icon: "list" },
  view_lyrics: { label: "show.lyrics", icon: "lyrics" },
  view_text: { label: "show.text", icon: "text" },
  // SLIDE
  disable: { label: "actions.disable", icon: "disable" },
  edit: { label: "menu.edit", icon: "edit" },
  recolor: { label: "actions.recolor", icon: "color" },
  actions: { label: "actions.actions", icon: "actions", items: ["LOAD_actions"] },
  remove_media: { label: "actions.remove_media", icon: "media", items: ["LOAD_remove_media"] },
  // ITEM
  format: { label: "actions.format", icon: "format", items: ["uppercase", "lowercase", "capitalize", "trim"] },
  // formatting
  uppercase: { label: "actions.uppercase" },
  lowercase: { label: "actions.lowercase" },
  capitalize: { label: "actions.capitalize" },
  trim: { label: "actions.trim" },
  // MEDIA
  play: { label: "media.play", icon: "play" },
  play_no_filters: { label: "media.play_no_filters", icon: "play" },
  favourite: { label: "media.favourite", icon: "star" },
  // OVERLAYS
  lock_to_output: { label: "context.lock_to_output", icon: "locked" },
}

export const contextMenuLayouts: { [key: string]: string[] } = {
  // MENU
  file: ["save", "import", "export_more", "SEPERATOR", "quit"],
  edit: ["undo", "redo", "SEPERATOR", "copy", "paste", "delete", "SEPERATOR", "selectAll"], // , "cut"
  view: ["fullscreen"], // , "resetZoom", "zoomIn", "zoomOut"
  help: ["shortcuts", "docs", "about"],
  // MAIN
  default: ["settings", "about", "SEPERATOR", "quit"],
  rename: ["rename"],
  close: ["close"],

  // TOP
  // TODO: output
  output: ["force_output"],

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
  category_media_button: ["rename", "delete"],
  category_audio_button: ["rename", "delete"],
  category_scripture_button: ["delete"],
  // CONTENT
  drawer_show: ["newShowPopup", "newShow"],
  // , "changeCategory" ? edit with rename & categories...
  // , "convertToOverlay"
  // , "SEPERATOR", "export"
  drawer_show_button: ["addToProject", "SEPERATOR", "rename", "duplicate", "delete"],
  // media / audio
  // "play", "play_no_filters", "SEPERATOR", "edit",
  media_preview: ["close"],
  // , "delete_all"
  show_media: ["play", "play_no_filters", "SEPERATOR", "edit"],
  // , "addToShow"
  // show_in_explorer!!
  media_card: ["play", "play_no_filters", "favourite", "SEPERATOR", "edit", "addToProject"],
  // "addToFirstSlide",
  overlay_card: ["edit", "lock_to_output", "SEPERATOR", "rename", "recolor", "duplicate", "delete"],
  // "addToShow",
  template_card: ["edit", "SEPERATOR", "rename", "recolor", "duplicate", "delete"],
  player_button: ["addToProject", "SEPERATOR", "rename", "delete"],
  audio_button: ["favourite", "addToProject"],
  // "addToFirstSlide"
  live_card: [],

  // PROJECT
  projects: ["newProject", "newFolder"],
  projectTab: ["export", "close"],
  project: ["section", "SEPERATOR", "newShowPopup", "newShow"], // , "newPrivateShow"
  project_button: ["rename", "delete", "export"],
  folder: ["rename", "delete"],
  project_media: ["play", "play_no_filters", "remove"],
  project_audio: ["remove"],
  project_player: ["remove"],
  project_show: ["rename", "remove", "private", "duplicate"],
  project_section: ["remove"],
  shows: ["newSlide", "selectAll"],
  // TIMER
  timer: ["play", "edit"], // , "reset"
  global_timer: ["play", "edit", "SEPERATOR", "delete"], // , "reset"

  // SHOWS
  // , "copy", "paste"
  slide: ["slideGroups", "actions", "remove_media", "format", "disable", "edit", "SEPERATOR", "duplicate", "remove_slide"],
  slideChild: ["slideGroups", "actions", "remove_media", "format", "disable", "edit", "SEPERATOR", "duplicate", "delete"],
  group: ["rename", "recolor", "disable", "selectAll", "SEPERATOR", "duplicate", "delete"],
  global_group: ["edit"],
  // global_group: ["rename"],
  layout: ["rename", "remove", "duplicate"],
  slideViews: ["view_grid", "view_list", "view_lyrics", "view_text"],

  // STAGE
  stage_slide: ["rename", "disable", "SEPERATOR", "duplicate", "delete"],

  // EDIT
  edit_box: ["format", "delete", "make stage exlusive", "SEPERATOR", "duplicate", "copy", "paste"],

  // CALENDAR
  event: ["edit", "duplicate", "delete", "delete_all"],
}
