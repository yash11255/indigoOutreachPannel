# Infrastructure — lean AWS setup (EC2 + RDS Postgres only)

Terraform for the minimal-necessary hosting setup: a single EC2 app server
and a single-AZ RDS Postgres instance, in `ap-south-1` (Mumbai). No S3, no
load balancer, no Multi-AZ — trimmed to just what's actually used. Estimated
cost: ~$25/month (EC2 ~$9 + RDS ~$16).

## Important — read before deploying

This provisions a **plain RDS Postgres database**. It does **not** include
authentication. The app currently uses Supabase for both the database *and*
auth (login, sessions, and the Row Level Security policies that scope each
team member to their own team's leads all depend on Supabase's `auth.uid()`
and its GoTrue auth service) via the `supabase-js` client library — it does
not talk to Postgres directly over SQL.

That means pointing the app at this RDS instance is not a drop-in swap.
There are two real paths:

1. **Self-host Supabase on this infrastructure** — Supabase is open source;
   its full stack (Postgres + GoTrue auth + PostgREST + Realtime) can run
   on your own EC2/RDS, and the app's existing code works unchanged since
   it's still talking to a Supabase-compatible API. This is the path that
   actually uses "your own Postgres" without a rewrite.
2. **Rewrite the data/auth layer** to use a plain Postgres driver (e.g.
   `pg` or `postgres.js`) and a separate auth solution (e.g. Auth.js,
   Cognito) — a genuinely bigger change than the infrastructure itself.

This Terraform only provisions the database — it does not decide between
these paths for you. Until one of them is done, keep the running app
pointed at Supabase as it is today; the RDS instance here is ready for
whichever path you choose next.

## Prerequisites

1. An AWS account with billing enabled.
2. The AWS CLI installed and configured with credentials that can create
   EC2/RDS/IAM resources: `aws configure` (needs an access key + secret
   from IAM — never share these in chat or commit them anywhere).
3. An EC2 key pair for SSH access: `aws ec2 create-key-pair --key-name outreach-dashboard --query 'KeyMaterial' --output text > outreach-dashboard.pem && chmod 400 outreach-dashboard.pem`
4. Your own public IP, for locking down SSH: `curl -s ifconfig.me`

## Deploy the infrastructure

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars
# edit terraform.tfvars: set ssh_key_pair_name and allowed_ssh_cidr

export TF_VAR_db_password='choose-a-strong-password-here'

terraform init
terraform plan    # review what it's about to create
terraform apply   # type "yes" to confirm — this starts billing
```

`terraform apply` takes a few minutes (RDS is the slow part). When it
finishes, note the outputs:

```bash
terraform output app_server_public_ip
terraform output rds_endpoint
terraform output -raw database_url   # sensitive — the full connection string
```

## Deploy the app onto the EC2 server (keeping Supabase for now)

This step is intentionally kept out of Terraform so redeploying the app
doesn't touch infrastructure state.

```bash
ssh -i outreach-dashboard.pem ec2-user@<app_server_public_ip>

# on the server:
sudo mkdir -p /var/www/outreach-dashboard && sudo chown ec2-user /var/www/outreach-dashboard
git clone <your-repo-url> /var/www/outreach-dashboard
cd /var/www/outreach-dashboard
npm install
```

Copy the same `.env.local` (Supabase URL/keys) used locally — the RDS
instance isn't wired in until one of the two paths above is chosen — then:

```bash
npm run build
pm2 start npm --name outreach-dashboard -- start
pm2 save
pm2 startup   # follow the printed instructions to start pm2 on boot
```

Point nginx at the app (`/etc/nginx/conf.d/outreach-dashboard.conf`):

```nginx
server {
    listen 80;
    server_name your-domain.example.com;
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Then `sudo nginx -t && sudo systemctl reload nginx`, point your domain's A
record at `app_server_public_ip`, and set up HTTPS with certbot:

```bash
sudo dnf install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.example.com
```

## Notes

- This provisions real, billable AWS resources the moment you run
  `terraform apply` — review the plan output first.
- To tear everything down: `terraform destroy` (also billable to run, but
  stops the ongoing charges — RDS creates a final snapshot first per
  `final_snapshot_identifier` in `rds.tf`).
