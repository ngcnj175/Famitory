/**
 * PixelGameKit - 複数マス占有タイル（32x32等）の共通ユーティリティ
 * ステージエディタ（配置・消去・反転）とゲームエンジン（衝突判定）で共有
 * 左上マスに実タイルID、残りのマスには占有マーカー（負数）を格納する方式を管理する
 */

class TileFootprint {
    // マーカー値の下限（これより小さい値は「占有マーカー」とみなす）
    static MARKER_BASE = 1000;
    // マーカー内でdx/dyをエンコードする基数（1辺あたり最大99マスまで対応、将来の大型タイルにも耐えられる余裕を持たせる）
    static OFFSET_RADIX = 100;

    static isMarker(tileId) {
        return tileId !== undefined && tileId <= -TileFootprint.MARKER_BASE;
    }

    // 左上原点からのオフセット(dx,dy)をマーカー値にエンコード
    static encodeMarker(dx, dy) {
        return -(TileFootprint.MARKER_BASE + dy * TileFootprint.OFFSET_RADIX + dx);
    }

    // マーカー値からオフセット(dx,dy)を復元
    static decodeMarker(tileId) {
        const offset = -tileId - TileFootprint.MARKER_BASE;
        return {
            dx: offset % TileFootprint.OFFSET_RADIX,
            dy: Math.floor(offset / TileFootprint.OFFSET_RADIX)
        };
    }

    // 指定セル(tx,ty)が占有マーカーの場合、左上原点セルの実タイルIDを解決する
    static resolveOrigin(layer, tx, ty) {
        const rawId = layer?.[ty]?.[tx];
        if (!TileFootprint.isMarker(rawId)) {
            return { tileId: rawId, originX: tx, originY: ty };
        }
        const { dx, dy } = TileFootprint.decodeMarker(rawId);
        const originX = tx - dx;
        const originY = ty - dy;
        return { tileId: layer?.[originY]?.[originX], originX, originY };
    }

    // 原点(originX,originY)からsize四方のマス目にコールバックを実行（境界外は除外）
    static forEachCell(originX, originY, size, boundsW, boundsH, callback) {
        for (let dy = 0; dy < size; dy++) {
            for (let dx = 0; dx < size; dx++) {
                const tx = originX + dx;
                const ty = originY + dy;
                if (tx < 0 || tx >= boundsW || ty < 0 || ty >= boundsH) continue;
                callback(tx, ty, dx, dy);
            }
        }
    }

    // 原点(originX,originY)にsize四方のタイルを書き込む（左上=実ID、他=マーカー）
    static place(layer, originX, originY, size, tileValue, boundsW, boundsH) {
        TileFootprint.forEachCell(originX, originY, size, boundsW, boundsH, (tx, ty, dx, dy) => {
            layer[ty][tx] = (dx === 0 && dy === 0) ? tileValue : TileFootprint.encodeMarker(dx, dy);
        });
    }

    // 指定セル(tx,ty)にあるタイルの占有マス全てを-1でクリアする。何か消したらtrueを返す
    // getSizeFn: 実タイルID -> 占有サイズ（1辺のマス数）を返す関数
    static clearFootprint(layer, tx, ty, boundsW, boundsH, getSizeFn) {
        const { tileId, originX, originY } = TileFootprint.resolveOrigin(layer, tx, ty);
        if (tileId === undefined || tileId === -1) return false;
        const size = getSizeFn(tileId);
        TileFootprint.forEachCell(originX, originY, size, boundsW, boundsH, (fx, fy) => {
            layer[fy][fx] = -1;
        });
        return true;
    }
}
