export interface ContextMenuItem {
  id?: string
  label: string
  items?: string[]
  icon?: string
  shortcuts?: string[]
  enabled?: boolean
}
// export interface ContextMenuLayout {
//   [key: string | "SEPERATOR"]: string[] | null
// }

export const contextMenuItems: { [key: string]: ContextMenuItem } = {
  quit: { label: "main.quit", icon: "quit", shortcuts: ["Alt+F4"] },
  settings: { label: "menu.settings", icon: "settings" },
  about: { label: "main.about", icon: "about" },
  rename: { label: "actions.rename", icon: "rename", shortcuts: ["F2"] },
  disable: { label: "actions.disable", icon: "disable" },
  delete: { label: "actions.delete", icon: "delete" },
  // DRAWER
  enabledTabs: { label: "context.enabledTabs", items: ["LOAD_enabled_drawer_tabs"] },
  // SHOWS
  addToProject: { label: "context.addToProject", icon: "project" },
  private: { label: "[[[private]]]", icon: "private" },
  remove: { label: "[[[remove]]]", icon: "remove" },
  slideLabels: { label: "context.changeLabel", icon: "label", items: ["LOAD_slide_labels"] },
  // PROJECT
  newProject: { label: "new.project", icon: "project" },
  newFolder: { label: "new.folder", icon: "folder" },
  newShowDrawer: { label: "new.show", icon: "showIcon" },
  newShow: { label: "new.show", icon: "showIcon" },
  newPrivateShow: { label: "new._private", icon: "private" },
}

export const contextMenuLayouts: { [key: string]: string[] } = {
  default: ["settings", "about", "SEPERATOR", "quit"],
  rename: ["rename"],
  // DRAWER
  drawer_top: ["enabledTabs"],
  // show_button: [ "rename", "SEPERATOR", "actions.rename": ["rename", "rename", "test"], "languages.no": ["test", "test", "SEPERATOR", "rename", "rename", "test"] ],
  drawer_show: ["newShowDrawer"],
  drawer_show_button: ["rename", "delete", "addToProject", "changeCategory", "SEPERATOR", "convertToOverlay", "export"],
  category_shows: ["newShowsCategory"],
  category_shows_button: ["rename", "changeIcon", "delete"],
  // SHOWS
  slide: ["disable", "rename", "slideLabels", "edit", "SEPERATOR", "delete", "duplicate", "copy", "paste"],
  slide_group: ["disable all", "enable all", "rename", "delete", "select all?", "duplicate"],
  // PROJECT
  projects: ["newProject", "newFolder"],
  project: ["newShow", "newPrivateShow"],
  show: ["rename", "remove", "private"],
}

// accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Alt+Shift+I',
