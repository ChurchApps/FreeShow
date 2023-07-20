<script lang="ts">
    import { audioChannels } from "../../stores"
</script>

<div class="main">
    <span class="left">
        <div style="height: {100 - $audioChannels.left}%" />
    </span>
    <span class="right">
        <div style="height: {100 - $audioChannels.right}%" />
    </span>
</div>

<style>
    .main {
        width: 6px;
        display: flex;

        /* position: absolute;
        right: 0;
        height: 100%; */
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
