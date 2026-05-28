# W5 Evidence Pack — Group 10, Agri Compliance Portal (AgriTech: Smart Compliance Document Portal)

> **Workshop:** W5 — Networking, Storage, API Gateway, và Serverless Scaling Pattern

---

## 1. Cover

| Trường | Giá trị |
|--------|---------|
| **Nhóm** | XBrain_Group10 |
| **Domain** | AgriTech: "Smart Compliance Document Portal" — Agri Compliance Portal |
| **Thành viên phụ trách** | Lê Viết Quốc Hưng |
| **AWS Account** | `945125812908` |
| **Region** | `us-east-1` (N. Virginia) |
| **Repo** | https://github.com/Hung0codon/Project_Xbrain_.git |
| **ALB URL** | http://w5-agri-alb-1092573247.us-east-1.elb.amazonaws.com |
| **Health URL** | http://w5-agri-alb-1092573247.us-east-1.elb.amazonaws.com/health |
| **API Gateway URL** | https://6w3fgcbsx6.execute-api.us-east-1.amazonaws.com/prod/validate |
| **Core flow** | ALB → ECS Fargate → EFS + DynamoDB → API Gateway/Lambda validation → S3 event pipeline |
| **Pre-flight safety** | Multi-AZ subnets | VPC Flow Logs enabled | Network Firewall Alert Logs | API Key auth | AWS Backup plan với retention 7 ngày |

### Bảng tài nguyên quan trọng

| Layer | Resource |
|-------|----------|
| VPC | `w5-agri-vpc` / `vpc-05925adb5ee41a007` |
| ALB | `w5-agri-alb` |
| ECS | `w5-agri-cluster` / `w5-agri-service` / `w5-agri-task:8` |
| EFS | `w5-agri-efs` / `fs-080ead609f73953dc` |
| DynamoDB | `w5-agri-documents` |
| API Gateway | HTTP API `w5-agri-api` / `6w3fgcbsx6` |
| Lambda | `w5-agri-validation` |
| S3 | `w5-agri-doc-events` |
| Backup | `w5-agri-backup-plan` / `w5-agri-vault` |
| Network Firewall | `w5-agri-nfw` / Policy `w5-agri-fw-policy` |

### Evidence — Live App

> **📸 Screenshot 1.1:** Live dashboard mở qua ALB URL.

<img width="1904" height="878" alt="image" src="https://github.com/user-attachments/assets/6af2b48a-46d3-468a-b5ec-169c9d420646" />

> **📸 Screenshot 1.2:** Endpoint `/health` trả về `200 OK`.

<img width="1904" height="881" alt="image" src="https://github.com/user-attachments/assets/f542ae1e-515e-448a-bfe1-445295a366c7" />

---

## 2. Pitch and Vision

### Use Case

**Agri Compliance Portal** là web app quản lý tài liệu tuân thủ nông nghiệp dành cho **supplier** (nhà cung cấp nông sản) và **quality-control teams** (đội kiểm định chất lượng). Giá trị cốt lõi: tải lên tài liệu chứng nhận (VietGAP, GlobalGAP, HACCP, v.v.) và nhận lại quy trình validation tự động qua API Gateway + Lambda, lưu trữ an toàn trên EFS với metadata trong DynamoDB, mọi sự kiện upload đều được ingest qua S3 event pipeline.

### Target User

- **Nhà cung cấp nông sản** cần submit chứng nhận tuân thủ định kỳ
- **Đội QA/QC** của doanh nghiệp nông nghiệp cần review và validate tài liệu
- **Auditor** bên thứ ba cần truy cập tài liệu để kiểm tra
- **Quản lý chuỗi cung ứng** cần theo dõi trạng thái compliance toàn hệ thống

### Why This Domain Matters

Ngành nông nghiệp Việt Nam đang đẩy mạnh xuất khẩu sang EU, US, Nhật Bản — nơi yêu cầu chứng nhận tuân thủ nghiêm ngặt. Các đơn vị supplier đối mặt với:

- **Phân tán tài liệu**: chứng nhận lưu trên email, USB, Drive cá nhân — khó tra cứu khi auditor yêu cầu
- **Không có quy trình validation chuẩn**: mỗi đơn vị tự tạo template kiểm tra, không nhất quán
- **Khó truy vết**: khi có sự cố an toàn thực phẩm, không biết lô hàng nào liên quan đến chứng nhận nào
- **Bảo mật yếu**: tài liệu compliance chứa thông tin nhạy cảm về quy trình sản xuất, cần lưu trữ có kiểm soát

Agri Compliance Portal giải quyết bằng kiến trúc cloud-native: tài liệu được upload qua web app, lưu trên EFS shared storage, metadata indexed trong DynamoDB, mọi event được async process qua S3 → Lambda pipeline để chuẩn bị cho việc tích hợp AI validation về sau.

### Real-World Parallel

Agri Compliance Portal tương tự **FoodLogiQ** (food traceability + compliance), **TraceGains** (supplier compliance management), và **Intelex** (EHS document management) — nhưng được thiết kế phù hợp với regulations và quy mô của thị trường Việt Nam.

---

## 3. Architecture

### 3.1 Sơ đồ kiến trúc tổng quan

