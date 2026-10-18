# 6. Add Music (BGM)

BGM is where you compose the music that plays in your game. Make your tracks here, then assign them in Game Settings to scenes like the stage, clear jingle, or game over.

<img src="assets/screenshots/BGM画面.png" alt="BGM screen" style="max-width:60%; min-width:312px; display:block; margin:16px 0; border:none; box-shadow:none; border-radius:0;">

<ul style="list-style:none; padding-left:0;">
<li>❶ <strong>Song Bar</strong> … Pick a BGM, set tempo and length.</li>
<li>❷ <strong>Track Panel</strong> … Set tone, volume, and pan for the four tracks.</li>
<li>❸ <strong>Canvas</strong> … Place notes to compose your BGM.</li>
<li>❹ <strong>Toolbar</strong> … Tools like place and erase for notes.</li>
<li>❺ <strong>Keyboard</strong> … A keyboard that plays notes as you input them.</li>
<li>❻ <strong>Play Bar</strong> … Playback, recording, and position controls.</li>
</ul>

---

## Song Bar

The Song Bar is where you handle settings for each BGM.

- **Pick a BGM** … Use `⌄` to switch between BGMs.
- **Rename a BGM** … Tap the BGM name to change it.
- **Add a new BGM** … Press `＋` to add a new one.
- **Delete a BGM** … The trash button deletes the currently selected BGM.
- **Tempo** … Set the speed of the BGM. Drag the number up or down, or tap it to type a value.
- **Steps** … Set the length of the BGM (number of cells). Drag the number up or down, or tap it to type a value.

---

## Track Panel

The Track Panel is where you set the tone and volume of each track.
Following the Famicom tradition, FAMITORY uses these four tracks:

- **Pulse (Square)** … Great for melodies. (There are two of these.)
- **Triangle** … Suited for bass (low notes).
- **Noise** … Suited for drums and rhythm.

<br>

- **Pick a track** … Tap a track to switch the canvas view and the keyboard's sound to that track.
- **Pick a tone** … Long-press a track to choose which tone it uses.
- **Volume** … Move the knob to change the loudness per track.
- **Pan** … Decide whether the sound comes from the left or the right.
- **Mute** … Tap the selected track again to mute it.

---

## Canvas

The Canvas is where you place notes to compose your BGM. The vertical axis is pitch (how high the note is), and the horizontal axis is time (steps).

- **Place a note** … Tap a cell to place a note there.
- **Extend a note** … Drag the right edge of a note to change its length.
- **Erase a note** … Switch to the Eraser and tap to remove it.
- **Switch tracks** … Change the track you're editing from the Track Panel.

---

## Toolbar

The tools next to the canvas let you switch how you place notes.

