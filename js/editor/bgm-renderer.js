/**
 * PixelGameKit - BGMエディタ ピアノロール描画エンジン
 */

class BgmRenderer {
    static MAX_PITCH = 71; // C1(0) 〜 B6(71)

    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
    }

    /**
     * @param {object} vc ViewContext — SoundEditor が毎フレーム組み立てて渡すスナップショット
     */
    render(vc) {
        if (!this.ctx) return;
        this._drawBackground(vc);
        this._drawBeatShading(vc);
        this._drawGrid(vc);
        this._drawOctaveDividers(vc);
        this._drawBarDividers(vc);
        this._drawOutOfRangeOverlay(vc);
        this._drawHighlightPitch(vc);
        this._drawNotes(vc);
        this._drawSelection(vc);
        this._drawPastePreview(vc);
        this._drawPlayhead(vc);
    }

    _drawBackground(vc) {
        this.ctx.fillStyle = vc.bgColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    _drawBeatShading(vc) {
        const { song, cellSize, scrollX } = vc;
        const beatWidth = 4 * cellSize;
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
        for (let bar = 0; bar < song.bars; bar++) {
            for (let beat = 0; beat < 4; beat++) {
                if (beat === 1 || beat === 3) {
                    const x = (bar * 16 + beat * 4) * cellSize - scrollX;
                    if (x + beatWidth >= 0 && x <= this.canvas.width) {
                        this.ctx.fillRect(x, 0, beatWidth, this.canvas.height);
                    }
                }
            }
        }
    }

    _drawGrid(vc) {
        const { cellSize, scrollX, scrollY } = vc;
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.lineWidth = 0.5;

        for (let i = 0; i <= Math.ceil(this.canvas.width / cellSize) + 1; i++) {
            const x = i * cellSize - scrollX % cellSize;
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }

        for (let i = 0; i <= Math.ceil(this.canvas.height / cellSize) + 1; i++) {
            const y = i * cellSize - scrollY % cellSize;
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }

    _drawOctaveDividers(vc) {
        const { cellSize, scrollY } = vc;
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 1;
        for (let octave = 1; octave <= 6; octave++) {
            const cPitch = (octave - 1) * 12;
            const y = (BgmRenderer.MAX_PITCH - cPitch + 1) * cellSize - scrollY;
            if (y >= 0 && y <= this.canvas.height) {
                this.ctx.beginPath();
                this.ctx.moveTo(0, y);
                this.ctx.lineTo(this.canvas.width, y);
                this.ctx.stroke();
            }
        }
    }

    _drawBarDividers(vc) {
        const { song, cellSize, scrollX } = vc;
        const barWidth = 16 * cellSize;
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 1;
        for (let bar = 0; bar <= song.bars; bar++) {
            const x = bar * barWidth - scrollX;
            if (x >= 0 && x <= this.canvas.width) {
                this.ctx.beginPath();
                this.ctx.moveTo(x, 0);
                this.ctx.lineTo(x, this.canvas.height);
                this.ctx.stroke();
            }
        }
    }

    _drawOutOfRangeOverlay(vc) {
        const { song, cellSize, scrollX } = vc;
        const maxX = song.bars * cellSize - scrollX;
        if (maxX < this.canvas.width) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.fillRect(maxX, 0, this.canvas.width - maxX, this.canvas.height);
        }
    }

    _drawHighlightPitch(vc) {
        const { highlightPitch, cellSize, scrollY } = vc;
        if (highlightPitch < 0 || highlightPitch > BgmRenderer.MAX_PITCH) return;
        const y = (BgmRenderer.MAX_PITCH - highlightPitch) * cellSize - scrollY;
        if (y + cellSize >= 0 && y < this.canvas.height) {
            this.ctx.fillStyle = 'rgba(74, 124, 89, 0.3)';
            this.ctx.fillRect(0, y, this.canvas.width, cellSize);
        }
    }

    _drawNotes(vc) {
        const { song, trackIndex, cellSize, scrollX, scrollY } = vc;
        const track = song.tracks[trackIndex];
        this.ctx.fillStyle = '#fff';
        track.notes.forEach(note => {
            const x = note.step * cellSize - scrollX;
            const y = (BgmRenderer.MAX_PITCH - note.pitch) * cellSize - scrollY;
            const w = note.length * cellSize - 2;
            if (x + w >= 0 && x <= this.canvas.width && y + cellSize >= 0 && y < this.canvas.height) {
                this.ctx.fillRect(x + 1, y + 1, w, cellSize - 2);
            }
        });
    }

    _drawSelection(vc) {
        const { selectionMode, selectionStart, selectionEnd, isSelecting, cellSize, scrollX, scrollY } = vc;
        if (!selectionMode || !selectionStart || !selectionEnd) return;

        const step1  = Math.min(selectionStart.step,  selectionEnd.step);
        const step2  = Math.max(selectionStart.step,  selectionEnd.step);
        const pitch1 = Math.min(selectionStart.pitch, selectionEnd.pitch);
        const pitch2 = Math.max(selectionStart.pitch, selectionEnd.pitch);

        const x = step1 * cellSize - scrollX;
        const y = (BgmRenderer.MAX_PITCH - pitch2) * cellSize - scrollY;
        const w = (step2 - step1 + 1) * cellSize;
        const h = (pitch2 - pitch1 + 1) * cellSize;

        this.ctx.setLineDash([4, 4]);
        this.ctx.strokeStyle = isSelecting ? '#ffffff' : '#90EE90';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, w, h);
        this.ctx.fillStyle = 'rgba(144, 238, 144, 0.2)';
        this.ctx.fillRect(x, y, w, h);
        this.ctx.setLineDash([]);
    }

    _drawPastePreview(vc) {
        const { pasteMode, pasteData, pasteOffset, cellSize, scrollX, scrollY } = vc;
        if (!pasteMode || !pasteData) return;

        this.ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
        pasteData.notes.forEach(note => {
            const newStep  = pasteOffset.step  + note.step;
            const newPitch = pasteOffset.pitch + note.pitch;
            const x = newStep  * cellSize - scrollX;
            const y = (BgmRenderer.MAX_PITCH - newPitch) * cellSize - scrollY;
            const w = note.length * cellSize - 2;
            if (x + w >= 0 && x <= this.canvas.width && y + cellSize >= 0 && y < this.canvas.height) {
                this.ctx.fillRect(x + 1, y + 1, w, cellSize - 2);
            }
        });

        if (pasteData.width && pasteData.height) {
            const x = pasteOffset.step  * cellSize - scrollX;
            const y = (BgmRenderer.MAX_PITCH - (pasteOffset.pitch + pasteData.height - 1)) * cellSize - scrollY;
            const w = pasteData.width  * cellSize;
            const h = pasteData.height * cellSize;
            this.ctx.setLineDash([4, 4]);
            this.ctx.strokeStyle = '#FFFFFF';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(x, y, w, h);
            this.ctx.setLineDash([]);
        }
    }

    _drawPlayhead(vc) {
        const { currentStep, isPlaying, isStepRecording, cellSize, scrollX } = vc;
        const x = currentStep * cellSize - scrollX;
        if (x < 0 || x > this.canvas.width) return;

        let color = '#00FF00';
        if (isStepRecording) color = '#FF0000';
        else if (!isPlaying)  color = 'rgba(0, 255, 0, 0.5)';

        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x, 0);
        this.ctx.lineTo(x, this.canvas.height);
        this.ctx.stroke();
    }
}
