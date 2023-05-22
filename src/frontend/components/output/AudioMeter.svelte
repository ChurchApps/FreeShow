<script lang="ts">
    import { audioChannels } from "../../stores"
    // import { audioSource, outBackground } from "../../stores"
    // import { audioAnalyser } from "./audioAnalyser"

    // export let video: any
    // let audioChannels: any = { left: 0, right: 0 }

    // // disable when no updates
    // let disableTimeout: any = null
    // function startTimeout() {
    //     if (disableTimeout) clearTimeout(disableTimeout)
    //     console.log("START TIMEOUT")

    //     disableTimeout = setTimeout(() => {
    //         audioChannels.set({ left: 0, right: 0 })
    //         disableTimeout = null
    //         console.log("DISABLE")
    //         console.log($audioChannels)
    //     }, 1000)
    // }

    // $: console.log($audioChannels)

    // receive(OUTPUT, {
    //     AUDIO_MAIN: (data: any) => {
    //         audioChannels.set(data.channels)
    //         startTimeout()
    //     },
    // })
</script>

<div class="main">
    <span class="left">
        <!-- <p>L</p> -->
        <div style="height: {100 - $audioChannels.left}%" />
    </span>
    <span class="right">
        <!-- <p>R</p> -->
        <div style="height: {100 - $audioChannels.right}%" />
    </span>
</div>

<style>
    .main {
        width: 15px;
        display: flex;
        border-left: 5px solid var(--primary-lighter);
    }

    span {
        /* background-image: linear-gradient(rgb(200, 0, 0) 1%, rgb(255, 220, 0) 16%, rgb(0, 220, 0) 45%, rgb(0, 120, 0) 100%); */
        /* filter: hue-rotate(250deg); */
        /* background-image: linear-gradient(rgb(200, 0, 0) 1%, rgb(200, 100, 0) 16%, rgb(0, 255, 120) 45%, rgb(0, 120, 200) 100%); */
        /* background-image: linear-gradient(rgb(200, 0, 0) 1%, rgb(255, 200, 0) 16%, rgb(0, 255, 50) 45%, rgb(0, 200, 150) 100%); */
        background-image: linear-gradient(rgb(200, 0, 0) 1%, rgb(255, 200, 0) 16%, rgb(0, 255, 50) 45%, rgb(0, 200, 200) 100%);
        width: 50%;
    }

    span div {
        /* transition: height 0.08s ease 0s; */
        transition: height 0.05s ease 0s;
        background-color: var(--primary);
        width: 100%;
    }
</style>