```text
                  ┌─────────────────┐
   Internet ───▶  │   ALB (public)  │
                  └────────┬────────┘
                           │
                  ┌────────▼────────────┐
                  │  ECS Fargate (app)  │
                  │  Private subnets    │
                  └─┬───────┬─────────┬─┘
                    │       │         │
              ┌─────▼──┐ ┌──▼──────┐ ┌▼──────────────┐
              │  EFS   │ │DynamoDB │ │ API Gateway   │
              │/mnt/efs│ │metadata │ │ → Lambda      │
              └────────┘ └─────────┘ └───────┬───────┘
                                             │
                       ┌─────────────────────▼──────┐
                       │   S3 (w5-agri-doc-events)  │
                       │   ObjectCreated → Lambda   │
                       └────────────────────────────┘

Egress: Private app subnets ──▶ Network Firewall endpoint ──▶ NAT Gateway ──▶ Internet
```

### 3.2 Bảng Service Decisions

| # | Capability | Service Đã Chọn | Tại Sao Chọn Cái Này, Không Phải Cái Khác |
|---|-----------|-----------------|-------------------------------------------|
| 1 | API Entry & Load Balancing | ALB (Application Load Balancer) | App có nhiều route (`/`, `/health`, `/upload`, `/documents`, `/lambda-test`) — ALB hỗ trợ path-based routing tốt hơn NLB. Internet-facing scheme. Tasks ở private subnet không lộ public IP. |
| 2 | Application Compute | ECS Fargate | Web app Node.js đã containerize. Fargate không cần quản lý EC2, scale theo desired count (2 tasks across 2 AZ). Tasks ở private subnet, egress qua Network Firewall → NAT. |
| 3 | Shared File Storage | EFS với Access Point | Multiple ECS tasks cần đọc/ghi cùng kho tài liệu upload. S3 không phù hợp vì app cần POSIX semantics. EFS access point `fsap-033c902fd72d4c722` enforce POSIX user 1000:1000 và root `/uploads`. |
| 4 | Metadata Persistence | DynamoDB | Document metadata (documentId, supplier, documentType, validationStatus, uploadTime) là key-value access pattern thuần — DynamoDB nhanh, serverless, không cần quản lý DB instance. Partition key: `documentId`. |
| 5 | Validation API | API Gateway HTTP API + Lambda | HTTP API rẻ hơn REST API (~70%). Stage `prod` có throttling. Auth được enforce trong Lambda qua header `x-api-key` — đơn giản, không cần Usage Plan riêng. |
| 6 | Event-driven Ingestion | S3 Event Notification → Lambda | S3 PutObject trên prefix `uploads/` async invoke Lambda `w5-agri-validation`. Decoupled khỏi web app, scale tự động theo upload volume. Cùng Lambda xử lý cả API request và S3 event. |
| 7 | Network Foundation | VPC 4-tier (public + private-app + private-data + firewall) | 4 subnet tier × 2 AZ = 8 subnets. ALB ở public, ECS ở private-app, EFS mount targets ở private-data, AWS Network Firewall endpoints ở firewall tier. Tách bạch trách nhiệm rõ ràng. |
| 8 | Network Hardening | AWS Network Firewall (stateful allowlist) | Vì stack có NAT Gateway egress → cần kiểm soát outbound traffic. Stateful rule group `w5-agri-stateful-allowlist` chỉ cho phép các domain `*.amazonaws.com`, `*.docker.io`, `*.github.com`, v.v. Alert log ghi mọi `drop`. |
| 9 | Backup & Recovery | AWS Backup Plan (EFS + DynamoDB + EBS) | 1 backup plan `w5-agri-backup-plan` cover cả 3 loại resource. Daily backup `cron(0 5 ? * * *)` UTC, retention 7 ngày. Đã verify restore COMPLETED trên cả 3 resource types. |
| 10 | CI/CD (Bonus) | GitHub Actions → ECR → ECS | Workflow `.github/workflows/deploy.yml` build `./app`, push lên ECR `w5-agri-app`, update ECS service, deploy Lambda. Không dùng CodePipeline vì repo đã ở GitHub. |

### 3.3 Trade-offs

**Trade-off 1: HTTP API vs REST API cho API Gateway**

Chúng tôi chọn **HTTP API** (`6w3fgcbsx6`) thay vì REST API vì HTTP API rẻ hơn ~70% ($1.00 vs $3.50 per 1M requests) và đủ cho use case validation đơn giản. Auth được implement trong Lambda (check `x-api-key` header) thay vì dùng API Gateway Usage Plan. **Trade-off:** mất khả năng native API key management, throttling per-key, và caching của REST API. Nếu trainer/customer yêu cầu Usage Plan chuẩn, sẽ migrate sang REST API — code Lambda vẫn dùng được vì proxy integration giữ nguyên event shape.

**Trade-off 2: EFS vs S3 cho document storage**

Chúng tôi chọn **EFS** cho document storage thay vì S3 vì web app cần POSIX file operations (`fs.writeFile`, `fs.readdir` từ Node.js) khi multiple ECS tasks cùng đọc/ghi. Trade-off: EFS đắt hơn S3 ($0.30/GB-mo vs $0.023/GB-mo) và scale chậm hơn cho large files. **Lý do chấp nhận:** Volume tài liệu trong giai đoạn MVP thấp (<10GB), và EFS Access Point đơn giản hóa permission model. S3 event pipeline song song được dùng cho async ingestion ở MH5 — best of both worlds.

**Trade-off 3: Network Firewall với strict allowlist vs Security Groups + NACL only**

