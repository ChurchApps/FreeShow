<script lang="ts">
  import { version } from "../../../stores"
  import T from "../../helpers/T.svelte"
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
    <T id="about.help" /> <a href="mailto:support@freeshow.net">support@freeshow.net</a>
  </div>
  <br />
  <!-- <h6><T id="about.libraries" /></h6>
  <h6><T id="about.thanks" /></h6> -->
  <div>
    <h6><T id="about.assets" /></h6>
    <div style="display: flex;justify-content: space-between;">
      <span>churchmotiongraphics.com</span>
      <span>CMG Sans</span>
    </div>
  </div>
</div>

<style>
  .main {
    display: flex;
    flex-direction: column;
    gap: 5px;
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
