<img width="1520" height="304" alt="image" src="https://github.com/user-attachments/assets/4fe9fb09-12c2-46b0-9d46-2c761b536ba5" /># W5 Evidence Pack — Smart Agricultural Compliance Document Portal

## Cover

- [x] **Name:** Lê Viết Quốc Hưng / XBrain_Group10
- [x] **Project:** Agri Compliance Portal
- [x] **AWS Account:** `945125812908`
- [x] **Region:** `us-east-1`
- [x] **Repo link:** `https://github.com/Hung0codon/Project_Xbrain_.git`
- [x] **ALB URL:** `http://w5-agri-alb-1092573247.us-east-1.elb.amazonaws.com`
- [x] **Health URL:** `http://w5-agri-alb-1092573247.us-east-1.elb.amazonaws.com/health`
- [x] **API Gateway URL:** `https://6w3fgcbsx6.execute-api.us-east-1.amazonaws.com/prod/validate`
- [ ] **Evidence commit link:** `[ẢNH/LINK CẦN THÊM] Commit chứa file evidence này`
- [ ] **Previous week evidence link, if available:** `[LINK CẦN THÊM HOẶC BỎ DÒNG NÀY]`

Notes:

```text
Agri Compliance Portal là web app quản lý tài liệu tuân thủ nông nghiệp cho supplier và quality-control teams.
Core flow: ALB -> ECS Fargate -> EFS + DynamoDB -> API Gateway/Lambda validation -> S3 event pipeline.
```

Important resources:

| Layer | Resource |
|---|---|
| VPC | `w5-agri-vpc` / `vpc-05925adb5ee41a007` |
| ALB | `w5-agri-alb` |
| ECS | `w5-agri-cluster` / `w5-agri-service` / `w5-agri-task:8` |
| EFS | `w5-agri-efs` / `fs-080ead609f73953dc` |
| DynamoDB | `w5-agri-documents` |
| API Gateway | HTTP API `w5-agri-api` / `6w3fgcbsx6` |
| Lambda | `w5-agri-validation` |
| S3 | `w5-agri-doc-events` |
| Backup | `w5-agri-backup-plan` / `w5-agri-vault` |

Evidence to capture:

- [ ] `[ẢNH CẦN CHỤP]` Live dashboard opened through ALB URL.
      <img width="1904" height="878" alt="image" src="https://github.com/user-attachments/assets/6af2b48a-46d3-468a-b5ec-169c9d420646" />

- [ ] `[ẢNH CẦN CHỤP]` `/health` returns `200 OK`.
      <img width="1904" height="881" alt="image" src="https://github.com/user-attachments/assets/f542ae1e-515e-448a-bfe1-445295a366c7" />

- [ ] `[ẢNH CẦN CHỤP]` GitHub commit link for this evidence pack.

---

## MH1 — Single-VPC Connectivity

- [x] Single-VPC rationale specific to this app.
- [x] Multi-AZ public, private app, private data, and firewall subnets.
- [x] Route table screenshots documented as TODO.
- [x] VPC Flow Logs enabled.
- [x] Sample Flow Logs entry with `ACCEPT`.

Notes:

```text
One VPC is sufficient because all components belong to one Agri Compliance Portal workload:
web portal, shared file storage, metadata table, validation function, and S3 ingestion pipeline.

A second VPC would be introduced when staging/production need hard network separation, or when
the app expands to partner/private integrations or multi-region deployment.
```

### VPC

```bash
aws ec2 describe-vpcs --region us-east-1
```

Observed:

```text
VPC name: w5-agri-vpc
VPC ID: vpc-05925adb5ee41a007
CIDR: 10.0.0.0/16
Region: us-east-1
```

### Subnet design

