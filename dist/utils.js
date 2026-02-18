import { findUpSync } from 'find-up-simple';
import { readFileSync } from 'fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const LOGIN_REGEX = /^[a-z]{3,8}$/;
export function getPackageVersion() {
    let currentModulePath = import.meta.dirname;
    if (!currentModulePath) {
        currentModulePath = dirname(fileURLToPath(import.meta.url));
    }
    const packageJsonPath = findUpSync('package.json', { cwd: currentModulePath });
    if (!packageJsonPath) {
        throw new Error(`Could not find up package.json from ${currentModulePath}`);
    }
    return JSON.parse(readFileSync(packageJsonPath, 'utf8')).version;
}
export function validateAmazonLogin(login) {
    if (!LOGIN_REGEX.test(login)) {
        throw new Error(`Invalid login syntax. Must match regex ${LOGIN_REGEX}`);
    }
}
