import { showsPath } from "./../stores"
import { MAIN } from "../../types/Channels"
import {
  activePopup,
  activeProject,
  audioFolders,
  categories,
  defaultProjectName,
  displayMetadata,
  drawer,
  drawerTabsData,
  drawSettings,
  fullColors,
  groupCount,
  groupNumbers,
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
  playerVideos,
  resized,
  saved,
  screen,
  slidesOptions,
  templateCategories,
  theme,
  videoExtensions,
  webFavorites,
} from "../stores"

export function updateSettings(data: any[]) {
  Object.entries(data).forEach(([key, value]) => {
    switch (key) {
      case "initialized":
        if (!value) {
          activePopup.set("initialize")
        }
        break
      case "outLocked":
        outLocked.set(value)
        break
      case "openedFolders":
        openedFolders.set(value)
        break
      case "activeProject":
        activeProject.set(value)
        break
      case "categories":
        categories.set(value)
        break
      case "drawSettings":
        drawSettings.set(value)
        break
      case "overlayCategories":
        overlayCategories.set(value)
        break
      case "templateCategories":
        templateCategories.set(value)
        break
      case "mediaFolders":
        mediaFolders.set(value)
        break
      case "audioFolders":
        audioFolders.set(value)
        break
      case "webFavorites":
        webFavorites.set(value)
        break
      case "playerVideos":
        playerVideos.set(value)
        break
      case "resized":
        resized.set(value)
        break
      case "slidesOptions":
        slidesOptions.set(value)
        break
      case "mediaOptions":
        mediaOptions.set(value)
        break
      case "drawerTabsData":
        drawerTabsData.set(value)
        break
      case "drawer":
        drawer.set(value)
        break
      case "language":
        // TODO: get device lang
        language.set(value)
        break
      case "labelsDisabled":
        labelsDisabled.set(value)
        break
      case "groupNumbers":
        groupNumbers.set(value)
        break
      case "fullColors":
        fullColors.set(value)
        break
      case "displayMetadata":
        displayMetadata.set(value)
        break
      case "showsPath":
        showsPath.set(value)
        break
      case "defaultProjectName":
        defaultProjectName.set(value)
        break
      case "videoExtensions":
        videoExtensions.set(value)
        break
      case "imageExtensions":
        imageExtensions.set(value)
        break
      case "theme":
        theme.set(value)
        break
      case "groupCount":
        groupCount.set(value)
        break
      case "groups":
        groups.set(value)
        break
      case "screen":
        screen.set(value)
        break
      case "os":
        if (!value.platform) window.api.send(MAIN, { channel: "GET_OS" })
        os.set(value)
        break

      default:
        console.log("MISSING: ", key)
        break
    }
  })

  saved.set(true)
}