<table class="tool-table">
<thead><tr><th></th><th>Name</th><th>What it does</th></tr></thead>
<tbody>
<tr><td><svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></td><td>Pen</td><td>Place a note in the tapped cell</td></tr>
<tr><td><svg viewBox="0 0 24 24"><path d="M16.24 3.56l4.95 4.94c.78.79.78 2.05 0 2.84L12 20.53a4.008 4.008 0 01-5.66 0L2.81 17c-.78-.79-.78-2.05 0-2.84l10.6-10.6c.79-.78 2.05-.78 2.83 0zM4.22 15.58l3.54 3.53c.78.79 2.04.79 2.83 0l3.53-3.53-4.95-4.95-4.95 4.95z"/></svg></td><td>Eraser</td><td>Remove a placed note (long-press to clear all)</td></tr>
<tr><td><svg viewBox="0 0 640 640"><path d="M352 96C352 78.3 337.7 64 320 64C302.3 64 288 78.3 288 96L288 304C288 312.8 280.8 320 272 320C263.2 320 256 312.8 256 304L256 128C256 110.3 241.7 96 224 96C206.3 96 192 110.3 192 128L192 400C192 401.5 192 403.1 192.1 404.6L131.6 347C115.6 331.8 90.3 332.4 75 348.4C59.7 364.4 60.4 389.7 76.4 405L188.8 512C231.9 553.1 289.2 576 348.8 576L368 576C465.2 576 544 497.2 544 400L544 192C544 174.3 529.7 160 512 160C494.3 160 480 174.3 480 192L480 304C480 312.8 472.8 320 464 320C455.2 320 448 312.8 448 304L448 128C448 110.3 433.7 96 416 96C398.3 96 384 110.3 384 128L384 304C384 312.8 376.8 320 368 320C359.2 320 352 312.8 352 304L352 96z"/></svg></td><td>Hand</td><td>Grab the canvas with your finger to move it around</td></tr>
<tr><td><svg viewBox="0 0 24 24"><path d="M3 5h2V3c-1.1 0-2 .9-2 2zm0 8h2v-2H3v2zm4 8h2v-2H7v2zM3 9h2V7H3v2zm10-6h-2v2h2V3zm6 0v2h2c0-1.1-.9-2-2-2zM5 21v-2H3c0 1.1.9 2 2 2zm-2-4h2v-2H3v2zM9 3H7v2h2V3zm2 18h2v-2h-2v2zm8-8h2v-2h-2v2zm0 8c1.1 0 2-.9 2-2h-2v2zm0-12h2V7h-2v2zm0 8h2v-2h-2v2zm-4 4h2v-2h-2v2zm0-16h2V3h-2v2z"/></svg></td><td>Select</td><td>Select a section of notes to move or copy</td></tr>
<tr><td><svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg></td><td>Copy</td><td>Copy the selected notes. Long-press to open a dialog where you can enter numeric values for copy & paste</td></tr>
<tr><td><svg viewBox="0 0 24 24"><path d="M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z"/></svg></td><td>Paste</td><td>Paste the copied notes</td></tr>
<tr><td><svg viewBox="0 0 24 24"><path d="M12.5 8c-2.65 0-5.05 1.04-6.82 2.75L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg></td><td>Undo</td><td>Undo your last action</td></tr>
</tbody>
</table>

---

## Keyboard

The keyboard at the bottom of the screen lets you hear notes as you type them into the canvas.

- **Play a note** … Press a key to hear it in the current track's tone.
- **Change the pitch range** … Use the scroll bar above the keyboard to shift to lower or higher notes.
- **Record** … Turn the record button on and the keys you press are written to the canvas. (During playback it records in real time; when stopped it advances one step per note.)

---

## Play Bar

The Play Bar has the buttons for playback and recording.

<table class="tool-table">
<thead><tr><th></th><th>Name</th><th>What it does</th></tr></thead>
<tbody>
<tr><td><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></td><td>Play/Stop</td><td>Play or stop the BGM (tap twice to play from the start)</td></tr>
<tr><td><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8"/></svg></td><td>Record</td><td>Keys you play are written to the canvas (one step at a time when stopped)</td></tr>
<tr><td><svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 21 L12 3 L19 21 Z"/><circle cx="17.5" cy="7" r="2.2"/></svg></td><td>Metronome</td><td>When on, a click plays on each beat during playback and recording</td></tr>
<tr><td><svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="4" width="18" height="10"/><path d="M3 17 h12 v-3 l6 5 -6 5 v-3 h-12 z"/></svg></td><td>Extend</td><td>Extend the note at the playhead by one step. Handy for long notes</td></tr>
<tr><td><svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 10 h8 v-3 l6 5 -6 5 v-3 h-8 z"/><rect x="20" y="2" width="3" height="20"/></svg></td><td>Forward</td><td>Move the playhead forward one step</td></tr>
<tr><td><svg viewBox="0 0 24 24" fill="currentColor" style="transform: scaleX(-1);"><path d="M4 10 h8 v-3 l6 5 -6 5 v-3 h-8 z"/><rect x="20" y="2" width="3" height="20"/></svg></td><td>Back</td><td>Move the playhead back one step</td></tr>
</tbody>
</table>

---

## Using your BGM in the game

On the STAGE screen, go to **Game Settings ▸ BGM** and assign a track to each scene — then it plays in-game.

- **Stage** … The main BGM during normal play.
- **Invincible** … Plays while the player is invincible.
- **Clear** … Plays when a stage is cleared.
- **Game Over** … Plays on game over.
- **Boss** … Plays during a boss fight.
