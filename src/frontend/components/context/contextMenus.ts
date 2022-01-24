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
// export interface ContextMenuLayout {
//   [key: string | "SEPERATOR"]: string[] | null
// }

export const contextMenuItems: { [key: string]: ContextMenuItem } = {
  quit: { label: "main.quit", icon: "quit", shortcuts: ["Alt+F4"] },
  settings: { label: "menu.settings", icon: "settings" },
  about: { label: "main.about", icon: "about" },
  rename: { label: "actions.rename", icon: "rename", shortcuts: ["F2"] },
  delete: { label: "actions.delete", icon: "delete" },
  export: { label: "actions.export", icon: "export" },
  // DRAWER
  enabledTabs: { label: "context.enabledTabs", items: ["LOAD_enabled_drawer_tabs"] },
  newCategory: { label: "context.newCategory", icon: "all" },
  changeIcon: { label: "context.changeIcon", icon: "noIcon" },
  // PROJECT
  close: { label: "actions.close", icon: "close" },
  newProject: { label: "new.project", icon: "project" },
  newFolder: { label: "new.folder", icon: "folder" },
  newShowPopup: { label: "new.show", icon: "showIcon" },
  newShow: { label: "new.empty_show", icon: "showIcon" },
  newPrivateShow: { label: "new.private", icon: "private" },
  private: { label: "actions.private", icon: "private" },
  duplicate: { label: "actions.duplicate", icon: "duplicate" },
  // SHOWS
  addToProject: { label: "context.addToProject", icon: "project" },
  remove: { label: "actions.remove", icon: "remove" },
  slideGroups: { label: "context.changeGroup", icon: "groups", items: ["rename", "recolor", "remove", "SEPERATOR", "LOAD_slide_groups"] },
  selectAll: { label: "context.selectAll", icon: "select" },
  newSlide: { label: "new.slide", icon: "add" },
  // newGroup: { label: "context.createNew", icon: "add" },
  // SLIDE
  disable: { label: "actions.disable", icon: "disable" },
  edit: { label: "menu.edit", icon: "edit" },
  recolor: { label: "actions.recolor", icon: "color" },
}

export const contextMenuLayouts: { [key: string]: string[] } = {
  default: ["settings", "about", "SEPERATOR", "quit"],
  rename: ["rename"],
  // DRAWER
  drawer_top: ["enabledTabs"],
  // navigation
  category_shows: ["newCategory"],
  category_backgrounds: ["newCategory"],
  // content
  drawer_show: ["newShowPopup", "newShow"],
  // , "changeCategory" ? edit with rename & categories...
  // , "convertToOverlay"
  drawer_show_button: ["rename", "addToProject", "delete", "duplicate", "SEPERATOR", "export"],
  category_shows_button: ["rename", "changeIcon", "delete"],
  // PROJECT
  projects: ["newProject", "newFolder"],
  projectTab: ["close"],
  project: ["newShowPopup", "newShow"], // , "newPrivateShow"
  show: ["rename", "remove", "private", "duplicate"],
  shows: ["newSlide", "selectAll"],
  // SHOWS
  // , "copy", "paste"
  slide: ["disable", "edit", "slideGroups", "SEPERATOR", "delete", "duplicate"],
  group: ["rename", "recolor", "disable", "selectAll", "SEPERATOR", "delete", "duplicate"],
  global_group: ["rename", "recolor"],
  // global_group: ["rename"],
}

// accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Alt+Shift+I',
