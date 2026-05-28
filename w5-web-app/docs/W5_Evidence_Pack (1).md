# Evidence Pack W5: The Network Fortress
## XBrain_Group10 - Agri Compliance Portal

---

## Cover

| Thông tin | Chi tiết |
|-----------|---------|
| Nhóm | XBrain_Group10 |
| Thành viên | Lê Viết Quốc Hưng |
| Tuần | W5 - The Network Fortress |
| Evidence date | 2026-05-28 |
| AWS Account | `945125812908` |
| Region chính | `us-east-1` |
| Repository | `https://github.com/Hung0codon/Project_Xbrain_.git` |
| Live web URL | `http://w5-agri-alb-1092573247.us-east-1.elb.amazonaws.com` |
| Health URL | `http://w5-agri-alb-1092573247.us-east-1.elb.amazonaws.com/health` |
| API Gateway URL | `https://6w3fgcbsx6.execute-api.us-east-1.amazonaws.com/prod/validate` |

> [ẢNH CẦN CHỤP] GitHub repository commit mới nhất và live web URL đang mở trong browser.

---

## 1. Application Recap & Reflection

### 1.1 Ứng dụng hiện tại

**Tên ứng dụng:** Agri Compliance Portal

**Business domain:** Quản lý tài liệu tuân thủ nông nghiệp cho supplier và đội quality-control.

**Core workflow:**

```text
Supplier / QC user
-> Application Load Balancer
-> ECS Fargate web app
-> EFS shared upload storage
-> DynamoDB metadata table
-> API Gateway / Lambda validation service
-> S3 event ingestion pipeline for MH5
```

**Chức năng đã triển khai:**

- Dashboard business-facing cho compliance status.
- Upload compliance document qua web form.
- File được ghi vào EFS mount tại container path `/mnt/efs`.
- Metadata được ghi vào DynamoDB table `w5-agri-documents`.
- Repository page đọc danh sách metadata và trạng thái validation.
- Validation Center gọi API Gateway endpoint phía trước Lambda.
- Health endpoint `/health` phục vụ ALB target health và evidence.
- S3 event pipeline: `s3://w5-agri-doc-events/uploads/*` -> Lambda -> DynamoDB.

**Stack đang chạy:**

| Layer | Resource thật |
|------|---------------|
| Web runtime | ECS Fargate service `w5-agri-service` |
| Container image | ECR `w5-agri-app`, task definition `w5-agri-task:8` |
| Public entrypoint | ALB `w5-agri-alb` |
| Shared file storage | EFS `w5-agri-efs` / `fs-080ead609f73953dc` |
| Metadata store | DynamoDB `w5-agri-documents` |
| API facade | API Gateway HTTP API `w5-agri-api` / `6w3fgcbsx6` |
| Serverless validation | Lambda `w5-agri-validation` |
| S3 event bucket | S3 `w5-agri-doc-events` |
| Backup | AWS Backup plan `w5-agri-backup-plan` |

### 1.2 Live demo verification

Health check:

```bash
curl -i http://w5-agri-alb-1092573247.us-east-1.elb.amazonaws.com/health
```

Observed:

```text
HTTP/1.1 200 OK
{"status":"ok","time":"2026-05-28T07:42:49.231Z"}
```

> [ẢNH CẦN CHỤP] Browser mở dashboard production UI.
>
> [ẢNH CẦN CHỤP] Browser mở `/health` hoặc terminal curl health trả `200 OK`.
>
> [ẢNH CẦN CHỤP] Upload form + Repository sau khi upload thành công.

---

## 2. Architecture Inventory

### 2.1 Account and region

```bash
aws sts get-caller-identity
```

Observed:

```json
{
  "Account": "945125812908",
  "Arn": "arn:aws:iam::945125812908:user/hung_admin"
}
```

### 2.2 Important resource IDs