| Tier | us-east-1a | us-east-1b | Purpose |
|---|---|---|---|
| Public | `public-a` / `subnet-07ae0c77a66ad62de` / `10.0.1.0/24` | `public-b` / `subnet-036c1da491bd70b77` / `10.0.2.0/24` | ALB, NAT Gateway |
| Private app | `private-app-a` / `subnet-06187c34ff780d2c3` / `10.0.11.0/24` | `private-app-b` / `subnet-03101b8bd214912a9` / `10.0.12.0/24` | ECS Fargate tasks |
| Private data | `private-data-a` / `subnet-01064d0479e404d07` / `10.0.21.0/24` | `private-data-b` / `subnet-095350f97638da3e1` / `10.0.22.0/24` | EFS mount targets |
| Firewall | `firewall-a` / `subnet-075105e6f186ddba8` / `10.0.31.0/28` | `firewall-b` / `subnet-0802144f1354fa71d` / `10.0.32.0/28` | AWS Network Firewall |

Evidence to capture:

- [ ] `[ẢNH CẦN CHỤP]` VPC details page showing `w5-agri-vpc`, `10.0.0.0/16`.
      <img width="1449" height="614" alt="image" src="https://github.com/user-attachments/assets/5f9538cf-5532-4267-acb2-d967d9236555" />

### Route tables

Public route:

```text
w5-agri-rt-public
0.0.0.0/0 -> igw-0048bac97b953c881
Associated subnets: public-a, public-b
```

Private app routes:

```text
w5-agri-rt-private-app-a
0.0.0.0/0 -> vpce-0851db9760ca363b9
S3 prefix list -> vpce-01bef9c5f0cbefad2
DynamoDB prefix list -> vpce-0f778fb0fd152ab68

w5-agri-rt-private-app-b
0.0.0.0/0 -> vpce-00484cd566a72a207
S3 prefix list -> vpce-01bef9c5f0cbefad2
DynamoDB prefix list -> vpce-0f778fb0fd152ab68
```

Firewall subnet routes:

```text
w5-agri-rt-firewall-a
0.0.0.0/0 -> nat-02c9dcc9a97f1b9e7

w5-agri-rt-firewall-b
0.0.0.0/0 -> nat-00ec681ea6b6095b3
```

Evidence to capture:

- [ ] `[ẢNH CẦN CHỤP]` Route table `w5-agri-rt-public`.
      <img width="1609" height="641" alt="image" src="https://github.com/user-attachments/assets/e8eeb9b4-535a-43b9-bb00-bf6dcfc8b254" />

- [ ] `[ẢNH CẦN CHỤP]` Route tables `w5-agri-rt-private-app-a` and `w5-agri-rt-private-app-b`.
      <img width="1619" height="692" alt="image" src="https://github.com/user-attachments/assets/2c739c20-03dc-48fb-8d50-744505beef98" />
      <img width="1617" height="675" alt="image" src="https://github.com/user-attachments/assets/779ac328-facc-4769-bfb5-320741dcff7f" />


- [ ] `[ẢNH CẦN CHỤP]` Firewall route tables showing `0.0.0.0/0 -> NAT Gateway`.
      <img width="1447" height="616" alt="image" src="https://github.com/user-attachments/assets/8ba37ce0-2576-4e8b-8367-9ad55ef737df" />
      <img width="1204" height="587" alt="image" src="https://github.com/user-attachments/assets/2adf9f9d-3430-497d-b096-4729f4f95062" />


      

### VPC Flow Logs

```bash
aws ec2 describe-flow-logs \
  --region us-east-1 \
  --filter Name=resource-id,Values=vpc-05925adb5ee41a007
```

Observed:

```text
FlowLogId: fl-0b873ee36c80c0a35
TrafficType: ALL
Destination: CloudWatch Logs
Log group: /aws/vpc/w5-agri-flowlogs
DeliverLogsStatus: SUCCESS
```

Sample:

```text
2 945125812908 eni-0be5b59288183815b 35.203.211.112 10.0.1.161 52425 9568 6 1 44 1779856375 1779856389 ACCEPT OK
```

Evidence to capture:

- [ ] `[ẢNH CẦN CHỤP]` VPC Flow Logs status `SUCCESS`.
      <img width="1300" height="296" alt="image" src="https://github.com/user-attachments/assets/c6cba851-6a09-43f8-b220-84ff732c36a5" />

      


