import { describe, expect, it } from "vitest";
import { isInsideCircle } from "./../../src/engine/utils/maths";

type Point = {
  x: number;
  y: number;
};

describe("Geometry for collisions", () => {
  describe("Circle at position (6,-6) with radius 2", () => {
    it("Point (8,-4) is not inside the circle", () => {
      // Arrange
      const object: Point = { x: 6, y: -6 };
      const target: Point = { x: 8, y: -4 };
      const radius: number = 2;

      // Action
      const result = isInsideCircle(object.x, object.y, target.x, target.y, radius);

      // Assert
      expect(result).toBe(false);
    });

    it("Point (6,-6) is inside the circle", () => {
      // Arrange
      const object: Point = { x: 6, y: -6 };
      const target: Point = { x: 6, y: -6 };
      const radius: number = 2;

      // Action
      const result = isInsideCircle(object.x, object.y, target.x, target.y, radius);

      // Assert
      expect(result).toBe(true);
    });

    it("Point (7.5,-7.123131) is inside the circle", () => {
      // Arrange
      const object: Point = { x: 6, y: -6 };
      const target: Point = { x: 7.5, y: -7.123131 };
      const radius: number = 2;

      // Action
      const result = isInsideCircle(object.x, object.y, target.x, target.y, radius);

      // Assert
      expect(result).toBe(true);
    });

    it("Point (7.9,-7.123131) is inside the circle", () => {
      // Arrange
      const object: Point = { x: 6, y: -6 };
      const target: Point = { x: 7.9, y: -7.123131 };
      const radius: number = 2;

      // Action
      const result = isInsideCircle(object.x, object.y, target.x, target.y, radius);

      // Assert
      expect(result).toBe(false);
    });
  });
});
