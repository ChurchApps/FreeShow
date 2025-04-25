<script lang="ts">
    import { videosData, videosTime } from "../../../stores"
    import { joinTime, secondsToTime } from "../../helpers/time"

    export let outputId = ""
    export let autoSize = 0
    export let reverse = false

    $: data = $videosData[outputId] || {}
    $: time = $videosTime[outputId] || 0

    $: videoTime = reverse ? (data.duration || 0) - time : time
    $: timeString = joinTime(secondsToTime(videoTime))
</script>

<div class="autoFontSize" style={autoSize ? `font-size: ${autoSize}px;height: 100%;align-items: center;` : ""}>{timeString}</div>

<style>
    div {
        width: 100%;
        height: 100%;

        display: flex;
        align-items: center;
        justify-content: center;
    }
</style>
