interface Tab {
  [key: string]: {
    name: string
    icon: string
  }
}

export const drawerTabs: Tab = {
  shows: { name: "tabs.shows", icon: "shows" },
  media: { name: "tabs.media", icon: "media" },
  overlays: { name: "tabs.overlays", icon: "overlays" },
  audio: { name: "tabs.audio", icon: "audio" },
  scripture: { name: "tabs.scripture", icon: "scripture" },
  templates: { name: "tabs.templates", icon: "templates" },
  // timers: { name: "tabs.timers", icon: "timers" },
  player: { name: "tabs.player", icon: "play" },
  // web: { name: "tabs.web", icon: "web" },
  live: { name: "tabs.live", icon: "camera" },
}
