import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createHomeBounds } from "../src/lib/cameraFraming";
import { Vector3 } from "three";
import { openLibrarySections } from './helpers/library';

async function ready(page: Page) {
  await page.goto("/");
  await openLibrarySections(page);
  await expect(page.locator(".model-thumbnail img")).toHaveCount(9);
  await expect(page.locator(".scene-item")).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "Place Breadboard", exact: true }),
  ).toBeEnabled();
}

test("renders the actual assets, independent copies, and keyboard editing", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await ready(page);
  await expect(page.locator("canvas")).toHaveCount(1);
  await page.screenshot({ path: "artifacts/workspace-desktop.png" });
  for (const card of await page.locator(".model-card").all())
    await card.getByRole("button", { name: "Add at view center" }).click();
  await expect(page.locator(".scene-item")).toHaveCount(12);
  await page.locator('.scene-item').filter({ hasText: 'Slide Switch' }).click();
  await expect(page.locator(".selection-panel")).toContainText("Slide Switch");
  await page.keyboard.press("r");
  await expect(page.locator(".selection-position")).toContainText("180°");
  const beforeMove = await page.locator(".selection-position").innerText();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".selection-position")).not.toHaveText(beforeMove);
  await page.getByRole("button", { name: "Snap to grid", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Snap to grid", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  const beforeFreeMove = await page.locator(".selection-position").innerText();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".selection-position")).not.toHaveText(
    beforeFreeMove,
  );
  await page.keyboard.press("Delete");
  await expect(page.locator(".scene-item")).toHaveCount(11);
  await page.locator(".scene-item").filter({ hasText: "LED" }).first().click();
  await expect(page.locator(".selection-position")).toContainText("0°");
  await page.getByRole("button", { name: "Focus selected component" }).click();
  await page.screenshot({ path: "artifacts/led-inspection.png" });
  await page.reload();
  await expect(page.locator(".scene-item")).toHaveCount(3);
  expect(errors).toEqual([]);
});

test("placement preview, cancellation, snapped dragging and release outside canvas", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("button", { name: "Place LED", exact: true }).click();
  await expect(page.locator(".placement-banner")).toBeVisible();
  await page.mouse.move(850, 580);
  await page.screenshot({ path: "artifacts/placement-preview.png" });
  await page.keyboard.press("Escape");
  await expect(page.locator(".placement-banner")).toHaveCount(0);
  await expect(page.locator(".scene-item")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Place Breadboard", exact: true })
    .click();
  await page.mouse.click(850, 580);
  await expect(page.locator(".scene-item")).toHaveCount(4);
  await expect(page.locator(".placement-banner")).toHaveCount(0);
  // Grab the central trench in top view; terminal clicks now start wires.
  await page.getByRole('button', { name: 'Top', exact: true }).click();
  await page.getByRole("button", { name: "Focus selected component" }).click();
  const before = await page.locator(".selection-position").innerText();
  const canvas = await page.locator("canvas").boundingBox();
  if (!canvas) throw new Error("Missing canvas");
  const center = {
    x: canvas.x + canvas.width / 2,
    y: canvas.y + canvas.height / 2,
  };
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x + 110, center.y + 30, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator(".selection-position")).not.toHaveText(before);
  const position = await page.locator(".selection-position").innerText();
  expect(position).toMatch(/X -?\d+\.0 · Z -?\d+\.0/);
  await page.getByRole("button", { name: "Focus selected component" }).click();
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(1250, center.y, { steps: 10 });
  await page.mouse.up();
  await expect(page.locator("canvas")).not.toHaveCSS("cursor", "grabbing");
  await page.getByRole("button", { name: "Home", exact: true }).click();
  const imageBefore = await page.locator("canvas").screenshot();
  await page.mouse.move(750, 350);
  await page.mouse.down();
  await page.mouse.move(800, 380, { steps: 8 });
  await page.mouse.up();
  const imageAfter = await page.locator("canvas").screenshot();
  expect(imageAfter.equals(imageBefore)).toBe(false);
});

