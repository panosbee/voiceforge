import paramiko
import sys

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('104.248.20.89', username='voiceforge', password='v0Icef0rg3R0t@!t3d')

cmd = sys.argv[1] if len(sys.argv) > 1 else 'echo no command'
# Fire and forget - don't wait for output
transport = ssh.get_transport()
channel = transport.open_session()
channel.exec_command(cmd)
print("FIRED")
ssh.close()
