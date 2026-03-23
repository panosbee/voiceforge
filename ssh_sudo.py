import paramiko
import sys

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('104.248.20.89', username='voiceforge', password='v0Icef0rg3R0t@!t3d')

cmd = sys.argv[1] if len(sys.argv) > 1 else 'echo no command'

# If command starts with 'sudo', pipe password
if 'sudo' in cmd:
    full_cmd = f'echo v0Icef0rg3R0t@!t3d | sudo -S {cmd.replace("sudo ", "", 1)} 2>&1'
else:
    full_cmd = cmd

stdin, stdout, stderr = ssh.exec_command(full_cmd, timeout=300)
out = stdout.read().decode()
err = stderr.read().decode()
if out:
    print(out)
if err:
    print("STDERR:", err)
ssh.close()
