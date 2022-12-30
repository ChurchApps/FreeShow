<script lang="ts">
  import { joinTime, secondsToTime } from "../../remote/helpers/time"

  export let videoTime: number = 0
  export let autoSize: number = 0

  $: timeString = joinTime(secondsToTime(videoTime))
</script>

<div style={autoSize ? `font-size: ${autoSize}px;height: 100%;align-items: center;` : ""}>{timeString}</div>