Chúng tôi chọn **AWS Network Firewall** với stateful rule group `STRICT_ORDER` + ALLOWLIST cho egress traffic. **Trade-off:** Network Firewall tốn ~$0.395/hr ($9.48/ngày) + $0.065/GB processed — đắt hơn nhiều so với chỉ dùng SG + NACL. **Lý do chấp nhận:** Compliance domain (nông nghiệp xuất khẩu) yêu cầu phải có outbound traffic inspection để đáp ứng audit. Allowlist domain (`*.amazonaws.com`, `*.docker.io`, `*.github.com`) đảm bảo container không gọi đến malicious endpoint nếu bị compromise. Alert logs ghi nhận mọi drop, hỗ trợ investigation.

---

## 4. MH1 — Single-VPC Connectivity ★

### 4.1 Checklist

- [x] Single-VPC rationale specific to this app
- [x] Multi-AZ public, private-app, private-data, và firewall subnets
- [x] Route table screenshots
- [x] VPC Flow Logs enabled
- [x] Sample Flow Logs entry với `ACCEPT`

### 4.2 Lý do chọn Single-VPC

> Toàn bộ workload Agri Compliance Portal nằm chung 1 nghiệp vụ: web portal, shared file storage, metadata table, validation function, và S3 ingestion pipeline. Một VPC duy nhất là đủ và đơn giản hóa networking.
>
> VPC thứ hai sẽ được đưa vào khi cần **hard network isolation** giữa staging/production, hoặc khi mở rộng sang **partner/private integrations** (B2B), hoặc khi triển khai **multi-region** cho disaster recovery.

### 4.3 VPC

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

> **📸 Screenshot 4.3:** Trang VPC details.

<img width="1449" height="614" alt="image" src="https://github.com/user-attachments/assets/5f9538cf-5532-4267-acb2-d967d9236555" />

### 4.4 Subnet Design

| Tier | us-east-1a | us-east-1b | Mục đích |
|------|-----------|-----------|---------|
| **Public** | `public-a` / `subnet-07ae0c77a66ad62de` / `10.0.1.0/24` | `public-b` / `subnet-036c1da491bd70b77` / `10.0.2.0/24` | ALB, NAT Gateway |
| **Private app** | `private-app-a` / `subnet-06187c34ff780d2c3` / `10.0.11.0/24` | `private-app-b` / `subnet-03101b8bd214912a9` / `10.0.12.0/24` | ECS Fargate tasks |
| **Private data** | `private-data-a` / `subnet-01064d0479e404d07` / `10.0.21.0/24` | `private-data-b` / `subnet-095350f97638da3e1` / `10.0.22.0/24` | EFS mount targets |
| **Firewall** | `firewall-a` / `subnet-075105e6f186ddba8` / `10.0.31.0/28` | `firewall-b` / `subnet-0802144f1354fa71d` / `10.0.32.0/28` | AWS Network Firewall endpoints |

### 4.5 Route Tables

**Public route table:**

```text
w5-agri-rt-public
0.0.0.0/0 -> igw-0048bac97b953c881
Associated subnets: public-a, public-b
```

**Private app route tables (egress qua Network Firewall endpoint):**

```text
w5-agri-rt-private-app-a
0.0.0.0/0 -> vpce-0851db9760ca363b9   (NFW endpoint us-east-1a)
S3 prefix list -> vpce-01bef9c5f0cbefad2
DynamoDB prefix list -> vpce-0f778fb0fd152ab68

w5-agri-rt-private-app-b
0.0.0.0/0 -> vpce-00484cd566a72a207   (NFW endpoint us-east-1b)
S3 prefix list -> vpce-01bef9c5f0cbefad2
DynamoDB prefix list -> vpce-0f778fb0fd152ab68
```

**Firewall subnet route tables (sau khi inspect → NAT Gateway):**

```text
w5-agri-rt-firewall-a
0.0.0.0/0 -> nat-02c9dcc9a97f1b9e7

w5-agri-rt-firewall-b
0.0.0.0/0 -> nat-00ec681ea6b6095b3
```

> **📸 Screenshot 4.5a:** Route table `w5-agri-rt-public`.

<img width="1609" height="641" alt="image" src="https://github.com/user-attachments/assets/e8eeb9b4-535a-43b9-bb00-bf6dcfc8b254" />

> **📸 Screenshot 4.5b:** Route tables `w5-agri-rt-private-app-a` và `w5-agri-rt-private-app-b`.

<img width="1619" height="692" alt="image" src="https://github.com/user-attachments/assets/2c739c20-03dc-48fb-8d50-744505beef98" />
<img width="1617" height="675" alt="image" src="https://github.com/user-attachments/assets/779ac328-facc-4769-bfb5-320741dcff7f" />

> **📸 Screenshot 4.5c:** Firewall route tables showing `0.0.0.0/0 -> NAT Gateway`.

<img width="1447" height="616" alt="image" src="https://github.com/user-attachments/assets/8ba37ce0-2576-4e8b-8367-9ad55ef737df" />
<img width="1204" height="587" alt="image" src="https://github.com/user-attachments/assets/2adf9f9d-3430-497d-b096-4729f4f95062" />

### 4.6 VPC Flow Logs

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

Sample log entry:

```text
2 945125812908 eni-0be5b59288183815b 35.203.211.112 10.0.1.161 52425 9568 6 1 44 1779856375 1779856389 ACCEPT OK
```

