import { parseManifest } from '../domain/extension';
import type { ExtensionManifest } from '../contracts/extension';
import { sampleHelloManifest } from './sample-hello.manifest';
import { workosJiraManifest } from './workos-jira.manifest';

/**
 * Catalog of first-party extensions shipped with the app.
 *
 * To add a new extension:
 *   1. Create `<id>.manifest.ts` next to this file exporting a manifest object.
 *   2. Import it here and push it into BUILTIN_EXTENSIONS.
 *   3. Restart the dev server. The manifest is validated at boot via
 *      parseManifest — invalid catalog entries crash early.
 */
const RAW_MANIFESTS: unknown[] = [sampleHelloManifest, workosJiraManifest];

export const BUILTIN_EXTENSIONS: ExtensionManifest[] = RAW_MANIFESTS.map((raw, idx) => {
  try {
    return parseManifest(raw);
  } catch (err) {
    throw new Error(
      `[builtin-extensions] catalog entry #${idx} is invalid: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
});