- [ ] `[ẢNH CẦN CHỤP]` CloudWatch log group `/aws/vpc/w5-agri-flowlogs` with `ACCEPT OK`.
      <img width="1374" height="240" alt="image" src="https://github.com/user-attachments/assets/4f37747a-4bc2-483f-ae4a-1b7c6181870f" />


      

---

## MH2 — Network Firewall Hardening

- [x] AWS Network Firewall deployed because the stack has NAT Gateway egress.
- [x] Dedicated firewall subnet.
- [x] Stateful rule group.
- [x] Alert Logs enabled.
- [x] Private subnet route table sends egress through firewall endpoint before NAT Gateway.
- [x] Allowed request evidence available through flow logs.
- [x] Blocked request evidence in Alert Logs.

Notes:

```text
Private app subnet egress is forced to the Network Firewall Gateway Load Balancer endpoint.
Firewall subnet route tables then send inspected traffic to NAT Gateway before internet egress.
```

### Firewall resources

```bash
aws network-firewall describe-firewall \
  --firewall-name w5-agri-nfw \
  --region us-east-1
```

Observed:

```text
Firewall: w5-agri-nfw
Status: READY
Sync: IN_SYNC
Policy: w5-agri-fw-policy
Endpoint us-east-1a: vpce-0851db9760ca363b9
Endpoint us-east-1b: vpce-00484cd566a72a207
Firewall subnets: firewall-a, firewall-b
```

### Stateful rule group

```text
Rule group: w5-agri-stateful-allowlist
Type: STATEFUL
Rule order: STRICT_ORDER
Generated rules type: ALLOWLIST
Allowed targets:
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
Stateful default actions: aws:alert_established, aws:drop_established
```

### Logging

```bash
aws network-firewall describe-logging-configuration \
  --firewall-name w5-agri-nfw \
  --region us-east-1
```

Observed:

```text
FLOW -> /aws/network-firewall/flows
ALERT -> /aws/network-firewall/alerts
```

Blocked alert sample:

```json
{
  "firewall_name": "w5-agri-nfw",
  "src_ip": "10.0.11.244",
  "dest_ip": "98.87.172.0",
  "dest_port": 443,
  "event_type": "alert",
  "verdict": { "action": "drop" },
  "alert": { "action": "blocked" }
}
```

Evidence to capture:

- [ ] `[ẢNH CẦN CHỤP]` Network Firewall `w5-agri-nfw` status `READY`.
      <img width="1277" height="525" alt="image" src="https://github.com/user-attachments/assets/875b7ad4-121d-49ac-83a9-f0478693cc58" />

- [ ] `[ẢNH CẦN CHỤP]` Firewall policy `w5-agri-fw-policy`.
      <img width="1135" height="364" alt="image" src="https://github.com/user-attachments/assets/7652e2e0-b29b-4673-9c33-6e00e7b31e3e" />

- [ ] `[ẢNH CẦN CHỤP]` Stateful rule group `w5-agri-stateful-allowlist`.
      <img width="1175" height="351" alt="image" src="https://github.com/user-attachments/assets/5c92040f-9cc9-4c7c-8d42-8be2b3655c17" />
      <img width="1227" height="581" alt="image" src="https://github.com/user-attachments/assets/414931a4-20f2-488a-bbd4-b0f84bf5999b" />



- [ ] `[ẢNH CẦN CHỤP]` Logging config with `/aws/network-firewall/alerts` and `/aws/network-firewall/flows`.
      <img width="1520" height="304" alt="image" src="https://github.com/user-attachments/assets/11e09919-d683-4fd2-9510-a0ba21d39e77" />

      
- [ ] `[ẢNH CẦN CHỤP]` CloudWatch Alert Logs showing `verdict.action=drop`.
      <img width="1104" height="488" alt="image" src="https://github.com/user-attachments/assets/5cdd5e2c-4ec1-4854-91f8-345366e9aef4" />


