import { expect, test } from "@playwright/test";

interface ProductionReadiness {
  status: "ready";
  service: "strategy-game";
  release: { version: string; commit: string; buildTime: string };
  checks: {
    manifest: "ok";
    criticalAssets: "ok";
    renderer: "ok";
    game: "ok";
  };
}

test("el despliegue publicado corresponde al commit esperado y está listo", async ({
  page,
  request,
}) => {
  const productionUrl = process.env.PRODUCTION_URL;
  const expectedCommit = process.env.EXPECTED_COMMIT_SHA;
  expect(productionUrl, "PRODUCTION_URL must be configured").toBeTruthy();
  expect(expectedCommit, "EXPECTED_COMMIT_SHA must be configured").toMatch(/^[a-f0-9]{40}$/);

  const failures: string[] = [];
  const expectedOrigin = new URL(productionUrl!).origin;
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console: ${message.text()}`);
  });
  page.on("requestfailed", (request) => {
    if (new URL(request.url()).origin === expectedOrigin) {
      failures.push(`requestfailed: ${request.method()} ${request.url()}`);
    }
  });
  page.on("response", (response) => {
    if (new URL(response.url()).origin === expectedOrigin && response.status() >= 400) {
      failures.push(`http ${response.status()}: ${response.url()}`);
    }
  });

  await test.step("Cuando se abre la URL de producción", async () => {
    const response = await page.goto(new URL("/", productionUrl!).href, {
      waitUntil: "domcontentloaded",
    });
    expect(response, "production did not return a document response").not.toBeNull();
    expect(response!.ok(), `production returned HTTP ${response!.status()}`).toBe(true);
    expect(new URL(page.url()).origin).toBe(expectedOrigin);
  });

  await test.step("Entonces existe una única superficie de juego lista", async () => {
    const root = page.getByTestId("game-root");
    await expect(root).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
    await expect(page.getByTestId("game-canvas")).toHaveCount(1);
    await expect(page.getByTestId("game-canvas")).toBeVisible();
  });

  await test.step("Y el endpoint de salud confirma release, assets y renderer", async () => {
    const healthUrl = new URL("/health/ready", productionUrl!);
    healthUrl.searchParams.set("expectedCommit", expectedCommit!);
    const response = await request.get(healthUrl.href, {
      headers: { "cache-control": "no-cache" },
    });
    expect(response.ok(), `health endpoint returned HTTP ${response.status()}`).toBe(true);

    const readiness = (await response.json()) as ProductionReadiness;
    expect(readiness).toEqual({
      status: "ready",
      service: "strategy-game",
      release: {
        version: expect.stringMatching(/^\d+\.\d+\.\d+/),
        commit: expectedCommit,
        buildTime: expect.any(String),
      },
      checks: { manifest: "ok", criticalAssets: "ok", renderer: "ok", game: "ok" },
    });
    const buildTime = Date.parse(readiness.release.buildTime);
    expect(Number.isNaN(buildTime)).toBe(false);
    expect(buildTime).toBeLessThanOrEqual(Date.now() + 60_000);
  });

  expect(failures, `browser failures:\n${failures.join("\n")}`).toEqual([]);
});