| Resource | ID / Name | Status |
|----------|-----------|--------|
| VPC | `w5-agri-vpc` / `vpc-05925adb5ee41a007` | available |
| CIDR | `10.0.0.0/16` | active |
| Public subnets | `public-a` `10.0.1.0/24`, `public-b` `10.0.2.0/24` | 2 AZ |
| Private app subnets | `private-app-a` `10.0.11.0/24`, `private-app-b` `10.0.12.0/24` | 2 AZ |
| Private data subnets | `private-data-a` `10.0.21.0/24`, `private-data-b` `10.0.22.0/24` | 2 AZ |
| Firewall subnets | `firewall-a` `10.0.31.0/28`, `firewall-b` `10.0.32.0/28` | 2 AZ |
| Internet Gateway | `igw-0048bac97b953c881` | attached |
| NAT Gateway A | `nat-02c9dcc9a97f1b9e7` | available |
| NAT Gateway B | `nat-00ec681ea6b6095b3` | available |
| Network Firewall | `w5-agri-nfw` | READY |
| ECS Cluster | `w5-agri-cluster` | ACTIVE |
| ECS Service | `w5-agri-service` | 2/2 running |
| ALB | `w5-agri-alb` | active |
| EFS | `fs-080ead609f73953dc` | available |
| DynamoDB | `w5-agri-documents` | ACTIVE |
| Lambda | `w5-agri-validation` | Active |
| API Gateway | `w5-agri-api` / `6w3fgcbsx6` | deployed |
| S3 Bucket | `w5-agri-doc-events` | exists |

---

## 3. MH1 - Single-VPC Connectivity

### 3.1 Connectivity decision

**Decision:** Justified Single-VPC architecture.

Ứng dụng hiện tại là một workload duy nhất: Agri Compliance Portal. Web app, shared storage, metadata store, validation function và S3 event workflow cùng phục vụ một business domain. Vì vậy dùng một VPC giúp giảm độ phức tạp routing, giảm chi phí Transit Gateway/VPC peering, và vẫn đạt yêu cầu segmentation bằng subnet tier + route table + security group + Network Firewall.

**Khi nào cần chuyển sang multi-VPC:**

- Tách production/staging bằng network isolation cứng.
- Mở rộng multi-region.
- Có partner/third-party private integration cần VPC peering hoặc Transit Gateway.
- Có compliance domain yêu cầu isolation riêng.

### 3.2 VPC and subnet design

```bash
aws ec2 describe-vpcs --region us-east-1
aws ec2 describe-subnets --region us-east-1
```

Observed project VPC:

```text
VPC: vpc-05925adb5ee41a007
Name: w5-agri-vpc
CIDR: 10.0.0.0/16
Region: us-east-1
AZs used: us-east-1a, us-east-1b
```

Subnet tiers:

| Tier | us-east-1a | us-east-1b | Purpose |
|------|------------|------------|---------|
| Public | `subnet-07ae0c77a66ad62de` / `10.0.1.0/24` | `subnet-036c1da491bd70b77` / `10.0.2.0/24` | ALB, NAT Gateway |
| Private app | `subnet-06187c34ff780d2c3` / `10.0.11.0/24` | `subnet-03101b8bd214912a9` / `10.0.12.0/24` | ECS Fargate tasks |
| Private data | `subnet-01064d0479e404d07` / `10.0.21.0/24` | `subnet-095350f97638da3e1` / `10.0.22.0/24` | EFS mount targets |
| Firewall | `subnet-075105e6f186ddba8` / `10.0.31.0/28` | `subnet-0802144f1354fa71d` / `10.0.32.0/28` | AWS Network Firewall endpoints |

> [ẢNH CẦN CHỤP] VPC details page: `w5-agri-vpc`, CIDR `10.0.0.0/16`.
>
> [ẢNH CẦN CHỤP] Subnets list filtered by VPC, showing public/private-app/private-data/firewall in `us-east-1a` and `us-east-1b`.

### 3.3 Route tables

Public route table:

```text
w5-agri-rt-public
0.0.0.0/0 -> igw-0048bac97b953c881
Associated: public-a, public-b
```

Private app route tables:

```text
w5-agri-rt-private-app-a
0.0.0.0/0 -> vpce-0851db9760ca363b9
S3 prefix list -> vpce-01bef9c5f0cbefad2
DynamoDB prefix list -> vpce-0f778fb0fd152ab68
Associated: private-app-a

w5-agri-rt-private-app-b
0.0.0.0/0 -> vpce-00484cd566a72a207
S3 prefix list -> vpce-01bef9c5f0cbefad2
DynamoDB prefix list -> vpce-0f778fb0fd152ab68
Associated: private-app-b
```

Firewall subnet route tables:

```text
w5-agri-rt-firewall-a
0.0.0.0/0 -> nat-02c9dcc9a97f1b9e7

w5-agri-rt-firewall-b
0.0.0.0/0 -> nat-00ec681ea6b6095b3
```

IGW edge route table:

```text
w5-agri-rt-igw-edge
10.0.11.0/24 -> vpce-0851db9760ca363b9
10.0.12.0/24 -> vpce-00484cd566a72a207
```

> [ẢNH CẦN CHỤP] Route table `w5-agri-rt-public`.
>
> [ẢNH CẦN CHỤP] Route table `w5-agri-rt-private-app-a` và `w5-agri-rt-private-app-b` showing `0.0.0.0/0 -> vpce-*`.
>
> [ẢNH CẦN CHỤP] Firewall route tables showing `0.0.0.0/0 -> NAT Gateway`.

### 3.4 VPC Flow Logs

```bash
aws ec2 describe-flow-logs \
  --region us-east-1 \
  --filter Name=resource-id,Values=vpc-05925adb5ee41a007
```

Observed:

```text
FlowLogId: fl-0b873ee36c80c0a35
ResourceId: vpc-05925adb5ee41a007
TrafficType: ALL
Destination: CloudWatch Logs
Log group: /aws/vpc/w5-agri-flowlogs
Delivery: SUCCESS
```

Sample log:

```text
2 945125812908 eni-0be5b59288183815b 35.203.211.112 10.0.1.161 52425 9568 6 1 44 1779856375 1779856389 ACCEPT OK
```

> [ẢNH CẦN CHỤP] VPC Flow Logs page showing `fl-0b873ee36c80c0a35`, status `SUCCESS`.
>
> [ẢNH CẦN CHỤP] CloudWatch log group `/aws/vpc/w5-agri-flowlogs` with an `ACCEPT OK` sample.

---

## 4. MH2 - Network Firewall Hardening

### 4.1 Path chosen

**Path A - AWS Network Firewall.**

Reason: ECS tasks in private app subnets need outbound access for container/runtime dependencies. Therefore outbound path is forced through AWS Network Firewall before NAT.

### 4.2 Firewall configuration

```bash
aws network-firewall describe-firewall \
  --firewall-name w5-agri-nfw \
  --region us-east-1
```

Observed:

```text
FirewallName: w5-agri-nfw
VpcId: vpc-05925adb5ee41a007
FirewallPolicyArn: arn:aws:network-firewall:us-east-1:945125812908:firewall-policy/w5-agri-fw-policy
Status: READY
Sync: IN_SYNC
Endpoint us-east-1a: vpce-0851db9760ca363b9
Endpoint us-east-1b: vpce-00484cd566a72a207
```

Traffic path:

```text
ECS task in private-app-a/b
-> private app route table
-> Network Firewall GatewayLoadBalancer endpoint
-> firewall subnet route table
-> NAT Gateway
-> Internet Gateway
-> Internet
```

### 4.3 Stateful rule group

```bash
aws network-firewall describe-rule-group \
  --rule-group-arn arn:aws:network-firewall:us-east-1:945125812908:stateful-rulegroup/w5-agri-stateful-allowlist \
  --type STATEFUL \
  --region us-east-1
```

Observed:

```text
Rule group: w5-agri-stateful-allowlist
Rule type: STATEFUL
Rule order: STRICT_ORDER
Generated rules type: ALLOWLIST
Targets:
- .amazonaws.com
- .docker.io
- .docker.com
- .cloudfront.net
- .github.com
- .githubusercontent.com
- .npmjs.org
- .npmjs.com
```

Firewall policy:

```text
Stateless default: aws:forward_to_sfe
Stateful rule group: w5-agri-stateful-allowlist
Stateful default actions: aws:alert_established, aws:drop_established
```

### 4.4 Firewall logging

```bash
aws network-firewall describe-logging-configuration \
  --firewall-name w5-agri-nfw \
  --region us-east-1
```

Observed:

```text
FLOW -> CloudWatch Logs /aws/network-firewall/flows
ALERT -> CloudWatch Logs /aws/network-firewall/alerts
```

Alert sample:

```json
{
  "firewall_name": "w5-agri-nfw",
  "availability_zone": "us-east-1a",
  "event": {
    "src_ip": "10.0.11.244",
    "dest_ip": "98.87.172.0",
    "dest_port": 443,
    "event_type": "alert",
    "verdict": { "action": "drop" },
    "alert": { "action": "blocked" }
  }
}
```