> **📸 Screenshot 4.6a:** VPC Flow Logs status `SUCCESS`.

<img width="1300" height="296" alt="image" src="https://github.com/user-attachments/assets/c6cba851-6a09-43f8-b220-84ff732c36a5" />

> **📸 Screenshot 4.6b:** CloudWatch log group `/aws/vpc/w5-agri-flowlogs` với entry `ACCEPT OK`.

<img width="1374" height="240" alt="image" src="https://github.com/user-attachments/assets/4f37747a-4bc2-483f-ae4a-1b7c6181870f" />

---

## 5. MH2 — Network Firewall Hardening ★

### 5.1 Checklist

- [x] AWS Network Firewall deployed (vì stack có NAT Gateway egress)
- [x] Dedicated firewall subnet (Multi-AZ)
- [x] Stateful rule group
- [x] Alert logs enabled
- [x] Private subnet route table gửi egress qua firewall endpoint trước khi ra NAT Gateway
- [x] Bằng chứng request được allow qua flow logs
- [x] Bằng chứng request bị block trong alert logs

### 5.2 Kiến trúc Egress

> Egress từ private-app subnet bị **force qua Network Firewall Gateway Load Balancer endpoint** (`vpce-0851db9760ca363b9` ở AZ-a và `vpce-00484cd566a72a207` ở AZ-b). Firewall subnet route tables sau đó forward traffic đã inspect sang NAT Gateway để ra Internet. Không có path bypass.

### 5.3 Firewall Resources

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

> **📸 Screenshot 5.3a:** Network Firewall `w5-agri-nfw` status `READY`.

<img width="1277" height="525" alt="image" src="https://github.com/user-attachments/assets/875b7ad4-121d-49ac-83a9-f0478693cc58" />

> **📸 Screenshot 5.3b:** Firewall policy `w5-agri-fw-policy`.

<img width="1135" height="364" alt="image" src="https://github.com/user-attachments/assets/7652e2e0-b29b-4673-9c33-6e00e7b31e3e" />

### 5.4 Stateful Rule Group (Allowlist)

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

**Firewall policy default actions:**

```text
Stateless default: aws:forward_to_sfe
Stateful default actions: aws:alert_established, aws:drop_established
```

> **📸 Screenshot 5.4:** Stateful rule group `w5-agri-stateful-allowlist`.

<img width="1175" height="351" alt="image" src="https://github.com/user-attachments/assets/5c92040f-9cc9-4c7c-8d42-8be2b3655c17" />
<img width="1227" height="581" alt="image" src="https://github.com/user-attachments/assets/414931a4-20f2-488a-bbd4-b0f84bf5999b" />

### 5.5 Logging & Alert Evidence

```bash
aws network-firewall describe-logging-configuration \
  --firewall-name w5-agri-nfw \
  --region us-east-1
```

Observed:

```text
FLOW  -> /aws/network-firewall/flows
ALERT -> /aws/network-firewall/alerts
```

**Sample blocked alert (verdict = drop):**

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

> **📸 Screenshot 5.5a:** Logging config với `/aws/network-firewall/alerts` và `/aws/network-firewall/flows`.

<img width="1520" height="304" alt="image" src="https://github.com/user-attachments/assets/11e09919-d683-4fd2-9510-a0ba21d39e77" />

> **📸 Screenshot 5.5b:** CloudWatch Alert Logs hiển thị `verdict.action=drop`.

<img width="1104" height="488" alt="image" src="https://github.com/user-attachments/assets/5cdd5e2c-4ec1-4854-91f8-345366e9aef4" />

> **⚠️ LƯU Ý (Security Hardening còn lại):** Hiện tại ECS SG cho phép TCP 3000 từ `0.0.0.0/0`. Mặc dù tasks ở private subnet và không có public IP (không thể truy cập trực tiếp), production-hardening cần thay đổi source của ECS SG thành **ALB SG only** để áp dụng nguyên tắc least-privilege một cách triệt để.

---

## 6. MH3 — File Storage Layer + Backup Plan ★

### 6.1 Checklist

- [x] ECS Fargate task definition có EFS volume
- [x] Container mount EFS tại `/mnt/efs`
- [x] Upload ghi file vào `/mnt/efs/uploads`
- [x] File list/read chứng minh đọc lại được từ EFS qua Repository page
- [x] DynamoDB metadata item có `documentName`, `supplier`, `documentType`, `uploadTime`, `validationStatus`
- [x] AWS Backup plan cover EFS
- [x] AWS Backup plan cover DynamoDB
- [x] AWS Backup plan cover EBS (W2 placeholder volume)
- [x] Recovery point / backup job `COMPLETED`
- [x] Restore job `COMPLETED`

### 6.2 EFS

```text
File system: w5-agri-efs
FileSystemId: fs-080ead609f73953dc
State: available
Encrypted: true
PerformanceMode: generalPurpose
ThroughputMode: bursting
```

**Mount targets (Multi-AZ):**

```text
us-east-1a: fsmt-0a004d99bd5429faa -> private-data-a / 10.0.21.218
us-east-1b: fsmt-0fdaa20137bfd5476 -> private-data-b / 10.0.22.201
```

**Access Point:**

```text
AccessPointId: fsap-033c902fd72d4c722
Name: w5-agri-efs-ap-uploads
RootDirectory: /uploads
POSIX user: 1000:1000
```

