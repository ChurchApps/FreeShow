import { useContext } from "react";
import { Context } from "../App";

export default function TextBox({style, children}) {
  const [freeShow, setFreeShow] = useContext(Context);

  if (!style) style = {left: freeShow.settings.resolution[0][0] / 6 + 'px', top: freeShow.settings.resolution [0][1] / 6 + 'px', width: freeShow.settings.resolution[0][0] / 1.5 + 'px', height: freeShow.settings.resolution[0][1] / 1.5 + 'px'}
  style = {...style, position: 'absolute'}

  return (
    <div style={style}>{children}</div>
  );
}