import { get } from 'svelte/store';
import { activeShow, shows } from './../../stores';

export function getGroup(showID: null | string, layoutID: null | string) {
  if (!showID && get(activeShow)) showID = get(activeShow)!.id
  if (showID) {
    if (!layoutID) layoutID = get(shows)[showID].settings.activeLayout
    let layout = get(shows)[showID].layouts[layoutID].slides
    console.log(layout);
    
  }
  return "verse"
}