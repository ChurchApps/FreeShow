import "svelte"
import App from "./App.svelte"

declare global {
  interface Window {
    api?: any
  }
  // TODO: remove
  interface EventTarget {
    play?: any // VideoStream
    classList?: any // Folder
    closest?: any // Dropdown
  }
}

const app = new App({
  target: document.body,
  props: {},
})

export default app