Security note:

```text
Current ECS SG allows TCP 3000 from 0.0.0.0/0, but tasks are in private subnets with no public IP.
Production-hardening improvement: change ECS SG source to ALB SG only.
```

---

## MH3 — File Storage Layer + Backup Plan

- [x] ECS Fargate task definition has EFS volume.
- [x] Container mounts EFS at `/mnt/efs`.
- [x] Upload writes file to `/mnt/efs/uploads`.
- [x] File list/read proves data is read back from EFS through the Repository page.
- [x] DynamoDB metadata item exists with `documentName`, `supplier`, `documentType`, `uploadTime`, `validationStatus`.
- [x] AWS Backup plan covers EFS.
- [x] AWS Backup plan covers DynamoDB table.
- [x] AWS Backup plan covers EBS W2 placeholder volume.
- [x] Recovery point / backup job is `COMPLETED`.
- [x] Restore job is `COMPLETED`.
- [ ] Restored file/data readable screenshot still needs to be added if trainer asks for data-level proof.

Notes:

```text
The app tier runs on ECS Fargate. User uploads are persisted through an EFS access point.
Metadata is stored in DynamoDB. AWS Backup protects EFS, DynamoDB, and a W2 EBS placeholder volume.
```

### EFS

```text
File system: w5-agri-efs
FileSystemId: fs-080ead609f73953dc
State: available
Encrypted: true
PerformanceMode: generalPurpose
ThroughputMode: bursting
```

Mount targets:

```text
us-east-1a: fsmt-0a004d99bd5429faa -> private-data-a / 10.0.21.218
us-east-1b: fsmt-0fdaa20137bfd5476 -> private-data-b / 10.0.22.201
```

Access point:

```text
AccessPointId: fsap-033c902fd72d4c722
Name: w5-agri-efs-ap-uploads
RootDirectory: /uploads
POSIX user: 1000:1000
```

EFS security:

```text
EFS SG: sg-0d13b43832b5eb336
Inbound: TCP 2049 from ECS SG sg-06c9fd208a68cf808
```

### ECS mount

```text
Task definition: w5-agri-task:8
Launch type: Fargate
Volume: efs-uploads
FileSystemId: fs-080ead609f73953dc
AccessPointId: fsap-033c902fd72d4c722
TransitEncryption: ENABLED
Container mount point: /mnt/efs
```

App code:

```text
EFS_BASE=/mnt/efs/uploads
POST /upload writes uploaded file to EFS and writes metadata to DynamoDB.
```

### DynamoDB metadata

```text
Table: w5-agri-documents
Status: ACTIVE
Partition key: documentId
```

Sample web-upload item:

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

### AWS Backup and restore

```text
Backup plan: w5-agri-backup-plan
BackupPlanId: 4160f2f5-feea-4bcf-bcc1-099da1a19c4b
Vault: w5-agri-vault
Schedule: cron(0 5 ? * * *) UTC
Retention: 7 days
```

Backup selection:

```text
Selection: w5-agri-assignment-1
Role: arn:aws:iam::945125812908:role/w5-agri-backup-role
Resources:
- DynamoDB: arn:aws:dynamodb:us-east-1:945125812908:table/w5-agri-documents
- EFS: arn:aws:elasticfilesystem:us-east-1:945125812908:file-system/fs-080ead609f73953dc
- EBS: arn:aws:ec2:us-east-1:945125812908:volume/vol-062f4a90c64f326ad
```

Completed backup jobs:

| Type | Resource | State |
|---|---|---|
| EFS | `fs-080ead609f73953dc` | `COMPLETED` |
| DynamoDB | `w5-agri-documents` | `COMPLETED` |
| EBS | `vol-062f4a90c64f326ad` | `COMPLETED` |

Completed restore jobs:

| Type | Created resource | Status |
|---|---|---|
| EFS | `fs-080ead609f73953dc` | `COMPLETED` |
| DynamoDB | `w5-agri-documents-restored` | `COMPLETED` |
| EBS | `vol-0fd869b80d5e5e095` | `COMPLETED` |

