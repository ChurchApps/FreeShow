// import Preview from "./Preview";

import { createElement, useContext, useEffect, useState } from "react";
import { Context } from "../App";
import Resizable from "./Resizable";
import Slide from "./Slide";
import TextOptions from "./TextOptions";

export default function Editor({mouse}) {
  const [freeShow, setFreeShow] = useContext(Context);
  const [options, setOptions] = useState({
    capitalize: false,
  })
  let song = freeShow.songs[freeShow.activeSong];
  const [active, setActive] = useState(0);
  const [activeBox, setActiveBox] = useState(song.slides[active][0] ? 0 : null);
  const [helperLines, setHelperLines] = useState([]);

  // const [editorText, setEditorText] = useState()
  const [inputValues, setInputValues] = useState({
    // changed: null,
    left: song.slides[active][activeBox]?.style?.left,
    top: song.slides[active][activeBox]?.style?.top,
    width: song.slides[active][activeBox]?.style?.width,
    height: song.slides[active][activeBox]?.style?.height,
    textAlign: song.slides[active][activeBox]?.style?.textAlign
  })

  useEffect(() => {
    let key = inputValues.changed || null;
    console.log('KEY:', key);
    console.log(document.activeElement);
    if (key !== null) { //  && document.activeElement.id !== key
      if (song.slides[active][activeBox]) { // WIP
        // setInputValues()
        // newShow.songs[freeShow.activeSong].slides[active][id].style = inputValues[key];
        let val = inputValues[key];
        // if (key.includes('_')) key = 
        if (!isNaN(val)) val = Number(val);
        if (song.slides[active][activeBox].style === undefined) song.slides[active][activeBox].style = {};
        song.slides[active][activeBox].style[key] = val;
        console.log(key, val);
      }
    }
  }, [inputValues])

  useEffect(() => {
    if (!mouse.e?.target.closest('.textbox') && !mouse.e?.target.closest('.options')) {
      setActiveBox(null);
      if (window.getSelection) window.getSelection().removeAllRanges();
      else if (document.selection) document.selection.empty();
    }
  }, [mouse.e]);

  useEffect(() => {
    console.log(activeBox);
  }, [activeBox]);

  console.log(song, active);

  // TODO: this is not updating before second interaction
  // useEffect(() => {
  //   console.log('Change');
  // }, [freeShow])

  return (
    <div style={{display: 'flex'}}>
      <SlidesList active={active} setActive={setActive} />
      <Slide>
        {mouse.down && mouse.e.target.closest('.textbox') !== null && !mouse.e.target.closest('.editable') && helperLines.map((line, i) => {
          var style = {position: 'absolute', backgroundColor: 'var(--secondary)'};
          if (line[0] === 'x') style = {...style, width: '2px', height: '100%', left: line[1], top: 0}
          else style = {...style, width: '100%', height: '2px', left: 0, top: line[1]}
          return <div key={i} style={style}></div>
        })}
        {song.slides[active].map((textbox, i) => <Resizable key={i} active={active} mouse={mouse} options={options} id={i} activeBox={activeBox} setActiveBox={setActiveBox} inputValues={inputValues} setInputValues={setInputValues} style={textbox.style} setHelperLines={setHelperLines}>
          {console.log(textbox.text)}
          {textbox.text && textbox.text.map((text, i) => createElement(text.tag ? text.tag : 'span', {key: i, style: (text.style ? text.style : {})}, text.content))}
        </Resizable>)}
        {/* <Resizable options={options}>test</Resizable> */}
      </Slide>
      <TextOptions setOptions={setOptions} options={options} activeBox={activeBox} active={active} inputValues={inputValues} setInputValues={setInputValues} />
    </div>
  );
}








function SlidesList({active, setActive}) {
  const [freeShow, setFreeShow] = useContext(Context);
  let song = freeShow.songs[freeShow.activeSong];

  // WIP: default starting styles!
  function newSlide() {
    let newShow = freeShow;
    newShow.songs[freeShow.activeSong].slides.push([{text: [{content: 't'}], style: {top: 400, left: 500, height: 220, width: 900, textAlign: 'center'}}]);
    setFreeShow(newShow);
    setActive(song.slides.length - 1);
  }
  
  const style = {position: 'absolute', overflow: 'hidden', outline: 'none', height: 'inherit', whiteSpace: 'pre-wrap', overflowWrap: 'break-word'}

  return <div style={{display: 'flex', flexDirection: 'column'}}>
    {[...song.slides].map((slide, i) => (
      <Slide key={i} id={i} active={i === active ? true : false} setActive={setActive} zoom={.1}>
        {slide.map((textbox, j) => <div key={j} style={{...style, ...textbox.style}}>
          {textbox.text.map((text, i) => createElement(text.tag ? text.tag : 'span', {key: i, style: (text.style ? text.style : {})}, text.content))}
        </div>)}
      </Slide>
    ))}
    <button style={{fontWeight: 'bold', fontSize: '1.5em'}} onClick={newSlide}>+</button>
  </div>
}