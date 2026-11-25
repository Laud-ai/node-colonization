// 0.22.0: the pre-0.22 specs exercise the docked side windows → start their games with floatingWindows off.
import type { Page } from "@playwright/test";
export async function useDockedLayout(page: Page): Promise<void> {
  await page.locator('[data-setup-tab="rules"]').click();
  const box = page.locator('[data-rule="floatingWindows"]');
  if (await box.isChecked()) await box.uncheck();
  await page.locator('[data-setup-tab="fervor"]').click();
}
