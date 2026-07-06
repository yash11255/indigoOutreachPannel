resource "aws_db_subnet_group" "this" {
  name       = "${var.project_name}-db-subnets"
  subnet_ids = data.aws_subnets.default.ids
  tags       = local.tags
}

resource "aws_db_instance" "postgres" {
  identifier     = "${var.project_name}-db"
  engine         = "postgres"
  engine_version = "16"

  instance_class    = var.db_instance_class
  allocated_storage = var.db_allocated_storage_gb
  storage_type      = "gp3"

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.db.id]
  publicly_accessible    = false

  # Lean setup: single-AZ, no read replica. Switch to Multi-AZ by setting
  # multi_az = true once this needs production-grade availability.
  multi_az = false

  backup_retention_period   = 1 # Free Tier accounts cap backup retention low
  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.project_name}-db-final"

  tags = local.tags
}
