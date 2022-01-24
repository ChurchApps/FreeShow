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
  templates: { name: "tabs.templates", icon: "templates" },
  audio: { name: "tabs.audio", icon: "audio" },
  scripture: { name: "tabs.scripture", icon: "scripture" },
  // timers: { name: "tabs.timers", icon: "timers" },
  player: { name: "tabs.player", icon: "play" },
  // web: { name: "tabs.web", icon: "web" },
  live: { name: "tabs.live", icon: "live" },
}
