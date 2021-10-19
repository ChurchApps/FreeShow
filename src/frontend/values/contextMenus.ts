export interface ContextMenuItem {
  label: string
  icon?: string
  shortcuts?: string[]
  enabled?: boolean
}
export interface ContextMenuLayout {
  [key: string | "SEPERATOR"]: string[] | null
}

export const contextMenuItems: { [key: string]: ContextMenuItem } = {
  test: { label: "context.test", shortcuts: ["Alt+CommandOrControl+I"] },
  rename: { label: "actions.rename", icon: "rename", shortcuts: ["F2"] },
}

export const contextMenuLayouts: { [key: string]: ContextMenuLayout } = {
  default: { test: null },
  show_button: { rename: null, SEPERATOR: null, "actions.rename": ["rename", "rename", "test"], "languages.no": ["test", "test", "SEPERATOR", "rename", "rename", "test"] },
  drawer_top: { "context.enabledTabs": ["LOAD_enabled_drawer_tabs"] },
  drawer_top_button: { rename: null, "context.enabledTabs": ["LOAD_enabled_drawer_tabs"] },
}

// accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Alt+Shift+I',
