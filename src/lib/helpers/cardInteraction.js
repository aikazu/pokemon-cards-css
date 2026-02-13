import { clamp, round, adjust } from "./Math.js";

/**
 * @param {Number} clientX
 * @param {Number} clientY
 * @param {DOMRect} rect
 * @returns {{ background: { x: Number, y: Number }, rotate: { x: Number, y: Number }, glare: { x: Number, y: Number, o: Number } }}
 */
export const getPointerSpringUpdate = (clientX, clientY, rect) => {
  const absolute = {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
  const percent = {
    x: clamp(round((100 / rect.width) * absolute.x)),
    y: clamp(round((100 / rect.height) * absolute.y)),
  };
  const center = {
    x: percent.x - 50,
    y: percent.y - 50,
  };

  return {
    background: {
      x: adjust(percent.x, 0, 100, 37, 63),
      y: adjust(percent.y, 0, 100, 33, 67),
    },
    rotate: {
      x: round(-(center.x / 3.5)),
      y: round(center.y / 3.5),
    },
    glare: {
      x: round(percent.x),
      y: round(percent.y),
      o: 1,
    }
  };
};

/**
 * @param {Number} gamma
 * @param {Number} beta
 * @returns {{ background: { x: Number, y: Number }, rotate: { x: Number, y: Number }, glare: { x: Number, y: Number, o: Number } }}
 */
export const getOrientationSpringUpdate = (gamma, beta) => {
  const limit = { x: 16, y: 18 };
  const degrees = {
    x: clamp(gamma, -limit.x, limit.x),
    y: clamp(beta, -limit.y, limit.y)
  };

  return {
    background: {
      x: adjust(degrees.x, -limit.x, limit.x, 37, 63),
      y: adjust(degrees.y, -limit.y, limit.y, 33, 67),
    },
    rotate: {
      x: round(degrees.x * -1),
      y: round(degrees.y),
    },
    glare: {
      x: adjust(degrees.x, -limit.x, limit.x, 0, 100),
      y: adjust(degrees.y, -limit.y, limit.y, 0, 100),
      o: 1,
    }
  };
};