**EFS Security Group:**

```text
EFS SG: sg-0d13b43832b5eb336
Inbound: TCP 2049 from ECS SG sg-06c9fd208a68cf808
```

> **📸 Screenshot 6.2a:** EFS details hiển thị encryption enabled.

<img width="1277" height="429" alt="image" src="https://github.com/user-attachments/assets/a7089f58-9836-4338-b446-b4f02c2a164a" />

> **📸 Screenshot 6.2b:** EFS mount targets ở private-data subnets.

<img width="1113" height="348" alt="image" src="https://github.com/user-attachments/assets/5fd65b1b-b14c-4191-b660-20e3ad842384" />

> **📸 Screenshot 6.2c:** EFS access point `w5-agri-efs-ap-uploads`.

<img width="1003" height="426" alt="image" src="https://github.com/user-attachments/assets/a9f07fc7-a62f-44e2-93e5-01953ffd62fe" />

### 6.3 ECS Mount

```text
Task definition: w5-agri-task:8
Launch type: Fargate
Volume: efs-uploads
FileSystemId: fs-080ead609f73953dc
AccessPointId: fsap-033c902fd72d4c722
TransitEncryption: ENABLED
Container mount point: /mnt/efs
```

**App code:**

```text
EFS_BASE=/mnt/efs/uploads
POST /upload writes uploaded file to EFS and writes metadata to DynamoDB.
```

> **📸 Screenshot 6.3:** ECS task definition volume và mount point `/mnt/efs`.

<img width="1297" height="392" alt="image" src="https://github.com/user-attachments/assets/6f071b02-a653-44fb-8e17-a0b9b861ee2f" />

### 6.4 DynamoDB Metadata

```text
Table: w5-agri-documents
Status: ACTIVE
Partition key: documentId
```

**Sample web-upload item:**

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

> **📸 Screenshot 6.4a:** Upload success page.

<img width="1412" height="182" alt="image" src="https://github.com/user-attachments/assets/4d759afa-d155-4d88-b726-23e6dea1140d" />

> **📸 Screenshot 6.4b:** Repository page hiển thị file đã upload.

<img width="1417" height="178" alt="image" src="https://github.com/user-attachments/assets/707fb9ed-3abc-4e42-b54d-f8b1f08d5b79" />

> **📸 Screenshot 6.4c:** DynamoDB item được tạo bởi upload.

<img width="1264" height="322" alt="image" src="https://github.com/user-attachments/assets/32689650-abd0-4976-a17f-fe2dec77cbbc" />

### 6.5 AWS Backup & Restore

```text
Backup plan: w5-agri-backup-plan
BackupPlanId: 4160f2f5-feea-4bcf-bcc1-099da1a19c4b
Vault: w5-agri-vault
Schedule: cron(0 5 ? * * *) UTC
Retention: 7 days
```

**Backup selection:**

```text
Selection: w5-agri-assignment-1
Role: arn:aws:iam::945125812908:role/w5-agri-backup-role
Resources:
- DynamoDB: arn:aws:dynamodb:us-east-1:945125812908:table/w5-agri-documents
- EFS:      arn:aws:elasticfilesystem:us-east-1:945125812908:file-system/fs-080ead609f73953dc
- EBS:      arn:aws:ec2:us-east-1:945125812908:volume/vol-062f4a90c64f326ad
```

**Completed backup jobs:**

| Type | Resource | State |
|------|----------|-------|
| EFS | `fs-080ead609f73953dc` | `COMPLETED` |
| DynamoDB | `w5-agri-documents` | `COMPLETED` |
| EBS | `vol-062f4a90c64f326ad` | `COMPLETED` |

**Completed restore jobs:**

| Type | Created resource | Status |
|------|-----------------|--------|
| EFS | `fs-080ead609f73953dc` | `COMPLETED` |
| DynamoDB | `w5-agri-documents-restored` | `COMPLETED` |
| EBS | `vol-0fd869b80d5e5e095` | `COMPLETED` |

> **📸 Screenshot 6.5a:** AWS Backup plan và selection.

<img width="1111" height="320" alt="image" src="https://github.com/user-attachments/assets/0e181bf0-0e2d-480f-9f1f-9a1d64722fc0" />
<img width="885" height="371" alt="image" src="https://github.com/user-attachments/assets/4e97ddd6-8570-4e76-8704-19c9eba2f924" />
<img width="1010" height="306" alt="image" src="https://github.com/user-attachments/assets/a276fcbb-ebcd-423a-8dc1-c1ada0c3a379" />
<img width="1312" height="413" alt="image" src="https://github.com/user-attachments/assets/4a238a65-2d69-4441-9879-c64664cd19ba" />
<img width="1110" height="322" alt="image" src="https://github.com/user-attachments/assets/e00cfee7-e6bb-4bfe-848c-6e89ec5f42f0" />

> **📸 Screenshot 6.5b:** Backup jobs `COMPLETED`.

<img width="1310" height="401" alt="image" src="https://github.com/user-attachments/assets/7e593282-226a-4c92-b996-e51c60af6d7a" />

> **📸 Screenshot 6.5c:** Restore jobs `COMPLETED`.

<img width="1163" height="307" alt="image" src="https://github.com/user-attachments/assets/93467087-394a-4800-ae8e-b5d0d4bb54a2" />

