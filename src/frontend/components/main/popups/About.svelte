<script lang="ts">
  import { MAIN } from "../../../../types/Channels"

  import { version } from "../../../stores"
  import T from "../../helpers/T.svelte"

  function openURL(url: string) {
    window.api.send(MAIN, { channel: "URL", data: url })
    return false
  }
</script>

<div style="text-align: center;">
  <h1>FreeShow</h1>
  <p style="opacity: 0.5;">v{$version}</p>
</div>
<br />
<div class="main">
  <div><T id="about.made" /> Kristoffer Vassbø</div>
  <div><T id="about.report" /></div>
  <div>
    <T id="about.help" /> <a href="#void" on:click={() => openURL("mailto:dev@freeshow.app")}>dev@freeshow.app</a>
  </div>
  <br />
  <!-- <h6><T id="about.libraries" /></h6>
  <h6><T id="about.thanks" /></h6> -->
  <div>
    <h6><T id="about.assets" /></h6>
    <div style="display: flex;justify-content: space-between;">
      <span>CMG Sans (Custom font)</span>
      <span>
        <a href="#void" on:click={() => openURL("https://www.churchmotiongraphics.com/cmg-sans/")}>https://www.churchmotiongraphics.com/cmg-sans/</a>
      </span>
    </div>
    <div style="display: flex;justify-content: space-between;">
      <span>Electron (Cross-platform desktop apps)</span>
      <span>
        <a href="#void" on:click={() => openURL("https://www.electronjs.org/")}>https://www.electronjs.org/</a>
      </span>
    </div>
    <div style="display: flex;justify-content: space-between;">
      <span>Svelte (DOM framework)</span>
      <span>
        <a href="#void" on:click={() => openURL("https://svelte.dev/")}>https://svelte.dev/</a>
      </span>
    </div>
    <div style="display: flex;justify-content: space-between;">
      <span>Rollup (Module bundler)</span>
      <span>
        <a href="#void" on:click={() => openURL("https://rollupjs.org/")}>https://rollupjs.org/</a>
      </span>
    </div>
    <div style="display: flex;justify-content: space-between;">
      <span>Socket.io (LAN connections)</span>
      <span>
        <a href="#void" on:click={() => openURL("https://socket.io/")}>https://socket.io/</a>
      </span>
    </div>
    <div style="display: flex;justify-content: space-between;">
      <span>Express (Web framework)</span>
      <span>
        <a href="#void" on:click={() => openURL("https://expressjs.com/")}>https://expressjs.com/</a>
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

  a {
    color: var(--text);
    opacity: 0.5;
  }
  a:hover {
    opacity: 0.6;
  }
  a:active {
    opacity: 0.8;
  }
</style>
