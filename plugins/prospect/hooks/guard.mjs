#!/usr/bin/env node
// PreToolUse safety guard for the Prospect Engine plugin.
// Active only inside a Prospect workspace (a folder containing prospect.config.json).
// Exit code 2 blocks the tool call and shows the reason to Claude.
import fs from 'node:fs';
import path from 'node:path';

function readStdin() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
  } catch {
    return {};
  }
}

function inWorkspace(start) {
  let dir = path.resolve(start || process.cwd());
  for (let i = 0; i < 25; i++) {
    if (fs.existsSync(path.join(dir, 'prospect.config.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

function block(reason) {
  process.stderr.write(`Blocked by Prospect Engine safety rules: ${reason}\n`);
  process.exit(2);
}

const input = readStdin();
const tool = String(input.tool_name || '');
const ti = input.tool_input || {};
const ws = inWorkspace(input.cwd || process.env.CLAUDE_PROJECT_DIR);
if (!ws) process.exit(0);

// 1) Never send outreach automatically: email, chat, WhatsApp, SMS, Instagram DMs, calls.
if (tool.startsWith('mcp__') && !tool.startsWith('mcp__plugin_prospect_')) {
  const name = tool.split('__').slice(2).join('__').toLowerCase();
  const sending = /(^|_)(send|sends|send_mail|send_email|send_message|send_draft|send_now|forward|forward_mail|reply|reply_all|post_message|create_message|direct_message|dm|call|dial|sms)(_|$)/;
  const channels = /whatsapp|twilio|sms|instagram.*(message|dm|comment)|messenger|telegram/;
  const safeDraft = /(create|update|save)_?.*draft|draft_create|list|search|get|read/;
  if ((sending.test(name) || channels.test(name)) && !(safeDraft.test(name) && !/send/.test(name))) {
    block(`"${tool}" could send a message. This plugin only prepares drafts — the user sends every message personally.`);
  }
}

// 2) Protect the private settings file from being read, printed or edited by the assistant.
const SECRET = /secrets\.env/i;
if (['Read', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'Grep'].includes(tool)) {
  const target = String(ti.file_path || ti.path || ti.notebook_path || ti.glob || '');
  if (SECRET.test(target) || (tool === 'Grep' && SECRET.test(String(ti.pattern || '')))) {
    block('.prospect/secrets.env is private. Ask the user to open and edit it themselves (for example: notepad .prospect\\secrets.env).');
  }
}

if (['Bash', 'PowerShell'].includes(tool)) {
  const cmd = String(ti.command || '');
  // Allow opening the secrets file in an editor for the user; block anything that would print it.
  if (SECRET.test(cmd) && !/^\s*(notepad(\.exe)?|start|open(\s+-e)?|code|xdg-open|nano|vi|vim|explorer(\.exe)?)\s/i.test(cmd)) {
    block('Commands must not read or print .prospect/secrets.env. Ask the user to open it in an editor instead.');
  }
  // Deployments must go through the plugin CLI, which enforces the "QA must pass first" rule.
  const viaCli = /prospect[\\/].*dist[\\/]cli\.mjs|[\\/]dist[\\/]cli\.mjs/.test(cmd);
  if (!viaCli && /(wrangler(\.js)?["']?\s+(pages\s+)?deploy|wrangler(\.js)?["']?\s+pages\s+project\s+delete|netlify(-cli)?[^|;&]*\s(deploy|sites:delete)\b|run\.js["']?\s+deploy)/i.test(cmd)) {
    block('Deploy only with the Prospect CLI ("deploy <lead>"), which checks that QA passed first.');
  }
  // No sending email from the shell either.
  if (/\b(sendmail|mailx|msmtp|swaks|Send-MailMessage)\b|smtp:\/\/|--mail-rcpt|smtplib|nodemailer/i.test(cmd)) {
    block('Sending email from the shell is not allowed. The plugin only saves drafts.');
  }
}

process.exit(0);