test("camera navigation, presets, deselection, and empty scene framing", async ({
  page,
}) => {
  await ready(page);
  for (const name of [
    "Top",
    "Front",
    "Home",
    "Zoom in",
    "Zoom out",
    "Fit all components",
  ]) {
    const before = await page.locator("canvas").screenshot();
    await page.getByRole("button", { name, exact: true }).click();
    const after = await page.locator("canvas").screenshot();
    expect(after.equals(before)).toBe(false);
  }
  const beforePan = await page.locator("canvas").screenshot();
  await page.mouse.move(800, 400);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(890, 440, { steps: 8 });
  await page.mouse.up({ button: "right" });
  expect((await page.locator("canvas").screenshot()).equals(beforePan)).toBe(
    false,
  );
  const beforeWheel = await page.locator("canvas").screenshot();
  await page.mouse.wheel(0, -250);
  await expect
    .poll(async () =>
      (await page.locator("canvas").screenshot()).equals(beforeWheel),
    )
    .toBe(false);
  const beforeShift = await page.locator("canvas").screenshot();
  await page.keyboard.down("Shift");
  await page.mouse.down();
  await page.mouse.move(820, 470, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  expect((await page.locator("canvas").screenshot()).equals(beforeShift)).toBe(
    false,
  );
  await page.locator(".scene-item").first().click();
  await page.mouse.click(950, 850);
  await expect(page.locator(".selection-panel")).toHaveCount(0);
  for (let count = 3; count > 0; count--) {
    await page.locator(".scene-item").first().click();
    await page
      .getByRole("button", { name: "Delete component", exact: true })
      .click();
    await expect(page.locator(".scene-item")).toHaveCount(count - 1);
  }
  await page.getByRole("button", { name: "Fit all components" }).click();
  await expect(page.locator(".status-bar")).toContainText("0 components");
  await page.screenshot({ path: "artifacts/empty-workspace.png" });
});

test("Home uses fixed work-area bounds while Fit All includes distant parts", async ({
  page,
}) => {
  await ready(page);
  const homeSize = createHomeBounds(0.165).getSize(new Vector3());
  expect(homeSize.x).toBeCloseTo(0.165 + 0.12);
  expect(homeSize.y).toBeCloseTo(0.165 * 0.35);
  expect(homeSize.z).toBeCloseTo(0.165 * 0.7);

  await page
    .locator(".model-card")
    .filter({ hasText: "Full-Size Breadboard" })
    .getByRole("button", { name: "Add at view center" })
    .click();
  for (let step = 0; step < 80; step++) await page.keyboard.press("ArrowRight");

  await page.getByRole("button", { name: "Home", exact: true }).click();
  const homeView = await page.locator("canvas").screenshot();

  await page.getByRole("button", { name: "Fit all components" }).click();
  const fitted = await page.locator("canvas").screenshot();
  expect(fitted.equals(homeView)).toBe(false);
});

for (const [id, label] of [["power", "Bench DC Power Supply"], ["breadboard-large", "Full-Size Breadboard"], ["slide-switch", "Slide Switch"], ["resistors", "Resistor"]]) test(`${id} failure stays isolated and can be retried without resetting edits`, async ({
  page,
}) => {
  let block = true;
  await page.route(`**/models/${id}.glb*`, (route) =>
    block ? route.abort() : route.continue(),
  );
  await page.goto("/");
  await openLibrarySections(page);
  await expect(page.locator(".asset-error")).toContainText(
    "Model could not load",
  );
  await expect(
    page.getByRole("button", { name: "Place Breadboard", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".model-thumbnail img")).toHaveCount(8);
  await page
    .locator('.model-card')
    .filter({ has: page.getByRole('button', { name: 'Place Breadboard', exact: true }) })
    .getByRole("button", { name: "Add at view center" })
    .click();
  await expect(page.locator(".scene-item")).toHaveCount(4);
  block = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.locator(".model-thumbnail img")).toHaveCount(9);
  await expect(page.locator(".scene-item")).toHaveCount(4);
  await expect(
    page.getByRole("button", {
      name: `Place ${label}`,
      exact: true,
    }),
  ).toBeEnabled();
});

test("narrow viewport keeps the grid usable with a collapsible library", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".scene-item")).toHaveCount(3);
  await expect(page.getByRole("complementary")).toBeHidden();
  await page.getByRole("button", { name: "Toggle component library" }).click();
  await expect(page.getByRole("complementary")).toBeVisible();
  await page.screenshot({ path: "artifacts/mobile-library.png" });
  await page
    .getByRole("button", { name: "Place Breadboard", exact: true })
    .click();
  await expect(page.getByRole("complementary")).toBeHidden();
  await page.mouse.click(270, 450);
  await expect(page.locator(".scene-item")).toHaveCount(4);
  await page.screenshot({ path: "artifacts/mobile-workspace.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.getByRole("complementary")).toBeVisible();
  await page.getByRole("button", { name: "Fit all components" }).click();
  await expect(page.locator(".scene-item")).toHaveCount(4);
});

test("WebGL unavailable shows a usable fallback", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      ...args: Parameters<typeof original>
    ) {
      if (String(args[0]).startsWith("webgl")) return null;
      return original.apply(this, args);
    } as typeof original;
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "3D view unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reload workspace" }),
  ).toBeVisible();
});