> [ẢNH CẦN CHỤP] Network Firewall `w5-agri-nfw` status READY.
>
> [ẢNH CẦN CHỤP] Firewall policy `w5-agri-fw-policy` and stateful rule group `w5-agri-stateful-allowlist`.
>
> [ẢNH CẦN CHỤP] Logging configuration showing `/aws/network-firewall/alerts` and `/aws/network-firewall/flows`.
>
> [ẢNH CẦN CHỤP] CloudWatch alert log sample with `verdict.action=drop`.

### 4.5 Security note

Current ECS security group `w5-agri-sg-ecs` allows inbound TCP `3000` from `0.0.0.0/0`. ECS tasks are in private subnets with no public IP, so they are not directly internet-routable, but the stronger production configuration is to allow port `3000` only from ALB security group `sg-011f9a1b4f5fd7589`.

> [OPTIONAL FIX] Change ECS SG ingress source from `0.0.0.0/0` to ALB SG only.

---

## 5. MH3 - File Storage Layer + Backup Plan

### 5.1 EFS shared storage

```bash
aws efs describe-file-systems --region us-east-1
```

Observed:

```text
FileSystemId: fs-080ead609f73953dc
Name: w5-agri-efs
State: available
Encrypted: true
PerformanceMode: generalPurpose
ThroughputMode: bursting
```

Mount targets:

```text
fsmt-0a004d99bd5429faa -> private-data-a / subnet-01064d0479e404d07 / us-east-1a / 10.0.21.218
fsmt-0fdaa20137bfd5476 -> private-data-b / subnet-095350f97638da3e1 / us-east-1b / 10.0.22.201
```

Access point:

```text
AccessPointId: fsap-033c902fd72d4c722
Name: w5-agri-efs-ap-uploads
RootDirectory: /uploads
POSIX user: 1000:1000
```

Security group:

```text
EFS SG: sg-0d13b43832b5eb336
Inbound: TCP 2049 from ECS SG sg-06c9fd208a68cf808
```

### 5.2 ECS task mounts EFS

```bash
aws ecs describe-task-definition \
  --task-definition w5-agri-task \
  --region us-east-1
```

Observed:

```text
Task definition: w5-agri-task:8
Launch type: Fargate
Container: app
Container port: 3000
EFS volume: efs-uploads
FileSystemId: fs-080ead609f73953dc
AccessPointId: fsap-033c902fd72d4c722
TransitEncryption: ENABLED
Container mount point: /mnt/efs
```

Application code writes uploaded files under:

```text
EFS_BASE = /mnt/efs/uploads
```

Because the access point root is `/uploads`, this effectively stores upload files under the access point namespace for the app container.

> [ẢNH CẦN CHỤP] EFS filesystem details `w5-agri-efs`, encrypted enabled.
>
> [ẢNH CẦN CHỤP] EFS mount targets in `private-data-a` and `private-data-b`.
>
> [ẢNH CẦN CHỤP] EFS access point `w5-agri-efs-ap-uploads`.
>
> [ẢNH CẦN CHỤP] ECS task definition volume and mount point `/mnt/efs`.

### 5.3 DynamoDB metadata

```bash
aws dynamodb describe-table \
  --table-name w5-agri-documents \
  --region us-east-1
```

Observed:

```text
TableName: w5-agri-documents
Status: ACTIVE
Key: documentId
ItemCount: 7+ during evidence check
```

Sample metadata item from web upload:

```json
{
  "documentId": "50ef1eac-1303-4e14-add7-b2676202a5da",
  "documentName": "ARCHBLOG-1090-Stage3.png",
  "supplier": "balaeleol",
  "documentType": "VietGAP Certificate",
  "validationStatus": "pending",
  "uploadTime": "2026-05-28T07:20:50.537Z"
}
```

Sample metadata item from S3 event:

```json
{
  "documentId": "uploads/s3-test-1779952164.txt",
  "documentName": "s3-test-1779952164.txt",
  "source": "s3-event",
  "bucket": "w5-agri-doc-events",
  "key": "uploads/s3-test-1779952164.txt",
  "validationStatus": "processed"
}
```

