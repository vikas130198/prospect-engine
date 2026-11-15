# NexDev Prospect Engine

Claude Code plugin marketplace containing the **Prospect Engine** plugin — AI-assisted client acquisition for web
design agencies: Instagram profile → research → approval → website audit & score → personalised prototype →
automated QA → deploy → contact research → email saved in Drafts (never sent automatically).

- Plugin: [`plugins/prospect`](plugins/prospect/README.md)
- First-time user guide: [`plugins/prospect/SETUP.md`](plugins/prospect/SETUP.md)

## Install (users)
```
/plugin marketplace add vikas130198/prospect-engine
/plugin install prospect@nexdev
```

## Develop
```
npm install          # dev dependencies (MCP SDK, esbuild, imapflow, node-html-parser)
npm run build        # bundle src → plugins/prospect/dist (commit dist/)
npm test             # unit + hook tests
node tests/e2e-local.mjs <workspace>   # full local pipeline (needs a workspace with components installed)
claude --plugin-dir plugins/prospect   # try the plugin without installing it
```

## License
[MIT](LICENSE) © 2026 NexDev Studios. Third-party licenses for bundled code: `plugins/prospect/dist/THIRD_PARTY_NOTICES.md`.
Contributions welcome — see the plugin README.
