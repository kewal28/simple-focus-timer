const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  onTick: (cb) => ipcRenderer.on("tick", (_, seconds) => cb(seconds)),
  onCancelled: (cb) => ipcRenderer.on("cancelled", () => cb()),
  onGoalReached: (cb) => ipcRenderer.on("goal-reached", (_, reached) => cb(reached)),
  onGoalInfo: (cb) => ipcRenderer.on("goal-info", (_, info) => cb(info)),
  onTimerComplete: (cb) => ipcRenderer.on("timer-complete", (_, minutes) => cb(minutes)),
  cancelTimer: () => ipcRenderer.send("cancel-timer"),
  startTimer: (minutes) => ipcRenderer.send("start-timer", minutes),
});
