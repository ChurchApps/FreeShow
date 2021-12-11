export interface ContextMenuItem {
  id?: string
  label: string
  icon?: string
  shortcuts?: string[]
  enabled?: boolean
}
export interface ContextMenuLayout {
  [key: string | "SEPERATOR"]: string[] | null
}

export const contextMenuItems: { [key: string]: ContextMenuItem } = {
  quit: { label: "main.quit", icon: "quit", shortcuts: ["Alt+F4"] },
  settings: { label: "menu.settings", icon: "settings" },
  about: { label: "main.about", icon: "about" },
  rename: { label: "actions.rename", icon: "rename", shortcuts: ["F2"] },
  disable: { label: "actions.disable", icon: "disable" },
  delete: { label: "actions.delete", icon: "delete" },
  // SHOWS
  addToProject: { label: "context.addToProject", icon: "project" },
  private: { label: "[[[private]]]", icon: "private" },
  remove: { label: "[[[remove]]]", icon: "remove" },
  // PROJECT
  newProject: { label: "new.project", icon: "project" },
  newFolder: { label: "new.folder", icon: "folder" },
  newShowDrawer: { label: "new.show", icon: "showIcon" },
  newShow: { label: "new.show", icon: "showIcon" },
  newPrivateShow: { label: "new._private", icon: "private" },
}

export const contextMenuLayouts: { [key: string]: ContextMenuLayout } = {
  default: { settings: null, about: null, SEPERATOR: null, quit: null },
  rename: { rename: null },
  // DRAWER
  drawer_top: { "context.enabledTabs": ["LOAD_enabled_drawer_tabs"] },
  // show_button: { rename: null, SEPERATOR: null, "actions.rename": ["rename", "rename", "test"], "languages.no": ["test", "test", "SEPERATOR", "rename", "rename", "test"] },
  drawer_show: { newShowDrawer: null },
  drawer_show_button: { rename: null, delete: null, addToProject: null, changeCategory: null, SEPERATOR: null, convertToOverlay: null, export: null },
  // SHOWS
  slide: { disable: null, rename: null, "context.changeLabel": ["LOAD_labels"] },
  // PROJECT
  projects: { newProject: null, newFolder: null },
  project: { newShow: null, newPrivateShow: null },
  show: { rename: null, remove: null, private: null },
}

// accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Alt+Shift+I',
