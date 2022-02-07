<script lang="ts">
  import { version } from "../../../stores"
</script>

<div style="text-align: center;">
  <h1>FreeShow</h1>
  <p style="opacity: 0.5;">v{$version}</p>
</div>
<br />
<div class="main">
  <div>Made with {"<3"} by Kristoffer Vassbø</div>
  <div>Want to report an issue; create an issue on GitHub</div>
  <div>
    Want to help translate or request a feature; send a mail to <a href="mailto:support@freeshow.net">support@freeshow.net</a>
  </div>
  <br />
  <div>
    <h6>Libraries used / Thanks to:</h6>
    <div>
      <span>churchmotiongraphics.com</span>
      <span>CMG Sans</span>
    </div>
    <div>
      <span>XX</span>
      <span>XX</span>
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
