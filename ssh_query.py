import paramiko
import sys

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('104.248.20.89', username='voiceforge', password='voiceforge_pw_salimov')

sql = sys.argv[1] if len(sys.argv) > 1 else "SELECT 1"
cmd = f'docker exec -i voiceforge-postgres psql -U voiceforge -d voiceforge -t'
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=60)
stdin.write(sql + '\n')
stdin.channel.shutdown_write()
out = stdout.read().decode()
err = stderr.read().decode()
if out:
    print(out.strip())
if err:
    print("STDERR:", err, file=sys.stderr)
ssh.close()
