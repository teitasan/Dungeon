/**
 * Movement and turn system types
 */
// Direction vectors for movement
export const DirectionVectors = {
    north: { x: 0, y: -1 },
    south: { x: 0, y: 1 },
    east: { x: 1, y: 0 },
    west: { x: -1, y: 0 },
    northeast: { x: 1, y: -1 },
    northwest: { x: -1, y: -1 },
    southeast: { x: 1, y: 1 },
    southwest: { x: -1, y: 1 }
};
// Key mappings for movement
export const KeyToDirection = {
    'ArrowUp': 'north',
    'ArrowDown': 'south',
    'ArrowLeft': 'west',
    'ArrowRight': 'east',
    'w': 'north',
    's': 'south',
    'a': 'west',
    'd': 'east',
    'q': 'northwest',
    'e': 'northeast',
    'z': 'southwest',
    'c': 'southeast'
};
//# sourceMappingURL=movement.js.map