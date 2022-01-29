import { MAIN } from "../../types/Channels"
import {
  activeProject,
  audioFolders,
  categories,
  defaultProjectName,
  displayMetadata,
  drawer,
  drawerTabsData,
  drawSettings,
  events,
  folders,
  fullColors,
  groupCount,
  groups,
  imageExtensions,
  labelsDisabled,
  language,
  mediaFolders,
  mediaOptions,
  openedFolders,
  os,
  outLocked,
  overlayCategories,
  overlays,
  playerVideos,
  projects,
  resized,
  saved,
  screen,
  slidesOptions,
  stageShows,
  templateCategories,
  templates,
  theme,
  themes,
  videoExtensions,
  webFavorites,
} from "./../stores"

export function updateSettings(data: any[]) {
  console.log(data)

  data.forEach((a) => {
    switch (a.key) {
      case "initialized":
        if (!a.value) {
          console.log("INITIALIZE")
          window.api.send(MAIN, { channel: "GET_PATHS" })
        }
        break
      case "outLocked":
        outLocked.set(a.value)
        break
      case "openedFolders":
        openedFolders.set(a.value)
        break
      case "activeProject":
        activeProject.set(a.value)
        break
      case "projects":
        projects.set(a.value)
        break
      case "folders":
        folders.set(a.value)
        break
      case "categories":
        categories.set(a.value)
        break
      case "drawSettings":
        drawSettings.set(a.value)
        break
      case "stageShows":
        stageShows.set(a.value)
        break
      case "overlayCategories":
        overlayCategories.set(a.value)
        break
      case "overlays":
        overlays.set(a.value)
        break
      case "templateCategories":
        templateCategories.set(a.value)
        break
      case "templates":
        templates.set(a.value)
        break
      case "mediaFolders":
        mediaFolders.set(a.value)
        break
      case "audioFolders":
        audioFolders.set(a.value)
        break
      case "webFavorites":
        webFavorites.set(a.value)
        break
      case "playerVideos":
        playerVideos.set(a.value)
        break
      case "events":
        events.set(a.value)
        break
      case "resized":
        resized.set(a.value)
        break
      case "slidesOptions":
        slidesOptions.set(a.value)
        break
      case "mediaOptions":
        mediaOptions.set(a.value)
        break
      case "drawerTabsData":
        drawerTabsData.set(a.value)
        break
      case "drawer":
        drawer.set(a.value)
        break
      case "language":
        language.set(a.value)
        break
      case "labelsDisabled":
        labelsDisabled.set(a.value)
        break
      case "fullColors":
        fullColors.set(a.value)
        break
      case "displayMetadata":
        displayMetadata.set(a.value)
        break
      case "defaultProjectName":
        defaultProjectName.set(a.value)
        break
      case "videoExtensions":
        videoExtensions.set(a.value)
        break
      case "imageExtensions":
        imageExtensions.set(a.value)
        break
      case "theme":
        theme.set(a.value)
        break
      case "themes":
        themes.set(a.value)
        break
      case "groupCount":
        groupCount.set(a.value)
        break
      case "groups":
        groups.set(a.value)
        break
      case "screen":
        screen.set(a.value)
        break
      case "os":
        if (!a.value.platform) window.api.send(MAIN, { channel: "GET_OS" })
        os.set(a.value)
        break

      default:
        console.log("MISSING: ", a.key)
        break
    }
  })

  saved.set(true)
}