> **📸 Screenshot 6.5d:** Restored DynamoDB table `w5-agri-documents-restored`.

<img width="1283" height="542" alt="image" src="https://github.com/user-attachments/assets/8ef01f3a-15db-4bdb-8898-2fc1acac1589" />

---

## 7. MH4 — API Gateway + Auth + Throttling ★

### 7.1 Checklist

- [x] API Gateway route đã cấu hình
- [x] Lambda proxy integration đã cấu hình
- [x] API key-style auth được enforce trong Lambda
- [x] Stage throttling có rate và burst limits
- [x] Web app gọi API Gateway URL qua `/lambda-test`
- [x] Web app không invoke Lambda trực tiếp
- [x] Authenticated curl trả về `200`
- [x] Unauthenticated curl trả về `403`

### 7.2 Note thiết kế Auth

> Endpoint hiện tại dùng **API Gateway HTTP API với stage throttling**. Auth được enforce bên trong Lambda bằng cách check header `x-api-key` so với env var `EXPECTED_API_KEY`.
>
> Nếu trainer/customer yêu cầu **REST API Usage Plan** native, migrate endpoint sang REST API — code Lambda không cần thay đổi vì proxy integration giữ nguyên event shape.

### 7.3 API Route & Stage

```text
API name: w5-agri-api
API ID: 6w3fgcbsx6
Protocol: HTTP API
Stage: prod
Route: POST /validate
Endpoint: https://6w3fgcbsx6.execute-api.us-east-1.amazonaws.com/prod/validate
```

**Stage throttling:**

```text
ThrottlingRateLimit: 2.0 requests/second
ThrottlingBurstLimit: 5
```

**Lambda:**

```text
Function: w5-agri-validation
Runtime: python3.12
Handler: lambda_function.lambda_handler
Env: EXPECTED_API_KEY=w5-agri-demo-key-123
```

> **📸 Screenshot 7.3a:** API Gateway `w5-agri-api`, route `POST /validate`.

<img width="1647" height="530" alt="image" src="https://github.com/user-attachments/assets/6e14fd2a-67a6-4e31-ab10-dc281c99a6b0" />

> **📸 Screenshot 7.3b:** Stage `prod`, throttling rate `2`, burst `5`.

<img width="849" height="144" alt="image" src="https://github.com/user-attachments/assets/a81e79ce-5782-49af-8a1b-c07786fb819e" />

> **📸 Screenshot 7.3c:** Lambda env var `EXPECTED_API_KEY` hoặc code snippet check `x-api-key`.

<img width="898" height="211" alt="image" src="https://github.com/user-attachments/assets/2c787c28-5ca6-4692-91bd-7cba206912b4" />

### 7.4 Authenticated Test

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

> **📸 Screenshot 7.4:** Curl/Postman `200` với `x-api-key`.

<img width="808" height="271" alt="image" src="https://github.com/user-attachments/assets/52d6f012-c727-4f54-a5f6-5d7951b61248" />

### 7.5 Unauthenticated Test

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

> **📸 Screenshot 7.5:** Curl/Postman `403` không có `x-api-key`.

<img width="638" height="246" alt="image" src="https://github.com/user-attachments/assets/0b89d438-b9bb-40df-a226-0ec8563141ac" />

> **📸 Screenshot 7.6:** Web app Validation Center page (gọi qua API Gateway).

<img width="1888" height="886" alt="image" src="https://github.com/user-attachments/assets/08ea4ef0-940e-4f2f-a2fb-91295b8b4ad5" />

---

## 8. MH5 — Serverless Scaling Pattern ★

### 8.1 Checklist

- [x] S3 event-triggered pipeline cấu hình trên cùng Lambda của MH4
- [x] S3 bucket `w5-agri-doc-events` đã tạo
- [x] S3 Event Notification: `ObjectCreated:*` → Lambda `w5-agri-validation`
- [x] Prefix filter: `uploads/`
- [x] Lambda handle cả API Gateway events và S3 events
- [x] Test object đã upload: `uploads/s3-test-1779952164.txt`
- [x] Lambda invocation từ S3 event đã ghi nhận trong CloudWatch Logs
- [x] Lambda ghi metadata S3 event vào DynamoDB
- [x] DynamoDB item verified với `source=s3-event`, `bucket`, `key`, `eventTime`, `validationStatus=processed`

### 8.2 Lý do thiết kế

> Đây là **event-driven scaling pattern**: S3 PutObject events invoke Lambda **asynchronously**. Document ingestion được decouple khỏi web app — nếu web app down, document upload trực tiếp lên S3 vẫn được process. Lambda ghi metadata vào DynamoDB với `source=s3-event` để phân biệt với web upload (`source=web-upload`).

### 8.3 S3 Notification Config

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

**Lambda invoke permission:**

```text
Sid: s3-invoke-w5
Principal: s3.amazonaws.com
Action: lambda:InvokeFunction
SourceArn: arn:aws:s3:::w5-agri-doc-events
SourceAccount: 945125812908
```

> **📸 Screenshot 8.3a:** S3 bucket `w5-agri-doc-events`.

<img width="868" height="367" alt="image" src="https://github.com/user-attachments/assets/cfb7812c-bfb7-4313-827a-523f5aa00a3d" />

> **📸 Screenshot 8.3b:** S3 event notification hiển thị `ObjectCreated:*`, Lambda ARN, prefix `uploads/`.

