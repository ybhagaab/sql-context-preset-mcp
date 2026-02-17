# Agent Tool Checker (ATC) Scan Results

**Server ID:** `sql-client-mcp`  
**Scan Date:** February 17, 2026  
**ATC Version:** 1.0.361.0  
**Scan Status:** ✅ PASSED

---

## Executive Summary

The SQL Client MCP Server was scanned using the Agent Tool Checker (ATC) security scanner. The scan completed successfully with **no security findings** detected across all 89 checks performed on 8 tools.

## Scan Command

```bash
atc mcp-analyze --command "node /Users/ybhagaab/SQL/mcp-server/dist/index.js"
```

## Scan Results

### Summary Table

| Metric                 | Count    |
|------------------------|----------|
| Servers Analyzed       | 1        |
| Total Tools            | 8        |
| Total Checks Performed | 89       |
| Low Severity           | 0        |
| Medium Severity        | 0        |
| High Severity          | 0        |
| Critical Severity      | 0        |
| Overall Status         | ✅ PASSED |

### Detailed Check Results

| Check | Status | Description |
|-------|--------|-------------|
| metadata_context_overflow_server | ✅ No findings | Server metadata does not overflow context |
| name_exact_match | ✅ No findings | No tool names exactly match known malicious patterns |
| name_overlap | ✅ No findings | No tool name overlaps with other servers |
| name_similarity | ✅ No findings | No suspicious tool name similarities |
| empty_description | ✅ No findings | All tools have descriptions |
| metadata_token_overflow | ✅ No findings | Tool metadata within token limits |
| command_injection | ✅ No findings | No command injection patterns detected |
| cross_server_call | ✅ No findings | No cross-server call vulnerabilities |
| capabilities_detection | ✅ No findings | Tool capabilities properly declared |
| sensitive_data_exposure | ✅ No findings | No sensitive data exposure in tool definitions |
| llm_poisoning_detection | ✅ No findings | No LLM poisoning attempts in tool descriptions |
| llm_overreach_detection | ✅ No findings | Tools do not overreach their stated capabilities |

## Tools Analyzed

The following 8 tools were analyzed:

| Tool | Description | Risk Assessment |
|------|-------------|-----------------|
| `run_query` | Execute SQL queries | No findings |
| `list_schemas` | List database schemas | No findings |
| `list_tables` | List tables in schema | No findings |
| `describe_table` | Get column information | No findings |
| `get_sample_data` | Get sample rows | No findings |
| `connection_status` | Check connection status | No findings |
| `get_schema_context` | Load schema documentation | No findings |
| `list_presets` | List available presets | No findings |

## Security Checks Explained

### Checks Performed

1. **metadata_context_overflow_server**: Checks if server metadata could overflow the LLM context window
2. **name_exact_match**: Detects tool names that exactly match known malicious patterns
3. **name_overlap**: Identifies tool names that overlap with other MCP servers (tool shadowing)
4. **name_similarity**: Detects suspiciously similar tool names that could confuse users
5. **empty_description**: Ensures all tools have proper descriptions
6. **metadata_token_overflow**: Checks if tool metadata exceeds token limits
7. **command_injection**: Scans for command injection patterns in tool descriptions
8. **cross_server_call**: Detects tools that attempt to call other MCP servers
9. **capabilities_detection**: Verifies tool capabilities are properly declared
10. **sensitive_data_exposure**: Checks for sensitive data in tool definitions
11. **llm_poisoning_detection**: Detects hidden instructions in tool descriptions (prompt injection)
12. **llm_overreach_detection**: Identifies tools that perform more actions than described

## Shepherd Risk Assessment

Based on the ATC scan results:

| Finding Type | Count | Shepherd Risk Required |
|--------------|-------|------------------------|
| Critical | 0 | No |
| High | 0 | No |
| Medium | 0 | No |
| Low | 0 | No |

**Conclusion:** No Shepherd risks need to be created based on ATC scan results.

## Disclaimer

> ⚠️ **DISCLAIMER:** ATC scans for known problematic patterns but should not be considered a complete security solution. Users must perform their own security analysis and exercise careful judgment. A clean scan does not guarantee safety.

## Raw Scan Output

```
🚀 Agent Tool Checker

MCP servers to analyze · 0.6k tokens
└── sql-client-mcp (node /Users/ybhagaab/SQL/mcp-server/dist/index.js) · 8
    tools, 0.6k tokens

Analysis results
└── sql-client-mcp (node /Users/ybhagaab/SQL/mcp-server/dist/index.js): ✓ 
    no findings · 89 checks performed, 8 tools, 0.6k tokens
    ├── ✓ metadata_context_overflow_server: no findings
    ├── ✓ name_exact_match: no findings
    ├── ✓ name_overlap: no findings
    ├── ✓ name_similarity: no findings
    ├── ✓ empty_description: no findings
    ├── ✓ metadata_token_overflow: no findings
    ├── ✓ command_injection: no findings
    ├── ✓ cross_server_call: no findings
    ├── ✓ capabilities_detection: no findings
    ├── ✓ sensitive_data_exposure: no findings
    ├── ✓ llm_poisoning_detection: no findings
    └── ✓ llm_overreach_detection: no findings

     Agent Tool Checker Summary      
╭────────────────────────┬──────────╮
│ Metric                 │ Count    │
├────────────────────────┼──────────┤
│ Servers Analyzed       │ 1        │
│ Total Tools            │ 8        │
│ Total Checks Performed │ 89       │
│ Low                    │ 0        │
│ Medium                 │ 0        │
│ High                   │ 0        │
│ Critical               │ 0        │
│ Overall Status         │ ✓ PASSED │
╰────────────────────────┴──────────╯
```

---

## Artifact Submission

This document serves as the ATC scan artifact for the AppSec review.

**Talos Engagement:** `b31119a8-2de4-4c05-89ae-970645a84236`

To upload this artifact to Talos:
1. Navigate to the Talos engagement
2. Upload this file as an artifact under the "Scan with Agent Tool Checker" task
