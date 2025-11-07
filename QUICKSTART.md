# Quick Start Guide - Simple Focus Timer

## 🚀 30-Second Setup

### For Users
```bash
# Download the .dmg, install, and run!
# Look for the timer icon in your menu bar
```

### For Developers
```bash
# Clone and run
git clone https://github.com/kewal28/simple-focus-timer.git
cd simple-focus-timer
npm install
npm start
```

That's it! The app will appear in your menu bar.

---

## 📋 Quick Reference

### Start the App
```bash
npm start
```

### Build DMG
```bash
npm run build
# Output: dist/Simple Focus Timer-1.0.0.dmg
```

### File Structure
```
main.js       → Main app logic & menu bar
index.html    → Timer window UI  
preload.js    → Security bridge
package.json  → Config & dependencies
icon.svg      → App icon
```

### Key Features to Test
1. Click menu bar icon → Select timer
2. Timer window appears with countdown
3. Click "Cancel" in window
4. Menu shows progress (e.g., "2/4")
5. Complete daily goal → See celebration

### Making Changes

**Change timer durations:**
Edit `main.js` → `buildTrayMenu()` function

**Change UI colors:**
Edit `index.html` → `<style>` section

**Change window size:**
Edit `main.js` → `createWindow()` function

**Change icon:**
Replace `icon.svg` and rebuild

### Common Commands
```bash
npm start              # Run dev mode
npm run build          # Build DMG
rm -rf node_modules    # Clean install
npm install            # Reinstall deps
```

### Troubleshooting
- **App won't start**: Check terminal for errors
- **Icon not showing**: Rebuild with `npm run build`
- **Build fails**: Delete node_modules, reinstall
- **Menu not updating**: Quit app, clear cache, restart

### Resources
- Full docs: [README.md](README.md)
- Build guide: [BUILD.md](BUILD.md)
- Contributing: [CONTRIBUTING.md](CONTRIBUTING.md)

---

**Need help?** Open an issue on GitHub!
