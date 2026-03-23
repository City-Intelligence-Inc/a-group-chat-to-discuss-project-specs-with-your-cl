terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-west-2"
}

variable "environment" {
  description = "Environment name (e.g. dev, prod)"
  type        = string
  default     = "dev"
}

locals {
  prefix = "chatroom-${var.environment}"
}

# =============================================================================
# 1. USERS TABLE
#    PK: userId
#    GSI: email-index (lookup by email for auth)
# =============================================================================
resource "aws_dynamodb_table" "users" {
  name         = "${local.prefix}-users"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "email"
    type = "S"
  }

  attribute {
    name = "username"
    type = "S"
  }

  global_secondary_index {
    name            = "email-index"
    hash_key        = "email"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "username-index"
    hash_key        = "username"
    projection_type = "ALL"
  }

  tags = {
    Environment = var.environment
    Project     = "chatroom"
  }
}

# =============================================================================
# 2. CHAT ROOMS TABLE
#    PK: roomId
#    GSI: createdBy-index (find rooms a user created)
# =============================================================================
resource "aws_dynamodb_table" "chat_rooms" {
  name         = "${local.prefix}-chat-rooms"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "roomId"

  attribute {
    name = "roomId"
    type = "S"
  }

  attribute {
    name = "createdBy"
    type = "S"
  }

  global_secondary_index {
    name            = "createdBy-index"
    hash_key        = "createdBy"
    projection_type = "ALL"
  }

  tags = {
    Environment = var.environment
    Project     = "chatroom"
  }
}

# =============================================================================
# 3. ROOM MEMBERS TABLE (many-to-many: users <-> rooms)
#    PK: roomId, SK: userId
#    GSI: userId-index (find all rooms a user belongs to)
# =============================================================================
resource "aws_dynamodb_table" "room_members" {
  name         = "${local.prefix}-room-members"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "roomId"
  range_key    = "userId"

  attribute {
    name = "roomId"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  global_secondary_index {
    name            = "userId-index"
    hash_key        = "userId"
    range_key       = "roomId"
    projection_type = "ALL"
  }

  tags = {
    Environment = var.environment
    Project     = "chatroom"
  }
}

# =============================================================================
# 4. MESSAGES TABLE
#    PK: roomId, SK: createdAt#messageId (sorted by time)
#    GSI: senderId-index (find all messages by a user)
# =============================================================================
resource "aws_dynamodb_table" "messages" {
  name         = "${local.prefix}-messages"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "roomId"
  range_key    = "sortKey"

  attribute {
    name = "roomId"
    type = "S"
  }

  attribute {
    name = "sortKey"
    type = "S"
  }

  attribute {
    name = "senderId"
    type = "S"
  }

  global_secondary_index {
    name            = "senderId-index"
    hash_key        = "senderId"
    range_key       = "sortKey"
    projection_type = "ALL"
  }

  tags = {
    Environment = var.environment
    Project     = "chatroom"
  }
}

# =============================================================================
# 5. CONNECTIONS TABLE (WebSocket presence tracking)
#    PK: connectionId
#    GSI: userId-index (find all connections for a user)
#    GSI: roomId-index (find all active users in a room)
# =============================================================================
resource "aws_dynamodb_table" "connections" {
  name         = "${local.prefix}-connections"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "connectionId"

  attribute {
    name = "connectionId"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "roomId"
    type = "S"
  }

  global_secondary_index {
    name            = "userId-index"
    hash_key        = "userId"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "roomId-index"
    hash_key        = "roomId"
    projection_type = "ALL"
  }

  tags = {
    Environment = var.environment
    Project     = "chatroom"
  }
}

# =============================================================================
# 6. S3 BUCKET — FILE UPLOADS
#    Bucket for chat file uploads (images, documents, etc.)
#    CORS allows uploads from any origin (for the demo).
#    Lifecycle rule expires objects after 30 days to avoid cost buildup.
# =============================================================================
resource "aws_s3_bucket" "uploads" {
  bucket = "${local.prefix}-uploads"

  tags = {
    Environment = var.environment
    Project     = "chatroom"
  }
}

resource "aws_s3_bucket_cors_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    id     = "expire-uploads-after-30-days"
    status = "Enabled"

    expiration {
      days = 30
    }
  }
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# NOTE: The App Runner instance role "chatroom-apprunner-instance" is managed
# via CLI, not Terraform. To grant S3 access for file uploads, attach an
# inline policy (or update the existing one) on that role with the following
# permissions:
#
#   {
#     "Effect": "Allow",
#     "Action": [
#       "s3:PutObject",
#       "s3:GetObject",
#       "s3:DeleteObject"
#     ],
#     "Resource": "arn:aws:s3:::chatroom-<env>-uploads/*"
#   }
#
# Example AWS CLI command:
#   aws iam put-role-policy \
#     --role-name chatroom-apprunner-instance \
#     --policy-name S3UploadsAccess \
#     --policy-document file://s3-uploads-policy.json

# =============================================================================
# OUTPUTS
# =============================================================================
output "users_table_name" {
  value = aws_dynamodb_table.users.name
}

output "users_table_arn" {
  value = aws_dynamodb_table.users.arn
}

output "chat_rooms_table_name" {
  value = aws_dynamodb_table.chat_rooms.name
}

output "chat_rooms_table_arn" {
  value = aws_dynamodb_table.chat_rooms.arn
}

output "room_members_table_name" {
  value = aws_dynamodb_table.room_members.name
}

output "room_members_table_arn" {
  value = aws_dynamodb_table.room_members.arn
}

output "messages_table_name" {
  value = aws_dynamodb_table.messages.name
}

output "messages_table_arn" {
  value = aws_dynamodb_table.messages.arn
}

output "connections_table_name" {
  value = aws_dynamodb_table.connections.name
}

output "connections_table_arn" {
  value = aws_dynamodb_table.connections.arn
}

output "uploads_bucket_name" {
  value = aws_s3_bucket.uploads.bucket
}

output "uploads_bucket_arn" {
  value = aws_s3_bucket.uploads.arn
}
