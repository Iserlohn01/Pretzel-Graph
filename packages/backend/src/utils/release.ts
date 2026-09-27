import { readFileSync } from 'fs';
import path from 'path';

const ROOT_PACKAGE_NAME = 'pretzel-graph';

// Walks up from here to the repository's root package.json, which is the same file in the tree and in every image.
function readRelease(): string {
    for (let dir = __dirname; dir !== path.dirname(dir); dir = path.dirname(dir)) {
        try {
            const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')) as { name?: string, version?: string };

            if (pkg.name === ROOT_PACKAGE_NAME && pkg.version)
                return pkg.version;
        }
        catch {}
    }

    throw new Error(`No ${ROOT_PACKAGE_NAME} package.json above ${__dirname}`);
}

/** The PretzelGraph version this backend runs, e.g. 0.0.732. */
export const RELEASE = readRelease();