<img width="1214" height="177" alt="image" src="https://github.com/user-attachments/assets/8b95032d-928a-481a-af7b-38ec8caded56" />

> **📸 Screenshot 8.3c:** Lambda permissions tab hiển thị S3 invoke permission.

<img width="963" height="261" alt="image" src="https://github.com/user-attachments/assets/2ffaec98-52ad-44c3-a071-c21599c4661b" />

### 8.4 End-to-End Test

**Upload:**

```bash
printf 'S3 event test document\n' > /tmp/s3-test.txt
aws s3 cp /tmp/s3-test.txt \
  s3://w5-agri-doc-events/uploads/s3-test-1779952164.txt \
  --region us-east-1
```

**DynamoDB result:**

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

**CloudWatch Logs:**

```text
START RequestId: ad5d84fd-315a-406a-8d20-98a10d8e2266 Version: $LATEST
END RequestId: ad5d84fd-315a-406a-8d20-98a10d8e2266
REPORT RequestId: ad5d84fd-315a-406a-8d20-98a10d8e2266 Duration: 303.67 ms
```

> **📸 Screenshot 8.4a:** S3 object dưới `uploads/s3-test-1779952164.txt`.

<img width="991" height="276" alt="image" src="https://github.com/user-attachments/assets/a94cb628-4652-43c4-8247-2ff754739cf1" />

> **📸 Screenshot 8.4b:** Lambda CloudWatch Logs sau khi S3 upload.

<img width="1467" height="382" alt="image" src="https://github.com/user-attachments/assets/71250eae-576c-44d4-9bcd-8a335fa8b814" />

> **📸 Screenshot 8.4c:** DynamoDB item với `source=s3-event` và `validationStatus=processed`.

<img width="1253" height="278" alt="image" src="https://github.com/user-attachments/assets/8a0489d8-656f-42c4-8da8-0e26bd316419" />

---

## 9. Application Carry-Forward Verification

### 9.1 Checklist

- [x] Agri Compliance Dashboard hoạt động qua ALB URL
- [x] `/health` hoạt động
- [x] Upload Agricultural Document hoạt động
- [x] Document Repository hoạt động
- [x] Validation Service hoạt động qua API Gateway

### 9.2 ALB và ECS

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

### 9.3 Verified Routes

| Route | Mục đích | Status |
|-------|---------|--------|
| `GET /` | Dashboard | 200 |
| `GET /health` | Health JSON | 200 |
| `GET /upload` / `/upload-form` | Upload form | 200 |
| `POST /upload` | Upload lên EFS + metadata vào DynamoDB | Implemented |
| `GET /documents` | Repository | 200 |
| `GET /files` | Compatibility alias | Implemented |
| `GET /files/:name` | File read compatibility route | Implemented |
| `GET/POST /lambda-test` | Validation Center | Implemented |

> **📸 Screenshot 9.3:** Cần chụp các trang Dashboard, Upload, Upload success, Repository (với badge `Pending` và `Processed`), Validation Center, System Status, ECS service 2 desired/2 running, ALB target group healthy.

---

## 10. Negative Security Tests ★

### 10.1 Checklist

- [x] Firewall blocked request xuất hiện trong Alert Logs
- [x] API Gateway request không có API key trả về `403`

### 10.2 Note

> Negative API test chứng minh **missing `x-api-key` bị reject**. Network Firewall alert logs chứng minh **non-allowlisted outbound traffic bị drop**.

### 10.3 API Negative Test

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

### 10.4 Firewall Negative Test Evidence

**CloudWatch log group:** `/aws/network-firewall/alerts`

**Sample observed:**

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

> **📸 Screenshot 10.4:** Cần chụp Curl/Postman `403` và CloudWatch Network Firewall alert log với `drop`.

---

## 11. Bonus

### 11.1 Checklist

- [x] CI/CD pipeline deploy ECS app và Lambda từ GitHub Actions
- [x] Production UI được redesign thành Agri Compliance Portal business-facing
- [x] UI map `validationStatus=processed` từ S3 events thành badge `Processed`

### 11.2 GitHub Actions Workflow

> Workflow `.github/workflows/deploy.yml` build `./app`, push lên ECR `w5-agri-app`, update ECS service `w5-agri-service`, và deploy Lambda `w5-agri-validation`.

**Recent commits:**

```text
1ea4d88 Redesign W5 portal UI
67927cb Map processed documents as completed
ae2c1b0 Update W5 evidence pack
```

> **📸 Screenshot 11.2:** Cần chụp GitHub Actions run thành công và ECS task definition image tag từ commit mới nhất.

---

## 12. Lessons Learned

### 12.1 Điều gì đã làm tốt

**1. 4-tier subnet design ngay từ đầu (public + private-app + private-data + firewall).**
Việc tách private-app khỏi private-data + có riêng firewall subnet giúp Network Firewall + EFS mount targets được isolate đúng nguyên tắc. Khi cần thêm RDS/Aurora sau này, chỉ cần dùng lại private-data subnets, không phải tái thiết kế VPC.

**2. Một Lambda function xử lý cả 2 event source (API Gateway + S3).**
Lambda `w5-agri-validation` handle cả API Gateway event (`x-api-key` auth) và S3 ObjectCreated event (ingest vào DynamoDB). Chỉ cần check `event.Records` để biết là S3 event hay API request. Đỡ phải maintain 2 codebase riêng cho 2 trigger.

