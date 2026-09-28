import { test, expect, type Page } from "@playwright/test";
const headline = "Court treats VSOP exit payout as salary, not capital gain";
async function select(page: Page, label: string, value: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: value, exact: true }).click();
}
async function addSignal(page: Page, type: string, url: string, label: string) {
  await page.getByRole("button", { name: "Add signal", exact: true }).click();
  await select(page, "Type", type);
  await page.getByLabel("URL", { exact: true }).fill(url);
  await page.getByLabel("Label (optional)", { exact: true }).fill(label);
  await page
    .locator(".signal-form")
    .getByRole("button", { name: "Add signal", exact: true })
    .click();
}
for (let rehearsal = 1; rehearsal <= 3; rehearsal++)
  test(`Complete clean ESOP rehearsal ${rehearsal}`, async ({
    page,
    context,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/?reset=1");
    await expect(
      page.getByRole("heading", {
        name: "Tell us what to watch. We handle the rest.",
      }),
    ).toBeVisible();
    await expect(page.locator(".first-login")).not.toContainText("ESOP");
    await page
      .getByRole("button", { name: "Create monitoring profile", exact: true })
      .click();
    await expect(page.getByLabel("What should we monitor?")).toHaveValue("");
    await expect(
      page.getByRole("button", { name: "Continue", exact: true }),
    ).toBeDisabled();
    await page.reload();
    await page.getByLabel("What should we monitor?").fill("ESOP");
    const start = Date.now();
    await page
      .getByRole("button", { name: "Suggest legal topics", exact: true })
      .click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Turning your keywords into legal topics" }),
    ).toBeVisible();
    await expect(page.locator(".topic-card")).toHaveCount(6);
    expect(Date.now() - start).toBeGreaterThanOrEqual(1500);
    await page
      .getByRole("button", {
        name: "Edit Taxation of employee participations",
        exact: true,
      })
      .click();
    await page
      .getByRole("textbox", { name: "Topic title", exact: true })
      .fill("Taxation of employee participations — Fintara");
    await page.getByRole("button", { name: "Save title", exact: true }).click();
    await page
      .getByRole("checkbox", {
        name: "Select Employer reporting obligations",
        exact: true,
      })
      .uncheck();
    await page
      .getByRole("button", {
        name: "Delete Share capital for option plans",
        exact: true,
      })
      .click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Select sources", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("switch", { name: "economiesuisse", exact: true }),
    ).toBeChecked();
    await page
      .getByRole("switch", { name: "economiesuisse", exact: true })
      .uncheck();
    await select(page, "Canton", "Bern");
    await expect(
      page.getByRole("switch", {
        name: "Cantonal Tax Office Bern",
        exact: true,
      }),
    ).toBeChecked();
    await expect(
      page.getByRole("switch", {
        name: "Cantonal Tax Office Zurich",
        exact: true,
      }),
    ).toBeChecked();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.locator(".topic-card")).toHaveCount(5);
    await expect(
      page.getByRole("heading", {
        name: "Taxation of employee participations — Fintara",
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(
      page.getByRole("switch", { name: "economiesuisse", exact: true }),
    ).not.toBeChecked();
    await page.reload();
    await page.getByRole("button", { name: "Add signal", exact: true }).click();
    await page.getByLabel("URL", { exact: true }).fill("not-a-url");
    await page
      .locator(".signal-form")
      .getByRole("button", { name: "Add signal", exact: true })
      .click();
    await expect(
      page.getByText("Enter a valid URL.", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await addSignal(
      page,
      "LinkedIn page",
      "https://www.linkedin.com/company/walder-wyss/",
      "Competing law firm",
    );
    await addSignal(
      page,
      "newsletter",
      "https://ledgy.com/newsletter",
      "Ledgy newsletter",
    );
    await expect(page.getByText("requested", { exact: true })).toHaveCount(2);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.reload();
    await page
      .getByRole("radio", { name: "Weekly digest", exact: true })
      .check();
    await expect(
      page.getByText("Weekly digest preview", { exact: false }),
    ).toBeVisible();
    await page.getByRole("radio", { name: "Both", exact: true }).check();
    await page.getByRole("radio", { name: "All matches", exact: true }).check();
    await expect(page.locator(".alert-preview")).toContainText("All matches");
    await page
      .getByRole("radio", { name: "Only high relevance", exact: true })
      .check();
    await expect(
      page.getByRole("button", { name: "Teams — Coming soon", exact: true }),
    ).toBeDisabled();
    await page.getByText("View as JSON", { exact: true }).click();
    const json = JSON.parse(
      await page.locator(".json-disclosure pre").innerText(),
    );
    expect(
      json.sources.find((s: { name: string }) => s.name === "economiesuisse")
        .active,
    ).toBe(false);
    expect(json.topics.length).toBe(5);
    expect(json.delivery.frequency).toBe("both");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Activate monitoring", exact: true }),
    ).toBeDisabled();
    await page
      .getByLabel("Profile name", { exact: true })
      .fill("Fintara AG: ESOP");
    await page
      .getByRole("button", { name: "Activate monitoring", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Your monitoring profile is live",
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Go to feed", exact: true }).click();
    await expect(page.getByTestId("update-row")).toHaveCount(4);
    await page.reload();
    await expect(page.getByTestId("update-row")).toHaveCount(4);
    await select(page, "Relevance", "High");
    await expect(page.getByTestId("update-row")).toHaveCount(2);
    await select(page, "Relevance", "All relevance");
    await page.getByRole("button", { name: headline, exact: true }).click();
    await expect(
      page.getByRole("heading", {
        name: "Why it matters for Fintara AG",
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page
      .getByRole("button", { name: "Add private note", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Private note", exact: true })
      .fill("Discuss treatment with Fintara founders.");
    await page.getByRole("button", { name: "Save note", exact: true }).click();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Saved", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Discuss treatment with Fintara founders.", {
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Copy summary", exact: true })
      .click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toContain(headline);
    await page
      .getByRole("button", { name: "Original source", exact: true })
      .click();
    await expect(
      page.getByText("AIx sample scenario", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Back to update", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Not relevant", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Reason (optional)", exact: true })
      .fill("Already reviewed");
    await page
      .getByRole("button", { name: "Confirm feedback", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Back to feed", exact: true })
      .click();
    await expect(page.getByTestId("update-row")).toHaveCount(3);
    await page
      .getByRole("button", { name: "Manage profile", exact: true })
      .click();
    await expect(page.getByTestId("update-row")).toHaveCount(4);
    await expect(page.locator(".history")).toContainText("Not relevant");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
test("recovery, offline reload, PDF, profile actions and mobile layout", async ({
  page,
  context,
}) => {
  await page.goto("/?state=feed");
  await expect(page.getByTestId("update-row")).toHaveCount(4);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.getByRole("button", { name: headline, exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: headline, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Export PDF", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF", exact: true }).click();
  const download = await downloadPromise;
  await download.saveAs("test-results/aix-update.pdf");
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  await context.setOffline(false);
  await page.getByRole("button", { name: "Back to feed", exact: true }).click();
  await page
    .getByRole("button", { name: "Manage profile", exact: true })
    .click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Resume", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.getByRole("button", { name: "Duplicate", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Copy of Fintara AG: ESOP",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("No updates yet.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Profile name", exact: true })
    .fill("wrong");
  await expect(
    page.getByRole("button", { name: "Delete profile", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("textbox", { name: "Profile name", exact: true })
    .fill("Copy of Fintara AG: ESOP");
  await page
    .getByRole("button", { name: "Delete profile", exact: true })
    .click();
  await expect(page.locator(".profile-list article")).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?state=feed");
  await expect(page.getByTestId("update-row")).toHaveCount(4);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/mobile-feed.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.screenshot({
    path: "test-results/desktop-feed.png",
    fullPage: true,
  });
  await page.goto("/?reset=1");
  await expect(
    page.getByRole("button", {
      name: "Create monitoring profile",
      exact: true,
    }),
  ).toBeVisible();
});
test("unknown query, custom topic, filters and missing route recovery", async ({
  page,
}) => {
  await page.goto("/?reset=1");
  await page
    .getByRole("button", { name: "Create monitoring profile", exact: true })
    .click();
  await page.getByLabel("What should we monitor?").fill("Unrelated inquiry");
  await page
    .getByRole("button", { name: "Suggest legal topics", exact: true })
    .click();
  await expect(
    page.getByText("No topics found. Add your own topic to continue.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add my own topic", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Topic title", exact: true })
    .fill("Own topic");
  await page.getByRole("button", { name: "Add topic", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Continue", exact: true }),
  ).toBeEnabled();
  await page.goto("/?state=feed");
  await page
    .getByRole("textbox", { name: "Search updates", exact: true })
    .fill("VSOP");
  await expect(page.getByTestId("update-row")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await page.getByLabel("From date", { exact: true }).fill("2026-09-23");
  await page.getByLabel("To date", { exact: true }).fill("2026-09-25");
  await expect(page.getByTestId("update-row")).toHaveCount(2);
  await page.goto("/updates/missing");
  await expect(
    page.getByRole("heading", { name: "Update unavailable", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Go to feed", exact: true }).click();
  await expect(page.getByTestId("update-row")).toHaveCount(4);
});
test("settings, malformed storage, canton removal, signal toggles and regeneration lock", async ({
  page,
}) => {
  await page.goto("/?state=feed");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Anna Example");
  await page.getByLabel("Firm", { exact: true }).fill("Zurich law firm");
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await page.reload();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Anna Example",
  );
  await page.getByRole("button", { name: "Set password", exact: true }).click();
  await page
    .getByLabel("New password", { exact: true })
    .fill("aix-local-password");
  await page
    .getByRole("button", { name: "Save password", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Change password", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "New profile", exact: true }).click();
  await page.getByLabel("What should we monitor?").fill("ESOP");
  await page
    .getByRole("button", { name: "Suggest legal topics", exact: true })
    .click();
  await expect(page.locator(".topic-card")).toHaveCount(6);
  await page
    .getByRole("button", {
      name: "Delete Share capital for option plans",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Regenerate", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Continue", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".topic-card")).toHaveCount(6);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.locator(".topic-card")).toHaveCount(6);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await select(page, "Canton", "Bern");
  await page
    .getByRole("button", { name: "Remove canton Bern", exact: true })
    .click();
  await expect(
    page.getByRole("switch", { name: "Cantonal Tax Office Bern", exact: true }),
  ).toHaveCount(0);
  await addSignal(page, "RSS", "https://example.com/rss", "Example feed");
  await page
    .getByRole("switch", { name: "Activate signal Example feed", exact: true })
    .uncheck();
  await expect(page.locator(".signals")).toContainText("0 of 1 active");
  await page.evaluate(() =>
    localStorage.setItem(
      "helvetic-lens-aix:v1",
      JSON.stringify({
        version: 1,
        profiles: [null],
        updates: [],
        account: { defaults: {} },
      }),
    ),
  );
  await page.goto("/");
  await expect(
    page.getByRole("button", {
      name: "Create monitoring profile",
      exact: true,
    }),
  ).toBeVisible();
});
