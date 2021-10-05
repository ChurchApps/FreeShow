console.log(1);
var socket = io();

socket.emit('message', 'hi!');

socket.on('data', data => {
  document.querySelector('.name').innerText = data.name;
});

document.querySelector('button').addEventListener('click', () => socket.emit('client1', 'this is some data from client!'));



const getUA = () => {
  let device = "Unknown";
  const ua = {
      "Generic Linux": /Linux/i,
      "Android": /Android/i,
      "BlackBerry": /BlackBerry/i,
      "Bluebird": /EF500/i,
      "Chrome OS": /CrOS/i,
      "Datalogic": /DL-AXIS/i,
      "Honeywell": /CT50/i,
      "iPad": /iPad/i,
      "iPhone": /iPhone/i,
      "iPod": /iPod/i,
      "macOS": /Macintosh/i,
      "Windows": /IEMobile|Windows/i,
      "Zebra": /TC70|TC55/i,
  }
  Object.keys(ua).map(v => navigator.userAgent.match(ua[v]) && (device = v));
  return device;
}
