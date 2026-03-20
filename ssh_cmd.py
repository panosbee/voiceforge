import paramiko
import sys

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('104.248.20.89', username='voiceforge', password='voiceforge_pw_salimov')

cmd = sys.argv[1] if len(sys.argv) > 1 else 'echo no command'
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=30)
out = stdout.read().decode()
err = stderr.read().decode()
if out:
    print(out)
if err:
    print("STDERR:", err)
ssh.close()
