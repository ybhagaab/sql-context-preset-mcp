import { execSync } from 'child_process';

/**
 * The package BuilderToolboxBundler provides the tools to bundle and publish Toolbox tools.
 *
 * Depending on where you run the tool, the platform various.
 */
const toolboxArtifacts = execSync("brazil-path '[BuilderToolboxBundler]pkg.runtimefarm'", { encoding: 'utf-8' }).trim();
export const isOsx = execSync('uname -v', { encoding: 'utf-8' }).toLowerCase().includes('darwin');

const toolboxToolsBaseDir = `${toolboxArtifacts}/bin`;
const toolboxToolsDir = isOsx ? `${toolboxToolsBaseDir}/darwin_amd64` : toolboxToolsBaseDir;

export const toolboxBundler = `${toolboxToolsDir}/toolbox-bundler`;
export const toolboxPublisher = `${toolboxToolsDir}/toolbox-publisher`;
