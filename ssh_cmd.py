import paramiko
import sys

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('104.248.20.89', username='voiceforge', password='v0Icef0rg3R0t@!t3d')

cmd = sys.argv[1] if len(sys.argv) > 1 else 'echo no command'
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=300)
out = stdout.read().decode()
err = stderr.read().decode()
if out:
    print(out)
if err:
    print("STDERR:", err)
ssh.close()
