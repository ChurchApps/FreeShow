import type { Line } from "../../../types/Show"

export class EditboxHelper {

  
  //Compare text of all the new lines to determine if it's truly a modification or just an index change.
  //Set the cursor to the start of the last line that was modified.
  static determineCaretLine(oldLines:Line[], newLines: Line[]) {
    const oldTexts:string[] = [];
    const newTexts:string[] = [];
    
    oldLines?.forEach((line) => {
      oldTexts.push(line.text[0].value);
    });

    newLines.forEach((line) => {
      newTexts.push(line.text[0].value);
    });

    let lastLineChanged = -1;
    if (oldTexts.length === newTexts.length) return lastLineChanged;
    for (let i=0; i<newTexts.length; i++) {
      const nt = newTexts[i];
      const index = oldTexts.indexOf(nt);
      if (index === -1) lastLineChanged = i;
      else oldTexts.splice(index, 1);
    }
    return lastLineChanged;
  }


}