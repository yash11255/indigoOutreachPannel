variable "aws_region" {
  description = "AWS region to deploy into."
  type        = string
  default     = "ap-south-1" # Mumbai — closest region to primary users
}

variable "project_name" {
  description = "Short name used to prefix/tag all resources."
  type        = string
  default     = "indigo-gwf-outreach"
}

variable "environment" {
  description = "Deployment environment name (used in tags)."
  type        = string
  default     = "production"
}

variable "ssh_key_pair_name" {
  description = "Name of an existing EC2 key pair to allow SSH access to the app server. Create one first via `aws ec2 create-key-pair` or the console."
  type        = string
}

variable "allowed_ssh_cidr" {
  description = "CIDR block allowed to SSH into the app server (lock this down to your own IP, e.g. \"203.0.113.4/32\" — never leave it as 0.0.0.0/0)."
  type        = string
}

variable "db_name" {
  description = "Name of the initial Postgres database."
  type        = string
  default     = "outreach"
}

variable "db_username" {
  description = "Master username for the RDS instance."
  type        = string
  default     = "outreach_admin"
}

variable "db_password" {
  description = "Master password for the RDS instance. Set via TF_VAR_db_password env var or a tfvars file that is never committed — do not hardcode."
  type        = string
  sensitive   = true
}

variable "ec2_instance_type" {
  description = "Instance type for the app server."
  type        = string
  default     = "t4g.micro" # ARM/Graviton — cheapest general-purpose burstable instance
}

variable "db_instance_class" {
  description = "Instance class for the RDS database."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage_gb" {
  description = "Allocated storage for RDS, in GB."
  type        = number
  default     = 20
}
