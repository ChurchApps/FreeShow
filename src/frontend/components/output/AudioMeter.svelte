<script lang="ts">
    import { audioChannels } from "../../stores"

    export let advanced: boolean = false
    const numbers: number = 8
</script>

<div class="main" class:advanced>
    <span class="left">
        <div style="height: {100 - $audioChannels.left}%" />
    </span>
    <span class="right">
        <div style="height: {100 - $audioChannels.right}%" />
    </span>

    {#if advanced}
        <div class="lines">
            {#each { length: numbers } as _}
                <div class="line" />
            {/each}
        </div>
        <div class="lines" style="padding: 0 8px;">
            {#each { length: numbers } as _, i}
                <p>{numbers - i}</p>
            {/each}
        </div>
    {/if}
</div>

<style>
    .main {
        width: 6px;
        display: flex;

        /* position: absolute;
        right: 0;
        height: 100%; */
    }

    .main.advanced {
        width: 70px;
    }
    .lines {
        display: flex;
        flex-direction: column;
        justify-content: space-around;

        text-align: center;
        opacity: 0.8;

        background: var(--primary-lighter);
    }
    .lines .line {
        height: 1px;
        width: 8px;
        background-color: var(--text);
        opacity: 0.4;
        margin: 0 5px;
    }

    span {
        /* background-image: linear-gradient(rgb(200, 0, 0) 1%, rgb(255, 220, 0) 16%, rgb(0, 220, 0) 45%, rgb(0, 120, 0) 100%); */
        /* background-image: linear-gradient(rgb(200, 0, 0) 1%, rgb(200, 100, 0) 16%, rgb(0, 255, 120) 45%, rgb(0, 120, 200) 100%); */
        /* background-image: linear-gradient(rgb(200, 0, 0) 1%, rgb(255, 200, 0) 16%, rgb(0, 255, 50) 45%, rgb(0, 200, 150) 100%); */
        background-image: linear-gradient(rgb(200, 0, 0) 1%, rgb(255, 200, 0) 16%, rgb(0, 255, 50) 45%, rgb(0, 200, 200) 100%);
        width: 50%;
    }

    span div {
        transition: height 0.05s ease 0s;
        /* background-color: transparent; */
        background-color: var(--primary-darker);
        width: 100%;
    }
</style>