> [ẢNH CẦN CHỤP] DynamoDB table `w5-agri-documents` item view showing one web upload item.
>
> [ẢNH CẦN CHỤP] DynamoDB item with `source=s3-event`.

### 5.4 AWS Backup plan

Backup plan:

```text
BackupPlanName: w5-agri-backup-plan
BackupPlanId: 4160f2f5-feea-4bcf-bcc1-099da1a19c4b
Vault: w5-agri-vault
Schedule: cron(0 5 ? * * *) UTC
Retention: 7 days
```

Backup selection:

```text
SelectionName: w5-agri-assignment-1
IAM role: arn:aws:iam::945125812908:role/w5-agri-backup-role
Resources:
- arn:aws:dynamodb:us-east-1:945125812908:table/w5-agri-documents
- arn:aws:ec2:us-east-1:945125812908:volume/vol-062f4a90c64f326ad
- arn:aws:elasticfilesystem:us-east-1:945125812908:file-system/fs-080ead609f73953dc
```

Completed backup jobs:

| Resource type | Resource | State | Completion |
|---------------|----------|-------|------------|
| EFS | `fs-080ead609f73953dc` | COMPLETED | 2026-05-28 12:15:55 +07 |
| DynamoDB | `w5-agri-documents` | COMPLETED | 2026-05-28 12:39:55 +07 |
| EBS | `vol-062f4a90c64f326ad` | COMPLETED | 2026-05-28 12:33:18 +07 |

Completed restore jobs:

| Resource type | Status | Created resource |
|---------------|--------|------------------|
| EFS | COMPLETED | `arn:aws:elasticfilesystem:us-east-1:945125812908:file-system/fs-080ead609f73953dc` |
| DynamoDB | COMPLETED | `arn:aws:dynamodb:us-east-1:945125812908:table/w5-agri-documents-restored` |
| EBS | COMPLETED | `vol-0fd869b80d5e5e095` |

DynamoDB restored table:

```text
TableName: w5-agri-documents-restored
Status: ACTIVE
ItemCount: 3
```

> [ẢNH CẦN CHỤP] AWS Backup plan `w5-agri-backup-plan`.
>
> [ẢNH CẦN CHỤP] Backup selection showing EFS, DynamoDB, EBS resources.
>
> [ẢNH CẦN CHỤP] Backup jobs list with EFS/DynamoDB/EBS `COMPLETED`.
>
> [ẢNH CẦN CHỤP] Restore jobs list with EFS/DynamoDB/EBS `COMPLETED`.
>
> [ẢNH CẦN CHỤP] Restored DynamoDB table `w5-agri-documents-restored` active with items.

---

## 6. MH4 - API Gateway + Auth + Throttling

### 6.1 API Gateway configuration

```bash
aws apigatewayv2 get-apis --region us-east-1
aws apigatewayv2 get-routes --api-id 6w3fgcbsx6 --region us-east-1
aws apigatewayv2 get-stages --api-id 6w3fgcbsx6 --region us-east-1
```

Observed:

```text
API name: w5-agri-api
API type: HTTP API
API ID: 6w3fgcbsx6
Endpoint: https://6w3fgcbsx6.execute-api.us-east-1.amazonaws.com
Stage: prod
Route: POST /validate
Stage throttling: rate 2 rps, burst 5
Integration target: Lambda w5-agri-validation
```

### 6.2 Auth behavior

Important implementation detail:

- API Gateway HTTP API route has `AuthorizationType=NONE`.
- The application still enforces an API key at Lambda code level.
- Lambda reads header `x-api-key` and compares it with env var `EXPECTED_API_KEY`.
- This produces the required `200` with key and `403` without key behavior.

Authenticated request:

```bash
curl -i -X POST \
  https://6w3fgcbsx6.execute-api.us-east-1.amazonaws.com/prod/validate \
  -H 'content-type: application/json' \
  -H 'x-api-key: w5-agri-demo-key-123' \
  --data '{"check":"evidence"}'
```

Observed:

```text
HTTP/2 200
{"ok": true, "service": "document-validation", "message": "Validation request received"}
```

Unauthenticated request:

```bash
curl -i -X POST \
  https://6w3fgcbsx6.execute-api.us-east-1.amazonaws.com/prod/validate \
  -H 'content-type: application/json' \
  --data '{"check":"evidence"}'
```

