<script lang="ts">
  import { OUTPUT } from "../../../../types/Channels"
  import { receive } from "../../../utils/request"
  import { joinTime, secondsToTime } from "../../helpers/time"

  export let autoSize: number = 0
  export let reverse: boolean = false

  // TODO: get this to work
  let videoTime: number = 0
  receive(OUTPUT, {
    MAIN_VIDEO: (a) => {
      console.log(a)
      videoTime = a.time
      if (reverse) videoTime = a.data.duration - videoTime
    },
  })

  $: timeString = joinTime(secondsToTime(videoTime))
</script>

<div style={autoSize ? `font-size: ${autoSize}px;height: 100%;align-items: center;` : ""}>{timeString}</div>
