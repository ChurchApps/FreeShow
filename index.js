const { app, BrowserWindow, Menu, MenuItem, ipcMain, dialog, desktopCapturer } = require("electron");
const path = require("path");
const fs = require("fs");
const Store = require("./Store");
// const express = express();
// const express = require("./server/connection");

// WIP: Tray / push notifications
// https://www.webtips.dev/how-to-make-your-very-first-desktop-app-with-electron-and-svelte

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;



// First instantiate the class
const store = new Store({
  // We'll call our data file 'user-preferences'
  configName: 'storage',
  defaults: {
    // 800x600 is the default size of our window
    windowBounds: { width: 800, height: 600 },
    maximized: true
  }
});



app.on("ready", () => {
  let { width, height } = store.get('windowBounds');
  let maximized = store.get('maximized');

  // https://gist.github.com/maximilian-lindsey/a446a7ee87838a62099d
  // const LANserver = 
  require("./server/connection")

  mainWindow = new BrowserWindow({
    width,
    height,
    webPreferences: {
      // preload: `${__dirname}/preload.js`
      preload: path.join(__dirname, "preload.js"), // use a preload script
      // nodeIntegration: false, // is default value after Electron v5
      // contextIsolation: true, // protect against prototype pollution
      // enableRemoteModule: false, // turn off remote
      sandbox: true
    },
  });
  
  mainWindow.on('maximize', () => store.set('maximized', true));
  mainWindow.on('unmaximize', () => store.set('maximized', false));
  mainWindow.on('resize', () => {
    let { width, height } = mainWindow.getBounds();
    store.set('windowBounds', { width, height });
  });

  mainWindow.loadFile("./public/index.html");
  // mainWindow.loadFile(path.join(__dirname, "index.html"));
  // win.loadFile(path.join(__dirname, "dist/index.html"));
  mainWindow.webContents.openDevTools();

  if (maximized) mainWindow.maximize();




  // https://www.electronjs.org/docs/api/menu
  // const menu = new Menu();

  // menu.append(
  //   new MenuItem({
  //     label: "Save",
  //     accelerator: "CmdOrCtrl+S",
  //     click: () => toApp("savefile"),
  //   })
  // );
  // menu.append(
  //   new MenuItem({
  //     label: "Open",
  //     accelerator: "CmdOrCtrl+O",
  //     click: openFile,
  //   })
  // );  
  // menu.append(
  //   new MenuItem({
  //     role: "reload",
  //     accelerator: "CmdOrCtrl+R",
  //   })
  // );  

  // Menu.setApplicationMenu(menu);


  // ipcMain.on('show-context-menu', (event) => {
  //   const template = [
  //     {
  //       role: 'reload'
  //     },
  //   ]
  //   const menu = Menu.buildFromTemplate(template)
  //   menu.popup(BrowserWindow.fromWebContents(event.sender))
  // })


  


  // ipcMain.on("savenewfile", (e, content) => {
  //   createNewFile(content);
  // });
  // ipcMain.on("saveexistingfile", (e, { path, content }) => {
  //   fs.writeFile(path, content, err => {
  //     if (err) return;
  //   });
  // });



  // function createNewFile(content) {
  //   dialog
  //     .showSaveDialog(mainWindow, {
  //       title: "Create New File",
  //       properties: ["showOverwriteConfirmation"],
  //       filters: [
  //         {
  //           name: "Markdown Files",
  //           extensions: ["md"],
  //         },
  //       ],
  //     })
  //     .then(({ canceled, filePath }) => {
  //       if (canceled) return;
  
  //       fs.writeFile(filePath, content, err => {
  //         if (err) return;

  //         toApp("fileopened", {
  //           path: filePath,
  //           content
  //         });
  //       });
  //     });
  // };





  // function openFile(filters = [{ name: "All", extensions: ["*"] }]) {
  //   const file = dialog.showOpenDialogSync(mainWindow, {
  //     properties: ["openFile"],
  //     filters: filters,
  //     title: 'Ayy',
  //     message: 'test message'
  //   });
  
  //   if (file) {
  //     fs.readFile(file[0], "utf8", (err, data) => {
  //       if (err) return;
  
  //       toApp("fileopened", {
  //         path: file[0],
  //         content: data,
  //       });
  //     });
  //   }
  // };
  
});

app.on("window-all-closed", () => {
  app.quit();
});




exports.toApp = (channel, args) => mainWindow.webContents.send(channel, args);




