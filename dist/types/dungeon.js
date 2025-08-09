/**
 * Dungeon system types for the mystery dungeon game
 */
// Direction enum for dungeon generation
export var Direction;
(function (Direction) {
    Direction[Direction["North"] = 0] = "North";
    Direction[Direction["East"] = 1] = "East";
    Direction[Direction["South"] = 2] = "South";
    Direction[Direction["West"] = 3] = "West";
})(Direction || (Direction = {}));
// Utility functions for direction
export const DirectionVectors = {
    [Direction.North]: { x: 0, y: -1 },
    [Direction.East]: { x: 1, y: 0 },
    [Direction.South]: { x: 0, y: 1 },
    [Direction.West]: { x: -1, y: 0 }
};
export const OppositeDirection = {
    [Direction.North]: Direction.South,
    [Direction.East]: Direction.West,
    [Direction.South]: Direction.North,
    [Direction.West]: Direction.East
};
//# sourceMappingURL=dungeon.js.map