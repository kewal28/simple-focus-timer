const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  Notification,
  nativeImage,
  ipcMain,
  shell,
  dialog,
} = require("electron");
const path = require("path");
const fs = require("fs");
const Store = require("electron-store");
const store = new Store();

let win,
  tray,
  countdownInterval = null,
  endAt = null,
  selectedMinutes = 60;

let appIconNative = null; // NativeImage used for notifications/about/dock

function isWindowValid() {
  return win && !win.isDestroyed();
}

function ensureWindow() {
  if (!isWindowValid()) {
    createWindow();
  } else {
    // refresh alwaysOnTop in case system changed
    win.setAlwaysOnTop(true);
  }
  win.show();
  win.focus();
  return win;
}

function safeSend(channel, ...args) {
  if (isWindowValid()) {
    try {
      win.webContents.send(channel, ...args);
    } catch (e) {
      // recreate and retry once
      ensureWindow();
      try { win.webContents.send(channel, ...args); } catch {}
    }
  } else {
    ensureWindow();
    try { win.webContents.send(channel, ...args); } catch {}
  }
}

function createAppIconNativeImage(size = 256) {
  // Create a simple round purple icon programmatically
  const buffer = Buffer.alloc(size * size * 4);
  const center = size / 2;
  const radius = size / 2 - 8; // padding
  const R = 118, G = 75, B = 162; // #764ba2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - center;
      const dy = y - center;
      const idx = (y * size + x) * 4;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= radius) {
        buffer[idx] = R;
        buffer[idx + 1] = G;
        buffer[idx + 2] = B;
        buffer[idx + 3] = 255;
      } else {
        buffer[idx + 3] = 0; // transparent
      }
    }
  }
  return nativeImage.createFromBuffer(buffer, { width: size, height: size });
}

function ensureAppIconFile() {
  try {
    const iconPath = path.join(app.getPath("userData"), "appIcon.png");
    if (!fs.existsSync(iconPath)) {
      const img = appIconNative || createAppIconNativeImage(256);
      const png = img.toPNG();
      fs.writeFileSync(iconPath, png);
    }
    return iconPath;
  } catch (e) {
    return undefined;
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 240,
    height: 200,
    alwaysOnTop: true,
    frame: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: false,
    title: "Simple Focus Timer",
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  win.loadFile("index.html");

  // Show a welcome message
  win.webContents.on("did-finish-load", () => {
    safeSend("tick", 0);
    checkAndNotifyGoal();
  });

  win.on("closed", () => {
    win = null;
  });
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function doneToday() {
  return store.get(`counts.${todayKey()}`, 0) || 0;
}

function productiveTimeToday() {
  return store.get(`productiveTime.${todayKey()}`, 0) || 0;
}

function formatProductiveTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = (minutes / 60).toFixed(2);
  return `${hours} hour${hours !== "1.00" ? "s" : ""}`;
}

function incIfProductive() {
  const prod = store.get("productiveBlockMinutes", 60);
  if (selectedMinutes === prod) {
    const k = `counts.${todayKey()}`;
    store.set(k, doneToday() + 1);
    // Track total productive time in seconds
    const timeKey = `productiveTime.${todayKey()}`;
    const currentTime = store.get(timeKey, 0) || 0;
    store.set(timeKey, currentTime + (selectedMinutes * 60));
    checkAndNotifyGoal();
  }
}

function checkAndNotifyGoal() {
  const dailyGoal = store.get("dailyGoal", 4);
  const done = doneToday();
  const reached = done >= dailyGoal;
  const productiveTime = productiveTimeToday();
  const formattedTime = formatProductiveTime(productiveTime);
  
  safeSend("goal-reached", reached);
  // Also send detailed goal info for motivational UI
  safeSend("goal-info", {
    done,
    dailyGoal,
    reached,
    remaining: Math.max(0, dailyGoal - done),
    productiveTime,
    formattedTime,
  });
  return reached;
}

function updateTrayTitle() {
  const dailyGoal = store.get("dailyGoal", 4);
  const progress = `${doneToday()}/${dailyGoal}`;
  if (countdownInterval) {
    const left = Math.max(0, Math.round((endAt - Date.now()) / 1000));
    const mm = String(Math.floor(left / 60)).padStart(2, "0");
    const ss = String(left % 60).padStart(2, "0");
    tray.setTitle(`${mm}:${ss} • ${progress}`); // macOS supports text tray titles
  } else {
    tray.setTitle(progress);
  }
}

function startTimer(mins) {
  if (countdownInterval) return;
  selectedMinutes = mins ?? selectedMinutes;
  endAt = Date.now() + selectedMinutes * 60_000;

  // show window
  ensureWindow();
  win.setAlwaysOnTop(true);
  updateTrayMenu(); // Update menu to enable cancel button

  countdownInterval = setInterval(() => {
    const left = endAt - Date.now();
    if (left <= 0) {
      clearInterval(countdownInterval);
      countdownInterval = null;
      // Notify renderer before final tick so it can play sound
      safeSend("timer-complete", selectedMinutes);
      safeSend("tick", 0);
      incIfProductive();
      updateTrayMenu(); // Update menu after timer ends
      try {
        new Notification({
          title: "Focus done!",
          body: `${selectedMinutes} min complete`,
          icon: appIconNative || undefined,
        }).show();
      } catch {}
    } else {
      safeSend("tick", Math.ceil(left / 1000));
      updateTrayTitle();
    }
  }, 1000);
}

function cancelTimer() {
  if (!countdownInterval) return;
  clearInterval(countdownInterval);
  countdownInterval = null;
  endAt = null;
  safeSend("cancelled");
  updateTrayTitle();
  updateTrayMenu(); // Update menu to disable cancel button
}

function setProductiveBlock(m) {
  const oldBlock = store.get("productiveBlockMinutes", 60);
  // If user changes productive block, reset today's count and time
  if (oldBlock !== m) {
    const k = `counts.${todayKey()}`;
    const timeKey = `productiveTime.${todayKey()}`;
    store.set(k, 0);
    store.set(timeKey, 0);
  }
  store.set("productiveBlockMinutes", m);
  updateTrayMenu();
  checkAndNotifyGoal();
}

function setDailyGoal(g) {
  store.set("dailyGoal", g);
  updateTrayMenu();
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: "Start 1m", click: () => startTimer(1) },
    { label: "Start 5m", click: () => startTimer(5) },
    { label: "Start 10m", click: () => startTimer(10) },
    { label: "Start 30m", click: () => startTimer(30) },
    { label: "Start 60m", click: () => startTimer(60) },
    { type: "separator" },
    {
      label: "Productive block (mins)",
      submenu: [1, 5, 10, 30, 60].map((m) => ({
        label: `${m}`,
        type: "radio",
        checked: store.get("productiveBlockMinutes", 60) === m,
        click: () => setProductiveBlock(m),
      })),
    },
    {
      label: "Daily goal",
      submenu: [1, 2, 3, 4, 5, 6, 8, 10].map((g) => ({
        label: `${g}`,
        type: "radio",
        checked: store.get("dailyGoal", 4) === g,
        click: () => setDailyGoal(g),
      })),
    },
    { type: "separator" },
    {
      label: "About Simple Focus Timer",
      click: () => {
        const iconPath = ensureAppIconFile();
        app.setAboutPanelOptions({
          applicationName: "Simple Focus Timer",
          applicationVersion: "1.0.0",
          version: "1.0.0",
          copyright: "© 2025 BillingPie",
          website: "https://github.com/kewal28/simple-focus-timer",
          iconPath,
          credits: "A minimalist macOS menu bar focus timer with daily goal tracking.\nOpen Source: MIT License",
        });
        app.showAboutPanel();
      },
    },
    { type: "separator" },
    { label: "Quit", role: "quit" },
  ]);
}