Observed:

```text
HTTP/2 403
{"message": "Forbidden: missing or invalid API key"}
```

### 6.3 Web app integration

ECS task environment:

```text
API_GW_URL=https://6w3fgcbsx6.execute-api.us-east-1.amazonaws.com/prod/validate
API_KEY=w5-agri-demo-key-123
DDB_TABLE=w5-agri-documents
AWS_REGION=us-east-1
```

The web app route `/lambda-test` calls API Gateway. It does not invoke Lambda directly from the web app.

> [ẢNH CẦN CHỤP] API Gateway API `w5-agri-api`, route `POST /validate`.
>
> [ẢNH CẦN CHỤP] Stage `prod` showing throttling rate `2` and burst `5`.
>
> [ẢNH CẦN CHỤP] Lambda environment variable `EXPECTED_API_KEY` or code snippet showing header check.
>
> [ẢNH CẦN CHỤP] Curl/Postman `200` with `x-api-key`.
>
> [ẢNH CẦN CHỤP] Curl/Postman `403` without `x-api-key`.

### 6.4 Risk note

If trainer requires **native API Gateway API Key + Usage Plan**, HTTP API is weaker evidence because Usage Plans are REST API-specific. Current deployment satisfies functional behavior through Lambda-level auth and HTTP API stage throttling. If strict native API Gateway API key evidence is required, migrate this endpoint to REST API with Usage Plan.

---

## 7. MH5 - Serverless Scaling Pattern / S3 Event Pipeline

### 7.1 Pattern selected

**Pattern:** S3 event-triggered serverless pipeline.

```text
S3 PutObject
-> S3 Event Notification
-> Lambda w5-agri-validation
-> DynamoDB w5-agri-documents
```

This pattern decouples document ingestion from the web app. New objects uploaded under `uploads/` trigger the same validation Lambda and create metadata records.

### 7.2 S3 event notification

```bash
aws s3api get-bucket-notification-configuration \
  --bucket w5-agri-doc-events \
  --region us-east-1
```

Observed:

```json
{
  "LambdaFunctionConfigurations": [
    {
      "Id": "w5-agri-s3-to-lambda",
      "LambdaFunctionArn": "arn:aws:lambda:us-east-1:945125812908:function:w5-agri-validation",
      "Events": ["s3:ObjectCreated:*"],
      "Filter": {
        "Key": {
          "FilterRules": [
            { "Name": "Prefix", "Value": "uploads/" }
          ]
        }
      }
    }
  ]
}
```

Lambda resource policy includes S3 invoke permission:

```text
Sid: s3-invoke-w5
Principal: s3.amazonaws.com
Action: lambda:InvokeFunction
SourceArn: arn:aws:s3:::w5-agri-doc-events
SourceAccount: 945125812908
```

### 7.3 Lambda code behavior

When event contains `Records[0].eventSource == aws:s3`, Lambda:

- extracts bucket and key,
- creates `documentId = key`,
- writes DynamoDB item with:
  - `source = s3-event`
  - `bucket`
  - `key`
  - `eventTime`
  - `validationStatus = processed`
  - `efsPath = s3://bucket/key`

### 7.4 End-to-end test

Test upload:

```bash
printf 'S3 event test document\n' > /tmp/s3-test.txt
aws s3 cp /tmp/s3-test.txt \
  s3://w5-agri-doc-events/uploads/s3-test-1779952164.txt \
  --region us-east-1
```

Observed object:

```text
s3://w5-agri-doc-events/uploads/s3-test-1779952164.txt
```

DynamoDB item:

```json
{
  "documentId": "uploads/s3-test-1779952164.txt",
  "documentName": "s3-test-1779952164.txt",
  "source": "s3-event",
  "bucket": "w5-agri-doc-events",
  "key": "uploads/s3-test-1779952164.txt",
  "validationStatus": "processed",
  "efsPath": "s3://w5-agri-doc-events/uploads/s3-test-1779952164.txt"
}
```

CloudWatch Logs sample:

```text
START RequestId: ad5d84fd-315a-406a-8d20-98a10d8e2266 Version: $LATEST
END RequestId: ad5d84fd-315a-406a-8d20-98a10d8e2266
REPORT RequestId: ad5d84fd-315a-406a-8d20-98a10d8e2266 Duration: 303.67 ms
```