Evidence to capture:

- [ ] `[ẢNH CẦN CHỤP]` EFS details showing encryption enabled.
      <img width="1277" height="429" alt="image" src="https://github.com/user-attachments/assets/a7089f58-9836-4338-b446-b4f02c2a164a" />

- [ ] `[ẢNH CẦN CHỤP]` EFS mount targets in private data subnets.
      <img width="1113" height="348" alt="image" src="https://github.com/user-attachments/assets/5fd65b1b-b14c-4191-b660-20e3ad842384" />

- [ ] `[ẢNH CẦN CHỤP]` EFS access point `w5-agri-efs-ap-uploads`.
      <img width="1003" height="426" alt="image" src="https://github.com/user-attachments/assets/a9f07fc7-a62f-44e2-93e5-01953ffd62fe" />

- [ ] `[ẢNH CẦN CHỤP]` ECS task definition volume and mount point `/mnt/efs`.
      <img width="1297" height="392" alt="image" src="https://github.com/user-attachments/assets/6f071b02-a653-44fb-8e17-a0b9b861ee2f" />


- [ ] `[ẢNH CẦN CHỤP]` Upload success page.
      <img width="1412" height="182" alt="image" src="https://github.com/user-attachments/assets/4d759afa-d155-4d88-b726-23e6dea1140d" />

- [ ] `[ẢNH CẦN CHỤP]` Repository page showing uploaded file.
      <img width="1417" height="178" alt="image" src="https://github.com/user-attachments/assets/707fb9ed-3abc-4e42-b54d-f8b1f08d5b79" />

- [ ] `[ẢNH CẦN CHỤP]` DynamoDB item created by upload.
      
- [ ] `[ẢNH CẦN CHỤP]` AWS Backup plan and selection.
- [ ] `[ẢNH CẦN CHỤP]` Backup jobs `COMPLETED`.
- [ ] `[ẢNH CẦN CHỤP]` Restore jobs `COMPLETED`.
- [ ] `[ẢNH CẦN CHỤP]` Restored DynamoDB table `w5-agri-documents-restored`.

---

## MH4 — API Gateway + Auth + Throttling

- [x] API Gateway route configured.
- [x] Lambda proxy integration configured.
- [x] API key-style auth behavior configured in Lambda.
- [x] Stage throttling has rate and burst limits.
- [x] Web app calls API Gateway URL via `/lambda-test`.
- [x] Web app does not invoke Lambda directly.
- [x] Authenticated curl returns `200`.
- [x] Unauthenticated curl returns `403`.

Notes:

```text
The current endpoint uses API Gateway HTTP API with stage throttling.
Auth is enforced inside Lambda by checking the x-api-key header against EXPECTED_API_KEY.
If the trainer requires native REST API Usage Plan, migrate this endpoint to REST API.
```

### API route

```text
API name: w5-agri-api
API ID: 6w3fgcbsx6
Protocol: HTTP API
Stage: prod
Route: POST /validate
Endpoint: https://6w3fgcbsx6.execute-api.us-east-1.amazonaws.com/prod/validate
```

Stage throttling:

```text
ThrottlingRateLimit: 2.0 requests/second
ThrottlingBurstLimit: 5
```

Lambda:

```text
Function: w5-agri-validation
Runtime: python3.12
Handler: lambda_function.lambda_handler
Env: EXPECTED_API_KEY=w5-agri-demo-key-123
```

Authenticated test:

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

Unauthenticated test:

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

Evidence to capture:

- [ ] `[ẢNH CẦN CHỤP]` API Gateway `w5-agri-api`, route `POST /validate`.
- [ ] `[ẢNH CẦN CHỤP]` Stage `prod`, throttling rate `2`, burst `5`.
- [ ] `[ẢNH CẦN CHỤP]` Lambda env var `EXPECTED_API_KEY` or code snippet checking `x-api-key`.
- [ ] `[ẢNH CẦN CHỤP]` Curl/Postman `200` with `x-api-key`.
- [ ] `[ẢNH CẦN CHỤP]` Curl/Postman `403` without `x-api-key`.
- [ ] `[ẢNH CẦN CHỤP]` Web app Validation Center page.

