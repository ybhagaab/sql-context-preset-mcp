import fs from 'fs/promises';
import { execSync } from 'child_process';
import { toolboxBundler } from './toolbox-tools';

export interface ToolboxBundle {
  readonly metadata: string;
  readonly root: string;
  readonly outputDir: string;
  readonly toolVersion: string;
  readonly os: string;
}

interface BundleTarget {
  toolboxPlatform: string;
}

const bundleTargets: BundleTarget[] = [
  {
    toolboxPlatform: 'alinux',
  },
  {
    toolboxPlatform: 'alinux_aarch64',
  },
  {
    toolboxPlatform: 'ubuntu',
  },
  {
    toolboxPlatform: 'osx',
  },
  {
    toolboxPlatform: 'osx_arm64',
  },
];

async function writeMetadataJson(root: string): Promise<string> {
  const bundlePath = 'sql-context-presets';
  const metadataJson = {
    Executables: {
      'sql-context-presets': {
        bundlePath: bundlePath,
      },
    },
  };
  const metadataDir = `${root}/tool-metadata`;
  const metadata = `${metadataDir}/metadata.json`;
  await fs.mkdir(metadataDir, { recursive: true });
  await fs.writeFile(metadata, JSON.stringify(metadataJson));
  return metadata;
}

export async function bundle(toolVersion: string): Promise<ToolboxBundle[]> {
  const outputDir = 'build/tool-bundle';
  const applicationRoot = `build/sql-context-presets`;
  const metadataPath = await writeMetadataJson('build');

  // clean build directories
  await fs.rm(outputDir, { recursive: true, force: true });

  return await Promise.all(
    bundleTargets.map(async (target): Promise<ToolboxBundle> => {
      // NpmPrettyMuch already creates an application folder. We only need to bundle the folder.
      // See https://code.amazon.com/packages/NpmPrettyMuch/trees/mainline-1.10#-appname-string-default-undefined-
      execSync(`${toolboxBundler} --root ${applicationRoot} --tool-version ${toolVersion} --output-dir ${outputDir} \
        --os ${target.toolboxPlatform} --metadata ${metadataPath} --verbose`);

      return {
        metadata: metadataPath,
        root: applicationRoot,
        outputDir,
        toolVersion: toolVersion,
        os: target.toolboxPlatform,
      };
    }),
  );
}