> [ẢNH CẦN CHỤP] S3 bucket notification showing Lambda target and prefix `uploads/`.
>
> [ẢNH CẦN CHỤP] Lambda resource policy or permissions tab showing S3 invoke permission.
>
> [ẢNH CẦN CHỤP] S3 object under `uploads/s3-test-1779952164.txt`.
>
> [ẢNH CẦN CHỤP] CloudWatch Logs for Lambda showing START/END/REPORT after S3 upload.
>
> [ẢNH CẦN CHỤP] DynamoDB item with `source=s3-event` and `validationStatus=processed`.

### 7.5 Status mapping note

The UI maps `validationStatus=processed` to a `Processed` badge and counts it toward compliance readiness. This is a display/business mapping; the raw DynamoDB evidence remains `processed` to show it came from the S3 event pipeline.

---

## 8. Application Carry-Forward Verification

### 8.1 ALB and ECS

ALB:

```text
Name: w5-agri-alb
DNS: w5-agri-alb-1092573247.us-east-1.elb.amazonaws.com
Scheme: internet-facing
Type: application
State: active
Subnets: public-a, public-b
```

Target health:

```text
10.0.12.239:3000 healthy
10.0.11.123:3000 healthy
```

ECS:

```text
Cluster: w5-agri-cluster
Service: w5-agri-service
Desired: 2
Running: 2
Task definition: w5-agri-task:8
Public IP: DISABLED
Subnets: private-app-a, private-app-b
```

> [ẢNH CẦN CHỤP] ECS service `w5-agri-service` showing 2 desired / 2 running.
>
> [ẢNH CẦN CHỤP] ALB target group `w5-agri-tg` showing both targets healthy.

### 8.2 Web application pages

Verified routes:

| Route | Purpose | Status |
|-------|---------|--------|
| `GET /` | Business dashboard | 200 |
| `GET /health` | Health check JSON | 200 |
| `GET /upload` / `/upload-form` | Document intake form | 200 |
| `POST /upload` | Upload to EFS + metadata to DynamoDB | implemented |
| `GET /documents` | Repository table | 200 |
| `GET /files` | Compatibility alias to repository/data | implemented |
| `GET /files/:name` | Compatibility file read route | implemented |
| `GET/POST /lambda-test` | Validation Center/API Gateway call | implemented |

> [ẢNH CẦN CHỤP] Dashboard page showing business KPIs.
>
> [ẢNH CẦN CHỤP] Upload page after upload success.
>
> [ẢNH CẦN CHỤP] Repository page showing `Processed` and `Pending` badges.
>
> [ẢNH CẦN CHỤP] Validation Center page with "Run validation check".
>
> [ẢNH CẦN CHỤP] System Status page showing Online/Available/Ready labels and W5 Technical Evidence.

---

## 9. Negative Security Tests

### 9.1 API Gateway unauthenticated request

Command:

```bash
curl -i -X POST \
  https://6w3fgcbsx6.execute-api.us-east-1.amazonaws.com/prod/validate \
  -H 'content-type: application/json' \
  --data '{"check":"evidence"}'
```

Observed:

```text
HTTP/2 403
{"message": "Forbidden: missing or invalid API key"}
```

### 9.2 Network Firewall blocked request

CloudWatch Alert Log group:

```text
/aws/network-firewall/alerts
```

Observed blocked log:

```json
{
  "firewall_name": "w5-agri-nfw",
  "src_ip": "10.0.11.244",
  "dest_ip": "98.87.172.0",
  "dest_port": 443,
  "event_type": "alert",
  "verdict": { "action": "drop" }
}
```

> [ẢNH CẦN CHỤP] Postman/curl showing `403` without API key.
>
> [ẢNH CẦN CHỤP] Network Firewall Alert Logs showing `verdict.action=drop`.

---

## 10. CI/CD and Deployment Evidence

GitHub Actions workflow:

```text
.github/workflows/deploy.yml
Trigger: push to main
Build context: ./app
ECR repository: w5-agri-app
ECS cluster: w5-agri-cluster
ECS service: w5-agri-service
Lambda function: w5-agri-validation
```

Recent application image in ECS task definition:

```text
945125812908.dkr.ecr.us-east-1.amazonaws.com/w5-agri-app:67927cb3c01891537b417a40794cf63d1c48653f
```

