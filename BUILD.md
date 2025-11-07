# Build Guide for Simple Focus Timer

This guide walks you through building a production-ready `.dmg` file for distribution.

## Prerequisites

### 1. Install Node.js and npm

```bash
# Check if already installed
node --version
npm --version

# If not installed, download from https://nodejs.org/
# Or use Homebrew:
brew install node
```

### 2. Install Xcode Command Line Tools

```bash
xcode-select --install
```

### 3. Verify macOS Version

- Recommended: macOS 11.0 (Big Sur) or later
- Check your version: Apple menu → About This Mac

## Building the App

### Step 1: Clone/Download the Repository

```bash
# If using git
git clone https://github.com/kewal28/simple-focus-timer.git
cd simple-focus-timer

# Or download and extract the ZIP file
```

### Step 2: Install Dependencies

```bash
npm install
```

This installs:
- Electron framework
- electron-builder (for packaging)
- electron-store (for settings persistence)

### Step 3: Test in Development Mode

Before building, test that everything works:

```bash
npm start
```

You should see:
- The app icon in your menu bar
- Timer window when you start a session
- No errors in the terminal

Press `Ctrl+C` to stop.

### Step 4: Build Production DMG

```bash
npm run build
```

**Build Process:**
1. Packages the Electron app
2. Creates app bundle with icon
3. Code signs (if certificates available)
4. Generates DMG installer
5. Outputs to `dist/` directory

**Time:** Usually 1-3 minutes

**Output Location:**
```
dist/
├── Simple Focus Timer-1.0.0.dmg          # The installer
├── Simple Focus Timer-1.0.0-mac.zip      # Zipped app
└── mac/Simple Focus Timer.app/           # Raw app bundle
```

### Step 5: Test the Built DMG

```bash
# Open the dist folder
open dist/

# Double-click the .dmg file to test installation
```

## Distribution

### Option 1: GitHub Releases (Recommended)

1. Create a new release on GitHub
2. Upload the `.dmg` file
3. Write release notes
4. Publish!

Users can download directly from GitHub.

### Option 2: Direct Distribution

Share the `.dmg` file via:
- Dropbox / Google Drive
- Your website
- Email (if small enough)

**Note:** Users may see "unidentified developer" warning on first launch (see Code Signing below).

## Code Signing (Optional but Recommended)

For distribution without warnings:

### Get Apple Developer Account
- Enroll at https://developer.apple.com
- Cost: $99/year

### Get Developer ID Certificate

1. Open Xcode
2. Preferences → Accounts → Add Apple ID
3. Manage Certificates → Create "Developer ID Application"

### Update package.json

Add to build configuration:

```json
"build": {
  "mac": {
    "identity": "Developer ID Application: Your Name (TEAM_ID)",
    "hardenedRuntime": true,
    "gatekeeperAssess": false,
    "entitlements": "entitlements.mac.plist",
    "entitlementsInherit": "entitlements.mac.plist"
  }
}
```

### Create entitlements.mac.plist

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
</dict>
</plist>
```

### Notarize (Required for macOS 10.15+)

```bash
# After building
xcrun notarytool submit dist/Simple\ Focus\ Timer-1.0.0.dmg \
  --apple-id your@email.com \
  --team-id TEAM_ID \
  --password app-specific-password \
  --wait

# Staple the ticket
xcrun stapler staple dist/Simple\ Focus\ Timer-1.0.0.dmg
```

## Troubleshooting

### Build Fails with "Cannot find module"

```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Icon Not Showing

- Verify `icon.svg` exists in root directory
- electron-builder auto-converts SVG to ICNS
- Check build logs for icon conversion errors

### App Won't Start After Build

Test the app bundle directly:
```bash
open dist/mac/Simple\ Focus\ Timer.app
```

Check Console.app for error messages.

### DMG Creation Fails

- Ensure no other apps are using port 5000
- Close any open Finder windows
- Try building again

### "Unidentified Developer" Warning

For testing:
```bash
# Right-click app → Open (instead of double-click)
# Or remove quarantine:
xattr -cr dist/mac/Simple\ Focus\ Timer.app
```

For distribution: Code sign and notarize (see above)

## Build Configuration

### Customize in package.json

```json
"build": {
  "appId": "com.yourname.focus",           // Unique identifier
  "productName": "Your Timer Name",         // Display name
  "mac": {
    "category": "public.app-category.productivity",
    "icon": "icon.svg",                     // Icon file
    "target": "dmg"                         // Output format
  },
  "dmg": {
    "title": "Your Timer Name",
    "icon": "icon.svg",
    "background": "background.png",         // Optional
    "window": {
      "width": 540,
      "height": 380
    }
  }
}
```

### Build for Different Targets

```bash
# DMG only (default)
npm run build

# ZIP only
npm run build -- --mac zip

# Both DMG and ZIP
npm run build -- --mac dmg zip
```

## CI/CD Automation (Advanced)

### GitHub Actions Example

Create `.github/workflows/build.yml`:

```yaml
name: Build
on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install
      - run: npm run build
      - uses: actions/upload-artifact@v3
        with:
          name: dmg
          path: dist/*.dmg
```

## File Size Optimization

Typical size: ~150-200 MB (due to Electron)

To reduce:
- Remove unused dependencies
- Use `asar` archive (automatic with electron-builder)
- Compress assets

## Version Management

Update version in `package.json`:

```json
{
  "version": "1.0.0"  // Increment for each release
}
```

Follows Semantic Versioning:
- `1.0.0` → `1.0.1` (bug fixes)
- `1.0.0` → `1.1.0` (new features)
- `1.0.0` → `2.0.0` (breaking changes)

## Auto-Updates (Future Enhancement)

Consider implementing with:
- electron-updater
- GitHub Releases as update server
- Automatic background updates

## Need Help?

- Check [electron-builder docs](https://www.electron.build/)
- Review [Electron docs](https://www.electronjs.org/docs)
- Open an issue on GitHub

---

**Happy Building! 🚀**
