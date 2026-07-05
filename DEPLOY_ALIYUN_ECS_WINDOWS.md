# Deploy on Alibaba Cloud ECS (Windows)

This repository now supports running on a Windows ECS instance directly with a single Node.js process.

## 1. Prepare the ECS instance

Open inbound ports in the security group:

- `80`
- `443`
- `3000`
- `3389` (if you need Remote Desktop)

For quick testing, allow source:

- `0.0.0.0/0`

## 2. Install software on the Windows server

Install:

- Node.js LTS (18+)
- Git for Windows

After installation, open a new PowerShell window and verify:

```powershell
node -v
npm -v
git --version
```

## 3. Download the project

```powershell
cd C:\
git clone https://github.com/swk-hnu/coze-resume-interview.git
cd coze-resume-interview
```

## 4. Install dependencies

```powershell
npm install
```

## 5. Configure environment variables

Temporary for the current PowerShell session:

```powershell
$env:COZE_WORKFLOW_ID="7658482627423731718"
$env:COZE_WORKFLOW_TOKEN="your_token"
$env:COZE_ACCESS_TOKEN="your_token"
$env:COZE_API_BASE="https://api.coze.cn"
$env:PORT="3000"
```

If upload uses the same PAT, you can reuse the same value for both token variables.

## 6. Start the service

```powershell
npm start
```

When startup succeeds, you should see:

```text
Server running on http://0.0.0.0:3000
```

## 7. Access the app

From a browser, open:

```text
http://<your-ecs-public-ip>:3000/
```

Example:

```text
http://118.178.133.155:3000/
```

## 8. Optional next step

After functional verification:

- add Nginx or IIS reverse proxy
- bind your domain
- complete ICP filing if using a mainland China domain and mainland ECS for public access
