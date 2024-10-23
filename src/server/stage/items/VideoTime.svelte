<script lang="ts">
    import { joinTime, secondsToTime } from "../../remote/helpers/time"

    export let videoTime: number = 0
    export let autoSize: number = 0

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