// ipcMain.handle("displayMessage", text => dialog.showMessageBox(text))


const os = require('os');
ipcMain.on('main', (e, args) => {
  if (args === 'getOS') e.reply('main', {id: 'os', data: os.hostname()});
  else {
    toApp('main', args);
    // fs.readFile("path/to/file", (error, data) => {
    //   // Do something with file contents
  
    //   // Send result back to renderer process
    //   toApp('main', {data, error});
    // });
  }
});



ipcMain.on('getScreens', (e, args) => {
  desktopCapturer.getSources({ types: ['window', 'screen'] }).then(async sources => {
    try {
      const screens = [];
      sources.map(source => screens.push({name: source.name, id: source.id}));
      toApp('getScreens', screens);

      // const videoOptionsMenu = Menu.buildFromTemplate(
      //   sources.map(source => {
      //     return {
      //       label: source.name,
      //       click: () => toApp('getScreens', source)
      //     }
      //   })
      // );
      
      // videoOptionsMenu.popup();
    } catch (e) {
      console.error('Error:', e);
    }
  })
});


ipcMain.on('openFile', (e, args) => {
  // toApp('main', args);

  if (!args.filters) args.filters = [{ name: "All", extensions: ["*"] }];
  if (!args.title) args.title = 'Test';
  
  const file = dialog.showOpenDialogSync(mainWindow, {
    properties: ["openFile"],
    filters: args.filters,
    title: args.title
  });

  if (file) {
    toApp('main', file);
    // server(file);
    // toApp("openFile", {
    //   path: chunk(file),
    //   // content: data,
    // });
    // toApp('openFile', "./video");
    toApp('openFile', file);
    // fs.readFile(file[0], "utf8", (err, data) => {
    //   toApp('main', err);
    //   toApp('main', data);
    //   if (err) return;

    //   toApp("openFile", {
    //     path: chunk(path),
    //     // content: data,
    //   });

    //   // toApp("openFile", {
    //   //   path: file[0],
    //   //   // content: data,
    //   // });
    // });
  }
  // fs.readFile(args.path, (error, data) => {
  //   // Do something with file contents

  //   // Send result back to renderer process
  //   toApp("openedFile", {data, error});
  // });
})








// server
// express.use(express.static(path.join(__dirname, 'public')))

// express.get('/', function(req, res) {
//   res.sendFile(path.join(__dirname + '/index.htm'))
// })

function server(path) {
  express.get('/video', function(req, res) {
    const stat = fs.statSync(path)
    const fileSize = stat.size
    const range = req.headers.range
  
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-")
      const start = parseInt(parts[0], 10)
      const end = parts[1]
        ? parseInt(parts[1], 10)
        : fileSize-1
  
      if(start >= fileSize) {
        res.status(416).send('Requested range not satisfiable\n'+start+' >= '+fileSize);
        return
      }
      
      const chunksize = (end-start)+1
      const file = fs.createReadStream(path, {start, end})
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      }
  
      res.writeHead(206, head)
      file.pipe(res)
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      }
      res.writeHead(200, head)
      fs.createReadStream(path).pipe(res)
    }
  })
}

// express.listen(3000, function () {
//   console.log('Listening on port 3000!')
// })


// function chunk(path) {
//   const stat = fs.statSync(path)
//   const fileSize = stat.size
//   const range = req.headers.range

//   if (range) {
//     const parts = range.replace(/bytes=/, "").split("-")
//     const start = parseInt(parts[0], 10)
//     const end = parts[1]
//       ? parseInt(parts[1], 10)
//       : fileSize-1

//     if(start >= fileSize) {
//       res.status(416).send('Requested range not satisfiable\n'+start+' >= '+fileSize);
//       return
//     }
    
//     const chunksize = (end-start)+1
//     const file = fs.createReadStream(path, {start, end})
//     const head = {
//       'Content-Range': `bytes ${start}-${end}/${fileSize}`,
//       'Accept-Ranges': 'bytes',
//       'Content-Length': chunksize,
//       'Content-Type': 'video/mp4',
//     }

//     // res.writeHead(206, head)
//     // file.pipe(res)
//     return file
//   } else {
//     const head = {
//       'Content-Length': fileSize,
//       'Content-Type': 'video/mp4',
//     }
//     // res.writeHead(200, head)
//     // fs.createReadStream(path).pipe(res)
//     return fs.createReadStream(path)
//   }
// }