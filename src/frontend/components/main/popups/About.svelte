<script lang="ts">
    import { version } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import Link from "../../inputs/Link.svelte"
</script>

<div style="text-align: center;">
    <h1>FreeShow</h1>
    <p>
        <span style="opacity: 0.8;">v{$version} -</span>
        <Link url={"https://freeshow.app/?v" + $version}>
            <T id="about.check_updates" />
        </Link>
    </p>
</div>
<br />
<div class="main">
    <div><T id="about.made" /> Kristoffer Vassbø</div>
    <div><T id="about.report" /></div>
    <div>
        <T id="about.help" />
        <Link url={"mailto:dev@freeshow.app"}>dev@freeshow.app</Link>
    </div>
    <br />
    <!-- <h6><T id="about.libraries" /></h6>
  <h6><T id="about.thanks" /></h6> -->
    <div>
        <h6><T id="about.assets" /></h6>
        <div style="display: flex;justify-content: space-between;gap: 10px;">
            <span>● CMG Sans (Custom font)</span>
            <span>
                <Link url={"https://www.churchmotiongraphics.com/cmg-sans/"}>https://www.churchmotiongraphics.com/cmg-sans/</Link>
            </span>
        </div>
        <div style="display: flex;justify-content: space-between;gap: 10px;">
            <span>● Google Fonts (Icons)</span>
            <span>
                <Link url={"https://fonts.google.com/icons"}>https://fonts.google.com/icons</Link>
            </span>
        </div>
        <div style="display: flex;justify-content: space-between;gap: 10px;">
            <span>● Icons8 (Icons)</span>
            <span>
                <Link url={"https://icons8.com"}>https://icons8.com</Link>
            </span>
        </div>
        <div style="display: flex;justify-content: space-between;gap: 10px;">
            <span>● Pixabay (Web Images)</span>
            <span>
                <Link url={"https://pixabay.com/"}>https://pixabay.com/</Link>
            </span>
        </div>
        <div style="display: flex;justify-content: space-between;gap: 10px;">
            <span>● Electron (Cross-platform desktop apps)</span>
            <span>
                <Link url={"https://www.electronjs.org/"}>https://www.electronjs.org/</Link>
            </span>
        </div>
        <div style="display: flex;justify-content: space-between;gap: 10px;">
            <span>● Svelte (DOM framework)</span>
            <span>
                <Link url={"https://svelte.dev/"}>https://svelte.dev/</Link>
            </span>
        </div>
        <div style="display: flex;justify-content: space-between;gap: 10px;">
            <span>● Rollup (Module bundler)</span>
            <span>
                <Link url={"https://rollupjs.org/"}>https://rollupjs.org/</Link>
            </span>
        </div>
        <div style="display: flex;justify-content: space-between;gap: 10px;">
            <span>● Socket.io (LAN connections)</span>
            <span>
                <Link url={"https://socket.io/"}>https://socket.io/</Link>
            </span>
        </div>
        <div style="display: flex;justify-content: space-between;gap: 10px;">
            <span>● Express (Web framework)</span>
            <span>
                <Link url={"https://expressjs.com/"}>https://expressjs.com/</Link>
            </span>
        </div>
    </div>
</div>

<style>
    .main {
        display: flex;
        flex-direction: column;
        gap: 5px;
    }

    h6 {
        font-size: 0.8em;
    }
</style>