---

## MH5 — Serverless Scaling Pattern

- [x] S3 event-triggered pipeline configured on the same Lambda used in MH4.
- [x] S3 bucket `w5-agri-doc-events` created for document event ingestion.
- [x] S3 Event Notification configured: `ObjectCreated:*` -> Lambda `w5-agri-validation`.
- [x] Prefix filter configured: `uploads/`.
- [x] Lambda handles both API Gateway events and S3 events.
- [x] Test object uploaded to S3: `uploads/s3-test-1779952164.txt`.
- [x] Lambda invocation from S3 event captured in CloudWatch Logs.
- [x] Lambda writes processed S3 event metadata into DynamoDB table `w5-agri-documents`.
- [x] DynamoDB item verified with `source=s3-event`, `bucket`, `key`, `eventTime`, `validationStatus=processed`.
- [x] Rationale documented.

Notes:

```text
This is an event-driven scaling pattern: S3 PutObject events invoke Lambda asynchronously.
Document ingestion is decoupled from the web app, and Lambda writes metadata to DynamoDB.
```

### S3 notification

```bash
aws s3api get-bucket-notification-configuration \
  --bucket w5-agri-doc-events \
  --region us-east-1
```

Observed:

```json
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
```

Lambda invoke permission:

```text
Sid: s3-invoke-w5
Principal: s3.amazonaws.com
Action: lambda:InvokeFunction
SourceArn: arn:aws:s3:::w5-agri-doc-events
SourceAccount: 945125812908
```

### End-to-end test

Upload:

```bash
printf 'S3 event test document\n' > /tmp/s3-test.txt
aws s3 cp /tmp/s3-test.txt \
  s3://w5-agri-doc-events/uploads/s3-test-1779952164.txt \
  --region us-east-1
```

DynamoDB result:

```json
{
  "documentId": "uploads/s3-test-1779952164.txt",
  "documentName": "s3-test-1779952164.txt",
  "source": "s3-event",
  "bucket": "w5-agri-doc-events",
  "key": "uploads/s3-test-1779952164.txt",
  "eventTime": "2026-05-28T07:09:28.717Z",
  "validationStatus": "processed",
  "efsPath": "s3://w5-agri-doc-events/uploads/s3-test-1779952164.txt"
}
```

CloudWatch Logs:

```text
START RequestId: ad5d84fd-315a-406a-8d20-98a10d8e2266 Version: $LATEST
END RequestId: ad5d84fd-315a-406a-8d20-98a10d8e2266
REPORT RequestId: ad5d84fd-315a-406a-8d20-98a10d8e2266 Duration: 303.67 ms
```

Evidence to capture:

- [ ] `[ẢNH CẦN CHỤP]` S3 bucket `w5-agri-doc-events`.
- [ ] `[ẢNH CẦN CHỤP]` S3 event notification showing `ObjectCreated:*`, Lambda ARN, prefix `uploads/`.
- [ ] `[ẢNH CẦN CHỤP]` Lambda permissions tab showing S3 invoke permission.
- [ ] `[ẢNH CẦN CHỤP]` S3 object under `uploads/s3-test-1779952164.txt`.
- [ ] `[ẢNH CẦN CHỤP]` Lambda CloudWatch Logs after S3 upload.
- [ ] `[ẢNH CẦN CHỤP]` DynamoDB item with `source=s3-event` and `validationStatus=processed`.

---

## Application Carry-Forward Verification

- [x] Agri Compliance Dashboard works through ALB URL.
- [x] `/health` works.
- [x] Upload Agricultural Document works.
- [x] Document Repository works.
- [x] Validation Service works through API Gateway.

Notes:

```text
The production-facing UI is available through the ALB DNS name.
The app runs on ECS Fargate with two healthy targets in private subnets.
```

