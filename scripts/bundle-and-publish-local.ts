import { execSync } from 'child_process';
import { version } from './toolbox/version';
import { bundle } from './toolbox/toolbox-bundle';
import { publish } from './toolbox/toolbox-publish';
import { invariant } from 'ts-invariant';

enum Channel {
  HEAD = 'head',
  STABLE = 'stable',
}

const channel = process.env.TOOLBOX_CHANNEL;
const bundleOnly = process.env.BUNDLE_ONLY;

// Bundling
console.log(`Bundling '${version}'`);
const bundles = await bundle(version);
if (bundleOnly && bundleOnly === 'true') {
  console.log(`Bundling completed, exiting.`);
  process.exit(0);
}

// Publishing
const SUPPORTED_CHANNELS: string[] = [Channel.HEAD, Channel.STABLE];
if (!channel || !SUPPORTED_CHANNELS.includes(channel)) {
  throw Error(`Environment variable TOOLBOX_CHANNEL must be defined. Supported values: ${SUPPORTED_CHANNELS}`);
}

if (channel === Channel.STABLE) {
  const gitChanges = execSync(`git status --porcelain`);
  invariant(gitChanges.trim() === '', `Can't publish to stable channel if there are pending changes:\n${gitChanges}`);
  const gitRemoteContainsCommit = execSync(`git branch -r --contains HEAD`);
  invariant(gitRemoteContainsCommit !== '', `Current commit must be merged to remote branch before publishing.`);
}

console.log(`Publishing '${version}'`);
await publish(bundles, channel);

if (channel === Channel.STABLE) {
  const tagName = `v${version}`;
  execSync(`git tag -f ${tagName} HEAD`);
  execSync(`git push origin ${tagName}`);
}