Recent commits relevant to UI/status:

```text
1ea4d88 Redesign W5 portal UI
67927cb Map processed documents as completed
```

> [ẢNH CẦN CHỤP] GitHub Actions run succeeded for latest commit.
>
> [ẢNH CẦN CHỤP] ECS task definition `w5-agri-task:8` showing image tag from latest commit.

---

## 11. Known Gaps / Trainer Notes

1. **API Gateway auth implementation**
   - Current: HTTP API route `AuthorizationType=NONE`, auth enforced in Lambda with `x-api-key`.
   - Evidence still shows 200 with key and 403 without key.
   - If trainer requires native API Gateway Usage Plan/API Key, migrate to REST API.

2. **ECS security group source**
   - Current ECS SG allows inbound TCP 3000 from `0.0.0.0/0`.
   - ECS tasks are private with no public IP, but production best practice is source = ALB SG only.
   - Recommended fix: restrict ECS SG inbound to `sg-011f9a1b4f5fd7589`.

3. **EFS restore evidence**
   - AWS Backup restore job for EFS is completed.
   - Add screenshot or command evidence showing restored data/readability if trainer asks for data-level proof.

4. **Lambda logging**
   - CloudWatch Logs show START/END/REPORT and DynamoDB item proves pipeline.
   - For clearer evidence, add `print(json.dumps(event))` in Lambda S3 branch before final submission.

---

## 12. Final PASS/FAIL Summary

| Requirement | Status | Evidence |
|-------------|--------|----------|
| MH1 Single VPC rationale | PASS | `w5-agri-vpc`, subnet tiers, route tables, Flow Logs |
| MH1 VPC Flow Logs | PASS | `/aws/vpc/w5-agri-flowlogs`, `DeliverLogsStatus=SUCCESS` |
| MH2 Network Firewall | PASS | `w5-agri-nfw`, READY, 2 firewall endpoints |
| MH2 Alert logs | PASS | `/aws/network-firewall/alerts`, drop sample |
| MH3 EFS mount | PASS | ECS task definition mounts EFS at `/mnt/efs` |
| MH3 DynamoDB metadata | PASS | `w5-agri-documents` ACTIVE with upload and S3-event items |
| MH3 AWS Backup | PASS | EFS/DynamoDB/EBS backup jobs COMPLETED |
| MH3 Restore jobs | PASS | EFS/DynamoDB/EBS restore jobs COMPLETED |
| MH4 API Gateway route | PASS | HTTP API `POST /validate` |
| MH4 Throttling | PASS | Stage rate 2 rps, burst 5 |
| MH4 Auth behavior | PASS with note | Lambda-level `x-api-key`, 200/403 verified |
| MH5 S3 event pipeline | PASS | S3 prefix `uploads/` -> Lambda -> DynamoDB |
| App carry-forward | PASS | ALB live, ECS 2/2, targets healthy |

---

## 13. Screenshot Checklist

Use this as the final image TODO list before submission:

- [ ] Live dashboard on ALB URL.
- [ ] `/health` returns `200 OK`.
- [ ] Upload form and upload success.
- [ ] Repository table with `Pending` and `Processed` badges.
- [ ] VPC `w5-agri-vpc` details.
- [ ] Subnet list showing public/private-app/private-data/firewall subnets.
- [ ] Route tables: public, private app A/B, firewall A/B, IGW edge.
- [ ] VPC Flow Logs status and CloudWatch sample.
- [ ] Network Firewall status READY.
- [ ] Network Firewall policy/rule group.
- [ ] Network Firewall alert log showing drop.
- [ ] EFS filesystem details, mount targets, access point.
- [ ] ECS task definition EFS mount.
- [ ] DynamoDB table and sample metadata item.
- [ ] AWS Backup plan, vault, backup jobs, restore jobs.
- [ ] API Gateway route and stage throttling.
- [ ] Curl/Postman 200 with API key.
- [ ] Curl/Postman 403 without API key.
- [ ] S3 notification config with prefix `uploads/`.
- [ ] Lambda permission showing S3 can invoke.
- [ ] S3 object under `uploads/`.
- [ ] Lambda CloudWatch log after S3 upload.
- [ ] DynamoDB item with `source=s3-event`.
- [ ] GitHub Actions deploy succeeded.

