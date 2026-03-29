terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
  backend "s3" {
    bucket = "marketx-tfstate"
    key    = "prod/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" { region = var.aws_region }

module "vpc"            { source = "./modules/vpc" }
module "alb"            { source = "./modules/alb";   vpc_id = module.vpc.vpc_id; public_subnets = module.vpc.public_subnets }
module "ecs"            { source = "./modules/ecs";   vpc_id = module.vpc.vpc_id; private_subnets = module.vpc.private_subnets; alb_target_group_arn = module.alb.target_group_arn }
module "rds"            { source = "./modules/rds";   vpc_id = module.vpc.vpc_id; private_subnets = module.vpc.private_subnets }