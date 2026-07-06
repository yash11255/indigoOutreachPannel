resource "aws_instance" "app" {
  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = var.ec2_instance_type
  key_name               = var.ssh_key_pair_name
  subnet_id              = data.aws_subnets.default.ids[0]
  vpc_security_group_ids = [aws_security_group.app.id]

  root_block_device {
    volume_size = 30 # Amazon Linux 2023 ARM64's snapshot requires >= 30GB
    volume_type = "gp3"
  }

  # Bootstraps Node.js + nginx + pm2. Does NOT deploy the app itself - see
  # infra/README.md for the deploy step (clone repo, npm install/build,
  # pm2 start, point nginx at it). Keeping app deployment out of Terraform
  # so redeploys don't require touching infrastructure state. The app
  # continues talking to Supabase for DB+Auth for now - see README.md for
  # what it takes to actually cut over to the RDS instance provisioned here.
  user_data = <<-EOF
    #!/bin/bash
    set -euo pipefail
    dnf update -y
    dnf install -y nginx
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    dnf install -y nodejs
    npm install -g pm2
    systemctl enable nginx
    systemctl start nginx
  EOF

  tags = merge(local.tags, { Name = "${var.project_name}-app" })
}

resource "aws_eip" "app" {
  instance = aws_instance.app.id
  domain   = "vpc"
  tags     = local.tags
}