function createTray() {
  // Create a clean clock icon for macOS menu bar
  const size = 16;
  const buffer = Buffer.alloc(size * size * 4);
  const center = 8;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - center + 0.5;
      const dy = y - center + 0.5;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const idx = (y * size + x) * 4;
      let draw = false;

      // Clock circle outline (radius 5-6)
      if (distance >= 5 && distance <= 6) {
        draw = true;
      }
      // Hour hand - vertical line up (width 1px, length 3px)
      else if (x === 8 && y >= 5 && y <= 7) {
        draw = true;
      }
      // Minute hand - diagonal to 1-2 o'clock (thinner, longer)
      else if (
        (x === 9 && y === 7) || 
        (x === 10 && y === 6) ||
        (x === 11 && y === 5)
      ) {
        draw = true;
      }
      // Center dot
      else if (distance <= 1) {
        draw = true;
      }

      if (draw) {
        buffer[idx] = 0;     // R
        buffer[idx + 1] = 0; // G
        buffer[idx + 2] = 0; // B
        buffer[idx + 3] = 255; // A
      } else {
        buffer[idx + 3] = 0; // transparent
      }
    }
  }

  const img = nativeImage.createFromBuffer(buffer, {
    width: size,
    height: size,
  });
  img.setTemplateImage(true);

  tray = new Tray(img);
  tray.setToolTip("Simple Focus Timer");
  updateTrayMenu();

  console.log("Tray created successfully");
}

function updateTrayMenu() {
  tray.setContextMenu(buildTrayMenu());
  updateTrayTitle();
}

app.whenReady().then(() => {
  // Prepare native icon
  appIconNative = createAppIconNativeImage(256);
  // Show custom icon in dock temporarily for notification usage (macOS may require dock icon to pick custom graphic)
  if (app.dock && appIconNative) {
    app.dock.setIcon(appIconNative);
  }
  createWindow();
  createTray();

  // Handle cancel timer from window
  ipcMain.on("cancel-timer", () => {
    cancelTimer();
  });

  // Handle start timer from window
  ipcMain.on("start-timer", (event, minutes) => {
    startTimer(minutes);
  });

  // Optionally hide dock icon after a delay to allow system to register icon
  if (app.dock) {
    setTimeout(() => {
      try { app.dock.hide(); } catch {}
    }, 800);
  }

  console.log("=".repeat(50));
  console.log("Simple Focus Timer is running!");
  console.log("Look for the timer icon in your menu bar (top-right)");
  console.log("Click it to start a focus session");
  console.log("=".repeat(50));
});

app.on("window-all-closed", () => {
  // Keep app alive so tray stays
});

// Right-click on dock icon to access menu too
app.on("activate", () => {
  if (tray) {
    tray.popUpContextMenu();
  }
});
