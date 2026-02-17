# Sql-context-presets

## Build and Test

We use `tsc` to bundle the project to `dist`.

There are several ways to test during your development:

- Unit test
- Use [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector) to test the full protocol in a visualized website.
  Note that MCP Inspector does not support dynamic resource feature.

  ```bash
  brazil-build run inspector -- node dist/index.js
  ```

- Directly integrate with AI-assistants that support MCP: Q Developer, Cline. This is an example of the MCP client side configuration:

  ```json
  {
    "mcpServers": {
      "sql-context-presets-workspace": {
        "disabled": false,
        "command": "node",
        "args": ["/<path-to-your-workspace>/src/Sql-context-presets/dist/index.js"],
        "env": {},
        "transportType": "stdio"
      }
    }
  }
  ```
  
## [Option 1] Vend to Amazon-internal MCP Registry using AIM CLI

### Prerequisite

- Test your MCP server as described in the section above.
- Build this package in a Brazil version set. This version set will vend MCP server from package artifacts.
<!-- TODO: Add BuilderHub article link once available -->

### Creation

- Choose a unique ID <MCP_SERVER_ID>. ID must end with `mcp`. ie. `my-awesome-mcp`. Customers will install server using this ID.
- Choose a name <MCP_SERVER_NAME>. Name should be human-readable and will be shown on MCP Registry website.
- Run the following command to create bundle for your MCP server (local):

```bash
aim mcp create package-artifact-mcp \
  --id <MCP_SERVER_ID> \
  --name <MCP_SERVER_NAME> \
  --packageMajorVersion Sql-context-presets-1.0 \
  --version-set <VERSION_SET> \
  --artifact-runtime node \
  --description <DESCRIPTION>
```
#### Test the bundle before publishing

Test your bundle using MCP inspector:

```bash
brazil-build run inspector <MCP_SERVER_ID>
```

### Publish your MCP server into Registry

- MCP server is treated as a Bindle resource. Choose a parent bindle id where this new resource will be created.
- Your team's CTI information

```bash
aim mcp publish \
  --id <MCP_SERVER_ID> \
  --bindleId <BINDLE_ID> \
  --cti <C/T/I>
```

- Once published, server can be found here: https://console.harmony.a2z.com/mcp-registry/

## [Option 2] Vend to toolbox

### Prerequisite

- Follow [toolbox document](https://docs.hub.amazon.dev/builder-toolbox/user-guide/vending/) to create your own vending infrastructure.
- ⚠️ ([GP-6194](https://taskei.amazon.dev/tasks/GP-6194)) There will be a specialized MCP Registry CLI and Pipeline Target
  to publish to centralized MCP registry. It will replace toolbox as the vending solution for MCP soon.

### Bundling

Run `brazil-build run toolbox:bundle` to create bundles `build/tool-bundle`.

#### How does it work

When appName is defined [npm-pretty-much](https://code.amazon.com/packages/NpmPrettyMuch/trees/mainline-1.10#-appname-string-default-undefined-)
will install your module and its production dependencies into the build/ directory.

```
build/sql-context-presets
├── sql-context-presets
├── dist
├── node_modules
├── package.json
└── README.md
```

`sql-context-presets` is an executable bash script. It is the entry point of the toolbox tool. The script checks `node` runtime availability, and runs `node ${SCRIPT_DIR}dist/index.js`.

The `toolbox:bundle` target simply creates toolbox metadata file and tarball the application folder above to `build/tool-bundle` for each platform
specified under `scripts/toolbox/toolbox-bundle.ts`. Note that Windows is not supported yet.

```text
build/tool-bundle
├── <platform1>
│   ├── <version>.json
│   └── <version>.tar.gz
└── <platform2>
    ├── <version>.json
    └── <version>.tar.gz
```

#### Test the bundle before publishing

You can test your bundle using MCP inspector:

```bash
brazil-build run inspector -- build/sql-context-presets/sql-context-presets ""
```

Or configure your AI assistant:

```json
{
  "mcpServers": {
    "sql-context-presets-bundle": {
      "disabled": false,
      "command": "node",
      "args": [
        "/<path-to-your-workspace>/src/Sql-context-presets/build/sql-context-presets/sql-context-presets"
      ],
      "env": {},
      "transportType": "stdio"
    }
  }
}
```

### Publishing

⚠️ If your vending infrastructure account is in Conduit, update `scripts/toolbox/toolbox-publish.ts` with the ADA command for conduit.

You should set environment variable `REPOSITORY_ACCOUNT`, `REPOSITORY_NAME`, and `REGISTRY_NAME`, based on your own toolbox infrastructure.

Run `brazil-build run toolbox:publish-head` to publish the bundle to your own toolbox repository `head` channel.

Then you should test installing the tool from toolbox:

```bash
toolbox registry add s3://buildertoolbox-registry-${REGISTRY_NAME}-us-west-2/tools.json \
&& toolbox install sql-context-presets --force --channel head
```

After installation, you can test your bundle using MCP inspector:

```bash
brazil-build run inspector -- sql-context-presets ""
```

Or configure your AI assistant:

```json
{
  "mcpServers": {
    "sql-context-presets-toolbox": {
      "disabled": false,
      "command": "sql-context-presets",
      "args": [],
      "env": {},
      "transportType": "stdio"
    }
  }
}
```

Once you've tested the tool, you can publish to stable channel: `brazil-build run toolbox:publish-stable`.

Note that you should always update the package version before publishing newer version. If you still have unpushed or uncommitted code locally, you won't be able to publish to stable channel.

### Vending with runtime

We do not create a binary bundle with `node` runtime as a Single Executable Application (SEA) because SEA relies on a copy of `node` runtime. In Brazil, `node` runtime comes from NodeJS package, which [compiles the runtime with CFlags](https://code.amazon.com/packages/NodeJS/blobs/4c205f332a719615fd28702ba21a7438758d65dd/--/build-tools/bin/config-make-install#L216-L220), but the required glibc libraries may not be available in the end-user's environment. For example, in AL2 Cloud Desktop, running the `node` from AL2_x86_64 platform will cause error:

```bash
/lib64/libstdc++.so.6: version `GLIBCXX_3.4.26' not found
```

NodeJS Brazil package works in Brazil because most applications use runtime closure, which will include other build artifacts from NodeJS package, including the compatible GLIBC libraries and a [bash wrapper](https://code.amazon.com/packages/NodeJS/blobs/4c205f332a719615fd28702ba21a7438758d65dd/--/build-tools/bin/config-make-install#L283-L286) that configures `LD_LIBRARY_PATH` properly.

Current existing MCP servers such as `amzn-mcp` uses Peru as the build system, where `node` runtime is installed specifically for the bundling environment (e.g. on AL2 Cloud Desktop), therefore it is compatible with the same environment in other users' machines.

If you wish to create a bundle with runtime, you can switch to Peru, but be mindful about the Peru availability of your 1st party dependencies. If you want to stay in Brazil, you can explore containerized build and use the runtime from container.
