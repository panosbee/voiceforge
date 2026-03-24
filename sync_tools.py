"""One-time script: Sync existing agents to webhook tools on production.
Uses the ElevenLabs Fern SDK (installed in the project) via tsx."""
import paramiko

HOST = '104.248.20.89'
USER = 'voiceforge'
PASS = 'v0Icef0rg3R0t@!t3d'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS)

# Create a TypeScript script that uses our existing elevenlabs service
ts_script = r"""
import { config } from 'dotenv';
config({ path: '/home/voiceforge/voicecall/voiceforge-ai/.env' });

(async () => {
  // Test check_availability via webhook endpoint
  const resp = await fetch('http://127.0.0.1:3001/webhooks/elevenlabs/tool/agent_6901kkdwv3ymfhmbyb4c14hnjx1w/check_availability', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requested_date: '2026-03-25' }),
  });
  const data = await resp.json();
  console.log('Status:', resp.status);
  console.log('Result:', JSON.stringify(data, null, 2).slice(0, 1000));
})();
"""

# Write and run the script via tsx
cmd = f"""cat > /home/voiceforge/voicecall/voiceforge-ai/sync_tools.ts << 'TSEOF'
{ts_script}
TSEOF
cd /home/voiceforge/voicecall/voiceforge-ai && source /home/voiceforge/.nvm/nvm.sh && npx tsx sync_tools.ts && rm sync_tools.ts"""

_, stdout, stderr = ssh.exec_command(cmd, timeout=60)
print(stdout.read().decode())
err = stderr.read().decode()
if err:
    print("STDERR:", err[:2000])

ssh.close()
