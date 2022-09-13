<script lang="ts">
  import { onMount } from "svelte"

  import { activeEdit, activePopup, activeShow, timers } from "../../../stores"
  import Icon from "../../helpers/Icon.svelte"
  import { select } from "../../helpers/select"
  import { _show } from "../../helpers/shows"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"

  export let item: any

  let timersList: any[] = []
  let activeTimer: any = {}
  onMount(() => {
    Object.entries($timers).forEach(([id, timer]: any) => timersList.push({ id, name: timer.name }))
    // activeTimer = timersList[0] || {}
  })

  let isPrivate: boolean = true

  // function togglePrivate(e: any) {
  //   isPrivate = e.target.checked
  //   if (isPrivate) activeTimer = {}
  // }

  function editTimer() {
    if (!isPrivate && activeTimer) {
      select("timer", { id: activeTimer.id })
      return activePopup.set("timer")
    }

    if ($activeEdit?.id) {
      // TODO: overlay/template timers...
      if ($activeEdit.type === "overlay") {
        select("timer", { id: item.timer.id, overlayId: $activeEdit.id })
      } else if ($activeEdit.type === "template") {
        select("timer", { id: item.timer.id, templateId: $activeEdit.id })
      }

      return activePopup.set("timer")
    }

    let showId = $activeEdit?.id || $activeShow?.id
    let ref = _show(showId).layouts("active").ref()[0]
    select("timer", { id: item.timer.id, showId, slideId: ref[$activeEdit?.slide ?? 0].id })

    activePopup.set("timer")
  }
</script>

<Button on:click={editTimer} style="width: 100%;" center dark>
  <Icon id="edit" right />
  <T id="menu.edit" />
</Button>
