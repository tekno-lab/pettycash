/*! jscanify v1.4.0 | (c) ColonelParrot and other contributors | MIT License */

(function (global, factory) {
  typeof exports === "object" && typeof module !== "undefined"
    ? (module.exports = factory())
    : typeof define === "function" && define.amd
      ? define(factory)
      : ((typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : global)).jscanify = factory());
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this), function () {
  "use strict";

  /**
   * Calculates distance between two points. Each point must have `x` and `y` property
   * @param {*} p1 point 1
   * @param {*} p2 point 2
   * @returns distance between two points
   */
  function distance(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
  }

  class jscanify {
    constructor() { }

    /**
     * Finds the contour of the paper within the image
     * @param {*} img image to process (cv.Mat)
     * @returns the biggest contour inside the image
     */
    /**
     * Finds the contour of the paper within the image.
     * Enforces outer-sheet envelope detection to prevent trapping on inner tables/gridlines.
     * @param {*} img image to process (cv.Mat)
     * @returns the outermost paper contour inside the image (cv.Mat)
     */
    findPaperContour(img) {
      const W = img.cols, H = img.rows;
      const imgArea = W * H;

      // 1. Convert to grayscale & denoise
      const gray = new cv.Mat();
      if (img.channels() >= 3) {
        cv.cvtColor(img, gray, cv.COLOR_RGBA2GRAY);
      } else {
        img.copyTo(gray);
      }

      const blur = new cv.Mat();
      cv.GaussianBlur(gray, blur, new cv.Size(7, 7), 0);

      // Strategy 1: Bright Document Segmentation (Otsu + Large Morphological Closing)
      // Paper receipts are bright foreground shapes on darker desk surfaces.
      // A large morphological closing completely fills inner tables, handwriting, and text into a solid sheet!
      const thresh = new cv.Mat();
      cv.threshold(blur, thresh, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);

      // Verify border luminance: if border is white, invert
      let borderWhiteCount = 0;
      const sampleStep = Math.max(1, Math.floor(W / 24));
      for (let x = 0; x < W; x += sampleStep) {
        if (thresh.ucharPtr(2, x)[0] > 128) borderWhiteCount++;
        if (thresh.ucharPtr(H - 3, x)[0] > 128) borderWhiteCount++;
      }
      if (borderWhiteCount > 20) {
        cv.bitwise_not(thresh, thresh);
      }

      // Morphological closing with a large 21x21 kernel bridges internal table borders & text
      const closeKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(21, 21));
      const closed = new cv.Mat();
      cv.morphologyEx(thresh, closed, cv.MORPH_CLOSE, closeKernel);

      // Strategy 2: Canny edge detection + dilation envelope (fallback for low-contrast backgrounds)
      const edges = new cv.Mat();
      cv.Canny(blur, edges, 25, 90);
      const edgeKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(7, 7));
      const closedEdges = new cv.Mat();
      cv.morphologyEx(edges, closedEdges, cv.MORPH_CLOSE, edgeKernel);

      // Find external contours using RETR_EXTERNAL so internal tables are completely ignored
      const contoursA = new cv.MatVector();
      const hierA = new cv.Mat();
      cv.findContours(closed, contoursA, hierA, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      const contoursB = new cv.MatVector();
      const hierB = new cv.Mat();
      cv.findContours(closedEdges, contoursB, hierB, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      let bestContour = null;
      let bestScore = 0;

      const evaluateContourList = (contours) => {
        for (let i = 0; i < contours.size(); ++i) {
          const c = contours.get(i);
          const area = cv.contourArea(c);
          // Paper sheets typically take 15% - 98% of the camera frame
          if (area < imgArea * 0.12 || area > imgArea * 0.99) continue;

          const hull = new cv.Mat();
          cv.convexHull(c, hull, false, true);
          const hullArea = cv.contourArea(hull);

          const peri = cv.arcLength(hull, true);
          const approx = new cv.Mat();
          cv.approxPolyDP(hull, approx, 0.025 * peri, true);

          const rect = cv.minAreaRect(hull);
          const rw = Math.max(rect.size.width, rect.size.height);
          const rh = Math.min(rect.size.width, rect.size.height);
          const aspect = rh > 0 ? rw / rh : 1;

          // Score prefers larger outer area (full sheet > inner table) and standard paper proportions
          let score = hullArea / imgArea;
          if (approx.rows >= 4 && approx.rows <= 6) score *= 1.4;
          if (aspect >= 1.05 && aspect <= 3.2) score *= 1.25;

          if (score > bestScore) {
            bestScore = score;
            if (bestContour) bestContour.delete();
            bestContour = hull.clone();
          }

          hull.delete();
          approx.delete();
        }
      };

      evaluateContourList(contoursA);
      if (bestScore < 0.20) {
        evaluateContourList(contoursB);
      }

      // Memory cleanup
      gray.delete();
      blur.delete();
      thresh.delete();
      closeKernel.delete();
      closed.delete();
      edges.delete();
      edgeKernel.delete();
      closedEdges.delete();
      contoursA.delete();
      hierA.delete();
      contoursB.delete();
      hierB.delete();

      return bestContour;
    }

    /**
     * Highlights the paper detected inside the image.
     * @param {*} image image to process
     * @param {*} options options for highlighting. Accepts `color` and `thickness` parameter
     * @returns `HTMLCanvasElement` with original image and paper highlighted
     */
    /**
     * Converts image source to canvas if it's a video element
     */
    _prepareSource(image) {
      if (typeof HTMLVideoElement !== "undefined" && image instanceof HTMLVideoElement) {
        const c = document.createElement("canvas");
        c.width = image.videoWidth || 640;
        c.height = image.videoHeight || 480;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(image, 0, 0, c.width, c.height);
        return c;
      }
      return image;
    }

    /**
     * Highlights the paper detected inside the image.
     * @param {*} image image to process
     * @param {*} options options for highlighting. Accepts `color` and `thickness` parameter
     * @returns `HTMLCanvasElement` with original image and paper highlighted
     */
    highlightPaper(image, options) {
      options = options || {};
      options.color = options.color || "orange";
      options.thickness = options.thickness || 10;
      image = this._prepareSource(image);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = cv.imread(image);

      const maxContour = this.findPaperContour(img);
      cv.imshow(canvas, img);
      if (maxContour) {
        const {
          topLeftCorner,
          topRightCorner,
          bottomLeftCorner,
          bottomRightCorner,
        } = this.getCornerPoints(maxContour, img);

        if (
          topLeftCorner &&
          topRightCorner &&
          bottomLeftCorner &&
          bottomRightCorner
        ) {
          ctx.strokeStyle = options.color;
          ctx.lineWidth = options.thickness;
          ctx.beginPath();
          ctx.moveTo(...Object.values(topLeftCorner));
          ctx.lineTo(...Object.values(topRightCorner));
          ctx.lineTo(...Object.values(bottomRightCorner));
          ctx.lineTo(...Object.values(bottomLeftCorner));
          ctx.lineTo(...Object.values(topLeftCorner));
          ctx.stroke();
        }
        maxContour.delete();
      }

      img.delete();
      return canvas;
    }

    /**
     * Extracts and undistorts the image detected within the frame.
     * 
     * Returns `null` if no paper is detected.
     *  
     * @param {*} image image to process (video, canvas, or img)
     * @param {*} resultWidth desired result paper width
     * @param {*} resultHeight desired result paper height
     * @param {*} cornerPoints optional custom corner points, in case automatic corner points are incorrect
     * @returns `HTMLCanvasElement` containing undistorted image
     */
    extractPaper(image, resultWidth, resultHeight, cornerPoints) {
      image = this._prepareSource(image);
      const canvas = document.createElement("canvas");
      const img = cv.imread(image);
      const maxContour = cornerPoints ? null : this.findPaperContour(img);

      if (maxContour == null && cornerPoints === undefined) {
        img.delete();
        return null;
      }

      const {
        topLeftCorner,
        topRightCorner,
        bottomLeftCorner,
        bottomRightCorner,
      } = cornerPoints || this.getCornerPoints(maxContour, img);

      if (!topLeftCorner || !topRightCorner || !bottomLeftCorner || !bottomRightCorner) {
        if (maxContour) maxContour.delete();
        img.delete();
        return null;
      }

      let warpedDst = new cv.Mat();

      let dsize = new cv.Size(resultWidth, resultHeight);
      let srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
        topLeftCorner.x,
        topLeftCorner.y,
        topRightCorner.x,
        topRightCorner.y,
        bottomLeftCorner.x,
        bottomLeftCorner.y,
        bottomRightCorner.x,
        bottomRightCorner.y,
      ]);

      let dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
        0,
        0,
        resultWidth,
        0,
        0,
        resultHeight,
        resultWidth,
        resultHeight,
      ]);

      let M = cv.getPerspectiveTransform(srcTri, dstTri);
      cv.warpPerspective(
        img,
        warpedDst,
        M,
        dsize,
        cv.INTER_LINEAR,
        cv.BORDER_CONSTANT,
        new cv.Scalar()
      );

      cv.imshow(canvas, warpedDst);

      img.delete();
      warpedDst.delete();
      srcTri.delete();
      dstTri.delete();
      M.delete();
      if (maxContour) maxContour.delete();
      return canvas;
    }

    /**
     * Calculates the corner points of a contour.
     * @param {*} contour contour from {@link findPaperContour}
     * @param {*} img optional cv.Mat image for bounds fallback
     * @returns object with properties `topLeftCorner`, `topRightCorner`, `bottomLeftCorner`, `bottomRightCorner`, each with `x` and `y` property
     */
    getCornerPoints(contour, img) {
      const W = img ? img.cols : 800;
      const H = img ? img.rows : 1100;

      if (!contour || !contour.data32S || contour.data32S.length < 8) {
        return {
          topLeftCorner: { x: Math.round(W * 0.05), y: Math.round(H * 0.05) },
          topRightCorner: { x: Math.round(W * 0.95), y: Math.round(H * 0.05) },
          bottomRightCorner: { x: Math.round(W * 0.95), y: Math.round(H * 0.95) },
          bottomLeftCorner: { x: Math.round(W * 0.05), y: Math.round(H * 0.95) }
        };
      }

      // Check polygon approximation for clean 4-quadrilateral
      const peri = cv.arcLength(contour, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(contour, approx, 0.028 * peri, true);

      let pts = [];
      if (approx.rows === 4) {
        for (let i = 0; i < 4; i++) {
          pts.push({ x: approx.data32S[i * 2], y: approx.data32S[i * 2 + 1] });
        }
      } else {
        for (let i = 0; i < contour.data32S.length; i += 2) {
          pts.push({ x: contour.data32S[i], y: contour.data32S[i + 1] });
        }
      }
      approx.delete();

      // Mathematically invariant 4-corner projection:
      // Top-Left: minimizes (x + y)
      // Bottom-Right: maximizes (x + y)
      // Top-Right: maximizes (x - y)
      // Bottom-Left: minimizes (x - y)
      let tl = pts[0], tr = pts[0], br = pts[0], bl = pts[0];
      let minSum = pts[0].x + pts[0].y;
      let maxSum = pts[0].x + pts[0].y;
      let maxDiff = pts[0].x - pts[0].y;
      let minDiff = pts[0].x - pts[0].y;

      for (let i = 1; i < pts.length; i++) {
        const p = pts[i];
        const s = p.x + p.y;
        const d = p.x - p.y;

        if (s < minSum) { minSum = s; tl = p; }
        if (s > maxSum) { maxSum = s; br = p; }
        if (d > maxDiff) { maxDiff = d; tr = p; }
        if (d < minDiff) { minDiff = d; bl = p; }
      }

      const clamp = p => ({
        x: Math.max(0, Math.min(W, Math.round(p.x))),
        y: Math.max(0, Math.min(H, Math.round(p.y)))
      });

      return {
        topLeftCorner: clamp(tl),
        topRightCorner: clamp(tr),
        bottomRightCorner: clamp(br),
        bottomLeftCorner: clamp(bl)
      };
    }
  }

  return jscanify;
});
