import { execSync } from 'child_process';
import { ToolboxBundle } from './toolbox-bundle';
import { toolboxPublisher } from './toolbox-tools';

export async function publish(bundles: ToolboxBundle[], channel: string) {
  execSync(`ada credentials update --account ${process.env.REPOSITORY_ACCOUNT} --role toolbox-publish-role --once`);
  await Promise.all(
    bundles.map(async (bundle) => {
      const source = `${bundle.outputDir}/${bundle.os}/${bundle.toolVersion}`;
      execSync(
        `${toolboxPublisher} --source ${source} --publish-to s3://buildertoolbox-${process.env.REPOSITORY_NAME}-us-west-2 --channel ${channel} --make-current --verbose`,
      );
    }),
  );
}
