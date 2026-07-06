output "app_server_public_ip" {
  description = "Elastic IP of the app server — point your domain's A record here."
  value       = aws_eip.app.public_ip
}

output "rds_endpoint" {
  description = "RDS connection endpoint (host:port). Not publicly reachable — only from the app server."
  value       = aws_db_instance.postgres.endpoint
}

output "database_url" {
  description = "Full Postgres connection string for DATABASE_URL / .env.local."
  value       = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.postgres.endpoint}/${var.db_name}"
  sensitive   = true
}