### ALB and ECS

```text
ALB: w5-agri-alb
DNS: w5-agri-alb-1092573247.us-east-1.elb.amazonaws.com
Scheme: internet-facing
State: active
Target group: w5-agri-tg
Healthy targets:
- 10.0.12.239:3000 healthy
- 10.0.11.123:3000 healthy
```

```text
ECS cluster: w5-agri-cluster
ECS service: w5-agri-service
Desired: 2
Running: 2
Task definition: w5-agri-task:8
Public IP: DISABLED
Subnets: private-app-a, private-app-b
```

Verified routes:

| Route | Purpose | Status |
|---|---|---|
| `GET /` | Dashboard | 200 |
| `GET /health` | Health JSON | 200 |
| `GET /upload` / `/upload-form` | Upload form | 200 |
| `POST /upload` | Upload to EFS + metadata to DynamoDB | Implemented |
| `GET /documents` | Repository | 200 |
| `GET /files` | Compatibility alias | Implemented |
| `GET /files/:name` | File read compatibility route | Implemented |
| `GET/POST /lambda-test` | Validation Center | Implemented |

Evidence to capture:

- [ ] `[ẢNH CẦN CHỤP]` Dashboard page.
- [ ] `[ẢNH CẦN CHỤP]` Upload page.
- [ ] `[ẢNH CẦN CHỤP]` Upload success.
- [ ] `[ẢNH CẦN CHỤP]` Repository table with `Pending` and `Processed` badges.
- [ ] `[ẢNH CẦN CHỤP]` Validation Center page.
- [ ] `[ẢNH CẦN CHỤP]` System Status page with W5 Technical Evidence.
- [ ] `[ẢNH CẦN CHỤP]` ECS service 2 desired / 2 running.
- [ ] `[ẢNH CẦN CHỤP]` ALB target group healthy targets.

---

## Negative Security Tests

- [x] Firewall blocked request appears in Alert Logs.
- [x] API Gateway request without API key/auth returns `403`.

Notes:

```text
Negative API test proves missing x-api-key is rejected.
Network Firewall alert logs prove non-allowlisted outbound traffic is dropped.
```

### API negative test

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

### Firewall negative test evidence

CloudWatch log group:

```text
/aws/network-firewall/alerts
```

Observed sample:

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

Evidence to capture:

- [ ] `[ẢNH CẦN CHỤP]` Curl/Postman `403` without API key.
- [ ] `[ẢNH CẦN CHỤP]` CloudWatch Network Firewall alert log with `drop`.

---

## Bonus

- [x] CI/CD pipeline deploys the ECS app and Lambda from GitHub Actions.
- [x] Production UI was redesigned into a business-facing Agri Compliance Portal.
- [x] UI maps `validationStatus=processed` from S3 events into a `Processed` badge.

Notes:

```text
GitHub Actions workflow .github/workflows/deploy.yml builds ./app, pushes to ECR w5-agri-app,
updates ECS service w5-agri-service, and deploys Lambda w5-agri-validation.
```

Recent commits:

```text
1ea4d88 Redesign W5 portal UI
67927cb Map processed documents as completed
ae2c1b0 Update W5 evidence pack
```

Evidence to capture:

- [ ] `[ẢNH CẦN CHỤP]` GitHub Actions run succeeded.
- [ ] `[ẢNH CẦN CHỤP]` ECS task definition image tag from latest app commit.

---

## Final Screenshot Checklist

- [ ] Live dashboard on ALB URL.
- [ ] `/health` returns `200 OK`.
- [ ] Upload form and upload success.
- [ ] Repository table with `Pending` and `Processed` badges.
- [ ] VPC `w5-agri-vpc` details.
- [ ] Subnet list showing public/private-app/private-data/firewall subnets.
- [ ] Route tables: public, private app A/B, firewall A/B.
- [ ] VPC Flow Logs status and CloudWatch sample.
- [ ] Network Firewall status READY.
- [ ] Network Firewall policy and stateful rule group.
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

