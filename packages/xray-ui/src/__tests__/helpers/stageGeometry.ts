// Mirror of the stage layout formulas (visual-polish-2 design, "Layout math"). CSS is the source of truth;
// this model only lets a property run over many viewports. The e2e measure spec checks it against real rectangles.
export const CROP_ASPECT = 1208 / 1116;
/** Left-most opaque skeleton pixel as a fraction of the photo width (R5.11). */
export const SKELETON_LEFT = 0.2243;
/** Card content estimate in u (design, Layout math). */
export const CARD_CONTENT_U = 138;

export interface StageGeometry {
  u: number;
  lightbox: { left: number; width: number; height: number };
  stage: { left: number; width: number; height: number };
  photoW: number;
  photoH: number;
  /** Photo top, stage relative (bottom aligned). */
  photoTop: number;
  cardTop: number;
  cardHeight: number;
  cardBottom: number;
  ribTop: number;
  /** Space between the card top and the rib top minus 8 u, in px. */
  cardBudgetPx: number;
  panelRight: number;
  skeletonWorstLeft: number;
}

export function stageGeometry(vw: number, vh: number): StageGeometry {
  const u = Math.max(1, Math.min(vw / 1280, vh / 720));
  const lightbox = { left: 14 * u, width: vw - 28 * u, height: vh - 52 * u - 28 * u };
  const stage = { left: lightbox.left + 0.28 * lightbox.width, width: 0.46 * lightbox.width, height: lightbox.height };
  const photoW = Math.min(1.1 * stage.width, 0.92 * stage.height * CROP_ASPECT);
  const photoH = photoW / CROP_ASPECT;
  const photoTop = stage.height - photoH;
  const cardTop = Math.max(2 * u, stage.height - photoH * 1.06);
  const ribTop = photoTop + 0.22 * photoH;
  const cardBudgetPx = ribTop - 8 * u - cardTop;
  const cardHeight = Math.min(CARD_CONTENT_U * u, cardBudgetPx, 160 * u);
  return {
    u,
    lightbox,
    stage,
    photoW,
    photoH,
    photoTop,
    cardTop,
    cardHeight,
    cardBottom: cardTop + cardHeight,
    ribTop,
    cardBudgetPx,
    panelRight: lightbox.left + 0.36 * lightbox.width,
    skeletonWorstLeft: stage.left - (photoW - stage.width) / 2 + SKELETON_LEFT * photoW,
  };
}
