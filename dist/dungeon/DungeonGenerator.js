/**
 * Dungeon generation system
 * Implements basic random dungeon generation with rooms and corridors
 */
export class DungeonGenerator {
    rng;
    seed;
    constructor(seed) {
        this.seed = seed || Math.floor(Math.random() * 1000000);
        this.rng = this.createSeededRandom(this.seed);
    }
    /**
     * Generate a complete dungeon
     */
    generateDungeon(dungeonId, dungeonName, floor, params) {
        // Initialize empty dungeon
        const dungeon = {
            id: dungeonId,
            name: dungeonName,
            floor,
            width: params.width,
            height: params.height,
            cells: this.initializeCells(params.width, params.height),
            rooms: [],
            playerSpawn: { x: 0, y: 0 },
            generationSeed: this.seed
        };
        // Generate rooms
        this.generateRooms(dungeon, params);
        // Connect rooms with corridors
        this.connectRooms(dungeon, params);
        // Place stairs (respect progression direction)
        this.placeStairs(dungeon, params);
        // Set player spawn point
        this.setPlayerSpawn(dungeon);
        return dungeon;
    }
    /**
     * Initialize dungeon cells with walls
     */
    initializeCells(width, height) {
        const cells = [];
        for (let y = 0; y < height; y++) {
            cells[y] = [];
            for (let x = 0; x < width; x++) {
                cells[y][x] = {
                    type: 'wall',
                    walkable: false,
                    transparent: false,
                    entities: []
                };
            }
        }
        return cells;
    }
    /**
     * Generate rooms in the dungeon
     */
    generateRooms(dungeon, params) {
        const maxAttempts = params.maxRooms * 3;
        let attempts = 0;
        let roomCount = 0;
        while (roomCount < params.maxRooms && attempts < maxAttempts) {
            attempts++;
            // Generate random room dimensions
            const width = this.randomInt(params.minRoomSize, params.maxRoomSize);
            const height = this.randomInt(params.minRoomSize, params.maxRoomSize);
            // Generate random position (with border padding)
            const x = this.randomInt(1, dungeon.width - width - 1);
            const y = this.randomInt(1, dungeon.height - height - 1);
            // Check if room overlaps with existing rooms
            if (this.isRoomValid(dungeon, x, y, width, height)) {
                const room = {
                    id: `room-${roomCount}`,
                    x,
                    y,
                    width,
                    height,
                    type: 'normal',
                    connected: false,
                    connections: []
                };
                // Carve out the room
                this.carveRoom(dungeon, room);
                dungeon.rooms.push(room);
                roomCount++;
            }
        }
        // Ensure we have at least the minimum number of rooms
        if (roomCount < params.minRooms) {
            console.warn(`Only generated ${roomCount} rooms, minimum was ${params.minRooms}`);
        }
    }
    /**
     * Check if a room position is valid (doesn't overlap)
     */
    isRoomValid(dungeon, x, y, width, height) {
        // Check bounds
        if (x < 1 || y < 1 || x + width >= dungeon.width - 1 || y + height >= dungeon.height - 1) {
            return false;
        }
        // Check for overlap with existing rooms (with 1-cell padding)
        for (let checkY = y - 1; checkY <= y + height; checkY++) {
            for (let checkX = x - 1; checkX <= x + width; checkX++) {
                if (checkX >= 0 && checkX < dungeon.width && checkY >= 0 && checkY < dungeon.height) {
                    if (dungeon.cells[checkY][checkX].type === 'floor') {
                        return false;
                    }
                }
            }
        }
        return true;
    }
    /**
     * Carve out a room in the dungeon
     */
    carveRoom(dungeon, room) {
        for (let y = room.y; y < room.y + room.height; y++) {
            for (let x = room.x; x < room.x + room.width; x++) {
                dungeon.cells[y][x] = {
                    type: 'floor',
                    walkable: true,
                    transparent: true,
                    entities: []
                };
            }
        }
    }
    /**
     * Connect all rooms with corridors
     */
    connectRooms(dungeon, params) {
        if (dungeon.rooms.length === 0)
            return;
        // Start with the first room
        dungeon.rooms[0].connected = true;
        const connectedRooms = [dungeon.rooms[0]];
        const unconnectedRooms = dungeon.rooms.slice(1);
        // Connect each unconnected room to the nearest connected room
        while (unconnectedRooms.length > 0) {
            let bestConnection = null;
            // Find the closest pair of connected/unconnected rooms
            for (const connectedRoom of connectedRooms) {
                for (const unconnectedRoom of unconnectedRooms) {
                    const distance = this.getRoomDistance(connectedRoom, unconnectedRoom);
                    if (!bestConnection || distance < bestConnection.distance) {
                        bestConnection = { from: connectedRoom, to: unconnectedRoom, distance };
                    }
                }
            }
            if (bestConnection) {
                // Create corridor between rooms
                const corridor = this.createCorridor(dungeon, bestConnection.from, bestConnection.to, params);
                // Add connection to both rooms
                bestConnection.from.connections.push({
                    roomId: bestConnection.to.id,
                    corridorPath: corridor
                });
                bestConnection.to.connections.push({
                    roomId: bestConnection.from.id,
                    corridorPath: corridor
                });
                // Move room to connected list
                bestConnection.to.connected = true;
                connectedRooms.push(bestConnection.to);
                const index = unconnectedRooms.indexOf(bestConnection.to);
                unconnectedRooms.splice(index, 1);
            }
        }
    }
    /**
     * Calculate distance between two rooms (center to center)
     */
    getRoomDistance(room1, room2) {
        const center1 = {
            x: room1.x + Math.floor(room1.width / 2),
            y: room1.y + Math.floor(room1.height / 2)
        };
        const center2 = {
            x: room2.x + Math.floor(room2.width / 2),
            y: room2.y + Math.floor(room2.height / 2)
        };
        return Math.abs(center1.x - center2.x) + Math.abs(center1.y - center2.y);
    }
    /**
     * Create a corridor between two rooms
     */
    createCorridor(dungeon, from, to, params) {
        const fromCenter = {
            x: from.x + Math.floor(from.width / 2),
            y: from.y + Math.floor(from.height / 2)
        };
        const toCenter = {
            x: to.x + Math.floor(to.width / 2),
            y: to.y + Math.floor(to.height / 2)
        };
        const path = [];
        let current = { ...fromCenter };
        // L-shaped corridor: horizontal first, then vertical
        // Move horizontally
        while (current.x !== toCenter.x) {
            if (current.x < toCenter.x) {
                current.x++;
            }
            else {
                current.x--;
            }
            path.push({ ...current });
            this.carveCorridor(dungeon, current, params.corridorWidth);
        }
        // Move vertically
        while (current.y !== toCenter.y) {
            if (current.y < toCenter.y) {
                current.y++;
            }
            else {
                current.y--;
            }
            path.push({ ...current });
            this.carveCorridor(dungeon, current, params.corridorWidth);
        }
        return path;
    }
    /**
     * Carve corridor at position
     */
    carveCorridor(dungeon, position, width) {
        const halfWidth = Math.floor(width / 2);
        for (let dy = -halfWidth; dy <= halfWidth; dy++) {
            for (let dx = -halfWidth; dx <= halfWidth; dx++) {
                const x = position.x + dx;
                const y = position.y + dy;
                if (x >= 0 && x < dungeon.width && y >= 0 && y < dungeon.height) {
                    if (dungeon.cells[y][x].type === 'wall') {
                        dungeon.cells[y][x] = {
                            type: 'floor',
                            walkable: true,
                            transparent: true,
                            entities: []
                        };
                    }
                }
            }
        }
    }
    /**
     * Place stairs in the dungeon
     */
    placeStairs(dungeon, params) {
        if (dungeon.rooms.length === 0)
            return;
        const direction = params.progressionDirection || 'down';
        if (direction === 'down') {
            // Only stairs-down per floor
            const lastRoom = dungeon.rooms[dungeon.rooms.length - 1];
            const stairsDown = {
                x: lastRoom.x + Math.floor(lastRoom.width / 2),
                y: lastRoom.y + Math.floor(lastRoom.height / 2)
            };
            dungeon.stairsDown = stairsDown;
            dungeon.cells[stairsDown.y][stairsDown.x].type = 'stairs-down';
            // Ensure no stairs-up
            dungeon.stairsUp = undefined;
        }
        else {
            // direction === 'up' → Only stairs-up per floor
            const firstRoom = dungeon.rooms[0];
            const stairsUp = {
                x: firstRoom.x + Math.floor(firstRoom.width / 2),
                y: firstRoom.y + Math.floor(firstRoom.height / 2)
            };
            dungeon.stairsUp = stairsUp;
            dungeon.cells[stairsUp.y][stairsUp.x].type = 'stairs-up';
            // Ensure no stairs-down
            dungeon.stairsDown = undefined;
        }
    }
    /**
     * Set player spawn point
     */
    setPlayerSpawn(dungeon) {
        if (dungeon.rooms.length === 0) {
            dungeon.playerSpawn = { x: 1, y: 1 };
            return;
        }
        // Spawn in the first room, avoiding stairs
        const firstRoom = dungeon.rooms[0];
        let spawnX = firstRoom.x + 1;
        let spawnY = firstRoom.y + 1;
        // If stairs up exists in first room, offset spawn position
        if (dungeon.stairsUp) {
            if (spawnX === dungeon.stairsUp.x && spawnY === dungeon.stairsUp.y) {
                spawnX = Math.min(spawnX + 1, firstRoom.x + firstRoom.width - 1);
            }
        }
        dungeon.playerSpawn = { x: spawnX, y: spawnY };
    }
    /**
     * Create seeded random number generator
     */
    createSeededRandom(seed) {
        let state = seed;
        return () => {
            state = (state * 1664525 + 1013904223) % 4294967296;
            return state / 4294967296;
        };
    }
    /**
     * Generate random integer between min and max (inclusive)
     */
    randomInt(min, max) {
        return Math.floor(this.rng() * (max - min + 1)) + min;
    }
    /**
     * Get the current seed
     */
    getSeed() {
        return this.seed;
    }
    /**
     * Reset with new seed
     */
    setSeed(seed) {
        this.seed = seed;
        this.rng = this.createSeededRandom(seed);
    }
}
//# sourceMappingURL=DungeonGenerator.js.map