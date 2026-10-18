# 5. Build Stages (STAGE)

STAGE is where you lay out the characters, blocks, and backgrounds you drew in PIXEL to build the stages (levels) of your game.

<img src="assets/screenshots/STAGE画面.png" alt="STAGE screen" style="max-width:60%; min-width:312px; display:block; margin:16px 0; border:none; box-shadow:none; border-radius:0;">

<ul style="list-style:none; padding-left:0;">
<li>❶ <strong>Tile Palette</strong> … A list of tiles you can place on the stage.</li>
<li>❷ <strong>Tile Settings</strong> … Set the contents and behavior of the selected tile.</li>
<li>❸ <strong>Toolbar</strong> … Tools like place and erase.</li>
<li>❹ <strong>Canvas</strong> … Place tiles here to build your stage.</li>
<li>❺ <strong>Game Settings</strong> … Set stage size, BGM, sound effects, and more all in one place.</li>
</ul>

---

## Tile Palette

The Tile Palette lists the parts (tiles) you can place on a stage.

- **Pick a tile** … Tap it to select.
- **Open tile settings** … Tap the selected tile again to open its settings.
- **Add a new tile** … Press `＋` to add a new tile.
- **Tile types** … Tiles come in four kinds: **Player** / **Enemy** / **Block/BG** / **Item**.
- **Duplicate / Delete** … Long-press a tile to **Duplicate** or **Delete** it.

---

## Tile Settings panel

The Tile Settings panel is where you set the pixel, movement, and abilities of the selected tile. **The available options depend on the tile type.**

- **Pixel** … Assign a picture (made in PIXEL) to the tile.
- **Animation** … Set which frames play for actions like walking or jumping.
- **5-step gauges** … Set animation speed and each ability's strength on a 5-step gauge.
- **Grip (top of panel)** … Drag the grip at the top up or down to expand or shrink the panel.
- When you're done, press **Save** at the top to confirm.

---

## Toolbar

The tools on the left of the canvas let you switch how you place tiles.

