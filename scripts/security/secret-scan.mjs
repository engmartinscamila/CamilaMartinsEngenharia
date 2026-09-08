import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const git = args => execFileSync('git',args,{cwd,encoding:'utf8',maxBuffer:128*1024*1024});
const files = git(['ls-files']).trim().split('\n');
const example = /(^|\/)\.env(?:\.[A-Za-z0-9_-]+)?\.example$/;
const badEnv = files.filter(f=>/(^|\/)\.env($|\.)/.test(f) && !example.test(f));
const issues = badEnv.map(path=>({path,kind:'real environment file'}));
const objects = git(['rev-list','--objects','--all']).trim().split('\n');
let scanned = 0;
for (const entry of objects) {
  const [sha,...parts] = entry.split(' ');
  const name = parts.join(' ');
  if (!name || !/(\.(?:js|mjs|cjs|ts|tsx|jsx|json|sql|yml|yaml|md|txt|toml|html|sh)|(^|\/)\.env[^/]*)$/i.test(name)) continue;
  const content = git(['cat-file','blob',sha]);
  scanned++;
  const kinds = new Set();
  if (/sb_secret_[A-Za-z0-9_-]{20,}/.test(content)) kinds.add('Supabase secret');
  // A parser removing PEM delimiters is not a credential. Require key material.
  const normalized = content.replaceAll('\\n','\n');
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\s+[A-Za-z0-9+/=\s]{64,}-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(normalized)) kinds.add('private key');
  if (/AKIA[0-9A-Z]{16}/.test(content)) kinds.add('AWS credential');
  if (/gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}/.test(content)) kinds.add('GitHub credential');
  for (const match of content.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
    try {
      if (JSON.parse(Buffer.from(match[1],'base64url').toString()).role === 'service_role') kinds.add('service role JWT');
    } catch { /* A token-shaped string may be a placeholder. */ }
  }
  for (const kind of kinds) issues.push({path:name,blob:sha,kind});
}
if (issues.length) {
  // Never print credential values, even when an audit fails.
  console.error(JSON.stringify(issues,null,2));
  process.exitCode = 1;
} else console.log(`PASS: ${scanned} historical text blobs; no recognized server credentials or tracked real environment files.`);
