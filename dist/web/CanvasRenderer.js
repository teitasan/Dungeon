export class CanvasRenderer {
    canvas;
    ctx;
    tileSize;
    viewportTilesX = null;
    viewportTilesY = null;
    minimapCtx = null;
    minimapCanvas = null;
    explored = null;
    currentDungeonId = null;
    constructor(canvas, tileSize = 20) {
        this.canvas = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            throw new Error('2D context not supported');
        this.ctx = ctx;
        this.tileSize = tileSize;
        this.ctx.imageSmoothingEnabled = false;
    }
    /**
     * ビューポートのタイル数を設定（プレイヤー中心表示）
     */
    setViewportTiles(tilesX, tilesY) {
        this.viewportTilesX = Math.max(1, Math.floor(tilesX));
        this.viewportTilesY = Math.max(1, Math.floor(tilesY));
        this.canvas.width = this.viewportTilesX * this.tileSize;
        this.canvas.height = this.viewportTilesY * this.tileSize;
    }
    /** タイルピクセルサイズを変更（ビューポートに合わせてキャンバスも再設定） */
    setTileSize(tileSize) {
        this.tileSize = Math.max(1, Math.floor(tileSize));
        if (this.viewportTilesX && this.viewportTilesY) {
            this.canvas.width = this.viewportTilesX * this.tileSize;
            this.canvas.height = this.viewportTilesY * this.tileSize;
        }
    }
    /**
     * ミニマップ用キャンバスを関連付け
     */
    attachMinimap(minimapCanvas) {
        const mm = minimapCanvas.getContext('2d');
        if (!mm)
            throw new Error('2D context not supported for minimap');
        this.minimapCtx = mm;
        this.minimapCanvas = minimapCanvas;
        this.minimapCtx.imageSmoothingEnabled = false;
    }
    render(dungeon, dungeonManager, player) {
        const { ctx, tileSize } = this;
        // Dungeon change → explored リセット
        if (this.currentDungeonId !== dungeon.id) {
            this.currentDungeonId = dungeon.id;
            this.explored = Array.from({ length: dungeon.height }, () => Array(dungeon.width).fill(false));
        }
        // 可視マップを計算（部屋ベース）
        const visible = this.computeVisibility(dungeon, player);
        // explored 更新
        if (this.explored) {
            for (let y = 0; y < dungeon.height; y++) {
                for (let x = 0; x < dungeon.width; x++) {
                    if (visible[y][x])
                        this.explored[y][x] = true;
                }
            }
        }
        // カメラ計算
        const [camX, camY, viewW, viewH] = this.computeCamera(dungeon, player);
        // 背景クリア
        ctx.fillStyle = '#0c0c0f';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        // タイル描画（ビューポート内のみ）
        for (let vy = 0; vy < viewH; vy++) {
            const y = camY + vy;
            if (y < 0 || y >= dungeon.height)
                continue;
            for (let vx = 0; vx < viewW; vx++) {
                const x = camX + vx;
                if (x < 0 || x >= dungeon.width)
                    continue;
                const cell = dungeon.cells[y][x];
                const isVisible = visible[y][x];
                const isExplored = this.explored ? this.explored[y][x] : false;
                // ベース色
                let color = '#15151b'; // wall
                switch (cell.type) {
                    case 'floor':
                        color = '#2a2a31';
                        break;
                    case 'stairs-down':
                        color = '#b58900';
                        break;
                    case 'stairs-up':
                        color = '#268bd2';
                        break;
                    default:
                        color = '#15151b';
                        break;
                }
                // 不可視/未踏破の減光
                if (!isExplored) {
                    color = '#000000';
                }
                else if (!isVisible) {
                    // half-darken
                    color = this.mix(color, '#000000', 0.5);
                }
                ctx.fillStyle = color;
                ctx.fillRect(vx * tileSize, vy * tileSize, tileSize, tileSize);
            }
        }
        // グリッド（薄く）
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= viewW; x++) {
            ctx.beginPath();
            ctx.moveTo(x * tileSize + 0.5, 0);
            ctx.lineTo(x * tileSize + 0.5, viewH * tileSize);
            ctx.stroke();
        }
        for (let y = 0; y <= viewH; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * tileSize + 0.5);
            ctx.lineTo(viewW * tileSize, y * tileSize + 0.5);
            ctx.stroke();
        }
        // エンティティ描画（可視セルのみ）
        const entities = dungeonManager.getAllEntities();
        for (const entity of entities) {
            const ex = entity.position.x;
            const ey = entity.position.y;
            if (ex < camX || ex >= camX + viewW || ey < camY || ey >= camY + viewH)
                continue;
            if (!visible[ey][ex])
                continue;
            if (entity.id === player.id)
                continue;
            const gx = (ex - camX) * tileSize;
            const gy = (ey - camY) * tileSize;
            const glyph = entity.name ? entity.name.charAt(0).toUpperCase() : 'E';
            this.ctx.fillStyle = 'rgba(255,255,255,0.1)';
            this.ctx.fillRect(gx + 3, gy + 3, tileSize - 6, tileSize - 6);
            this.ctx.fillStyle = '#d0d0d0';
            this.ctx.font = `${Math.floor(tileSize * 0.7)}px ui-monospace, Menlo, monospace`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(glyph, gx + tileSize / 2, gy + tileSize / 2 + 1);
        }
        // プレイヤー
        const px = (player.position.x - camX) * tileSize + tileSize / 2;
        const py = (player.position.y - camY) * tileSize + tileSize / 2;
        ctx.beginPath();
        ctx.arc(px, py, tileSize * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = '#58a6ff';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#1f6feb';
        ctx.stroke();
        // 方向ノッチ
        ctx.beginPath();
        ctx.moveTo(px, py - tileSize * 0.35);
        ctx.lineTo(px, py - tileSize * 0.15);
        ctx.strokeStyle = '#cdd9e5';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // ミニマップ描画
        this.renderMinimap(dungeon, visible, camX, camY, viewW, viewH, player);
    }
    computeCamera(dungeon, player) {
        const tilesX = this.viewportTilesX ?? dungeon.width;
        const tilesY = this.viewportTilesY ?? dungeon.height;
        let camX = player.position.x - Math.floor(tilesX / 2);
        let camY = player.position.y - Math.floor(tilesY / 2);
        camX = Math.max(0, Math.min(dungeon.width - tilesX, camX));
        camY = Math.max(0, Math.min(dungeon.height - tilesY, camY));
        return [camX, camY, tilesX, tilesY];
    }
    findRoomAt(dungeon, x, y) {
        for (const room of dungeon.rooms) {
            if (x >= room.x && x < room.x + room.width && y >= room.y && y < room.y + room.height) {
                return room;
            }
        }
        return null;
    }
    computeVisibility(dungeon, player) {
        const w = dungeon.width;
        const h = dungeon.height;
        const visible = Array.from({ length: h }, () => Array(w).fill(false));
        const px = player.position.x;
        const py = player.position.y;
        const room = this.findRoomAt(dungeon, px, py);
        if (room) {
            // 部屋内なら部屋全体可視
            for (let y = room.y; y < room.y + room.height; y++) {
                for (let x = room.x; x < room.x + room.width; x++) {
                    visible[y][x] = true;
                }
            }
            // 廊下側に1タイルだけ可視
            for (let y = room.y; y < room.y + room.height; y++) {
                for (let x = room.x; x < room.x + room.width; x++) {
                    // 境界のみチェック
                    const onBorder = (x === room.x || x === room.x + room.width - 1 || y === room.y || y === room.y + room.height - 1);
                    if (!onBorder)
                        continue;
                    const neighbors = [
                        { x: x + 1, y },
                        { x: x - 1, y },
                        { x, y: y + 1 },
                        { x, y: y - 1 },
                    ];
                    for (const n of neighbors) {
                        if (n.x < 0 || n.x >= w || n.y < 0 || n.y >= h)
                            continue;
                        if (this.findRoomAt(dungeon, n.x, n.y))
                            continue; // となりも部屋ならスキップ
                        if (dungeon.cells[n.y][n.x].walkable) {
                            visible[n.y][n.x] = true; // 廊下1タイル
                        }
                    }
                }
            }
        }
        else {
            // 廊下内：プレイヤー位置と直線視界
            visible[py][px] = true;
            const dirs = [
                { dx: 1, dy: 0 },
                { dx: -1, dy: 0 },
                { dx: 0, dy: 1 },
                { dx: 0, dy: -1 },
            ];
            for (const d of dirs) {
                let cx = px;
                let cy = py;
                // 直線に伸ばす
                while (true) {
                    cx += d.dx;
                    cy += d.dy;
                    if (cx < 0 || cx >= w || cy < 0 || cy >= h)
                        break;
                    const cell = dungeon.cells[cy][cx];
                    if (!cell.walkable)
                        break; // 壁で遮断
                    visible[cy][cx] = true;
                    // 部屋に入ったら入口タイルのみで停止
                    if (this.findRoomAt(dungeon, cx, cy))
                        break;
                }
            }
        }
        return visible;
    }
    renderMinimap(dungeon, visible, camX, camY, viewW, viewH, player) {
        if (!this.minimapCtx || !this.minimapCanvas)
            return;
        const mm = this.minimapCtx;
        const W = this.minimapCanvas.width;
        const H = this.minimapCanvas.height;
        // 背景
        mm.fillStyle = '#0b0b0d';
        mm.fillRect(0, 0, W, H);
        // タイルサイズ（整数）
        const mmTile = Math.max(1, Math.floor(Math.min(W / dungeon.width, H / dungeon.height)));
        const offsetX = Math.floor((W - dungeon.width * mmTile) / 2);
        const offsetY = Math.floor((H - dungeon.height * mmTile) / 2);
        // 描画
        for (let y = 0; y < dungeon.height; y++) {
            for (let x = 0; x < dungeon.width; x++) {
                const cell = dungeon.cells[y][x];
                const isExplored = this.explored ? this.explored[y][x] : false;
                const isVisible = visible[y][x];
                let color = '#111318'; // wall base
                switch (cell.type) {
                    case 'floor':
                        color = '#2a2a31';
                        break;
                    case 'stairs-down':
                        color = '#b58900';
                        break;
                    case 'stairs-up':
                        color = '#268bd2';
                        break;
                    default:
                        color = '#111318';
                        break;
                }
                if (!isExplored) {
                    color = '#000000';
                }
                else if (!isVisible) {
                    color = this.mix(color, '#000000', 0.6);
                }
                mm.fillStyle = color;
                mm.fillRect(offsetX + x * mmTile, offsetY + y * mmTile, mmTile, mmTile);
            }
        }
        // ビューポート枠
        mm.strokeStyle = 'rgba(255,255,255,0.6)';
        mm.lineWidth = 1;
        mm.strokeRect(offsetX + camX * mmTile + 0.5, offsetY + camY * mmTile + 0.5, viewW * mmTile, viewH * mmTile);
        // プレイヤー点
        mm.fillStyle = '#58a6ff';
        mm.fillRect(offsetX + player.position.x * mmTile, offsetY + player.position.y * mmTile, Math.max(1, Math.floor(mmTile / 2)), Math.max(1, Math.floor(mmTile / 2)));
    }
    // 簡易カラー合成
    mix(hex1, hex2, ratio) {
        const c1 = this.hexToRgb(hex1);
        const c2 = this.hexToRgb(hex2);
        const r = Math.round(c1[0] * (1 - ratio) + c2[0] * ratio);
        const g = Math.round(c1[1] * (1 - ratio) + c2[1] * ratio);
        const b = Math.round(c1[2] * (1 - ratio) + c2[2] * ratio);
        return `rgb(${r},${g},${b})`;
    }
    hexToRgb(hex) {
        // Accept formats like '#rrggbb' or 'rgb(...)'
        if (hex.startsWith('#')) {
            const v = hex.replace('#', '');
            const r = parseInt(v.substring(0, 2), 16);
            const g = parseInt(v.substring(2, 4), 16);
            const b = parseInt(v.substring(4, 6), 16);
            return [r, g, b];
        }
        if (hex.startsWith('rgb')) {
            const m = hex.match(/rgb\((\d+),(\d+),(\d+)\)/);
            if (m)
                return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
        }
        return [0, 0, 0];
    }
}
//# sourceMappingURL=CanvasRenderer.js.map