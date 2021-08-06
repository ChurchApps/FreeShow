import { useContext, useEffect, useState } from "react";
import { Context } from "../App";
import { combine, convertStyle, getArray } from "../functions/TextBox";
import { textTags } from "./Editable";
import { Button, Input } from "./OptionsInputs";

export default function TextOptions({options, setOptions, activeBox, active, inputValues, setInputValues}) {
  const [freeShow, setFreeShow] = useContext(Context);
  let song = freeShow.songs[freeShow.activeSong];

  let align = song.slides[active][activeBox]?.style?.textAlign;
  let v_align = 'top';
  

  const style = {
    width: '300px',
    padding: '20px',
    // border: '2px solid red',
    boxShadow: '2px 2px 5px 0 rgb(0 0 0 / 30%)',
    height: '80vh',
    overflowY: 'scroll'
    // zIndex: 2
  }

  // TODO: padding textbox

  // TODO: bug when selecting another part of already selected text after changing style
  // create array with new values when textbox changed and store the array
  function changeText(key, value, toggle) {
    // TODO: text drag drop error 
    // TODO: select everything if nothings selected! (-1)
    let selection = getSelectedText();
    let selectionOffset = [selection.anchorOffset, selection.focusOffset];
    let node = [selection.anchorNode?.parentElement, selection.focusNode?.parentElement];
    let selectedText = getSelectedText().toString();
    // let selectedText = selection.focusNode.textContent;

    let textbox = node[0]?.closest('.editable');
    if (textbox) { // WIP: loop if no textbox

      if (toggle) {
        let styleCount = 0, childCount = 0, found = false;
        [...textbox.children].forEach(child => {
          if (node[0] !== node[1] && (node[0] === child || node[1] === child)) found = !found;
          if (found || node[0] === child || node[1] === child) {
            childCount++;
            let style = convertStyle(child.getAttribute('style'));
            if (style[key] === value) styleCount++;
          }
        })
        if (styleCount === childCount) {
          const revert = {'bold': 'normal', 'underline': 'none'}
          // WIP: underline & line-through has to be on the same!
          value = revert[value];
        }
      }

      let arr = getArray(textbox, {selectionOffset, node, selectedText}, {key, value});      
      let newShow = freeShow;
      newShow.songs[freeShow.activeSong].slides[active][activeBox].text = arr;
      setFreeShow(newShow);
      console.log(freeShow.songs[freeShow.activeSong]);
    }
  }

  return (
    <div style={style} className="options">
      <h3>TextBox</h3>
      <div>
        <span className="flex">
          <p>Position</p>
          <span style={{display: 'flex', width: '102%'}}>
            <Input title="X" id="left" type="number" step={50} value={inputValues.left} inputValues={inputValues} setInputValues={setInputValues} disabled={activeBox === null ? true : false} style={{marginRight: 5}} />
            <Input title="Y" id="top" type="number" step={50} value={inputValues.top} inputValues={inputValues} setInputValues={setInputValues} disabled={activeBox === null ? true : false} />
          </span>
        </span>
        <span className="flex">
          <p>Size</p>
          <span style={{display: 'flex', width: '102%'}}>
            <Input title="W" type="number" value={song.slides[active][activeBox]?.style?.width} disabled={activeBox === null ? true : false} style={{marginRight: 5}} />
            <Input title="H" type="number" value={song.slides[active][activeBox]?.style?.height} disabled={activeBox === null ? true : false} />
          </span> 
        </span>
        <span className="flex">
          <p>Angle</p>
          <Input title="R" type="number" value={song.slides[active][activeBox]?.style?.transform} disabled={activeBox === null ? true : false} />
          {/* <span></span> */}
        </span>
        <span className="flex">
          <p>Opacity</p>
          <Input title="O" type="range" value={song.slides[active][activeBox]?.style?.transform} disabled={activeBox === null ? true : false} />
        </span>
        <span className="flex">
          <p>Fill</p>
          <Input title="C" type="color" value={song.slides[active][activeBox]?.style?.color} disabled={activeBox === null ? true : false} />
        </span>
      </div>

      <hr />

      <h3>Slide</h3>
      <span className="flex">
        <p>Fill</p>
        <Input title="C" type="color" value={song.slides[active][activeBox]?.style?.color} />
        {/* WIP: gradient */}
      </span>
      
      <hr />

      <h3>Text</h3>      
      <span className="flex">
        <p>Font</p>
        <span style={{display: 'flex', width: '102%'}}>
          <select name="family" style={{width: '100%', padding: '8px 6px'}} disabled={activeBox === null ? true : false}>
            <option>CMG Sans</option>
            <option>Tahoma</option>
            <option>Arial</option>
            <option>Calibri</option>
            <option>Sans-serif</option>
            <option>Monospace</option>
          </select>
          <input type="number" value={song.slides[active][activeBox]?.text[0]?.style?.fontSize || 12} onChange={e => changeText('fontSize', e.target.value)} style={{width: 50, marginLeft: 5}} disabled={activeBox === null ? true : false} />
        </span>
      </span>
      <span className="flex">
        <p>Type</p>
        <select name="tye" style={{width: '100%', padding: '8px 6px'}} disabled={activeBox === null ? true : false}>
          <option>Regular</option>
          <option>Bold</option>
        </select>
      </span>
      {/* <span className="flex">
        <p>Size</p>
        <Input title="S" type="number" value={song.slides[active][activeBox]?.style?.transform} disabled={activeBox === null ? true : false} />
      </span> */}
      <span className="flex">
        <p>Style</p>
        <span style={{display: 'flex', width: '102%'}}>
          <Button id="bold" onClick={() => changeText('fontWeight', 'bold', true)} disabled={activeBox === null ? true : false}><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px"><path d="M0 0h24v24H0z" fill="none"/><path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/></svg></Button>
          <Button id="underline" onClick={() => changeText('textDecoration', 'underline', true)} disabled={activeBox === null ? true : false}><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px"><path d="M0 0h24v24H0z" fill="none"/><path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z"/></svg></Button>
          <Button id="italic" onClick={() => changeText('fontStyle', 'italic', true)} disabled={activeBox === null ? true : false}><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px"><path d="M0 0h24v24H0z" fill="none"/><path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/></svg></Button>
          <Button id="strikethrough" onClick={() => changeText('textDecoration', 'line-through', true)} disabled={activeBox === null ? true : false}><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px"><path d="M0 0h24v24H0z" fill="none"/><path d="M10 19h4v-3h-4v3zM5 4v3h5v3h4V7h5V4H5zM3 14h18v-2H3v2z"/></svg></Button>
          {/* TODO: secondary color on selection */}
        </span>
      </span>
      <span className="flex">
        <p>Align</p>
        <span style={{display: 'flex', width: '102%'}}>
          {/* TODO: add parent divs, for line break & alignment++ */}
          <Button id="align_left" disabled={activeBox === null ? true : false} active={align === 'left'} onClick={() => setInputValues({...inputValues, textAlign: 'left', changed: 'textAlign'})}><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px"><path d="M0 0h24v24H0z" fill="none"/><path d="M15 15H3v2h12v-2zm0-8H3v2h12V7zM3 13h18v-2H3v2zm0 8h18v-2H3v2zM3 3v2h18V3H3z"/></svg></Button>
          <Button id="align_center" disabled={activeBox === null ? true : false} active={align === 'center'} onClick={() => setInputValues({...inputValues, textAlign: 'center', changed: 'textAlign'})}><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px"><path d="M0 0h24v24H0z" fill="none"/><path d="M7 15v2h10v-2H7zm-4 6h18v-2H3v2zm0-8h18v-2H3v2zm4-6v2h10V7H7zM3 3v2h18V3H3z"/></svg></Button>
          <Button id="align_right" disabled={activeBox === null ? true : false} active={align === 'right'} onClick={() => setInputValues({...inputValues, textAlign: 'right', changed: 'textAlign'})}><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px"><path d="M0 0h24v24H0z" fill="none"/><path d="M3 21h18v-2H3v2zm6-4h12v-2H9v2zm-6-4h18v-2H3v2zm6-4h12V7H9v2zM3 3v2h18V3H3z"/></svg></Button>
        </span>
        {/* <Button id="align_right" disabled={activeBox === null ? true : false}></Button> */}
      </span>
      <span className="flex">
        <p>V Align</p>
        <span style={{display: 'flex', width: '102%'}}>
          <Button id="v_align_left" disabled={activeBox === null ? true : false} active={v_align === 'top'} onClick={() => setInputValues({...inputValues, textAlign: 'left', changed: 'textAlign'})}><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px"><path d="M0 0h24v24H0z" fill="none"/><path d="M8 11h3v10h2V11h3l-4-4-4 4zM4 3v2h16V3H4z"/></svg></Button>
          <Button id="v_align_center" disabled={activeBox === null ? true : false} active={v_align === 'center'} onClick={() => setInputValues({...inputValues, textAlign: 'center', changed: 'textAlign'})}><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px"><path d="M0 0h24v24H0z" fill="none"/><path d="M8 19h3v4h2v-4h3l-4-4-4 4zm8-14h-3V1h-2v4H8l4 4 4-4zM4 11v2h16v-2H4z"/></svg></Button>
          <Button id="v_align_right" disabled={activeBox === null ? true : false} active={v_align === 'bottom'} onClick={() => setInputValues({...inputValues, textAlign: 'right', changed: 'textAlign'})}><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px"><path d="M0 0h24v24H0z" fill="none"/><path d="M16 13h-3V3h-2v10H8l4 4 4-4zM4 19v2h16v-2H4z"/></svg></Button>
        </span>
        {/* <Button id="align_right" disabled={activeBox === null ? true : false}></Button> */}
      </span>
      <span className="flex">
        <p>Color</p>
        {/* <Input title="C" type="color" value={song.slides[active][activeBox]?.style?.color} disabled={activeBox === null ? true : false} /> */}
        {/* <input type="color" name="color" onInput={e => {setOptions({...options, color: e.target.value})}} /> */}
        <input type="color" name="color" onChange={e => changeText('color', e.target.value)} disabled={activeBox === null ? true : false} />
      </span>

      {/* <br />
      <input type="checkbox" name="" id="" onClick={e => {setOptions({...options, capitalize: e.target.checked})}} />
      <select>
        <option>Normal</option>
        <option>Capitalize</option>
        <option>Uppercase</option>
        <option>Lowercase</option>
      </select> */}

      <hr />

      <h3>Shadow</h3>
      <input type="text" name="color" />
      <label htmlFor="color">Shadow</label>
      <hr />

      <h3>Outline</h3>
      <input type="text" name="color" />
      <label htmlFor="color">Outline</label>

      {/* WIP: <button>Add text + Image + shapes++</button> */}

      {/* WIP: slide background++ / gradient */}

    </div>
  )
}

//Grab selected text
function getSelectedText() {
  if (window.getSelection) return window.getSelection();
  else if (document.getSelection) return document.getSelection();
  // else if (document.selection) return document.selection.createRange().text;
}