<table class="tool-table">
<thead><tr><th></th><th>Name</th><th>What it does</th></tr></thead>
<tbody>
<tr><td><svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></td><td>Place</td><td>Place the selected tile in a cell</td></tr>
<tr><td><svg viewBox="0 0 24 24"><path d="M16.24 3.56l4.95 4.94c.78.79.78 2.05 0 2.84L12 20.53a4.008 4.008 0 01-5.66 0L2.81 17c-.78-.79-.78-2.05 0-2.84l10.6-10.6c.79-.78 2.05-.78 2.83 0zM4.22 15.58l3.54 3.53c.78.79 2.04.79 2.83 0l3.53-3.53-4.95-4.95-4.95 4.95z"/></svg></td><td>Eraser</td><td>Erase a placed tile (long-press to clear all)</td></tr>
<tr><td><svg viewBox="0 0 24 24"><path d="M16.56 8.94L7.62 0 6.21 1.41l2.38 2.38-5.15 5.15c-.59.59-.59 1.54 0 2.12l5.5 5.5c.29.29.68.44 1.06.44s.77-.15 1.06-.44l5.5-5.5c.59-.58.59-1.53 0-2.12zM5.21 10L10 5.21 14.79 10H5.21zM19 11.5s-2 2.17-2 3.5c0 1.1.9 2 2 2s2-.9 2-2c0-1.33-2-3.5-2-3.5z"/></svg></td><td>Fill</td><td>Replace all connected tiles of the same type at once</td></tr>
<tr><td><svg viewBox="0 0 24 24"><path d="M20.71 5.63l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-3.12 3.12-1.93-1.91-1.41 1.41 1.42 1.42L3 16.25V21h4.75l8.92-8.92 1.42 1.42 1.41-1.41-1.92-1.92 3.12-3.12c.4-.4.4-1.03.01-1.42zM6.92 19L5 17.08l8.06-8.06 1.92 1.92L6.92 19z"/></svg></td><td>Eyedropper</td><td>Pick a tile from the canvas as your active tile</td></tr>
<tr><td><svg viewBox="0 0 24 24"><path d="M12.5 8c-2.65 0-5.05 1.04-6.82 2.75L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg></td><td>Undo</td><td>Undo your last action</td></tr>
<tr><td><svg viewBox="0 0 640 640"><path d="M352 96C352 78.3 337.7 64 320 64C302.3 64 288 78.3 288 96L288 304C288 312.8 280.8 320 272 320C263.2 320 256 312.8 256 304L256 128C256 110.3 241.7 96 224 96C206.3 96 192 110.3 192 128L192 400C192 401.5 192 403.1 192.1 404.6L131.6 347C115.6 331.8 90.3 332.4 75 348.4C59.7 364.4 60.4 389.7 76.4 405L188.8 512C231.9 553.1 289.2 576 348.8 576L368 576C465.2 576 544 497.2 544 400L544 192C544 174.3 529.7 160 512 160C494.3 160 480 174.3 480 192L480 304C480 312.8 472.8 320 464 320C455.2 320 448 312.8 448 304L448 128C448 110.3 433.7 96 416 96C398.3 96 384 110.3 384 128L384 304C384 312.8 376.8 320 368 320C359.2 320 352 312.8 352 304L352 96z"/></svg></td><td>Hand</td><td>Grab the canvas with your finger to move it around</td></tr>
<tr><td><svg viewBox="0 0 24 24"><path d="M3 5h2V3c-1.1 0-2 .9-2 2zm0 8h2v-2H3v2zm4 8h2v-2H7v2zM3 9h2V7H3v2zm10-6h-2v2h2V3zm6 0v2h2c0-1.1-.9-2-2-2zM5 21v-2H3c0 1.1.9 2 2 2zm-2-4h2v-2H3v2zM9 3H7v2h2V3zm2 18h2v-2h-2v2zm8-8h2v-2h-2v2zm0 8c1.1 0 2-.9 2-2h-2v2zm0-12h2V7h-2v2zm0 8h2v-2h-2v2zm-4 4h2v-2h-2v2zm0-16h2V3h-2v2z"/></svg></td><td>Select</td><td>Select an area to move or copy</td></tr>
<tr><td><svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg></td><td>Copy</td><td>Copy the selected area</td></tr>
<tr><td><svg viewBox="0 0 24 24"><path d="M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z"/></svg></td><td>Paste</td><td>Paste what you copied</td></tr>
<tr><td><svg viewBox="0 0 24 24"><path d="M15 21h2v-2h-2v2zm4-12h2V7h-2v2zM3 5v14c0 1.1.9 2 2 2h4v-2H5V5h4V3H5c-1.1 0-2 .9-2 2zm16-2v2h2c0-1.1-.9-2-2-2zm-8 20h2V1h-2v22zm8-6h2v-2h-2v2zM15 5h2V3h-2v2zm4 8h2v-2h-2v2zm0 8c1.1 0 2-.9 2-2h-2v2z"/></svg></td><td>Flip V</td><td>Flip the selected area upside-down</td></tr>
<tr><td><svg viewBox="0 0 24 24"><path d="M15 21h2v-2h-2v2zm4-12h2V7h-2v2zM3 5v14c0 1.1.9 2 2 2h4v-2H5V5h4V3H5c-1.1 0-2 .9-2 2zm16-2v2h2c0-1.1-.9-2-2-2zm-8 20h2V1h-2v22zm8-6h2v-2h-2v2zM15 5h2V3h-2v2zm4 8h2v-2h-2v2zm0 8c1.1 0 2-.9 2-2h-2v2z"/></svg></td><td>Flip H</td><td>Flip the selected area left-to-right</td></tr>
</tbody>
</table>

---

## Canvas

The Canvas is where you place tiles to build your stage.

- Drag your finger on the screen to place the tile you selected in the Tile Palette.
- Made a mistake? Use **Undo** to step back, or the **Eraser** to remove tiles.
- With the **Hand** tool, grab the canvas to move your view. (Two-finger drag also works.)

---

## Game Settings

Press **▼ Game Settings** at the top of the screen to open it. Here you can set stage-wide rules and sounds all in one place.

- **Stage Size** … One screen = 16×16 cells. Adding more cells connects screens horizontally or vertically to build a bigger stage.
- **BG Color** … Change the background color of the stage.
- **Base Rule** … Pick one: None / Defeat Enemies / Survival. If Clear Items or a Boss are placed on the stage, achieving any of them will also clear the stage (except in Survival mode, which only clears by surviving the time limit).
- **Time Limit** … Set a limit in minutes and seconds (0 means no limit).
- **Show Score** … Toggle the score display during play.
- **BGM** … Assign the Stage / Invincible / Clear / Game Over / Boss BGM tracks.
- **Sound Effects** … Pick effects per category: player, item pickup, environment.
