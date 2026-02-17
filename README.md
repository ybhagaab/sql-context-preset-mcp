# Sql-context-presets

## Overview

A vanilla MCP server that demonstrates MCP protocols.

## Installation

### Prerequisites

- Node.js 20 or later. Follow [BuilderHub guidance](https://docs.hub.amazon.dev/languages/typescript/#typescript-install-node) to install NodeJs.

### Install from workspace

1. Checkout and build the package to a Brazil workspace

   ```bash
   brazil ws create Sql-context-presets
   cd Sql-context-presets
   brazil ws use -p Sql-context-presets
   cd src/Sql-context-presets
   brazil-build
   ```

2. Configure the MCP client

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

### [Option 1] Install from Amazon-internal MCP Registry using AIM CLI

```bash
export MCP_SERVER_ID=<UPDATE THIS AFTER YOU VEND IN AMAZON INTERNAL MCP REGISTRY>
aim mcp install ${MCP_SERVER_ID}
```

Clients like Kiro (Q), Cline are automatically updated with new config. If not you can manually update MCP client:

```json
{
  "mcpServers": {
    "sql-context-presets-aim": {
      "disabled": false,
      "command": ${MCP_SERVER_ID},
      "args": [],
      "env": {},
      "transportType": "stdio"
    }
  }
}
```

### [Option 2] Install from toolbox

```bash
export REGISTRY_NAME=<UPDATE THIS>
toolbox registry add s3://buildertoolbox-registry-${REGISTRY_NAME}-us-west-2/tools.json \
&& toolbox install sql-context-presets
```

Then you can configure the MCP client:

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

If you use Cline, you may see error that it is unable to start the server. A possible reason is that the `node` runtime isn't discoverable by Cline extension. If you have installed `node` with `mise`, you can [add mise shims to PATH in your default shell profile](https://mise.jdx.dev/ide-integration.html#adding-shims-to-path-default-shell).

When your AI-assistant (Q-CLI, Cline) starts the MCP server, it spawns the server as a process. The process should be closed when the AI-assistant application shuts down.
In case of emergency, you can also kill the process directly from terminal, which may impact the function of your AI-assistant. You can use `ps aux | grep sql-context-presets` to find the process IDs.

If you directly run the command installed by toolbox, you'd need to run Ctrl+Z to suspend and then kill the process.

## Tools

### divide

A tool to divide two numbers.

#### Description

This tool takes two numbers (dividend and divisor) and returns the result of their division. It will throw an error if the divisor is 0.

#### Parameters

| Name       | Type   | Required | Description                           |
| ---------- | ------ | -------- | ------------------------------------- |
| `dividend` | number | Yes      | The number to be divided              |
| `divisor`  | number | Yes      | The number to divide by (cannot be 0) |

#### Example

**Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "divide",
    "arguments": {
      "dividend": 10,
      "divisor": 2
    }
  }
}
```

**Response:**

```json
{
  "content": [
    {
      "type": "text",
      "text": "5"
    }
  ],
  "isError": false
}
```

### amazon-tenure

A tool to query the Amazon tenure days of a given employee.

#### Description

This tool takes an employee's login or alias and returns their tenure in days at Amazon. It performs validation on the login and will return an error if the login is invalid or if the information cannot be retrieved.

#### Parameters

| Name    | Type   | Required | Description                                                        |
| ------- | ------ | -------- | ------------------------------------------------------------------ |
| `login` | string | Yes      | The login or alias of the employee (must be 8 characters or fewer) |

#### Example

**Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "amazon-tenure",
    "arguments": {
      "login": "jeff"
    }
  }
}
```

**Response:**

```json
{
  "content": [
    {
      "type": "text",
      "text": "Tenure of jeff is 42 days."
    }
  ],
  "isError": false
}
```

## Prompts

### amazon-employee-badge-color

#### Description

This prompt helps determine the badge color for an Amazon employee based on their tenure with the company. It uses the amazon-tenure tool to get the employee's tenure in days, converts it to years, and applies specific rules to determine the appropriate badge color.

#### Parameters

| Name    | Type   | Required | Description                        |
| ------- | ------ | -------- | ---------------------------------- |
| `login` | string | Yes      | The login or alias of the employee |

#### Example

**Request:**

```json
{
  "method": "prompts/get",
  "params": {
    "name": "amazon-employee-badge-color",
    "arguments": {
      "login": "jeff"
    }
  }
}
```

**Response:**

```json
{
  "messages": [
    {
      "role": "user",
      "content": {
        "type": "text",
        "text": "<prompt template>"
      }
    }
  ]
}
```

If you use Amazon Q CLI, you can type `> /prompts get amazon-employee-badge-color ${your login}` to use the prompt.
