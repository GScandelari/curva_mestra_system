# Icons Directory

This directory contains the PWA icons for Curva Mestra System.

## Required Icons

- `icon-192x192.png` - 192x192 pixels ⚠️ **MISSING**
- `icon-512x512.png` - 512x512 pixels ⚠️ **MISSING**
- `icon.svg` - SVG version ✅ **CREATED**

## Icon Design

The provided logo shows:
- **Background**: Dark blue (#2c3e50 or similar)
- **Logo**: Stylized "M" in white
- **Style**: Modern, rounded corners, professional

## How to Add the Missing Icons

1. **Save the provided image** as `icon-source.png` in this directory
2. **Resize to create required sizes:**
   - Create `icon-192x192.png` (192x192 pixels)
   - Create `icon-512x512.png` (512x512 pixels)

3. **Tools you can use:**
   - Online: [Favicon Generator](https://realfavicongenerator.net/)
   - Online: [PWA Builder](https://www.pwabuilder.com/imageGenerator)
   - Desktop: Photoshop, GIMP, Canva
   - Command line: ImageMagick

4. **ImageMagick commands** (if available):
   ```bash
   # Resize to 192x192
   magick icon-source.png -resize 192x192 icon-192x192.png
   
   # Resize to 512x512  
   magick icon-source.png -resize 512x512 icon-512x512.png
   ```

## Current Status

- ✅ `icon.svg` - Temporary SVG created
- ⚠️ `icon-192x192.png` - **NEEDS TO BE ADDED**
- ⚠️ `icon-512x512.png` - **NEEDS TO BE ADDED**
- ✅ `generate-icons.html` - Tool to create icons in browser

## Usage

These icons are referenced in:
- `manifest.json` - PWA icons for app installation
- `index.html` - Favicon and Apple touch icon
- Browser favorites and bookmarks
- Mobile home screen when app is installed

## Next Steps

1. Add the missing PNG files using the provided logo image
2. Test the PWA installation to ensure icons appear correctly
3. Verify icons display properly in browser tabs and bookmarks