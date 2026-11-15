// Tests for the PreToolUse safety hook.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const guard = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../plugins/prospect/hooks/guard.mjs');
const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'pe-guard-'));
fs.writeFileSync(path.join(ws, 'prospect.config.json'), '{}');
const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'pe-outside-'));

const run = (tool_name, tool_input = {}, cwd = ws) =>
  spawnSync(process.execPath, [guard], { input: JSON.stringify({ cwd, tool_name, tool_input }) }).status;

const cases = [
  ['mcp__claude_ai_Gmail__send_message', {}, 2],
  ['mcp__claude_ai_Gmail__create_draft', {}, 0],
  ['mcp__claude_ai_Gmail__search_threads', {}, 0],
  ['mcp__claude_ai_Microsoft_365__outlook_send_draft', {}, 2],
  ['mcp__claude_ai_Microsoft_365__outlook_send_mail', {}, 2],
  ['mcp__claude_ai_Microsoft_365__outlook_create_draft', {}, 0],
  ['mcp__claude_ai_Microsoft_365__outlook_create_reply_draft', {}, 0],
  ['mcp__claude_ai_Microsoft_365__outlook_forward_mail', {}, 2],
  ['mcp__claude_ai_Microsoft_365__teams_send_chat_message', {}, 2],
  ['mcp__claude_ai_Slack__slack_send_message', {}, 2],
  ['mcp__whatsapp__list_chats', {}, 0],
  ['mcp__whatsapp__send_message', {}, 2],
  ['mcp__claude_ai_Apollo_io__apollo_emailer_messages_send_now', {}, 2],
  ['mcp__plugin_prospect_prospect__save_email', {}, 0],
  ['Read', { file_path: path.join(ws, '.prospect', 'secrets.env') }, 2],
  ['Edit', { file_path: path.join(ws, '.prospect', 'secrets.env') }, 2],
  ['Read', { file_path: path.join(ws, 'prospect.config.json') }, 0],
  ['Bash', { command: 'cat .prospect/secrets.env' }, 2],
  ['PowerShell', { command: 'Get-Content .prospect\secrets.env' }, 2],
  ['Bash', { command: 'notepad .prospect\secrets.env' }, 0],
  ['Bash', { command: 'npx wrangler pages deploy site --project-name x' }, 2],
  ['Bash', { command: 'node "D:/b/node_modules/netlify-cli/bin/run.js" deploy --prod --dir site' }, 2],
  ['Bash', { command: 'node "D:/x/plugins/prospect/dist/cli.mjs" deploy my-lead' }, 0],
  ['Bash', { command: 'node "D:/b/node_modules/wrangler/bin/wrangler.js" login' }, 0],
  ['Bash', { command: 'node "D:/b/node_modules/wrangler/bin/wrangler.js" pages project create x --production-branch main' }, 0],
  ['Bash', { command: 'python -c "import smtplib"' }, 2],
  ['WebFetch', { url: 'https://example.com' }, 0],
];

for (const [tool, input, expected] of cases) {
  test(`${tool} ${JSON.stringify(input).slice(0, 60)} → ${expected}`, () => assert.equal(run(tool, input), expected));
}

test('rules only apply inside a Prospect workspace', () => {
  assert.equal(run('mcp__claude_ai_Gmail__send_message', {}, outside), 0);
});
