/**
 * BGM Editor - Song Data Manager
 */
class SongManager {
    constructor(songsArray) {
        this.songs = songsArray || [];
        this.currentIdx = 0;
        this.migrate();
    }

    /**
     * Get the currently active song object
     */
    get current() {
        if (this.songs.length === 0) return null;
        return this.songs[this.currentIdx] || this.songs[0];
    }

    /**
     * Add a new song to the list
     */
    add() {
        const newSong = {
            name: `BGM ${this.songs.length + 1}`,
            bpm: 120,
            bars: 16,
            tracks: [
                { type: 'square', volume: 0.65, pan: 0.0, tone: 0, notes: [] },
                { type: 'square', volume: 0.65, pan: 0.0, tone: 0, notes: [] },
                { type: 'triangle', volume: 0.65, pan: 0.0, tone: 0, notes: [] },
                { type: 'noise', volume: 0.65, pan: 0.0, tone: 0, notes: [] }
            ]
        };
        this.songs.push(newSong);
        this.currentIdx = this.songs.length - 1;
        return newSong;
    }

    /**
     * Remove the current song
     */
    remove() {
        if (this.songs.length <= 1) return false;

        this.songs.splice(this.currentIdx, 1);
        
        // Adjust index if we removed the last item
        if (this.currentIdx >= this.songs.length) {
            this.currentIdx = this.songs.length - 1;
        }
        return true;
    }

    /**
     * Select a song by index
     */
    select(idx) {
        if (idx >= 0 && idx < this.songs.length) {
            this.currentIdx = idx;
            return true;
        }
        return false;
    }

    /**
     * Move to next/previous song
     */
    getNextIdx() {
        let nextIdx = this.currentIdx + 1;
        if (nextIdx >= this.songs.length) nextIdx = 0;
        return nextIdx;
    }

    getPrevIdx() {
        let prevIdx = this.currentIdx - 1;
        if (prevIdx < 0) prevIdx = this.songs.length - 1;
        return prevIdx;
    }

    /**
     * Ensure song data matches current version (Vol/Pan/Tone)
     */
    migrate() {
        if (!this.songs) return;
        this.songs.forEach(song => {
            if (!song.tracks) return;
            song.tracks.forEach(track => {
                if (typeof track.volume === 'undefined') track.volume = 0.65;
                if (typeof track.pan === 'undefined') track.pan = 0.0;
                if (typeof track.tone === 'undefined') track.tone = 0;
            });
        });
    }
}
