interface Tab {
  [key: string]: {
    name: string
    icon: string
  }
}

export const drawerTabs: Tab = {
  shows: { name: "tabs.shows", icon: "shows" },
  backgrounds: { name: "tabs.backgrounds", icon: "backgrounds" },
  overlays: { name: "tabs.overlays", icon: "overlays" },
  audio: { name: "tabs.audio", icon: "audio" },
  scripture: { name: "tabs.scripture", icon: "scripture" },
  live: { name: "tabs.live", icon: "live" },
  web: { name: "tabs.web", icon: "web" },
}
