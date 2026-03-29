resource "aws_db_subnet_group" "main" {
  name       = "marketx-rds-subnet"
  subnet_ids = var.private_subnets
}

resource "aws_rds_cluster" "postgres" {
  cluster_identifier      = "marketx-postgres"
  engine                  = "aurora-postgresql"
  engine_version          = "15.4"
  database_name           = "marketx"
  master_username         = "marketx_admin"
  master_password         = var.db_password
  db_subnet_group_name    = aws_db_subnet_group.main.name
  backup_retention_period = 7
  deletion_protection     = true
}

resource "aws_rds_cluster_instance" "instances" {
  count              = 2
  identifier         = "marketx-postgres-${count.index}"
  cluster_identifier = aws_rds_cluster.postgres.id
  instance_class     = "db.t3.medium"
  engine             = aws_rds_cluster.postgres.engine
}