**3. AWS Backup plan cover cả 3 resource types (EFS + DynamoDB + EBS) trong 1 plan.**
Cùng schedule, cùng vault, cùng retention. Khi audit hỏi "data backup policy của các bạn là gì?", chỉ cần show 1 plan.

### 12.2 Điều gì sẽ làm khác đi

**1. Setup Network Firewall trước, configure ECS sau.**
Khi triển khai theo thứ tự ngược (ECS trước, NFW sau), egress traffic của ECS task ban đầu đi thẳng ra NAT Gateway. Sau khi thêm NFW vào route table, một số dependency (NPM install, Docker pull) bị block tạm thời vì allowlist chưa đầy đủ. Lần sau: dựng NFW + allowlist trước, sau đó mới deploy ECS — debug dễ hơn.

**2. Tighten ECS Security Group ngay từ đầu.**
Hiện tại ECS SG cho phép TCP 3000 từ `0.0.0.0/0`. Mặc dù tasks ở private subnet không có public IP nên thực tế không truy cập trực tiếp được, đây vẫn là vi phạm least-privilege. Lần sau: ECS SG source phải là ALB SG only, ngay từ deployment đầu tiên.

**3. Migrate sang REST API Usage Plan nếu workflow yêu cầu native API key management.**
Hiện tại auth được implement trong Lambda (check header `x-api-key`). Cách này đơn giản nhưng không có native key rotation, per-key throttling, hay quota tracking. Production-ready solution: REST API + Usage Plan + API key resource. Code Lambda không cần thay đổi nhờ proxy integration.

### 12.3 Điều gì gây bất ngờ

**1. Network Firewall pricing tăng nhanh hơn dự kiến.**
NFW tính phí cả endpoint hour (~$0.395/hr × 2 endpoints = ~$19/ngày) lẫn data processed ($0.065/GB). Với một dev account demo, NFW chiếm phần lớn cost. Bài học: NFW chỉ nên enable cho production hoặc môi trường có compliance requirement, không phải mọi dev environment.

**2. EFS Access Point đơn giản hóa POSIX permission rất nhiều.**
Ban đầu định để ECS task chạy as root để ghi file lên EFS root, nhưng Access Point cho phép enforce POSIX user `1000:1000` và chỉ expose `/uploads` ra ngoài. Container chỉ thấy directory `/uploads`, không thấy phần khác của filesystem. Tốt hơn nhiều so với mount toàn bộ EFS root.

**3. S3 Event Notification với prefix filter `uploads/` hoạt động chính xác như mong đợi.**
Khi upload file lên `s3://w5-agri-doc-events/something-else/file.txt` (không có prefix `uploads/`), Lambda **không bị invoke**. Khi upload lên `uploads/`, Lambda invoke ngay lập tức (~300ms cold start). Prefix filter là cách lọc event hiệu quả mà không cần code logic check trong Lambda.

### 12.4 Concrete Failure Case

> **Network Firewall block NPM install khi ECS task lần đầu start trên image mới.**
>
> **Vấn đề:** Khi push image mới lên ECR và ECS service restart, container bị stuck ở entrypoint vì `npm install` (chạy trong runtime, không phải build time) cố gắng kết nối `registry.npmjs.org`. Allowlist ban đầu chỉ có `*.npmjs.org` nhưng request thực tế đi qua `registry.npmjs.org` qua redirect CDN — host header không match.
>
> **Cách sửa tạm thời:** Thêm `*.cloudfront.net` và `*.npmjs.com` vào allowlist (thấy trong Network Firewall alert logs để biết domain nào bị drop).
>
> **Cách sửa triệt để:** Move `npm install` vào Dockerfile build stage thay vì runtime — image build ở GitHub Actions runner (không qua NFW), runtime container chỉ chạy app đã có sẵn `node_modules`. Vừa giảm cold start time, vừa loại bỏ runtime dependency lên npm registry.

---

## 13. Final Screenshot Checklist

> **Checklist tổng hợp tất cả screenshot cần có trong evidence pack:**

- [ ] Live dashboard trên ALB URL
- [ ] `/health` trả về `200 OK`
- [ ] Upload form và upload success
- [ ] Repository table với badge `Pending` và `Processed`
- [ ] VPC `w5-agri-vpc` details
- [ ] Subnet list hiển thị public/private-app/private-data/firewall subnets
- [ ] Route tables: public, private-app A/B, firewall A/B
- [ ] VPC Flow Logs status và CloudWatch sample
- [ ] Network Firewall status `READY`
- [ ] Network Firewall policy và stateful rule group
- [ ] Network Firewall alert log hiển thị `drop`
- [ ] EFS filesystem details, mount targets, access point
- [ ] ECS task definition EFS mount
- [ ] DynamoDB table và sample metadata item
- [ ] AWS Backup plan, vault, backup jobs, restore jobs
- [ ] API Gateway route và stage throttling
- [ ] Curl/Postman `200` với API key
- [ ] Curl/Postman `403` không có API key
- [ ] S3 notification config với prefix `uploads/`
- [ ] Lambda permission hiển thị S3 có thể invoke
- [ ] S3 object dưới `uploads/`
- [ ] Lambda CloudWatch log sau khi S3 upload
- [ ] DynamoDB item với `source=s3-event`
- [ ] GitHub Actions deploy thành công

---
